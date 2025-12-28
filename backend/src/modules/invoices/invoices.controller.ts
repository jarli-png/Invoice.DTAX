import { Controller, Get, Post, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private service: InvoicesService, private pdfService: PdfService) {}

  @Get()
  findAll(@Query() query: { status?: string; customerId?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.service.findOne(id);
    const pdf = await this.pdfService.generate(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    });
    res.send(pdf);
  }

  @Post()
  create(@Body() data: any) { return this.service.create(data); }

  @Post(':id/send')
  send(@Param('id') id: string) { return this.service.send(id); }

  @Post(':id/credit-note')
  createCreditNote(@Param('id') id: string) { return this.service.createCreditNote(id); }
}
