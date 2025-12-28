import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.payment.findMany({
      include: { invoice: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByInvoice(invoiceId: string) {
    return this.prisma.payment.findMany({ where: { invoiceId } });
  }

  async registerPayment(data: { invoiceId: string; amount: number; method: any; providerRef?: string }) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        provider: data.method === 'BANK_TRANSFER' ? 'Bank' : data.method,
        providerRef: data.providerRef,
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    // Oppdater fakturastatus
    await this.updateInvoiceStatus(data.invoiceId);

    return payment;
  }

  async handleStripeWebhook(event: any) {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata?.invoiceId;
      
      if (invoiceId) {
        await this.registerPayment({
          invoiceId,
          amount: paymentIntent.amount / 100,
          method: 'CARD',
          providerRef: paymentIntent.id,
        });
      }
    }
    return { received: true };
  }

  async handleVippsWebhook(event: any) {
    if (event.transactionInfo?.status === 'CAPTURED') {
      const invoiceId = event.reference;
      
      if (invoiceId) {
        await this.registerPayment({
          invoiceId,
          amount: event.transactionInfo.amount / 100,
          method: 'VIPPS',
          providerRef: event.transactionInfo.transactionId,
        });
      }
    }
    return { received: true };
  }

  private async updateInvoiceStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) return;

    const totalPaid = invoice.payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    let status = invoice.status;
    if (totalPaid >= invoice.totalAmount) {
      status = 'PAID';
    } else if (totalPaid > 0) {
      status = 'PARTIALLY_PAID';
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }
}
