import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from './storage.service';

@Injectable()
export class PdfService {
  constructor(private storageService: StorageService) {}

  async generate(invoice: any): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Logo (hvis organisasjonen har en)
      let logoYEnd = 50;
      if (invoice.organization?.logoUrl) {
        try {
          const logoBuffer = await this.storageService.getBuffer(invoice.organization.logoUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, 50, 50, { width: 120 });
            logoYEnd = 120;
          }
        } catch (e) {
          console.log('Could not load logo:', e.message);
        }
      }

      // Header - firma info
      const headerX = invoice.organization?.logoUrl ? 200 : 50;
      doc.fontSize(16).text(invoice.organization?.name || 'DTAX LIER', headerX, 50);
      doc.fontSize(9)
        .text(invoice.organization?.address || 'Moen 50', headerX, 70)
        .text(`${invoice.organization?.postalCode || '4333'} ${invoice.organization?.city || 'OLTEDAL'}`, headerX, 82)
        .text(`Org.nr: ${invoice.organization?.orgNumber || '936 859 356'}`, headerX, 94);
      
      if (invoice.organization?.email) {
        doc.text(`E-post: ${invoice.organization.email}`, headerX, 106);
      }
      if (invoice.organization?.phone) {
        doc.text(`Tlf: ${invoice.organization.phone}`, headerX, 118);
      }

      // Faktura-tittel og info (høyre side)
      doc.fontSize(24).text('FAKTURA', 400, 50, { align: 'right' });
      doc.fontSize(10)
        .text(`Fakturanummer: ${invoice.invoiceNumber}`, 350, 80, { align: 'right' })
        .text(`Fakturadato: ${new Date(invoice.issueDate).toLocaleDateString('nb-NO')}`, 350, 95, { align: 'right' })
        .text(`Forfallsdato: ${new Date(invoice.dueDate).toLocaleDateString('nb-NO')}`, 350, 110, { align: 'right' });

      // Kunde info
      const customerY = Math.max(logoYEnd, 130) + 20;
      doc.fontSize(11).text('Faktureres til:', 50, customerY, { underline: true });
      doc.fontSize(10)
        .text(invoice.customer?.name || '', 50, customerY + 18)
        .text(invoice.customer?.address || '', 50, customerY + 32)
        .text(`${invoice.customer?.postalCode || ''} ${invoice.customer?.city || ''}`, 50, customerY + 46);
      
      if (invoice.customer?.orgNumber) {
        doc.text(`Org.nr: ${invoice.customer.orgNumber}`, 50, customerY + 60);
      }

      // Linjer-tabell
      const tableTop = customerY + 90;
      doc.fontSize(9);
      
      // Header
      doc.rect(50, tableTop - 5, 500, 20).fill('#f0f0f0');
      doc.fillColor('#000')
        .text('Beskrivelse', 55, tableTop)
        .text('Antall', 300, tableTop, { width: 50, align: 'right' })
        .text('Pris', 355, tableTop, { width: 60, align: 'right' })
        .text('MVA', 420, tableTop, { width: 40, align: 'right' })
        .text('Sum', 465, tableTop, { width: 80, align: 'right' });

      // Linjer
      let y = tableTop + 25;
      for (const line of invoice.lines || []) {
        doc.text(line.description, 55, y, { width: 240 })
          .text(String(line.quantity), 300, y, { width: 50, align: 'right' })
          .text(`kr ${line.unitPrice.toFixed(2)}`, 355, y, { width: 60, align: 'right' })
          .text(`${((line.vatRate || 0.25) * 100).toFixed(0)}%`, 420, y, { width: 40, align: 'right' })
          .text(`kr ${line.amount.toFixed(2)}`, 465, y, { width: 80, align: 'right' });
        y += 20;
      }

      // Totaler
      doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
      y += 15;
      
      doc.fontSize(10)
        .text('Subtotal:', 400, y)
        .text(`kr ${invoice.subtotal?.toFixed(2)}`, 465, y, { width: 80, align: 'right' });
      y += 18;
      doc.text('MVA (25%):', 400, y)
        .text(`kr ${invoice.vatAmount?.toFixed(2)}`, 465, y, { width: 80, align: 'right' });
      y += 18;
      
      doc.rect(395, y - 5, 155, 25).fill('#e8e8e8');
      doc.fillColor('#000').fontSize(12)
        .text('Å betale:', 400, y)
        .text(`kr ${invoice.totalAmount?.toFixed(2)}`, 465, y, { width: 80, align: 'right' });

      // Betalingsinformasjon
      y += 50;
      doc.fontSize(11).fillColor('#000').text('Betalingsinformasjon', 50, y, { underline: true });
      y += 20;
      doc.fontSize(10)
        .text(`Kontonummer: ${invoice.organization?.bankAccount || '3201.23.19997'}`, 50, y)
        .text(`KID: ${invoice.kid || 'Ikke generert'}`, 50, y + 15)
        .text(`Forfallsdato: ${new Date(invoice.dueDate).toLocaleDateString('nb-NO')}`, 50, y + 30)
        .text(`Beløp å betale: kr ${invoice.totalAmount?.toFixed(2)}`, 50, y + 45);

      // Footer
      doc.fontSize(8).fillColor('#666')
        .text(`Faktura generert ${new Date().toLocaleDateString('nb-NO')} - ${invoice.organization?.name || 'DTAX LIER'}`, 50, 750, { align: 'center' });

      doc.end();
    });
  }
}
