import { IsString, IsEmail, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString, IsUrl, Min, Max, IsIn, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for kunde-informasjon i en ordre
 */
export class OrderCustomerDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  orgNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

/**
 * DTO for en ordrelinje
 */
export class OrderLineDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  vatRate?: number; // 0-1 (f.eks. 0.25 for 25%)

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  unit?: string; // stk, timer, kg, etc.
}

/**
 * DTO for vedlegg
 */
export class OrderAttachmentDto {
  @IsString()
  fileName: string;

  @IsUrl()
  fileUrl: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

/**
 * DTO for fullstendig ordremottak
 * 
 * Dette er hovedformatet som eksterne systemer sender til invoice.dtax.no
 */
export class ReceiveOrderDto {
  /**
   * Kilde-system identifikator (f.eks. "tax.salestext.no")
   */
  @IsString()
  source: string;

  /**
   * Unik ordre-ID fra kildesystemet
   */
  @IsString()
  sourceOrderId: string;

  /**
   * Kundeinformasjon
   */
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto;

  /**
   * Ordrelinjer (minst én påkrevd)
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  /**
   * Valgfri organisasjons-ID (bruker default hvis ikke spesifisert)
   */
  @IsOptional()
  @IsString()
  organizationId?: string;

  /**
   * Fakturadato (default: i dag)
   */
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  /**
   * Antall dager til forfall (default: 14)
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  dueDays?: number;

  /**
   * Valuta (default: NOK)
   */
  @IsOptional()
  @IsString()
  @IsIn(['NOK', 'SEK', 'DKK', 'EUR', 'USD', 'GBP'])
  currency?: string;

  /**
   * Notat som legges på fakturaen
   */
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Callback-URL for statusoppdateringer
   */
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  /**
   * Vedlegg til fakturaen
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAttachmentDto)
  attachments?: OrderAttachmentDto[];

  /**
   * Om fakturaen skal sendes automatisk (default: false = opprett som kladd)
   */
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  /**
   * Betalingsmetode som foretrekkes
   */
  @IsOptional()
  @IsString()
  @IsIn(['BANK_TRANSFER', 'VIPPS', 'CARD'])
  preferredPaymentMethod?: string;

  /**
   * Referanse til intern ordre/prosjekt hos avsender
   */
  @IsOptional()
  @IsString()
  internalReference?: string;

  /**
   * Ekstra metadata (JSON)
   */
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * Respons ved vellykket ordremottak
 */
export class OrderReceiveResponseDto {
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

/**
 * DTO for status-forespørsel
 */
export class OrderStatusResponseDto {
  sourceOrderId: string;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  vatAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  kid?: string;
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  payments?: PaymentSummaryDto[];
}

export class PaymentSummaryDto {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt?: string;
}
