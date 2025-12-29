import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Headers, 
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ReceiveOrderDto, OrderReceiveResponseDto, OrderStatusResponseDto } from '../../common/dto/order-receive.dto';

/**
 * Orders Controller
 * 
 * Håndterer mottak av ordrer fra eksterne systemer og statusforespørsler.
 * 
 * Autentisering:
 * - Alle endepunkter krever X-API-Key header
 * - POST-endepunkter krever også X-Signature og X-Timestamp for HMAC-validering
 * 
 * @example
 * // Motta ordre
 * POST /api/orders/receive
 * Headers: {
 *   "X-API-Key": "tax_xxx",
 *   "X-Timestamp": "1703851200",
 *   "X-Signature": "hmac-sha256-signature"
 * }
 * 
 * // Sjekk status
 * GET /api/orders/status/ORDER-12345
 * Headers: { "X-API-Key": "tax_xxx" }
 */
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private service: OrdersService) {}

  /**
   * Motta ordre fra eksternt system
   * 
   * Oppretter en faktura basert på ordredata og returnerer fakturainformasjon.
   * Kan konfigureres til å sende fakturaen automatisk eller la den stå som kladd.
   * 
   * @param body - Ordredata (se ReceiveOrderDto for format)
   * @param apiKey - API-nøkkel for autentisering
   * @param signature - HMAC-SHA256 signatur av body + timestamp
   * @param timestamp - Unix timestamp for når forespørselen ble generert
   * @returns Fakturainformasjon inkludert ID, nummer, beløp og KID
   */
  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  async receive(
    @Body() body: ReceiveOrderDto,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
  ): Promise<OrderReceiveResponseDto> {
    this.logger.log(`Mottok ordre fra ${body.source}: ${body.sourceOrderId}`);

    // Valider request
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    // Valider autentisering
    const rawBody = JSON.stringify(body);
    await this.service.validateRequest(apiKey, signature, timestamp, rawBody);

    // Prosesser ordre
    const result = await this.service.processOrder(body);

    this.logger.log(`Faktura ${result.invoiceNumber} opprettet for ordre ${body.sourceOrderId}`);
    return result;
  }

  /**
   * Sjekk status for en ordre
   * 
   * Returnerer full status for en ordre inkludert betalingsinformasjon.
   * 
   * @param sourceOrderId - Ordre-ID fra kildesystemet
   * @param apiKey - API-nøkkel for autentisering
   * @returns Ordrestatus eller 404 hvis ikke funnet
   */
  @Get('status/:sourceOrderId')
  async getStatus(
    @Param('sourceOrderId') sourceOrderId: string,
    @Headers('x-api-key') apiKey: string,
  ): Promise<OrderStatusResponseDto> {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    // Enkel API-key validering (uten signatur for GET)
    await this.service.validateApiKey(apiKey);

    const status = await this.service.getOrderStatus(sourceOrderId);
    if (!status) {
      throw new NotFoundException(`Ordre ${sourceOrderId} ikke funnet`);
    }

    return status;
  }

  /**
   * Liste alle ordrer fra en kilde
   * 
   * @param source - Kildesystem (f.eks. "tax.salestext.no")
   * @param status - Filtrer på fakturastatus (valgfritt)
   * @param from - Fra-dato (ISO format, valgfritt)
   * @param to - Til-dato (ISO format, valgfritt)
   * @param limit - Maks antall resultater (default 50, maks 100)
   * @param apiKey - API-nøkkel
   */
  @Get('list')
  async listOrders(
    @Headers('x-api-key') apiKey: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    await this.service.validateApiKey(apiKey);

    return this.service.listOrders({
      source,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: Math.min(limit || 50, 100),
    });
  }

  /**
   * Hent detaljert fakturainformasjon
   * 
   * @param sourceOrderId - Ordre-ID fra kildesystemet
   * @param apiKey - API-nøkkel
   */
  @Get('invoice/:sourceOrderId')
  async getInvoiceDetails(
    @Param('sourceOrderId') sourceOrderId: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    await this.service.validateApiKey(apiKey);

    const details = await this.service.getInvoiceDetails(sourceOrderId);
    if (!details) {
      throw new NotFoundException(`Faktura for ordre ${sourceOrderId} ikke funnet`);
    }

    return details;
  }

  /**
   * Kanseller/krediter en ordre
   * 
   * Oppretter en kreditnota for fakturaen hvis den allerede er sendt.
   * Sletter fakturaen hvis den fortsatt er en kladd.
   * 
   * @param sourceOrderId - Ordre-ID fra kildesystemet
   * @param reason - Årsak til kansellering
   */
  @Post('cancel/:sourceOrderId')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('sourceOrderId') sourceOrderId: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Body() body: { reason?: string },
  ) {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    // Valider autentisering
    const rawBody = JSON.stringify(body);
    await this.service.validateRequest(apiKey, signature, timestamp, rawBody);

    return this.service.cancelOrder(sourceOrderId, body.reason);
  }

  /**
   * Oppdater ordre/faktura
   * 
   * Kun mulig for fakturaer som fortsatt er kladd.
   * 
   * @param sourceOrderId - Ordre-ID fra kildesystemet
   * @param updates - Felter som skal oppdateres
   */
  @Post('update/:sourceOrderId')
  @HttpCode(HttpStatus.OK)
  async updateOrder(
    @Param('sourceOrderId') sourceOrderId: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Body() body: Partial<ReceiveOrderDto>,
  ) {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    const rawBody = JSON.stringify(body);
    await this.service.validateRequest(apiKey, signature, timestamp, rawBody);

    return this.service.updateOrder(sourceOrderId, body);
  }

  /**
   * Send faktura manuelt
   * 
   * Sender en faktura som er opprettet som kladd.
   * 
   * @param sourceOrderId - Ordre-ID fra kildesystemet
   */
  @Post('send/:sourceOrderId')
  @HttpCode(HttpStatus.OK)
  async sendInvoice(
    @Param('sourceOrderId') sourceOrderId: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
  ) {
    if (!apiKey) {
      throw new BadRequestException('X-API-Key header påkrevd');
    }

    await this.service.validateRequest(apiKey, signature, timestamp, '{}');

    return this.service.sendInvoice(sourceOrderId);
  }
}
