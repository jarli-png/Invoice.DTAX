/**
 * Tax.salestext.no Invoice Integration Client
 * 
 * Denne modulen håndterer integrasjon med invoice.dtax.no for automatisk fakturering.
 * 
 * Bruk:
 * const invoiceClient = new InvoiceClient();
 * await invoiceClient.createInvoiceFromTaxCalculation(orderData);
 */

import crypto from 'crypto';

// ============================================
// KONFIGURASJON - Oppdater med dine verdier
// ============================================

const CONFIG = {
  apiKey: 'tax_a352897dc2a328cb28d80ff307a130de',
  apiSecret: 'a517d8c43ddaa69942010f7b446363033df62dbd189e0142f721776596b5fdf5',
  baseUrl: 'https://invoice.dtax.no/api',
  source: 'tax.salestext.no',
  callbackUrl: 'https://tax.salestext.no/api/invoice-callback',
  defaultDueDays: 14,
  defaultVatRate: 0.25,
};

// ============================================
// TYPER
// ============================================

interface Customer {
  name: string;
  email: string;
  phone?: string;
  orgNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

interface OrderLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  unit?: string;
}

interface TaxCalculationOrder {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  userOrgNumber?: string;
  userAddress?: string;
  userPostalCode?: string;
  userCity?: string;
  taxYear: number;
  taxBenefitAmount: number;
  spouseTaxBenefit?: number;
  totalTaxBenefit: number;
  commissionRate: number;
  commissionAmount: number;
  calculationType: 'standard' | 'couples' | 'business';
}

interface InvoiceResponse {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  vatAmount: number;
  dueDate: string;
  kid?: string;
  message?: string;
}

interface OrderStatus {
  sourceOrderId: string;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  paidAt?: string;
}

interface WebhookEvent {
  eventId: string;
  event: string;
  timestamp: string;
  sourceOrderId: string;
  invoiceId: string;
  invoiceNumber: string;
  data: Record<string, any>;
}

// ============================================
// INVOICE CLIENT CLASS
// ============================================

