import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { StorageService } from './storage.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private storageService: StorageService,
    @InjectQueue('invoices') private invoiceQueue: Queue,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async findAll(query?: { status?: string; customerId?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.customerId) where.customerId = query.customerId;
    return this.prisma.invoice.findMany({
      where,
      include: { customer: true, organization: true, lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, organization: true, lines: true, payments: true, emailLogs: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(data: any) {
    const { lines, ...invoiceData } = data;
    
    // Generate invoice number
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `${year}-` } },
    });
    const invoiceNumber = `${year}-${String(count + 1).padStart(6, '0')}`;
    
    // Calculate totals
    let subtotal = 0;
    let vatAmount = 0;
    const processedLines = lines.map((line: any) => {
      const amount = line.quantity * line.unitPrice;
      const vat = amount * (line.vatRate || 0.25);
      subtotal += amount;
      vatAmount += vat;
      return { ...line, amount };
    });
    
    // Generate KID
    const kid = this.generateKid(invoiceNumber);
    
    const invoice = await this.prisma.invoice.create({
      data: {
        ...invoiceData,
        invoiceNumber,
        kid,
        subtotal,
        vatAmount,
        totalAmount: subtotal + vatAmount,
        lines: { create: processedLines },
      },
      include: { customer: true, organization: true, lines: true },
    });

    // Generate PDF
    await this.generateAndStorePdf(invoice);

    return invoice;
  }

  async send(id: string) {
    const invoice = await this.findOne(id);
    await this.emailQueue.add('send-invoice', { invoiceId: id });
    await this.prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
    return { message: 'Invoice queued for sending' };
  }

  async createCreditNote(id: string) {
    const original = await this.findOne(id);
    
    const creditNote = await this.create({
      organizationId: original.organizationId,
      customerId: original.customerId,
      dueDate: new Date(),
      notes: `Kreditnota for faktura ${original.invoiceNumber}`,
      lines: original.lines.map(line => ({
        description: `Kreditering: ${line.description}`,
        quantity: -line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
      })),
    });

    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CREDITED', creditNoteId: creditNote.id },
    });

    return creditNote;
  }

  private generateKid(invoiceNumber: string): string {
    const base = invoiceNumber.replace(/-/g, '');
    const weights = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5];
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[base.length - 1 - i]) * weights[i % weights.length];
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit;
  }

  private async generateAndStorePdf(invoice: any) {
    const fullInvoice = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { customer: true, organization: true, lines: true },
    });
    const pdfBuffer = await this.pdfService.generate(fullInvoice);
    const key = `invoices/${invoice.id}/${invoice.invoiceNumber}.pdf`;
    const url = await this.storageService.upload(key, pdfBuffer, 'application/pdf');
    await this.prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: url } });
  }
}
