'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  amount: number;
}

const dummyProducts = [
  { id: '1', name: 'Skatteberegning - Standard', priceType: 'COMMISSION', unitPrice: 0, commissionRate: 0.30, vatRate: 0.25 },
  { id: '2', name: 'Konsulenttime - Senior', priceType: 'HOURLY', unitPrice: 1850, vatRate: 0.25 },
  { id: '3', name: 'Selvangivelse - Enkel', priceType: 'FIXED', unitPrice: 2500, vatRate: 0.25 },
  { id: '4', name: 'Selvangivelse - Utvidet', priceType: 'FIXED', unitPrice: 4500, vatRate: 0.25 },
  { id: '5', name: 'MVA-oppgjør', priceType: 'FIXED', unitPrice: 3500, vatRate: 0.25 },
];

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Faktura-data
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customer, setCustomer] = useState({ name: '', email: '', address: '', postalCode: '', city: '' });
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    // Last faktura-data (dummy)
    setTimeout(() => {
      setInvoiceNumber('2025-0040');
      setCustomer({ name: 'Drammen Data', email: 'faktura@drammendata.no', address: 'Bragernes torg 1', postalCode: '3017', city: 'Drammen' });
      setIssueDate('2024-12-28');
      setDueDate('2025-01-12');
      setNotes('Betaling innen forfallsdato.');
      setLines([
        { id: '1', description: 'Konsulenttjenester - desember', quantity: 5, unitPrice: 1850, vatRate: 0.25, amount: 11562.50 },
        { id: '2', description: 'Reisekostnader', quantity: 1, unitPrice: 850, vatRate: 0.25, amount: 1062.50 },
      ]);
      setLoading(false);
    }, 300);
  }, [params.id]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const addLine = () => {
    if (selectedProduct) {
      const product = dummyProducts.find(p => p.id === selectedProduct);
      if (product) {
        const newLine: InvoiceLine = {
          id: Date.now().toString(),
          description: product.name,
          quantity: 1,
          unitPrice: product.unitPrice,
          vatRate: product.vatRate,
          amount: product.unitPrice * (1 + product.vatRate),
        };
        setLines([...lines, newLine]);
        setSelectedProduct('');
      }
    }
  };

  const addCustomLine = () => {
    setLines([...lines, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: 0.25,
      amount: 0,
    }]);
  };

  const updateLine = (id: string, field: keyof InvoiceLine, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: value };
      if (['quantity', 'unitPrice', 'vatRate'].includes(field)) {
        updated.amount = updated.quantity * updated.unitPrice * (1 + updated.vatRate);
      }
      return updated;
    }));
  };

  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id));

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
    const vatAmount = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice * l.vatRate), 0);
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Fakturakladd lagret!');
    }, 500);
  };

  const handleSend = () => {
    if (!confirm(`Send faktura ${invoiceNumber} til ${customer.email}?`)) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert(`Faktura ${invoiceNumber} sendt til ${customer.email}!`);
      router.push('/invoices');
    }, 500);
  };

  const handleDelete = () => {
    if (!confirm('Er du sikker på at du vil slette denne fakturakladden?')) return;
    router.push('/invoices');
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></Layout>;
  }

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/invoices" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">← Tilbake til fakturaer</Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rediger faktura {invoiceNumber}</h1>
            <p className="text-yellow-600">📝 Kladd - ikke sendt ennå</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDelete} className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50">🗑️ Slett</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {saving ? 'Lagrer...' : '💾 Lagre kladd'}
            </button>
            <button onClick={handleSend} disabled={saving || lines.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              ✉️ Send faktura
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Venstre: Fakturadetaljer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kunde */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Mottaker</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Kundenavn *</label>
                <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">E-post *</label>
                <input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Adresse</label>
                <input type="text" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Postnr</label>
                <input type="text" value={customer.postalCode} onChange={(e) => setCustomer({ ...customer, postalCode: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sted</label>
                <input type="text" value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
          </div>

          {/* Fakturalinjer */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Fakturalinjer</h3>
            
            {/* Legg til produkt */}
            <div className="flex gap-2 mb-4">
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg">
                <option value="">Velg produkt...</option>
                {dummyProducts.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.unitPrice)}</option>)}
              </select>
              <button onClick={addLine} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Legg til</button>
            </div>
            <button onClick={addCustomLine} className="text-sm text-blue-600 hover:text-blue-800 mb-4">+ Egendefinert linje</button>

            {/* Linjer */}
            {lines.length === 0 ? (
              <p className="text-center text-gray-500 py-8 bg-gray-50 rounded">Ingen linjer - legg til produkter eller egne linjer</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.id} className="border rounded-lg p-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input type="text" value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)} className="w-full px-2 py-1 border rounded text-sm" placeholder="Beskrivelse" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-sm" step="0.5" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" value={line.unitPrice} onChange={(e) => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-sm" />
                      </div>
                      <div className="col-span-2">
                        <select value={line.vatRate} onChange={(e) => updateLine(line.id, 'vatRate', parseFloat(e.target.value))} className="w-full px-2 py-1 border rounded text-sm">
                          <option value={0.25}>25%</option>
                          <option value={0.15}>15%</option>
                          <option value={0.12}>12%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        <button onClick={() => removeLine(line.id)} className="text-red-600 hover:text-red-800">🗑️</button>
                      </div>
                    </div>
                    <div className="text-right mt-1 text-sm font-medium">{formatCurrency(line.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notat */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Notat på faktura</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Valgfritt notat som vises på fakturaen..." />
          </div>
        </div>

        {/* Høyre: Sammendrag */}
        <div className="space-y-6">
          {/* Datoer */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Datoer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fakturanummer</label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fakturadato</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Forfallsdato</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
          </div>

          {/* Totaler */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold mb-4">Sammendrag</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-600">Nettobeløp</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">MVA</span><span>{formatCurrency(totals.vatAmount)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Totalbeløp</span><span>{formatCurrency(totals.total)}</span></div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Kladd:</strong> Alle endringer lagres automatisk. Fakturaen sendes ikke før du klikker "Send faktura".
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
