'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import InvoicePreview from '@/components/InvoicePreview';
import { PrintButton, DownloadPdfButton, EmailButton } from '@/components/ActionButtons';
import Link from 'next/link';
import { api } from '@/lib/api';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  amount: number;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  orgNumber: string | null;
}

interface Organization {
  id: string;
  name: string;
  orgNumber: string;
  address: string;
  postalCode: string;
  city: string;
  email: string | null;
  phone: string | null;
  bankAccount: string | null;
  logoUrl: string | null;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  sentAt: string;
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
  kid: string | null;
  pdfUrl: string | null;
  notes: string | null;
  source: string | null;
  sourceOrderId: string | null;
  lines: InvoiceLine[];
  customer: Customer;
  organization: Organization;
  payments: Payment[];
  emailLogs?: EmailLog[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'history' | 'payments'>('preview');

  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState(0);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const data = await api.getInvoice(params.id as string);
        setInvoice(data);
      } catch (err: any) {
        console.error('Failed to fetch invoice:', err);
        setError(err.message || 'Kunne ikke laste faktura');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchInvoice();
    }
  }, [params.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-200 text-gray-800',
    SENT: 'bg-blue-200 text-blue-800',
    DELIVERED: 'bg-blue-200 text-blue-800',
    VIEWED: 'bg-indigo-200 text-indigo-800',
    PARTIALLY_PAID: 'bg-yellow-200 text-yellow-800',
    PAID: 'bg-green-200 text-green-800',
    OVERDUE: 'bg-red-200 text-red-800',
    CANCELLED: 'bg-gray-300 text-gray-600',
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

  const handleCreateCreditNote = async () => {
    if (!invoice) return;
    
    setCreatingCreditNote(true);
    try {
      const creditNote = await api.createCreditNote(invoice.id);
      alert(`Kreditnota ${creditNote.invoiceNumber} opprettet!\n\nÅrsak: ${creditNoteReason}`);
      
      // Oppdater fakturastatus
      setInvoice({ ...invoice, status: 'CREDITED' });
      setShowCreditNoteModal(false);
      setCreditNoteReason('');
      setCreditNoteAmount('full');
      setPartialAmount(0);
      
      router.push('/credit-notes');
    } catch (err: any) {
      alert('Kunne ikke opprette kreditnota: ' + (err.message || 'Ukjent feil'));
    } finally {
      setCreatingCreditNote(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoice) return;
    
    try {
      // E-post sendt av EmailButton
      setInvoice({ ...invoice, status: 'SENT' });
    } catch (err) {
      console.error('Failed to send invoice:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !invoice) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">
            {error || 'Faktura ikke funnet'}
          </h2>
          <Link href="/invoices" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Tilbake til fakturaer
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Tilbake til fakturaer
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            Faktura {invoice.invoiceNumber}
            <span className={`text-sm px-3 py-1 rounded-full ${statusColors[invoice.status] || 'bg-gray-200'}`}>
              {statusLabels[invoice.status] || invoice.status}
            </span>
          </h1>
          <p className="text-gray-600">{invoice.customer.name}</p>
        </div>
        
        <div className="flex flex-wrap gap-3 print:hidden">
          <PrintButton />
          <DownloadPdfButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
          {invoice.status === 'DRAFT' && (
            <EmailButton invoiceId={invoice.id} onSent={handleSendInvoice} />
          )}
          {invoice.status !== 'CREDITED' && invoice.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowCreditNoteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              📝 Opprett kreditnota
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 print:hidden">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">Totalbeløp</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">Forfallsdato</p>
          <p className="text-2xl font-bold text-gray-900">{formatDate(invoice.dueDate)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">KID</p>
          <p className="text-2xl font-bold font-mono text-gray-900">{invoice.kid || 'Ikke generert'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">Kilde</p>
          <p className="text-lg font-medium text-gray-900">{invoice.source || 'Manuell'}</p>
          {invoice.sourceOrderId && (
            <p className="text-sm text-gray-500">{invoice.sourceOrderId}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6 print:hidden">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'preview' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📄 Forhåndsvisning
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'payments' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            💳 Betalinger ({invoice.payments?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'history' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 Historikk
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'preview' && (
        <InvoicePreview invoice={invoice} />
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Betalingshistorikk</h3>
          {(!invoice.payments || invoice.payments.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">💳</p>
              <p>Ingen betalinger registrert</p>
              <Link 
                href={`/payments?invoiceId=${invoice.id}`}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 inline-block"
              >
                Registrer betaling
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Dato</th>
                  <th className="text-left py-2">Metode</th>
                  <th className="text-right py-2">Beløp</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} className="border-b">
                    <td className="py-3">{formatDateTime(payment.paidAt)}</td>
                    <td className="py-3">{payment.method}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(payment.amount)}</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Hendelseslogg</h3>
          <div className="space-y-4">
            {invoice.emailLogs && invoice.emailLogs.length > 0 ? (
              invoice.emailLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl">📧</div>
                  <div className="flex-1">
                    <p className="font-medium">E-post sendt til {log.recipient}</p>
                    <p className="text-sm text-gray-500">{formatDateTime(log.sentAt)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    log.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                    log.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Ingen hendelser registrert</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      <Modal isOpen={showCreditNoteModal} onClose={() => setShowCreditNoteModal(false)} title="Opprett kreditnota" size="md">
        <div className="p-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <p className="text-purple-800 font-medium">Kreditnota for faktura {invoice.invoiceNumber}</p>
            <p className="text-purple-600 text-sm">Kunde: {invoice.customer.name}</p>
            <p className="text-purple-600 text-sm">Opprinnelig beløp: {formatCurrency(invoice.totalAmount)}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Beløp å kreditere</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input 
                    type="radio" 
                    name="amount" 
                    checked={creditNoteAmount === 'full'} 
                    onChange={() => setCreditNoteAmount('full')} 
                  />
                  <div>
                    <p className="font-medium">Fullt beløp</p>
                    <p className="text-sm text-gray-500">{formatCurrency(invoice.totalAmount)}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input 
                    type="radio" 
                    name="amount" 
                    checked={creditNoteAmount === 'partial'} 
                    onChange={() => setCreditNoteAmount('partial')} 
                  />
                  <div className="flex-1">
                    <p className="font-medium">Delvis beløp</p>
                    {creditNoteAmount === 'partial' && (
                      <input 
                        type="number" 
                        value={partialAmount} 
                        onChange={(e) => setPartialAmount(parseFloat(e.target.value) || 0)}
                        max={invoice.totalAmount}
                        className="mt-2 w-full px-3 py-2 border rounded"
                        placeholder="Beløp inkl. MVA"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Årsak til kreditering *</label>
              <select 
                value={creditNoteReason} 
                onChange={(e) => setCreditNoteReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-2"
              >
                <option value="">Velg årsak...</option>
                <option value="Feilaktig fakturert beløp">Feilaktig fakturert beløp</option>
                <option value="Kansellert tjeneste">Kansellert tjeneste</option>
                <option value="Dobbeltfakturering">Dobbeltfakturering</option>
                <option value="Kunde misfornøyd">Kunde misfornøyd</option>
                <option value="Prisreduksjon avtalt">Prisreduksjon avtalt</option>
                <option value="Annet">Annet</option>
              </select>
              {creditNoteReason === 'Annet' && (
                <textarea 
                  placeholder="Beskriv årsaken..."
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              )}
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 mt-6">
            <p className="text-sm text-purple-800">
              Kreditnotanummer blir: <strong>K{invoice.invoiceNumber}</strong>
            </p>
            <p className="text-xs text-purple-600 mt-1">Kreditnotaen kobles direkte til denne fakturaen</p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setShowCreditNoteModal(false)} 
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={creatingCreditNote}
            >
              Avbryt
            </button>
            <button 
              onClick={handleCreateCreditNote} 
              disabled={!creditNoteReason || (creditNoteAmount === 'partial' && partialAmount <= 0) || creatingCreditNote}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {creatingCreditNote ? 'Oppretter...' : 'Opprett kreditnota'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-preview, #invoice-preview * {
            visibility: visible;
          }
          #invoice-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </Layout>
  );
}
