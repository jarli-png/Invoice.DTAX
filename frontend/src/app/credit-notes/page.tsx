'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

interface CreditNote {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  totalAmount: number;
  customer: {
    id: string;
    name: string;
  };
  originalInvoice?: {
    id: string;
    invoiceNumber: string;
  };
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      // Hent alle fakturaer og filtrer ut kreditnotaer (starter med K)
      const invoices = await api.getInvoices();
      const notes = invoices.filter((inv: any) => 
        inv.invoiceNumber.startsWith('K') || inv.status === 'CREDITED'
      );
      setCreditNotes(notes);
    } catch (error) {
      console.error('Failed to fetch credit notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('nb-NO');

  const totalCredited = creditNotes.reduce((sum, cn) => sum + Math.abs(cn.totalAmount), 0);

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Kreditnotaer</h1>
        <p className="text-gray-600">{creditNotes.length} kreditnotaer</p>
      </div>

      {/* Statistikk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Antall kreditnotaer</p>
          <p className="text-2xl font-bold text-gray-900">{creditNotes.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Totalt kreditert</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalCredited)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Info</p>
          <p className="text-sm text-gray-600">
            Kreditnotaer opprettes fra fakturavisningen
          </p>
        </div>
      </div>

      {/* Liste */}
      {creditNotes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen kreditnotaer</h2>
          <p className="text-gray-600 mb-4">
            Kreditnotaer opprettes ved å kreditere en eksisterende faktura
          </p>
          <Link
            href="/invoices"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Gå til fakturaer
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kreditnota</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Original faktura</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dato</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beløp</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {creditNotes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/invoices/${note.id}`}
                      className="font-medium text-purple-600 hover:text-purple-800"
                    >
                      {note.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {note.customer?.name || 'Ukjent'}
                  </td>
                  <td className="px-6 py-4">
                    {note.originalInvoice ? (
                      <Link
                        href={`/invoices/${note.originalInvoice.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {note.originalInvoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(note.issueDate)}</td>
                  <td className="px-6 py-4 text-right font-medium text-purple-600">
                    -{formatCurrency(Math.abs(note.totalAmount))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/invoices/${note.id}`}
                      className="text-purple-600 hover:text-purple-800"
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
