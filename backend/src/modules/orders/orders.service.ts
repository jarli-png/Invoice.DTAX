import { Injectable, UnauthorizedException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomersService } from '../customers/customers.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CallbackService } from '../integrations/callback.service';
import { ReceiveOrderDto, OrderReceiveResponseDto, OrderStatusResponseDto } from '../../common/dto/order-receive.dto';
import * as crypto from 'crypto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
    private customersService: CustomersService,
    private organizationsService: OrganizationsService,
    private callbackService: CallbackService,
  ) {}

  /**
   * Validerer API-forespørsel med HMAC-signatur
   */
  async validateRequest(
    apiKey: string, 
    signature: string, 
    timestamp: string, 
    body: string
  ): Promise<boolean> {
    // Sjekk at alle påkrevde headers er tilstede
    if (!signature || !timestamp) {
      throw new UnauthorizedException('Mangler X-Signature eller X-Timestamp header');
    }

    // Sjekk timestamp (maks 5 min gammel for å forhindre replay-angrep)
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(ts) || Math.abs(now - ts) > 5 * 60) {
      throw new UnauthorizedException('Request utløpt eller ugyldig timestamp');
    }

    // Finn API-nøkkel i databasen
    const key = await this.prisma.apiKey.findFirst({
      where: { 
        keyHash: apiKey,
        isActive: true,
      },
    });

    if (!key) {
      this.logger.warn(`Ugyldig API-nøkkel: ${apiKey.substring(0, 10)}...`);
      throw new UnauthorizedException('Ugyldig API-nøkkel');
    }

    // Valider HMAC-signatur
    // Format: HMAC-SHA256(timestamp + "." + body, secret)
    const signatureData = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', key.secret)
      .update(signatureData)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn(`Ugyldig signatur for API-nøkkel ${key.name}`);
      throw new UnauthorizedException('Ugyldig signatur');
    }

    // Oppdater lastUsedAt
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }

  /**
   * Enkel API-nøkkel validering (uten signatur, for GET-forespørsler)
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    const key = await this.prisma.apiKey.findFirst({
      where: { 
        keyHash: apiKey,
        isActive: true,
      },
    });

    if (!key) {
      throw new UnauthorizedException('Ugyldig API-nøkkel');
    }

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }

  /**
   * Prosesserer en innkommende ordre og oppretter faktura
   */
  async processOrder(data: ReceiveOrderDto): Promise<OrderReceiveResponseDto> {
    const { 
      source, 
      sourceOrderId, 
      customer, 
      lines, 
      organizationId, 
      issueDate, 
      dueDays,
      currency,
      notes,
      callbackUrl,
      attachments,
      autoSend,
      preferredPaymentMethod,
      internalReference,
      metadata,
    } = data;

    // Sjekk om ordren allerede finnes
    const existing = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
    });
    if (existing) {
      throw new ConflictException(`Ordre ${sourceOrderId} er allerede prosessert som faktura ${existing.invoiceNumber}`);
    }

    // Finn eller opprett kunde
    let dbCustomer = await this.customersService.findByEmail(customer.email);
    if (!dbCustomer) {
      dbCustomer = await this.customersService.create({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        postalCode: customer.postalCode,
        city: customer.city,
        country: customer.country || 'NO',
        orgNumber: customer.orgNumber,
      });
      this.logger.log(`Ny kunde opprettet: ${dbCustomer.name} (${dbCustomer.id})`);
    } else {
      // Oppdater kundeinfo hvis ny data
      await this.customersService.update(dbCustomer.id, {
        name: customer.name,
        phone: customer.phone || dbCustomer.phone,
        address: customer.address || dbCustomer.address,
        postalCode: customer.postalCode || dbCustomer.postalCode,
        city: customer.city || dbCustomer.city,
        orgNumber: customer.orgNumber || dbCustomer.orgNumber,
      });
    }

    // Finn organisasjon
    let organization;
    if (organizationId) {
      organization = await this.organizationsService.findOne(organizationId);
    } else {
      // Bruk default organisasjon
      organization = await this.organizationsService.findDefault();
    }

    if (!organization) {
      throw new BadRequestException('Ingen organisasjon funnet. Opprett en organisasjon først.');
    }

    // Beregn datoer
    const issue = issueDate ? new Date(issueDate) : new Date();
    const dueDate = new Date(issue);
    dueDate.setDate(dueDate.getDate() + (dueDays || 14));

    // Generer KID-nummer
    const kid = await this.generateKID(dbCustomer.customerNumber || 0, sourceOrderId);

    // Opprett faktura
    const invoice = await this.invoicesService.create({
      organizationId: organization.id,
      customerId: dbCustomer.id,
      issueDate: issue,
      dueDate,
      currency: currency || 'NOK',
      notes: notes || undefined,
      source,
      sourceOrderId,
      kid,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate ?? 0.25,
        unit: line.unit,
        productCode: line.productCode,
      })),
    });

    // Lagre metadata og callback-URL
    if (callbackUrl || metadata || internalReference) {
      await this.prisma.taxOrder.create({
        data: {
          externalOrderId: sourceOrderId,
          userId: dbCustomer.id,
          userEmail: customer.email,
          userName: customer.name,
          taxBenefitAmount: 0,
          totalTaxBenefit: 0,
          commissionAmount: invoice.totalAmount,
          invoiceId: invoice.id,
          metadata: {
            callbackUrl,
            internalReference,
            preferredPaymentMethod,
            ...metadata,
          },
        },
      });
    }

    // Håndter vedlegg
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await this.prisma.attachment.create({
          data: {
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            mimeType: att.mimeType,
            invoiceId: invoice.id,
          },
        });
      }
    }

    // Logg hendelsen
    await this.prisma.auditEvent.create({
      data: {
        action: 'ORDER_RECEIVED',
        entityType: 'Invoice',
        entityId: invoice.id,
        invoiceId: invoice.id,
        data: { 
          source, 
          sourceOrderId,
          customerEmail: customer.email,
          totalAmount: invoice.totalAmount,
          autoSend,
        },
      },
    });

    // Send callback om at faktura er opprettet
    await this.callbackService.sendInvoiceCreated({
      ...invoice,
      customer: dbCustomer,
      sourceOrderId,
    });

    // Auto-send hvis spesifisert
    if (autoSend) {
      await this.sendInvoice(sourceOrderId);
    }

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      vatAmount: invoice.vatAmount,
      dueDate: dueDate.toISOString(),
      kid,
      message: autoSend ? 'Faktura opprettet og sendt' : 'Faktura opprettet som kladd',
    };
  }

  /**
   * Henter ordrestatus
   */
  async getOrderStatus(sourceOrderId: string): Promise<OrderStatusResponseDto | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
      include: { 
        payments: true,
        customer: true,
      },
    });

    if (!invoice) return null;

    const completedPayments = invoice.payments.filter(p => p.status === 'COMPLETED');
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      sourceOrderId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      vatAmount: invoice.vatAmount,
      paidAmount: totalPaid,
      remainingAmount: invoice.totalAmount - totalPaid,
      dueDate: invoice.dueDate.toISOString(),
      kid: invoice.kid || undefined,
      createdAt: invoice.createdAt.toISOString(),
      sentAt: invoice.status !== 'DRAFT' ? invoice.updatedAt.toISOString() : undefined,
      paidAt: invoice.status === 'PAID' ? completedPayments[0]?.paidAt?.toISOString() : undefined,
      payments: completedPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt?.toISOString(),
      })),
    };
  }

  /**
   * Lister ordrer med filtrering
   */
  async listOrders(filters: {
    source?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit: number;
  }) {
    const where: any = {};

    if (filters.source) {
      where.source = filters.source;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      take: filters.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        sourceOrderId: true,
        source: true,
        status: true,
        totalAmount: true,
        dueDate: true,
        createdAt: true,
        customer: {
          select: { name: true, email: true },
        },
      },
    });

    return {
      orders: invoices.map(inv => ({
        sourceOrderId: inv.sourceOrderId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        source: inv.source,
        status: inv.status,
        totalAmount: inv.totalAmount,
        dueDate: inv.dueDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        customerName: inv.customer.name,
        customerEmail: inv.customer.email,
      })),
      count: invoices.length,
    };
  }

  /**
   * Henter detaljert fakturainformasjon
   */
  async getInvoiceDetails(sourceOrderId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
      include: {
        customer: true,
        organization: true,
        lines: true,
        payments: true,
        attachments: true,
        emailLogs: { orderBy: { sentAt: 'desc' }, take: 5 },
      },
    });

    if (!invoice) return null;

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        subtotal: invoice.subtotal,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        kid: invoice.kid,
        notes: invoice.notes,
        pdfUrl: invoice.pdfUrl,
      },
      customer: {
        id: invoice.customer.id,
        name: invoice.customer.name,
        email: invoice.customer.email,
        orgNumber: invoice.customer.orgNumber,
        address: invoice.customer.address,
        postalCode: invoice.customer.postalCode,
        city: invoice.customer.city,
      },
      organization: {
        name: invoice.organization.name,
        orgNumber: invoice.organization.orgNumber,
        bankAccount: invoice.organization.bankAccount,
      },
      lines: invoice.lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        amount: l.amount,
      })),
      payments: invoice.payments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt?.toISOString(),
      })),
      emailHistory: invoice.emailLogs.map(e => ({
        recipient: e.recipient,
        status: e.status,
        sentAt: e.sentAt.toISOString(),
      })),
    };
  }

  /**
   * Kansellerer en ordre
   */
  async cancelOrder(sourceOrderId: string, reason?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new BadRequestException(`Ordre ${sourceOrderId} ikke funnet`);
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Kan ikke kansellere en betalt faktura. Opprett kreditnota i stedet.');
    }

    if (invoice.status === 'DRAFT') {
      // Slett kladden
      await this.prisma.invoice.delete({
        where: { id: invoice.id },
      });

      return { 
        success: true, 
        message: 'Fakturakladd slettet',
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    // Opprett kreditnota for sendte fakturaer
    const creditNote = await this.invoicesService.createCreditNote(invoice.id);

    return {
      success: true,
      message: 'Faktura kreditert',
      invoiceNumber: invoice.invoiceNumber,
      creditNoteNumber: creditNote.invoiceNumber,
      creditNoteId: creditNote.id,
      reason,
    };
  }

  /**
   * Oppdaterer en ordres faktura (kun kladder)
   */
  async updateOrder(sourceOrderId: string, updates: Partial<ReceiveOrderDto>) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
    });

    if (!invoice) {
      throw new BadRequestException(`Ordre ${sourceOrderId} ikke funnet`);
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Kan kun oppdatere fakturaer som er kladd');
    }

    // Oppdater faktura direkte via Prisma
    const updateData: any = {};
    if (updates.notes) updateData.notes = updates.notes;
    if (updates.dueDays) {
      updateData.dueDate = new Date(invoice.issueDate.getTime() + updates.dueDays * 24 * 60 * 60 * 1000);
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: updateData,
    });

    return {
      success: true,
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      message: 'Faktura oppdatert',
    };
  }

  /**
   * Sender en faktura
   */
  async sendInvoice(sourceOrderId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new BadRequestException(`Ordre ${sourceOrderId} ikke funnet`);
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Fakturaen er allerede sendt');
    }

    // Send faktura via InvoicesService
    await this.invoicesService.send(invoice.id);

    // Send callback
    await this.callbackService.sendInvoiceSent(
      { ...invoice, sourceOrderId },
      'email'
    );

    return {
      success: true,
      invoiceNumber: invoice.invoiceNumber,
      sentTo: invoice.customer.email,
      message: 'Faktura sendt',
    };
  }

  /**
   * Genererer KID-nummer (MOD10)
   */
  private async generateKID(customerNumber: number, sourceOrderId: string): Promise<string> {
    // Format: [5-sifret kundenr][unikt løpenummer]
    const custPart = customerNumber.toString().padStart(5, '0');
    
    // Bruk hash av sourceOrderId for å lage et unikt nummer
    const hash = crypto.createHash('md5').update(sourceOrderId).digest('hex');
    const numericPart = parseInt(hash.substring(0, 8), 16).toString().substring(0, 10).padStart(10, '0');
    
    const base = custPart + numericPart;
    const checkDigit = this.calculateMod10(base);
    
    return base + checkDigit;
  }

  /**
   * Beregner MOD10 kontrollsiffer (Luhn-algoritme)
   */
  private calculateMod10(input: string): string {
    let sum = 0;
    let alternate = false;
    
    for (let i = input.length - 1; i >= 0; i--) {
      let n = parseInt(input[i], 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    
    return ((10 - (sum % 10)) % 10).toString();
  }
}
