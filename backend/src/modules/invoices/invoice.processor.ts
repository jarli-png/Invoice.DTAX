import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

@Processor('email')
export class InvoiceProcessor extends WorkerHost {
  constructor(private emailService: EmailService) { super(); }

  async process(job: Job) {
    if (job.name === 'send-invoice') {
      return this.emailService.sendInvoice(job.data.invoiceId);
    }
  }
}
