import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {
    // Konfigurer Brevo SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
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
    const bccEmail = 'faktura@dtax.no';

    const subject = `Faktura ${invoice.invoiceNumber} fra ${invoice.organization.name}`;
    
    const htmlBody = this.generateInvoiceEmailHtml(invoice);
    const textBody = this.generateInvoiceEmailText(invoice);

    try {
      const result = await this.transporter.sendMail({
        from: `"dTax Betaling" <${fromEmail}>`,
        to: invoice.customer.email,
        bcc: bccEmail,
        replyTo: replyTo,
        subject: subject,
        text: textBody,
        html: htmlBody,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'SENT',
          provider: 'BREVO_SMTP',
          messageId: result.messageId,
        },
      });

      this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}`);

    } catch (error: any) {
      this.logger.error(`Email send error: ${error.message}`);

      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'FAILED',
          provider: 'BREVO_SMTP',
          error: error.message,
        },
      });

      throw error;
    }
  }

  async sendReminder(invoiceId: string, reminderNumber: number = 1): Promise<void> {
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

    const pdfBuffer = await this.pdfService.generate(invoice);

    const fromEmail = process.env.EMAIL_FROM || 'noreply@dtax.no';
    const replyTo = process.env.EMAIL_REPLY_TO || 'faktura@dtax.no';
    const bccEmail = 'faktura@dtax.no';

    const subject = `Purring ${reminderNumber}: Faktura ${invoice.invoiceNumber} fra ${invoice.organization.name}`;
    
    const htmlBody = this.generateReminderEmailHtml(invoice, reminderNumber);
    const textBody = this.generateReminderEmailText(invoice, reminderNumber);

    try {
      const result = await this.transporter.sendMail({
        from: `"dTax Betaling" <${fromEmail}>`,
        to: invoice.customer.email,
        bcc: bccEmail,
        replyTo: replyTo,
        subject: subject,
        text: textBody,
        html: htmlBody,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'SENT',
          provider: 'BREVO_SMTP',
          messageId: result.messageId,
        },
      });

      this.logger.log(`Reminder ${reminderNumber} for invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}`);

    } catch (error: any) {
      this.logger.error(`Reminder email send error: ${error.message}`);

      await this.prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customer.email,
          subject: subject,
          status: 'FAILED',
          provider: 'BREVO_SMTP',
          error: error.message,
        },
      });

      throw error;
    }
  }

  private generateInvoiceEmailHtml(invoice: any): string {
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
    .no-reply { background: #fef3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin: 15px 0; font-size: 12px; color: #856404; }
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
      <p>Med vennlig hilsen,<br>${invoice.organization.name}</p>
      
      <div class="no-reply">
        <strong>NB:</strong> Denne e-posten kan ikke besvares. Ved spørsmål, kontakt oss på <a href="mailto:faktura@dtax.no">faktura@dtax.no</a>
      </div>
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

  private generateInvoiceEmailText(invoice: any): string {
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

Med vennlig hilsen,
${invoice.organization.name}
${invoice.organization.address}, ${invoice.organization.postalCode} ${invoice.organization.city}
Org.nr: ${invoice.organization.orgNumber}

---
NB: Denne e-posten kan ikke besvares. Ved spørsm��Ål, kontakt oss på faktura@dtax.no
`;
  }

  private generateReminderEmailHtml(invoice: any, reminderNumber: number): string {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

    const dueDate = new Date(invoice.dueDate).toLocaleDateString('nb-NO');
    const today = new Date().toLocaleDateString('nb-NO');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .no-reply { background: #fef3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin: 15px 0; font-size: 12px; color: #856404; }
    .warning { background: #fee2e2; border: 1px solid #dc2626; border-radius: 4px; padding: 10px; margin: 15px 0; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .label { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Purring ${reminderNumber}</h1>
      <p style="margin:5px 0 0 0;">Faktura ${invoice.invoiceNumber}</p>
    </div>
    <div class="content">
      <p>Hei ${invoice.customer.name},</p>
      
      <div class="warning">
        <strong>Vi har ikke registrert betaling for faktura ${invoice.invoiceNumber}.</strong><br>
        Fakturaen forfalt ${dueDate}. Vennligst betal snarest.
      </div>
      
      <div class="info-box">
        <table>
          <tr>
            <td class="label">Fakturanummer:</td>
            <td><strong>${invoice.invoiceNumber}</strong></td>
          </tr>
          <tr>
            <td class="label">Opprinnnelig forfallsdato:</td>
            <td><strong>${dueDate}</strong></td>
          </tr>
          <tr>
            <td class="label">KID:</td>
            <td><strong>${invoice.kid || '-'}</strong></td>
          </tr>
          <tr>
            <td class="label">Utestående beløp:</td>
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

      <p>Hvis du allerede har betalt, kan du se bort fra denne purringen.</p>
      <p>Med vennlig hilsen,<br>${invoice.organization.name}</p>
      
      <div class="no-reply">
        <strong>NB:</strong> Denne e-posten kan ikke besvares. Ved spørsmål, kontakt oss på <a href="mailto:faktura@dtax.no">faktura@dtax.no</a>
      </div>
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

  private generateReminderEmailText(invoice: any, reminderNumber: number): string {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

    const dueDate = new Date(invoice.dueDate).toLocaleDateString('nb-NO');

    return `
PURRING ${reminderNumber} - FAKTURA ${invoice.invoiceNumber}

Hei ${invoice.customer.name},

Vi har ikke registrert betaling for faktura ${invoice.invoiceNumber}.
Fakturaen forfalt ${dueDate}. Vennligst betal snarest.

FAKTURADETALJER:
- Fakturanummer: ${invoice.invoiceNumber}
- Opprinnelig forfallsdato: ${dueDate}
- KID: ${invoice.kid || '-'}
- Utestående beløp: ${formatCurrency(invoice.totalAmount)}

BETALINGSINFORMASJON:
- Kontonummer: ${invoice.organization.bankAccount || '9801.16.72043'}
- KID: ${invoice.kid || '-'}

Hvis du allerede har betalt, kan du se bort fra denne purringen.

Med vennlig hilsen,
${invoice.organization.name}
${invoice.organization.address}, ${invoice.organization.postalCode} ${invoice.organization.city}
Org.nr: ${invoice.organization.orgNumber}

---
NB: Denne e-posten kan ikke besvares. Ved spørsm��Ål, kontakt oss på faktura@dtax.no
`;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Brevo SMTP connection successful');
      return true;
    } catch (error: any) {
      this.logger.error(`Brevo SMTP connection failed: ${error.message}`);
      return false;
    }
  }
}
