'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Order {
  id: string;
  sourceOrderId: string;
  source: string;
  status: string;
  receivedAt: string;
  processedAt: string | null;
  invoiceId: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
  };
  customerEmail: string;
  customerName: string;
  totalAmount: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Ordrer er ikke implementert ennå - vis tom liste
      setOrders([]);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
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

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-200 text-yellow-800',
    PROCESSING: 'bg-blue-200 text-blue-800',
    COMPLETED: 'bg-green-200 text-green-800',
    FAILED: 'bg-red-200 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Venter',
    PROCESSING: 'Behandles',
    COMPLETED: 'Fullført',
    FAILED: 'Feilet',
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ordrer</h1>
        <p className="text-gray-600">Ordrer mottatt fra tax.salestext.no</p>
      </div>

      {/* Info-boks */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-blue-800 mb-1">Webhook-endepunkt</h3>
        <code className="text-sm bg-blue-100 px-2 py-1 rounded">
          POST https://invoice.dtax.no/api/orders/receive
        </code>
        <p className="text-sm text-blue-600 mt-2">
          Ordrer fra tax.salestext.no blir automatisk konvertert til fakturaer
        </p>
      </div>

      {/* Ordreliste */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">📥</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen ordrer mottatt</h2>
          <p className="text-gray-600 mb-4">Ordrer fra tax.salestext.no vil vises her</p>
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">API-detaljer:</p>
            <p className="text-xs text-gray-500">
              Endpoint: <code className="bg-gray-200 px-1 rounded">/api/orders/receive</code>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Autentisering: HMAC-signatur i X-Signature header
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ordre-ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kilde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Mottatt</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Faktura</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beløp</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{order.sourceOrderId}</td>
                  <td className="px-6 py-4 text-gray-600">{order.source}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{order.customerName}</div>
                    <div className="text-sm text-gray-500">{order.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-200'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatDate(order.receivedAt)}</td>
                  <td className="px-6 py-4">
                    {order.invoice ? (
                      <Link
                        href={`/invoices/${order.invoice.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {order.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(order.totalAmount)}
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
