'use client';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  kid?: string | null;
  notes?: string | null;
  lines: InvoiceLine[];
  customer: {
    name: string;
    email?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    orgNumber?: string | null;
  };
  organization: {
    name: string;
    orgNumber: string;
    address: string;
    postalCode: string;
    city: string;
    email?: string | null;
    phone?: string | null;
    bankAccount?: string | null;
    logoUrl?: string | null;
  };
}

interface InvoiceSettings {
  primaryColor?: string;
  showLogo?: boolean;
  footerText?: string;
  headerText?: string;
  fontSize?: 'small' | 'medium' | 'large';
}

interface InvoicePreviewProps {
  invoice: Invoice;
  settings?: InvoiceSettings;
}

export default function InvoicePreview({ invoice, settings = {} }: InvoicePreviewProps) {
  const {
    primaryColor = '#1e40af',
    showLogo = true,
    footerText = 'Takk for at du er kunde hos oss!',
    headerText = '',
    fontSize = 'medium',
  } = settings;

  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }[fontSize];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(amount);
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-200 text-gray-800',
    SENT: 'bg-blue-200 text-blue-800',
    PAID: 'bg-green-200 text-green-800',
    OVERDUE: 'bg-red-200 text-red-800',
    CANCELLED: 'bg-gray-400 text-gray-800',
    CREDITED: 'bg-purple-200 text-purple-800',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Kladd',
    SENT: 'Sendt',
    DELIVERED: 'Levert',
    VIEWED: 'Åpnet',
    PARTIALLY_PAID: 'Delvis betalt',
    PAID: 'Betalt',
    OVERDUE: 'Forfalt',
    CANCELLED: 'Kansellert',
    CREDITED: 'Kreditert',
  };

  return (
    <div className={`bg-white shadow-lg max-w-4xl mx-auto ${fontSizeClass}`} id="invoice-preview">
      {/* Header */}
      <div 
        className="p-8 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex justify-between items-start">
          <div>
            {showLogo && invoice.organization.logoUrl && (
              <img 
                src={invoice.organization.logoUrl} 
                alt={invoice.organization.name}
                className="h-16 mb-4 bg-white p-2 rounded"
              />
            )}
            <h1 className="text-3xl font-bold">{invoice.organization.name}</h1>
            <p className="opacity-80">Org.nr: {invoice.organization.orgNumber}</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-bold">FAKTURA</h2>
            <p className="text-2xl mt-2">{invoice.invoiceNumber}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${statusColors[invoice.status] || 'bg-gray-200'}`}>
              {statusLabels[invoice.status] || invoice.status}
            </span>
          </div>
        </div>
        {headerText && (
          <p className="mt-4 opacity-80 italic">{headerText}</p>
        )}
      </div>

      {/* Info section */}
      <div className="p-8 grid grid-cols-2 gap-8 border-b">
        <div>
          <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Faktureres til</h3>
          <p className="font-semibold text-lg">{invoice.customer.name}</p>
          {invoice.customer.address && <p>{invoice.customer.address}</p>}
          {invoice.customer.postalCode && invoice.customer.city && (
            <p>{invoice.customer.postalCode} {invoice.customer.city}</p>
          )}
          {invoice.customer.orgNumber && <p>Org.nr: {invoice.customer.orgNumber}</p>}
          {invoice.customer.email && <p className="text-blue-600">{invoice.customer.email}</p>}
        </div>
        <div className="text-right">
          <div className="inline-block text-left">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <span className="text-gray-500">Fakturanummer:</span>
              <span className="font-mono font-bold">{invoice.invoiceNumber}</span>
              
              <span className="text-gray-500">Fakturadato:</span>
              <span className="font-medium">{formatDate(invoice.issueDate)}</span>
              
              <span className="text-gray-500">Forfallsdato:</span>
              <span className="font-medium text-red-600">{formatDate(invoice.dueDate)}</span>
              
              {invoice.kid && (
                <>
                  <span className="text-gray-500">KID:</span>
                  <span className="font-mono font-bold">{invoice.kid}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="p-8">
        <table className="w-full">
          <thead>
            <tr className="border-b-2" style={{ borderColor: primaryColor }}>
              <th className="text-left py-3 font-semibold">Beskrivelse</th>
              <th className="text-right py-3 font-semibold w-20">Antall</th>
              <th className="text-right py-3 font-semibold w-28">Pris</th>
              <th className="text-right py-3 font-semibold w-20">MVA</th>
              <th className="text-right py-3 font-semibold w-32">Beløp</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={line.id || index} className="border-b border-gray-200">
                <td className="py-3">{line.description}</td>
                <td className="text-right py-3">{line.quantity}</td>
                <td className="text-right py-3">{formatCurrency(line.unitPrice)}</td>
                <td className="text-right py-3">{((line.vatRate || 0.25) * 100).toFixed(0)}%</td>
                <td className="text-right py-3 font-medium">{formatCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-8 flex justify-end">
          <div className="w-72">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Subtotal:</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">MVA:</span>
              <span>{formatCurrency(invoice.vatAmount)}</span>
            </div>
            <div 
              className="flex justify-between py-3 text-xl font-bold border-t-2 mt-2"
              style={{ borderColor: primaryColor }}
            >
              <span>Totalt:</span>
              <span style={{ color: primaryColor }}>{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment info - OPPDATERT MED KID */}
      <div className="mx-8 mb-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-3">Betalingsinformasjon</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-gray-500 text-xs uppercase">Kontonummer</span>
            <p className="font-mono font-medium text-lg">{invoice.organization.bankAccount || 'Ikke oppgitt'}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase">KID</span>
            <p className="font-mono font-medium text-lg">{invoice.kid || 'Bruk fakturanr.'}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase">Forfallsdato</span>
            <p className="font-medium text-lg text-red-600">{formatDate(invoice.dueDate)}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase">Å betale</span>
            <p className="font-bold text-lg" style={{ color: primaryColor }}>{formatCurrency(invoice.totalAmount)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          {invoice.kid 
            ? 'Merk betalingen med KID-nummer for automatisk registrering' 
            : 'Merk betalingen med fakturanummer'}
        </p>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mx-8 mb-8 p-4 border-l-4" style={{ borderColor: primaryColor }}>
          <h4 className="font-semibold text-gray-600 mb-1">Merknad</h4>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div 
        className="p-6 text-center text-white text-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <p>{footerText}</p>
        <p className="mt-2 opacity-80">
          {invoice.organization.name} • {invoice.organization.address}, {invoice.organization.postalCode} {invoice.organization.city}
          {invoice.organization.email && ` • ${invoice.organization.email}`}
          {invoice.organization.phone && ` • ${invoice.organization.phone}`}
        </p>
      </div>
    </div>
  );
}
