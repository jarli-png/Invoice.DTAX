/**
 * Webhook Event Types
 * 
 * Disse eventene sendes til callback-URLer registrert av integrasjonspartnere
 */
export enum WebhookEventType {
  // Faktura livssyklus
  INVOICE_CREATED = 'invoice.created',
  INVOICE_UPDATED = 'invoice.updated',
  INVOICE_SENT = 'invoice.sent',
  INVOICE_VIEWED = 'invoice.viewed',
  INVOICE_OVERDUE = 'invoice.overdue',
  INVOICE_CANCELLED = 'invoice.cancelled',
  
  // Betalinger
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_PARTIAL = 'payment.partial',
  INVOICE_PAID = 'invoice.paid',
  PAYMENT_FAILED = 'payment.failed',
  
  // Kreditnota
  CREDIT_NOTE_CREATED = 'creditnote.created',
  
  // Purringer
  REMINDER_SENT = 'reminder.sent',
}

/**
 * Base webhook event payload
 */
export interface WebhookEventBase {
  /**
   * Unik event-ID for deduplicering
   */
  eventId: string;

  /**
   * Event type
   */
  event: WebhookEventType;

  /**
   * Tidspunkt for hendelsen (ISO 8601)
   */
  timestamp: string;

  /**
   * Opprinnelig kilde-ordre ID
   */
  sourceOrderId: string;

  /**
   * Invoice.dtax.no sin faktura-ID
   */
  invoiceId: string;

  /**
   * Fakturanummer
   */
  invoiceNumber: string;
}

/**
 * Faktura opprettet event
 */
export interface InvoiceCreatedEvent extends WebhookEventBase {
  event: WebhookEventType.INVOICE_CREATED;
  data: {
    status: string;
    totalAmount: number;
    vatAmount: number;
    dueDate: string;
    currency: string;
    kid?: string;
    customerName: string;
    customerEmail: string;
  };
}

/**
 * Faktura sendt event
 */
export interface InvoiceSentEvent extends WebhookEventBase {
  event: WebhookEventType.INVOICE_SENT;
  data: {
    status: string;
    sentAt: string;
    sentTo: string;
    method: 'email' | 'paper' | 'ehf';
  };
}

/**
 * Faktura betalt event
 */
export interface InvoicePaidEvent extends WebhookEventBase {
  event: WebhookEventType.INVOICE_PAID;
  data: {
    status: string;
    paidAt: string;
    paidAmount: number;
    paymentMethod: string;
    transactionId?: string;
  };
}

/**
 * Delvis betaling event
 */
export interface PaymentPartialEvent extends WebhookEventBase {
  event: WebhookEventType.PAYMENT_PARTIAL;
  data: {
    status: string;
    paidAmount: number;
    remainingAmount: number;
    totalAmount: number;
    paymentMethod: string;
    paidAt: string;
  };
}

/**
 * Faktura forfalt event
 */
export interface InvoiceOverdueEvent extends WebhookEventBase {
  event: WebhookEventType.INVOICE_OVERDUE;
  data: {
    status: string;
    dueDate: string;
    daysOverdue: number;
    totalAmount: number;
    remainingAmount: number;
  };
}

/**
 * Kreditnota opprettet event
 */
export interface CreditNoteCreatedEvent extends WebhookEventBase {
  event: WebhookEventType.CREDIT_NOTE_CREATED;
  data: {
    creditNoteNumber: string;
    creditNoteId: string;
    originalInvoiceNumber: string;
    creditAmount: number;
    reason?: string;
  };
}

/**
 * Union type for alle events
 */
export type WebhookEvent = 
  | InvoiceCreatedEvent 
  | InvoiceSentEvent 
  | InvoicePaidEvent 
  | PaymentPartialEvent
  | InvoiceOverdueEvent
  | CreditNoteCreatedEvent;

/**
 * Forventet respons fra callback-endpoint
 */
export interface WebhookCallbackResponse {
  received: boolean;
  message?: string;
}

/**
 * Callback-konfigurasjon for en integrasjon
 */
export interface IntegrationCallbackConfig {
  url: string;
  secret: string;
  events: WebhookEventType[];
  retryPolicy?: {
    maxAttempts: number;
    initialDelayMs: number;
    backoffMultiplier: number;
  };
}
