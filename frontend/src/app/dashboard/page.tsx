'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { api } from '@/lib/api';

interface DashboardStats {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  totalProducts: number;
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  issueDate: string;
  customer: {
    name: string;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [invoices, customers, products] = await Promise.all([
        api.getInvoices(),
        api.getCustomers(),
        api.getProducts(),
      ]);

      // Beregn statistikk
      const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
      const paidRevenue = invoices
        .filter((inv: any) => inv.status === 'PAID')
        .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);

      setStats({
        totalInvoices: invoices.length,
        draftInvoices: invoices.filter((i: any) => i.status === 'DRAFT').length,
        sentInvoices: invoices.filter((i: any) => i.status === 'SENT').length,
        paidInvoices: invoices.filter((i: any) => i.status === 'PAID').length,
        overdueInvoices: invoices.filter((i: any) => i.status === 'OVERDUE').length,
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalRevenue,
        paidRevenue,
        outstandingRevenue: totalRevenue - paidRevenue,
      });

      // Siste 5 fakturaer
      setRecentInvoices(
        invoices
          .sort((a: any, b: any) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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
    PAID: 'bg-green-200 text-green-800',
    OVERDUE: 'bg-red-200 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Kladd',
    SENT: 'Sendt',
    PAID: 'Betalt',
    OVERDUE: 'Forfalt',
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Oversikt over faktureringssystemet</p>
      </div>

      {/* Hovedstatistikk */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Total omsetning</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Innbetalt</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.paidRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Utestående</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats?.outstandingRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Kunder</p>
          <p className="text-2xl font-bold text-blue-600">{stats?.totalCustomers || 0}</p>
        </div>
      </div>

      {/* Faktura-statistikk */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{stats?.totalInvoices || 0}</p>
          <p className="text-sm text-gray-500">Totalt</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-gray-500">{stats?.draftInvoices || 0}</p>
          <p className="text-sm text-gray-500">Kladder</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats?.sentInvoices || 0}</p>
          <p className="text-sm text-gray-500">Sendt</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{stats?.paidInvoices || 0}</p>
          <p className="text-sm text-gray-500">Betalt</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{stats?.overdueInvoices || 0}</p>
          <p className="text-sm text-gray-500">Forfalt</p>
        </div>
      </div>

      {/* Hurtiglenker og siste fakturaer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hurtiglenker */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Hurtiglenker</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/customers"
              className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition"
            >
              <span className="text-2xl">👥</span>
              <div>
                <p className="font-medium">Ny faktura</p>
                <p className="text-sm text-gray-500">Via kunderegisteret</p>
              </div>
            </Link>
            <Link
              href="/customers"
              className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition"
            >
              <span className="text-2xl">➕</span>
              <div>
                <p className="font-medium">Ny kunde</p>
                <p className="text-sm text-gray-500">Legg til kunde</p>
              </div>
            </Link>
            <Link
              href="/invoices"
              className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition"
            >
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium">Fakturaer</p>
                <p className="text-sm text-gray-500">Se alle fakturaer</p>
              </div>
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition"
            >
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-medium">Produkter</p>
                <p className="text-sm text-gray-500">Administrer produkter</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Siste fakturaer */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Siste fakturaer</h2>
            <Link href="/invoices" className="text-blue-600 hover:text-blue-800 text-sm">
              Se alle →
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Ingen fakturaer ennå</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500">{invoice.customer?.name || 'Ukjent'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.totalAmount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[invoice.status] || 'bg-gray-200'}`}>
                      {statusLabels[invoice.status] || invoice.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
