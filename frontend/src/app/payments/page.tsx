'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    customer: {
      name: string;
    };
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await api.getPayments();
      setPayments(data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const methodLabels: Record<string, string> = {
    BANK: 'Bank',
    CARD: 'Kort',
    VIPPS: 'Vipps',
    STRIPE: 'Stripe',
    CASH: 'Kontant',
    OTHER: 'Annet',
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

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
        <h1 className="text-3xl font-bold text-gray-900">Betalinger</h1>
        <p className="text-gray-600">{payments.length} betalinger registrert</p>
      </div>

      {/* Statistikk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Totalt innbetalt</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Antall betalinger</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Gjennomsnitt</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(payments.length > 0 ? totalAmount / payments.length : 0)}
          </p>
        </div>
      </div>

      {/* Betalingsliste */}
      {payments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">💳</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen betalinger ennå</h2>
          <p className="text-gray-600">Betalinger vil vises her når fakturaer blir betalt</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dato</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Faktura</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Metode</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Referanse</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beløp</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDate(payment.paidAt)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/invoices/${payment.invoice.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {payment.invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{payment.invoice.customer?.name || 'Ukjent'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100">
                      {methodLabels[payment.method] || payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-sm">
                    {payment.reference || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">
                    {formatCurrency(payment.amount)}
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
