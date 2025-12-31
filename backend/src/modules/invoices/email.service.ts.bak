import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private ses: AWS.SES;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {
    // Konfigurer AWS SES
    AWS.config.update({
      region: process.env.AWS_REGION || 'eu-north-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    this.ses = new AWS.SES();
  }

  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { 
        customer: true, 
        organization: true, 
        lines: true 
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (!invoice.customer.email) {
      throw new Error(`Customer ${invoice.customer.name} has no email address`);
    }

    // Generer PDF
    const pdfBuffer = await this.pdfService.generate(invoice);

    const fromEmail = process.env.EMAIL_FROM || 'noreply@dtax.no';
    const replyTo = process.env.EMAIL_REPLY_TO || 'faktura@dtax.no';

    const subject = `Faktura ${invoice.invoiceNumber} fra ${invoice.organization.name}`;
    
    const htmlBody = this.generateEmailHtml(invoice);
    const textBody = this.generateEmailText(invoice);

    try {
      // Send e-post via AWS SES med vedlegg
      const result = await this.sendEmailWithAttachment({
        from: fromEmail,
        to: invoice.customer.email,
        replyTo: replyTo,
        subject: subject,
        htmlBody: htmlBody,
        textBody: textBody,
        attachment: {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      });

      // Logg vellykket sending
      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'SENT',
          provider: 'AWS_SES',
          messageId: result.MessageId,
        },
      });

      this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}`);

    } catch (error: any) {
      this.logger.error(`Email send error: ${error.message}`);

      // Logg feil
      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'FAILED',
          provider: 'AWS_SES',
          error: error.message,
        },
      });

      throw error;
    }
  }

  private async sendEmailWithAttachment(options: {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    attachment: { filename: string; content: Buffer };
  }): Promise<AWS.SES.SendRawEmailResponse> {
    const boundary = `----=_Part_${Date.now().toString(16)}`;
    
    const rawEmail = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Reply-To: ${options.replyTo}`,
      `Subject: ${options.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${boundary}_alt"`,
      ``,
      `--${boundary}_alt`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.textBody,
      ``,
      `--${boundary}_alt`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.htmlBody,
      ``,
      `--${boundary}_alt--`,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${options.attachment.filename}"`,
      `Content-Disposition: attachment; filename="${options.attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      options.attachment.content.toString('base64').match(/.{1,76}/g)?.join('\n') || '',
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    return this.ses.sendRawEmail({
      RawMessage: {
        Data: rawEmail,
      },
    }).promise();
  }

  private generateEmailHtml(invoice: any): string {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

    const dueDate = new Date(invoice.dueDate).toLocaleDateString('nb-NO');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .label { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Faktura ${invoice.invoiceNumber}</h1>
    </div>
    <div class="content">
      <p>Hei ${invoice.customer.name},</p>
      <p>Vedlagt finner du faktura fra ${invoice.organization.name}.</p>
      
      <div class="info-box">
        <table>
          <tr>
            <td class="label">Fakturanummer:</td>
            <td><strong>${invoice.invoiceNumber}</strong></td>
          </tr>
          <tr>
            <td class="label">Forfallsdato:</td>
            <td><strong>${dueDate}</strong></td>
          </tr>
          <tr>
            <td class="label">KID:</td>
            <td><strong>${invoice.kid || '-'}</strong></td>
          </tr>
          <tr>
            <td class="label">Beløp:</td>
            <td class="amount">${formatCurrency(invoice.totalAmount)}</td>
          </tr>
        </table>
      </div>

      <div class="info-box">
        <p style="margin:0 0 10px 0;"><strong>Betalingsinformasjon:</strong></p>
        <table>
          <tr>
            <td class="label">Kontonummer:</td>
            <td>${invoice.organization.bankAccount || '9801.16.72043'}</td>
          </tr>
          <tr>
            <td class="label">KID:</td>
            <td>${invoice.kid || '-'}</td>
          </tr>
        </table>
      </div>

      <p>Fakturaen er også vedlagt som PDF.</p>
      <p>Ta kontakt hvis du har spørsmål.</p>
      <p>Med vennlig hilsen,<br>${invoice.organization.name}</p>
    </div>
    <div class="footer">
      <p>${invoice.organization.name}<br>
      ${invoice.organization.address}, ${invoice.organization.postalCode} ${invoice.organization.city}<br>
      Org.nr: ${invoice.organization.orgNumber}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private generateEmailText(invoice: any): string {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

    const dueDate = new Date(invoice.dueDate).toLocaleDateString('nb-NO');

    return `
FAKTURA ${invoice.invoiceNumber}

Hei ${invoice.customer.name},

Vedlagt finner du faktura fra ${invoice.organization.name}.

FAKTURADETALJER:
- Fakturanummer: ${invoice.invoiceNumber}
- Forfallsdato: ${dueDate}
- KID: ${invoice.kid || '-'}
- Beløp: ${formatCurrency(invoice.totalAmount)}

BETALINGSINFORMASJON:
- Kontonummer: ${invoice.organization.bankAccount || '9801.16.72043'}
- KID: ${invoice.kid || '-'}

Fakturaen er vedlagt som PDF.

Ta kontakt hvis du har spørsmål.

Med vennlig hilsen,
${invoice.organization.name}
${invoice.organization.address}, ${invoice.organization.postalCode} ${invoice.organization.city}
Org.nr: ${invoice.organization.orgNumber}
`;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ses.getSendQuota().promise();
      this.logger.log('AWS SES connection successful');
      return true;
    } catch (error: any) {
      this.logger.error(`AWS SES connection failed: ${error.message}`);
      return false;
    }
  }
}
