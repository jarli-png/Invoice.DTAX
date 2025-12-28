'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Customer {
  id: string;
  customerNumber: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  orgNumber: string | null;
  invoices?: Invoice[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  vatRate: number;
  unit: string;
}

interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 0.25 }
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [dueInDays, setDueInDays] = useState(14);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customerData, productsData] = await Promise.all([
        api.getCustomer(params.id as string),
        api.getProducts()
      ]);
      setCustomer(customerData);
      setProducts(productsData);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Kunne ikke laste kunde');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('nb-NO');

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-200 text-gray-800',
    SENT: 'bg-blue-200 text-blue-800',
    DELIVERED: 'bg-blue-200 text-blue-800',
    PAID: 'bg-green-200 text-green-800',
    OVERDUE: 'bg-red-200 text-red-800',
    CREDITED: 'bg-purple-200 text-purple-800',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Kladd',
    SENT: 'Sendt',
    DELIVERED: 'Levert',
    PAID: 'Betalt',
    OVERDUE: 'Forfalt',
    CREDITED: 'Kreditert',
  };

  const addLine = () => {
    setInvoiceLines([...invoiceLines, { description: '', quantity: 1, unitPrice: 0, vatRate: 0.25 }]);
  };

  const removeLine = (index: number) => {
    if (invoiceLines.length > 1) {
      setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const updated = [...invoiceLines];
    updated[index] = { ...updated[index], [field]: value };
    setInvoiceLines(updated);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      updateLine(index, 'description', product.name);
      updateLine(index, 'unitPrice', product.unitPrice);
      updateLine(index, 'vatRate', product.vatRate);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let vatAmount = 0;
    invoiceLines.forEach(line => {
      const lineTotal = line.quantity * line.unitPrice;
      subtotal += lineTotal;
      vatAmount += lineTotal * line.vatRate;
    });
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  };

  const handleCreateInvoice = async () => {
    if (!customer) return;
    
    const validLines = invoiceLines.filter(l => l.description && l.unitPrice > 0);
    if (validLines.length === 0) {
      alert('Legg til minst én fakturalinje');
      return;
    }

    setCreatingInvoice(true);
    try {
      // Hent default organisasjon
      const orgs = await api.getOrganizations();
      const defaultOrg = orgs.find((o: any) => o.isDefault) || orgs[0];
      
      if (!defaultOrg) {
        alert('Ingen organisasjon funnet. Opprett en organisasjon først.');
        return;
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueInDays);

      const invoiceData = {
        customerId: customer.id,
        organizationId: defaultOrg.id,
        dueDate: dueDate.toISOString(),
        notes: invoiceNotes || null,
        lines: validLines.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
        })),
      };

      const invoice = await api.createInvoice(invoiceData);
      alert(`Faktura ${invoice.invoiceNumber} opprettet!`);
      setShowInvoiceModal(false);
      setInvoiceLines([{ description: '', quantity: 1, unitPrice: 0, vatRate: 0.25 }]);
      setInvoiceNotes('');
      
      // Oppdater kundedata for å vise ny faktura
      fetchData();
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      alert('Kunne ikke opprette faktura: ' + (err.message || 'Ukjent feil'));
    } finally {
      setCreatingInvoice(false);
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

  if (error || !customer) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">{error || 'Kunde ikke funnet'}</h2>
          <Link href="/customers" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Tilbake til kunder
          </Link>
        </div>
      </Layout>
    );
  }

  const invoices = customer.invoices || [];
  const totals = calculateTotals();

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link href="/customers" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
          ← Tilbake til kunder
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-1">
              {customer.customerNumber && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Kundenr: {customer.customerNumber}
                </span>
              )}
              {customer.orgNumber && (
                <span className="text-gray-600">Org.nr: {customer.orgNumber}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ Opprett faktura
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Kontaktinformasjon</h3>
          {customer.email && (
            <p className="text-gray-900 mb-1">📧 {customer.email}</p>
          )}
          {customer.phone && (
            <p className="text-gray-900 mb-1">📞 {customer.phone}</p>
          )}
          {!customer.email && !customer.phone && (
            <p className="text-gray-500 italic">Ingen kontaktinfo</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Adresse</h3>
          {customer.address ? (
            <>
              <p className="text-gray-900">{customer.address}</p>
              <p className="text-gray-900">{customer.postalCode} {customer.city}</p>
            </>
          ) : (
            <p className="text-gray-500 italic">Ingen adresse</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Statistikk</h3>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-gray-600">fakturaer</p>
          <p className="text-lg font-medium text-green-600 mt-2">
            {formatCurrency(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0))}
          </p>
          <p className="text-gray-600 text-sm">totalt fakturert</p>
        </div>
      </div>

      {/* Fakturaer */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Fakturaer</h2>
        </div>
        
        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-4">📄</p>
            <p className="text-gray-600 mb-4">Ingen fakturaer ennå</p>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Opprett første faktura
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fakturanr</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dato</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Forfall</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beløp</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/invoices/${invoice.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || 'bg-gray-200'}`}>
                      {statusLabels[invoice.status] || invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(invoice.issueDate)}</td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(invoice.dueDate)}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatCurrency(invoice.totalAmount)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/invoices/${invoice.id}`} className="text-blue-600 hover:text-blue-800">
                      Vis →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Opprett faktura modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Opprett faktura"
        size="lg"
      >
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="font-medium text-blue-800">Kunde: {customer.name}</p>
            {customer.email && <p className="text-blue-600 text-sm">{customer.email}</p>}
          </div>

          {/* Fakturalinjer */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Fakturalinjer</h3>
              <button
                onClick={addLine}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Legg til linje
              </button>
            </div>

            <div className="space-y-3">
              {invoiceLines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    {products.length > 0 ? (
                      <select
                        onChange={(e) => selectProduct(index, e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="">Velg produkt eller skriv selv...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.unitPrice)}</option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      placeholder="Beskrivelse"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Antall"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Pris"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      min="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={line.vatRate}
                      onChange={(e) => updateLine(index, 'vatRate', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border rounded text-sm"
                    >
                      <option value="0.25">25% MVA</option>
                      <option value="0.15">15% MVA</option>
                      <option value="0.12">12% MVA</option>
                      <option value="0">0% MVA</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {invoiceLines.length > 1 && (
                      <button
                        onClick={() => removeLine(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forfall */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Forfallsdato</label>
            <select
              value={dueInDays}
              onChange={(e) => setDueInDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="7">7 dager</option>
              <option value="14">14 dager</option>
              <option value="30">30 dager</option>
              <option value="45">45 dager</option>
            </select>
          </div>

          {/* Notat */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Notat (valgfritt)</label>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              rows={2}
              placeholder="Eventuell merknad på fakturaen"
            />
          </div>

          {/* Totaler */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span>Subtotal:</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>MVA:</span>
              <span>{formatCurrency(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Totalt:</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {/* Knapper */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowInvoiceModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={creatingInvoice}
            >
              Avbryt
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={creatingInvoice || invoiceLines.every(l => !l.description || l.unitPrice <= 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingInvoice ? 'Oppretter...' : 'Opprett faktura'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
