'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
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
    PARTIALLY_PAID: 'bg-yellow-200 text-yellow-800',
    CREDITED: 'bg-purple-200 text-purple-800',
    CANCELLED: 'bg-gray-300 text-gray-600',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Kladd',
    SENT: 'Sendt',
    DELIVERED: 'Levert',
    PAID: 'Betalt',
    OVERDUE: 'Forfalt',
    PARTIALLY_PAID: 'Delvis betalt',
    CREDITED: 'Kreditert',
    CANCELLED: 'Kansellert',
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesFilter = filter === 'ALL' || inv.status === filter;
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Statistikk
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'DRAFT').length,
    sent: invoices.filter(i => i.status === 'SENT').length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    overdue: invoices.filter(i => i.status === 'OVERDUE').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
    paidAmount: invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.totalAmount, 0),
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

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fakturaer</h1>
          <p className="text-gray-600">{invoices.length} fakturaer totalt</p>
        </div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ➕ Ny faktura
        </Link>
      </div>

      {/* Statistikk-kort */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Totalt</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Kladder</p>
          <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Sendt</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Betalt</p>
          <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Forfalt</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      {/* Filtre og søk */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm ${
                filter === status 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'ALL' ? 'Alle' : statusLabels[status]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Søk etter fakturanr eller kunde..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-64 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Fakturaliste */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">📄</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen fakturaer ennå</h2>
          <p className="text-gray-600 mb-4">Opprett din første faktura fra en kunde</p>
          <Link
            href="/customers"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Gå til kunder
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fakturanr</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dato</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Forfall</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beløp</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link 
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{invoice.customer?.name || 'Ukjent'}</div>
                    {invoice.customer?.email && (
                      <div className="text-sm text-gray-500">{invoice.customer.email}</div>
                    )}
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
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Vis →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
