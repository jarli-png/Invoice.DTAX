import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfService } from './pdf.service';
import { EmailService } from './email.service';
import { StorageService } from './storage.service';
import { InvoiceProcessor } from './invoice.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'invoices' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService, EmailService, StorageService, InvoiceProcessor],
  exports: [InvoicesService, PdfService, EmailService, StorageService],
})
export class InvoicesModule {}
