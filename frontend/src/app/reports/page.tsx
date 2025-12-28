'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

interface ReportData {
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  vatAmount: number;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  customerCount: number;
  monthlyRevenue: { month: string; amount: number }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [invoices, customers] = await Promise.all([
        api.getInvoices(),
        api.getCustomers(),
      ]);

      // Beregn statistikk fra fakturaer
      const now = new Date();
      const startDate = new Date();
      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      const filteredInvoices = invoices.filter((inv: any) => 
        new Date(inv.issueDate) >= startDate
      );

      const totalRevenue = filteredInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
      const paidInvoices = filteredInvoices.filter((inv: any) => inv.status === 'PAID');
      const paidRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
      const overdueInvoices = filteredInvoices.filter((inv: any) => inv.status === 'OVERDUE');

      // Estimer MVA (25% av netto)
      const vatAmount = totalRevenue * 0.2; // 25% av brutto = 20% av totalt

      // Månedlig inntekt (siste 6 måneder)
      const monthlyRevenue: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthName = d.toLocaleDateString('nb-NO', { month: 'short' });
        const monthInvoices = invoices.filter((inv: any) => {
          const invDate = new Date(inv.issueDate);
          return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
        });
        monthlyRevenue.push({
          month: monthName,
          amount: monthInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0),
        });
      }

      setData({
        totalRevenue,
        paidRevenue,
        outstandingRevenue: totalRevenue - paidRevenue,
        vatAmount,
        invoiceCount: filteredInvoices.length,
        paidCount: paidInvoices.length,
        overdueCount: overdueInvoices.length,
        customerCount: customers.length,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

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
          <h1 className="text-3xl font-bold text-gray-900">Rapporter</h1>
          <p className="text-gray-600">Økonomisk oversikt</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="month">Siste måned</option>
          <option value="quarter">Siste kvartal</option>
          <option value="year">Siste år</option>
        </select>
      </div>

      {/* Hovedtall */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Total omsetning</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(data?.totalRevenue || 0)}</p>
          <p className="text-sm text-gray-500 mt-1">{data?.invoiceCount || 0} fakturaer</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Innbetalt</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.paidRevenue || 0)}</p>
          <p className="text-sm text-gray-500 mt-1">{data?.paidCount || 0} betalte</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Utestående</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(data?.outstandingRevenue || 0)}</p>
          <p className="text-sm text-red-500 mt-1">{data?.overdueCount || 0} forfalt</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">MVA (estimert)</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(data?.vatAmount || 0)}</p>
          <p className="text-sm text-gray-500 mt-1">25% sats</p>
        </div>
      </div>

      {/* Månedlig oversikt */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Månedlig omsetning</h2>
        {data?.monthlyRevenue && data.monthlyRevenue.length > 0 ? (
          <div className="space-y-3">
            {data.monthlyRevenue.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="w-12 text-sm text-gray-500">{item.month}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (item.amount / Math.max(...data.monthlyRevenue.map(m => m.amount), 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-32 text-right font-medium">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Ingen data for denne perioden</p>
        )}
      </div>

      {/* Oppsummering */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Fakturastatus</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Totalt fakturert</span>
              <span className="font-medium">{data?.invoiceCount || 0} stk</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Betalt</span>
              <span className="font-medium text-green-600">{data?.paidCount || 0} stk</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Forfalt</span>
              <span className="font-medium text-red-600">{data?.overdueCount || 0} stk</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Nøkkeltall</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Antall kunder</span>
              <span className="font-medium">{data?.customerCount || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Gjennomsnitt per faktura</span>
              <span className="font-medium">
                {formatCurrency(data?.invoiceCount ? (data.totalRevenue / data.invoiceCount) : 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Betalingsgrad</span>
              <span className="font-medium">
                {data?.invoiceCount ? Math.round((data.paidCount / data.invoiceCount) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