export class InvoiceClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config?: Partial<typeof CONFIG>) {
    this.apiKey = config?.apiKey || CONFIG.apiKey;
    this.apiSecret = config?.apiSecret || CONFIG.apiSecret;
    this.baseUrl = config?.baseUrl || CONFIG.baseUrl;
  }

  /**
   * Genererer HMAC-SHA256 signatur for API-forespørsler
   */
  private generateSignature(body: any, timestamp: string): string {
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Sender en autentisert POST-forespørsel
   */
  private async post<T>(endpoint: string, body: any): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.generateSignature(body, timestamp);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error ${response.status}: ${error.message || JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Sender en autentisert GET-forespørsel
   */
  private async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error ${response.status}: ${error.message || JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Oppretter en faktura basert på en skatteberegningsordre
   * 
   * @param order - Skatteberegningsordre fra tax.salestext.no
   * @param options - Ekstra alternativer
   * @returns Fakturainformasjon
   */
  async createInvoiceFromTaxOrder(
    order: TaxCalculationOrder,
    options?: {
      autoSend?: boolean;
      customDueDays?: number;
      extraNotes?: string;
    }
  ): Promise<InvoiceResponse> {
    // Bygg beskrivelse basert på beregninstype
    const descriptions: Record<string, string> = {
      standard: `Skatteberegning for ${order.taxYear}`,
      couples: `Skatteberegning for ektefeller ${order.taxYear}`,
      business: `Skatteberegning næring ${order.taxYear}`,
    };

    const lines: OrderLine[] = [
      {
        description: descriptions[order.calculationType] || `Skatteberegning ${order.taxYear}`,
        quantity: 1,
        unitPrice: order.commissionAmount / 1.25, // Eks. MVA
        vatRate: CONFIG.defaultVatRate,
        unit: 'stk',
      },
    ];

    // Legg til ekstra linje for ektefelle hvis relevant
    if (order.spouseTaxBenefit && order.spouseTaxBenefit > 0) {
      const spouseCommission = order.spouseTaxBenefit * order.commissionRate;
      lines.push({
        description: `Skatteberegning ektefelle ${order.taxYear}`,
        quantity: 1,
        unitPrice: spouseCommission / 1.25,
        vatRate: CONFIG.defaultVatRate,
        unit: 'stk',
      });
    }

    const notes = [
      `Skattefordel: kr ${order.totalTaxBenefit.toLocaleString('nb-NO')}`,
      order.spouseTaxBenefit ? `Herav ektefelle: kr ${order.spouseTaxBenefit.toLocaleString('nb-NO')}` : null,
      `Provisjonssats: ${(order.commissionRate * 100).toFixed(0)}%`,
      options?.extraNotes,
    ].filter(Boolean).join('\n');

    const body = {
      source: CONFIG.source,
      sourceOrderId: order.id,
      customer: {
        name: order.userName,
        email: order.userEmail,
        phone: order.userPhone,
        orgNumber: order.userOrgNumber,
        address: order.userAddress,
        postalCode: order.userPostalCode,
        city: order.userCity,
        country: 'NO',
      },
      lines,
      dueDays: options?.customDueDays || CONFIG.defaultDueDays,
      currency: 'NOK',
      notes,
      callbackUrl: CONFIG.callbackUrl,
      autoSend: options?.autoSend ?? true,
      preferredPaymentMethod: 'BANK_TRANSFER',
      internalReference: `TAX-${order.taxYear}-${order.id}`,
      metadata: {
        taxYear: order.taxYear,
        calculationType: order.calculationType,
        taxBenefitAmount: order.taxBenefitAmount,
        spouseTaxBenefit: order.spouseTaxBenefit,
        totalTaxBenefit: order.totalTaxBenefit,
        commissionRate: order.commissionRate,
        userId: order.userId,
      },
    };

    return this.post<InvoiceResponse>('/orders/receive', body);
  }

  /**
   * Sjekker status for en ordre
   */
  async getOrderStatus(sourceOrderId: string): Promise<OrderStatus> {
    return this.get<OrderStatus>(`/orders/status/${sourceOrderId}`);
  }

  /**
   * Henter detaljert fakturainformasjon
   */
  async getInvoiceDetails(sourceOrderId: string): Promise<any> {
    return this.get<any>(`/orders/invoice/${sourceOrderId}`);
  }

  /**
   * Sender en faktura manuelt (hvis autoSend var false)
   */
  async sendInvoice(sourceOrderId: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(
      `/orders/send/${sourceOrderId}`,
      {}
    );
  }

  /**
   * Kansellerer en ordre og oppretter kreditnota hvis nødvendig
   */
  async cancelOrder(
    sourceOrderId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string; creditNoteNumber?: string }> {
    return this.post<{ success: boolean; message: string; creditNoteNumber?: string }>(
      `/orders/cancel/${sourceOrderId}`,
      { reason }
    );
  }

  /**
   * Lister alle ordrer med filtrering
   */
  async listOrders(filters?: {
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<{ orders: any[]; count: number }> {
    const params = new URLSearchParams();
    params.set('source', CONFIG.source);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.from) params.set('from', filters.from.toISOString());
    if (filters?.to) params.set('to', filters.to.toISOString());
    if (filters?.limit) params.set('limit', filters.limit.toString());

    return this.get<{ orders: any[]; count: number }>(`/orders/list?${params.toString()}`);
  }
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export class WebhookHandler {
  private apiSecret: string;

  constructor(apiSecret?: string) {
    this.apiSecret = apiSecret || CONFIG.apiSecret;
  }

  /**
   * Validerer webhook-signatur
   */
  validateSignature(body: any, timestamp: string, signature: string): boolean {
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const expected = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
    return signature === expected;
  }

  /**
   * Parser og validerer en webhook-forespørsel
   */
  parseWebhook(
    body: any,
    headers: {
      'x-webhook-event'?: string;
      'x-webhook-timestamp'?: string;
      'x-webhook-signature'?: string;
      'x-webhook-id'?: string;
    }
  ): WebhookEvent | null {
    const event = headers['x-webhook-event'];
    const timestamp = headers['x-webhook-timestamp'];
    const signature = headers['x-webhook-signature'];
    const eventId = headers['x-webhook-id'];

    if (!event || !timestamp || !eventId) {
      console.error('Missing required webhook headers');
      return null;
    }

    // Valider signatur hvis tilgjengelig
    if (signature && !this.validateSignature(body, timestamp, signature)) {
      console.error('Invalid webhook signature');
      return null;
    }

    return {
      eventId,
      event,
      timestamp: body.timestamp,
      sourceOrderId: body.sourceOrderId,
      invoiceId: body.invoiceId,
      invoiceNumber: body.invoiceNumber,
      data: body.data,
    };
  }
}

// ============================================
// EKSEMPEL: EXPRESS WEBHOOK ENDPOINT
// ============================================

/*
import express from 'express';

const app = express();
const webhookHandler = new WebhookHandler();
const invoiceClient = new InvoiceClient();

// Lagre behandlede event-IDer for deduplicering
const processedEvents = new Set<string>();

app.post('/api/invoice-callback', express.json(), async (req, res) => {
  try {
    const webhook = webhookHandler.parseWebhook(req.body, req.headers as any);
    
    if (!webhook) {
      return res.status(400).json({ error: 'Invalid webhook' });
    }

    // Deduplicering
    if (processedEvents.has(webhook.eventId)) {
      console.log(`Duplicate event ${webhook.eventId}, skipping`);
      return res.json({ received: true });
    }
    processedEvents.add(webhook.eventId);

    // Håndter ulike event-typer
    switch (webhook.event) {
      case 'invoice.created':
        console.log(`✅ Faktura ${webhook.invoiceNumber} opprettet`);
        await updateOrderInDatabase(webhook.sourceOrderId, {
          invoiceId: webhook.invoiceId,
          invoiceNumber: webhook.invoiceNumber,
          invoiceStatus: 'CREATED',
        });
        break;

      case 'invoice.sent':
        console.log(`📧 Faktura ${webhook.invoiceNumber} sendt til ${webhook.data.sentTo}`);
        await updateOrderInDatabase(webhook.sourceOrderId, {
          invoiceStatus: 'SENT',
          invoiceSentAt: webhook.data.sentAt,
        });
        break;

      case 'invoice.paid':
        console.log(`💰 Faktura ${webhook.invoiceNumber} BETALT!`);
        await updateOrderInDatabase(webhook.sourceOrderId, {
          invoiceStatus: 'PAID',
          invoicePaidAt: webhook.data.paidAt,
          invoicePaidAmount: webhook.data.paidAmount,
        });
        // Lever skattedokumenter til kunden
        await deliverTaxDocumentsToCustomer(webhook.sourceOrderId);
        break;

      case 'payment.partial':
        console.log(`💵 Delvis betaling: ${webhook.data.paidAmount} av ${webhook.data.totalAmount}`);
        await updateOrderInDatabase(webhook.sourceOrderId, {
          invoiceStatus: 'PARTIAL',
          invoicePartialAmount: webhook.data.paidAmount,
        });
        break;

      case 'invoice.overdue':
        console.log(`⚠️ Faktura ${webhook.invoiceNumber} forfalt (${webhook.data.daysOverdue} dager)`);
        await sendPaymentReminder(webhook.sourceOrderId);
        break;

      case 'creditnote.created':
        console.log(`📝 Kreditnota ${webhook.data.creditNoteNumber} opprettet`);
        await updateOrderInDatabase(webhook.sourceOrderId, {
          invoiceStatus: 'CREDITED',
          creditNoteNumber: webhook.data.creditNoteNumber,
        });
        break;

      default:
        console.log(`Unknown event: ${webhook.event}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Hjelpefunksjoner (implementer disse)
async function updateOrderInDatabase(orderId: string, data: any) {
  // Oppdater ordre i din database
}

async function deliverTaxDocumentsToCustomer(orderId: string) {
  // Send skattedokumenter til kunden
}

async function sendPaymentReminder(orderId: string) {
  // Send betalingspåminnelse
}
*/

// ============================================
// EKSEMPEL: BRUK AV KLIENTEN
// ============================================

/*
async function example() {
  const client = new InvoiceClient();

  // Opprett faktura fra skatteberegning
  const order: TaxCalculationOrder = {
    id: 'TAX-2024-00123',
    userId: 'user_abc123',
    userEmail: 'ola.nordmann@example.com',
    userName: 'Ola Nordmann',
    userPhone: '+47 912 34 567',
    taxYear: 2024,
    taxBenefitAmount: 15000,
    totalTaxBenefit: 15000,
    commissionRate: 0.30,
    commissionAmount: 4500,
    calculationType: 'standard',
  };

  try {
    const result = await client.createInvoiceFromTaxOrder(order, {
      autoSend: true,
    });

    console.log('Faktura opprettet:', result);
    // {
    //   success: true,
    //   invoiceId: 'cm5xyz...',
    //   invoiceNumber: '2025-0001',
    //   totalAmount: 4500,
    //   kid: '0000112345678901',
    //   ...
    // }

    // Sjekk status senere
    const status = await client.getOrderStatus(order.id);
    console.log('Status:', status.status); // SENT, PAID, etc.

  } catch (error) {
    console.error('Feil ved fakturering:', error);
  }
}
*/

export default InvoiceClient: string;
  data: any;
}

// ============================================
// INVOICE CLIENT
// ============================================

export class InvoiceClient {
  private config = CONFIG;

  /**
   * Genererer HMAC-SHA256 signatur for API-forespørsler
   */
  private generateSignature(body: object, timestamp: string): string {
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Sender HTTP-forespørsel til invoice.dtax.no
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: object
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    };

    if (method === 'POST' && body) {
      headers['X-Timestamp'] = timestamp;
      headers['X-Signature'] = this.generateSignature(body, timestamp);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Invoice API error: ${response.status} - ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Oppretter faktura for en skatteberegning
   * 
   * @param order - Skatteberegningsordre fra tax.salestext.no
   * @param autoSend - Send faktura automatisk (default: true)
   * @returns Fakturainformasjon inkludert ID og KID
   */
  async createInvoiceFromTaxCalculation(
    order: TaxCalculationOrder,
    autoSend: boolean = true
  ): Promise<InvoiceResponse> {
    // Bygg ordrelinjer basert på beregningstype
    const lines: OrderLine[] = [];

    if (order.calculationType === 'couples' && order.spouseTaxBenefit) {
      // Par-beregning med to linjer
      lines.push({
        description: `Skatteberegning ${order.taxYear} - Hovedperson`,
        quantity: 1,
        unitPrice: order.taxBenefitAmount * order.commissionRate,
        vatRate: this.config.defaultVatRate,
        unit: 'stk',
      });
      lines.push({
        description: `Skatteberegning ${order.taxYear} - Ektefelle/partner`,
        quantity: 1,
        unitPrice: order.spouseTaxBenefit * order.commissionRate,
        vatRate: this.config.defaultVatRate,
        unit: 'stk',
      });
    } else {
      // Standard enkelt-beregning
      lines.push({
        description: `Skatteberegning ${order.taxYear}`,
        quantity: 1,
        unitPrice: order.commissionAmount,
        vatRate: this.config.defaultVatRate,
        unit: 'stk',
      });
    }

    const requestBody = {
      source: this.config.source,
      sourceOrderId: order.id,
      customer: {
        name: order.userName,
        email: order.userEmail,
        phone: order.userPhone,
        orgNumber: order.userOrgNumber,
        address: order.userAddress,
        postalCode: order.userPostalCode,
        city: order.userCity,
        country: 'NO',
      },
      lines,
      dueDays: this.config.defaultDueDays,
      currency: 'NOK',
      notes: `Skattefordel beregnet: ${order.totalTaxBenefit.toLocaleString('nb-NO')} kr`,
      callbackUrl: this.config.callbackUrl,
      autoSend,
      preferredPaymentMethod: 'BANK_TRANSFER',
      internalReference: `TAX-${order.taxYear}-${order.userId}`,
      metadata: {
        taxYear: order.taxYear,
        taxBenefitAmount: order.taxBenefitAmount,
        spouseTaxBenefit: order.spouseTaxBenefit,
        totalTaxBenefit: order.totalTaxBenefit,
        commissionRate: order.commissionRate,
        calculationType: order.calculationType,
      },
    };

    return this.request<InvoiceResponse>('POST', '/orders/receive', requestBody);
  }

  /**
   * Henter status for en ordre
   */
  async getOrderStatus(sourceOrderId: string): Promise<OrderStatus> {
    return this.request<OrderStatus>('GET', `/orders/status/${sourceOrderId}`);
  }

  /**
   * Henter detaljert fakturainformasjon
   */
  async getInvoiceDetails(sourceOrderId: string): Promise<any> {
    return this.request<any>('GET', `/orders/invoice/${sourceOrderId}`);
  }

  /**
   * Sender en faktura manuelt (hvis opprettet som kladd)
   */
  async sendInvoice(sourceOrderId: string): Promise<{ success: boolean; message: string }> {
    return this.request<any>('POST', `/orders/send/${sourceOrderId}`, {});
  }

  /**
   * Kansellerer/krediterer en ordre
   */
  async cancelOrder(
    sourceOrderId: string,
    reason?: string
  ): Promise<{ success: boolean; creditNoteNumber?: string }> {
    return this.request<any>('POST', `/orders/cancel/${sourceOrderId}`, { reason });
  }

  /**
   * Lister alle ordrer fra tax.salestext.no
   */
  async listOrders(filters?: {
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<{ orders: any[]; count: number }> {
    const params = new URLSearchParams({
      source: this.config.source,
    });

    if (filters?.status) params.append('status', filters.status);
    if (filters?.from) params.append('from', filters.from.toISOString());
    if (filters?.to) params.append('to', filters.to.toISOString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return this.request<any>('GET', `/orders/list?${params.toString()}`);
  }
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export class InvoiceWebhookHandler {
  private config = CONFIG;

  /**
   * Validerer webhook-signatur
   */
  validateSignature(body: object, timestamp: string, signature: string): boolean {
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const expected = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(payload)
      .digest('hex');
    return signature === expected;
  }

  /**
   * Håndterer innkommende webhook
   */
  async handleWebhook(
    headers: {
      'x-webhook-event': string;
      'x-webhook-timestamp': string;
      'x-webhook-signature': string;
      'x-webhook-id': string;
    },
    body: WebhookEvent
  ): Promise<{ received: boolean; action?: string }> {
    const event = headers['x-webhook-event'];
    const timestamp = headers['x-webhook-timestamp'];
    const signature = headers['x-webhook-signature'];

    // Valider signatur (anbefalt i produksjon)
    if (!this.validateSignature(body, timestamp, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const { sourceOrderId, invoiceNumber, data } = body;

    switch (event) {
      case 'invoice.created':
        console.log(`[WEBHOOK] Faktura ${invoiceNumber} opprettet`);
        await this.onInvoiceCreated(sourceOrderId, data);
        return { received: true, action: 'invoice_created' };

      case 'invoice.sent':
        console.log(`[WEBHOOK] Faktura ${invoiceNumber} sendt til ${data.sentTo}`);
        await this.onInvoiceSent(sourceOrderId, data);
        return { received: true, action: 'invoice_sent' };

      case 'invoice.paid':
        console.log(`[WEBHOOK] Faktura ${invoiceNumber} betalt: ${data.paidAmount} NOK`);
        await this.onInvoicePaid(sourceOrderId, data);
        return { received: true, action: 'invoice_paid' };

      case 'payment.partial':
        console.log(`[WEBHOOK] Delvis betaling: ${data.paidAmount} av ${data.totalAmount}`);
        await this.onPartialPayment(sourceOrderId, data);
        return { received: true, action: 'partial_payment' };

      case 'invoice.overdue':
        console.log(`[WEBHOOK] Faktura ${invoiceNumber} forfalt (${data.daysOverdue} dager)`);
        await this.onInvoiceOverdue(sourceOrderId, data);
        return { received: true, action: 'invoice_overdue' };

      case 'creditnote.created':
        console.log(`[WEBHOOK] Kreditnota ${data.creditNoteNumber} opprettet`);
        await this.onCreditNoteCreated(sourceOrderId, data);
        return { received: true, action: 'creditnote_created' };

      default:
        console.log(`[WEBHOOK] Ukjent event: ${event}`);
        return { received: true, action: 'unknown' };
    }
  }

  // ============================================
  // EVENT HANDLERS - Implementer disse i din app
  // ============================================

  protected async onInvoiceCreated(sourceOrderId: string, data: any): Promise<void> {
    // TODO: Oppdater ordre-status i din database
    // await db.orders.update({ id: sourceOrderId }, { 
    //   invoiceStatus: 'CREATED',
    //   invoiceKid: data.kid,
    // });
  }

  protected async onInvoiceSent(sourceOrderId: string, data: any): Promise<void> {
    // TODO: Oppdater status til SENDT
  }

  protected async onInvoicePaid(sourceOrderId: string, data: any): Promise<void> {
    // VIKTIG: Lever skattedokumenter til kunden!
    // await deliverTaxDocuments(sourceOrderId);
  }

  protected async onPartialPayment(sourceOrderId: string, data: any): Promise<void> {
    // TODO: Oppdater med delvis betaling
  }

  protected async onInvoiceOverdue(sourceOrderId: string, data: any): Promise<void> {
    // TODO: Send påminnelse til kunde
  }

  protected async onCreditNoteCreated(sourceOrderId: string, data: any): Promise<void> {
    // TODO: Håndter kreditering
  }
}

// ============================================
// EKSEMPEL: Express.js webhook endpoint
// ============================================

/*
import express from 'express';
const app = express();
const webhookHandler = new InvoiceWebhookHandler();

app.post('/api/invoice-callback', express.json(), async (req, res) => {
  try {
    const result = await webhookHandler.handleWebhook(
      {
        'x-webhook-event': req.headers['x-webhook-event'] as string,
        'x-webhook-timestamp': req.headers['x-webhook-timestamp'] as string,
        'x-webhook-signature': req.headers['x-webhook-signature'] as string,
        'x-webhook-id': req.headers['x-webhook-id'] as string,
      },
      req.body
    );
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});
*/

// ============================================
// EKSEMPEL: Komplett flyt
// ============================================

/*
async function exampleUsage() {
  const client = new InvoiceClient();

  // 1. Når kunde fullfører skatteberegning, opprett faktura
  const order: TaxCalculationOrder = {
    id: 'ORDER-2025-00001',
    userId: 'user-123',
    userEmail: 'kunde@example.com',
    userName: 'Ola Nordmann',
    taxYear: 2024,
    taxBenefitAmount: 15000,
    totalTaxBenefit: 15000,
    commissionRate: 0.30,
    commissionAmount: 4500,
    calculationType: 'standard',
  };

  const invoice = await client.createInvoiceFromTaxCalculation(order);
  console.log(`Faktura opprettet: ${invoice.invoiceNumber}`);
  console.log(`KID: ${invoice.kid}`);
}
*/

export default InvoiceClient;
