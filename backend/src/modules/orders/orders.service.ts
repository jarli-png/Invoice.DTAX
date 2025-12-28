import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomersService } from '../customers/customers.service';
import { OrganizationsService } from '../organizations/organizations.service';
import * as crypto from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
    private customersService: CustomersService,
    private organizationsService: OrganizationsService,
  ) {}

  async validateRequest(apiKey: string, signature: string, timestamp: string, body: string): Promise<boolean> {
    // Sjekk timestamp (maks 5 min gammel)
    const ts = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - ts) > 5 * 60 * 1000) {
      throw new UnauthorizedException('Request expired');
    }

    // Finn API-nøkkel
    const key = await this.prisma.apiKey.findFirst({
      where: { keyHash: { contains: apiKey.substring(0, 10) }, isActive: true },
    });

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Valider signatur
    const data = `${timestamp}.${body}`;
    const expectedSignature = crypto.createHmac('sha256', key.secret).update(data).digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Oppdater lastUsedAt
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }

  async processOrder(data: any) {
    const { source, sourceOrderId, customer, lines, organizationId, issueDate, dueDays, attachments } = data;

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
    }

    // Finn organisasjon (default hvis ikke spesifisert)
    let organization;
    if (organizationId) {
      organization = await this.organizationsService.findOne(organizationId);
    } else if (source === 'tax.salestext.no') {
      organization = await this.organizationsService.findDefault();
    }

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    // Beregn forfallsdato
    const issue = issueDate ? new Date(issueDate) : new Date();
    const dueDate = new Date(issue);
    dueDate.setDate(dueDate.getDate() + (dueDays || 14));

    // Opprett faktura
    const invoice = await this.invoicesService.create({
      organizationId: organization.id,
      customerId: dbCustomer.id,
      issueDate: issue,
      dueDate,
      source,
      sourceOrderId,
      lines: lines.map((line: any) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate || 0.25,
        productId: line.productId,
      })),
    });

    // Logg hendelsen
    await this.prisma.auditEvent.create({
      data: {
        action: 'ORDER_RECEIVED',
        entityType: 'Invoice',
        entityId: invoice.id,
        invoiceId: invoice.id,
        data: { source, sourceOrderId },
      },
    });

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      kid: invoice.kid,
    };
  }

  async getOrderStatus(sourceOrderId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { sourceOrderId },
      include: { payments: true },
    });

    if (!invoice) return null;

    const totalPaid = invoice.payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      sourceOrderId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      paidAmount: totalPaid,
      remainingAmount: invoice.totalAmount - totalPaid,
      dueDate: invoice.dueDate,
      kid: invoice.kid,
    };
  }
}
