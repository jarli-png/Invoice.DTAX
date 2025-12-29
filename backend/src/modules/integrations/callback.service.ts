import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookEvent, WebhookEventType } from '../../common/dto/webhook-events.dto';
import * as crypto from 'crypto';

@Injectable()
export class CallbackService {
  private readonly logger = new Logger(CallbackService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Sender en webhook-hendelse til registrerte mottakere
   */
  async sendWebhook(
    sourceOrderId: string,
    event: WebhookEventType,
    invoiceId: string,
    data: any,
  ): Promise<void> {
    // Finn fakturaen for å hente callback-URL og annen info
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      this.logger.warn(`Faktura ${invoiceId} ikke funnet for webhook`);
      return;
    }

    // Sjekk om det finnes en TaxOrder med callback-URL
    const taxOrder = await this.prisma.taxOrder.findFirst({
      where: { invoiceId },
    });

    // Hent callback-URL fra metadata eller taxOrder
    let callbackUrl: string | null = null;
    if (invoice.source && invoice.sourceOrderId) {
      // Finn webhook-endpoint basert på kilde
      const webhookEndpoint = await this.prisma.webhookEndpoint.findFirst({
        where: { 
          name: { contains: invoice.source },
          isActive: true,
          events: { has: event },
        },
      });
      if (webhookEndpoint) {
        callbackUrl = webhookEndpoint.url;
      }
    }

    // Fallback: Sjekk for metadata med callbackUrl
    const metadata = taxOrder?.metadata as any;
    if (!callbackUrl && metadata?.callbackUrl) {
      callbackUrl = metadata.callbackUrl;
    }

    if (!callbackUrl) {
      this.logger.debug(`Ingen callback-URL for faktura ${invoiceId}`);
      return;
    }

    // Bygg webhook-payload
    const payload: WebhookEvent = {
      eventId: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      sourceOrderId: invoice.sourceOrderId || sourceOrderId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      data,
    } as WebhookEvent;

    // Lagre i WebhookOutgoing for sporing og retry
    await this.prisma.webhookOutgoing.create({
      data: {
        targetUrl: callbackUrl,
        event,
        payload: payload as any,
        status: 'PENDING',
      },
    });

    // Send asynkront (ikke blokker hovedflyten)
    this.sendWebhookAsync(callbackUrl, payload);
  }

  /**
   * Sender webhook asynkront med retry-logikk
   */
  private async sendWebhookAsync(url: string, payload: WebhookEvent): Promise<void> {
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 sekund

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Finn webhook-endpoint for å hente secret
        const endpoint = await this.prisma.webhookEndpoint.findFirst({
          where: { url },
        });

        // Generer signatur
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payloadString = JSON.stringify(payload);
        const signatureData = `${timestamp}.${payloadString}`;
        const signature = endpoint?.secret 
          ? crypto.createHmac('sha256', endpoint.secret).update(signatureData).digest('hex')
          : '';

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': payload.event,
            'X-Webhook-Timestamp': timestamp,
            'X-Webhook-Signature': signature,
            'X-Webhook-Id': payload.eventId,
          },
          body: payloadString,
          signal: AbortSignal.timeout(10000), // 10 sekunder timeout
        });

        if (response.ok) {
          // Oppdater status i database
          await this.prisma.webhookOutgoing.updateMany({
            where: { 
              payload: { path: ['eventId'], equals: payload.eventId } 
            },
            data: { 
              status: 'SENT',
              sentAt: new Date(),
              attempts: attempt,
            },
          });
          this.logger.log(`Webhook sendt til ${url} for event ${payload.event}`);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        this.logger.warn(`Webhook-forsøk ${attempt}/${maxAttempts} feilet: ${error.message}`);
        
        // Oppdater feilstatus
        await this.prisma.webhookOutgoing.updateMany({
          where: { 
            payload: { path: ['eventId'], equals: payload.eventId } 
          },
          data: { 
            status: attempt === maxAttempts ? 'FAILED' : 'RETRYING',
            lastError: error.message,
            attempts: attempt,
          },
        });

        if (attempt < maxAttempts) {
          // Eksponentiell backoff
          await this.delay(baseDelay * Math.pow(2, attempt - 1));
        }
      }
    }
  }

  /**
   * Sender spesifikke events
   */
  async sendInvoiceCreated(invoice: any): Promise<void> {
    await this.sendWebhook(
      invoice.sourceOrderId,
      WebhookEventType.INVOICE_CREATED,
      invoice.id,
      {
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        vatAmount: invoice.vatAmount,
        dueDate: invoice.dueDate.toISOString(),
        currency: invoice.currency,
        kid: invoice.kid,
        customerName: invoice.customer?.name,
        customerEmail: invoice.customer?.email,
      },
    );
  }

  async sendInvoiceSent(invoice: any, method: 'email' | 'paper' | 'ehf'): Promise<void> {
    await this.sendWebhook(
      invoice.sourceOrderId,
      WebhookEventType.INVOICE_SENT,
      invoice.id,
      {
        status: invoice.status,
        sentAt: new Date().toISOString(),
        sentTo: invoice.customer?.email,
        method,
      },
    );
  }

  async sendInvoicePaid(invoice: any, payment: any): Promise<void> {
    await this.sendWebhook(
      invoice.sourceOrderId,
      WebhookEventType.INVOICE_PAID,
      invoice.id,
      {
        status: 'PAID',
        paidAt: payment.paidAt?.toISOString() || new Date().toISOString(),
        paidAmount: payment.amount,
        paymentMethod: payment.method,
        transactionId: payment.providerRef,
      },
    );
  }

  async sendPaymentPartial(invoice: any, payment: any, remainingAmount: number): Promise<void> {
    await this.sendWebhook(
      invoice.sourceOrderId,
      WebhookEventType.PAYMENT_PARTIAL,
      invoice.id,
      {
        status: 'PARTIALLY_PAID',
        paidAmount: payment.amount,
        remainingAmount,
        totalAmount: invoice.totalAmount,
        paymentMethod: payment.method,
        paidAt: payment.paidAt?.toISOString() || new Date().toISOString(),
      },
    );
  }

  async sendInvoiceOverdue(invoice: any): Promise<void> {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    await this.sendWebhook(
      invoice.sourceOrderId,
      WebhookEventType.INVOICE_OVERDUE,
      invoice.id,
      {
        status: 'OVERDUE',
        dueDate: invoice.dueDate.toISOString(),
        daysOverdue,
        totalAmount: invoice.totalAmount,
        remainingAmount: invoice.totalAmount - (invoice.paidAmount || 0),
      },
    );
  }

  async sendCreditNoteCreated(creditNote: any, originalInvoice: any, reason?: string): Promise<void> {
    await this.sendWebhook(
      originalInvoice.sourceOrderId,
      WebhookEventType.CREDIT_NOTE_CREATED,
      originalInvoice.id,
      {
        creditNoteNumber: creditNote.invoiceNumber,
        creditNoteId: creditNote.id,
        originalInvoiceNumber: originalInvoice.invoiceNumber,
        creditAmount: creditNote.totalAmount,
        reason,
      },
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manuell retry av feilede webhooks
   */
  async retryFailedWebhooks(): Promise<{ retried: number; failed: number }> {
    const failed = await this.prisma.webhookOutgoing.findMany({
      where: { status: 'FAILED' },
      take: 50,
    });

    let retried = 0;
    let stillFailed = 0;

    for (const webhook of failed) {
      try {
        await this.sendWebhookAsync(webhook.targetUrl, webhook.payload as any);
        retried++;
      } catch {
        stillFailed++;
      }
    }

    return { retried, failed: stillFailed };
  }
}
