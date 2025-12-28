import { Controller, Get, Post, Body, Param, UseGuards, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.service.findAll(); }

  @Get('invoice/:invoiceId')
  @UseGuards(JwtAuthGuard)
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.service.findByInvoice(invoiceId);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(@Body() data: { invoiceId: string; amount: number; method: any; providerRef?: string }) {
    return this.service.registerPayment(data);
  }

  @Post('stripe/webhook')
  stripeWebhook(@Body() body: any) {
    return this.service.handleStripeWebhook(body);
  }

  @Post('vipps/webhook')
  vippsWebhook(@Body() body: any) {
    return this.service.handleVippsWebhook(body);
  }
}
