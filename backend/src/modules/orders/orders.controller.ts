import { Controller, Post, Get, Body, Param, Headers, Req, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post('receive')
  async receive(
    @Body() body: any,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = JSON.stringify(body);
    await this.service.validateRequest(apiKey, signature, timestamp, rawBody);
    return this.service.processOrder(body);
  }

  @Get('status/:sourceOrderId')
  getStatus(@Param('sourceOrderId') sourceOrderId: string) {
    return this.service.getOrderStatus(sourceOrderId);
  }
}
