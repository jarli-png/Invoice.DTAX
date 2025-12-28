'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

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
  isDefault: boolean;
}

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('organization');
  const [formData, setFormData] = useState({
    name: '',
    orgNumber: '',
    address: '',
    postalCode: '',
    city: '',
    email: '',
    phone: '',
    bankAccount: '',
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const orgs = await api.getOrganizations();
      const defaultOrg = orgs.find((o: Organization) => o.isDefault) || orgs[0];
      if (defaultOrg) {
        setOrganization(defaultOrg);
        setFormData({
          name: defaultOrg.name || '',
          orgNumber: defaultOrg.orgNumber || '',
          address: defaultOrg.address || '',
          postalCode: defaultOrg.postalCode || '',
          city: defaultOrg.city || '',
          email: defaultOrg.email || '',
          phone: defaultOrg.phone || '',
          bankAccount: defaultOrg.bankAccount || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      await api.updateOrganization(organization.id, formData);
      alert('Innstillinger lagret!');
      fetchOrganization();
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert('Kunne ikke lagre: ' + (error.message || 'Ukjent feil'));
    } finally {
      setSaving(false);
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

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Innstillinger</h1>
        <p className="text-gray-600">Administrer bedriftsinformasjon og systeminnstillinger</p>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          {[
            { id: 'organization', label: 'Organisasjon' },
            { id: 'invoice', label: 'Faktura' },
            { id: 'api', label: 'API & Integrasjoner' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Organisasjon */}
      {activeTab === 'organization' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Bedriftsinformasjon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedriftsnavn</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organisasjonsnummer</label>
              <input
                type="text"
                value={formData.orgNumber}
                onChange={(e) => setFormData({ ...formData, orgNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postnummer</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sted</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bankkonto</label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="XXXX.XX.XXXXX"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Lagrer...' : 'Lagre endringer'}
            </button>
          </div>
        </div>
      )}

      {/* Faktura-innstillinger */}
      {activeTab === 'invoice' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Fakturainnstillinger</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Betalingsinformasjon på faktura</h3>
              <p className="text-sm text-gray-600">
                Bankkonto: <strong>{formData.bankAccount || 'Ikke satt'}</strong>
              </p>
              <p className="text-sm text-gray-600">
                KID genereres automatisk basert på kundenummer og fakturanummer
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Forfallsdatoer</h3>
              <p className="text-sm text-gray-600">Standard forfall: 14 dager</p>
              <p className="text-sm text-gray-600">Kan endres per faktura</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">MVA-satser</h3>
              <p className="text-sm text-gray-600">Standard: 25%</p>
              <p className="text-sm text-gray-600">Tilgjengelig: 25%, 15%, 12%, 0%</p>
            </div>
          </div>
        </div>
      )}

      {/* API & Integrasjoner */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">E-post (SMTP)</h2>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">✓ Konfigurert</p>
              <p className="text-sm text-green-600 mt-1">
                Domeneshop SMTP via smtp.domeneshop.no
              </p>
              <p className="text-sm text-green-600">
                Avsender: noreply@dtax.no
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">tax.salestext.no Integration</h2>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Webhook-endepunkt</h3>
              <code className="block bg-blue-100 px-3 py-2 rounded text-sm">
                POST https://invoice.dtax.no/api/orders/receive
              </code>
              <p className="text-sm text-blue-600 mt-2">
                Ordrer fra tax.salestext.no blir automatisk konvertert til fakturaer
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Betalingsintegrasjoner</h2>
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-gray-500">Kortbetaling</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Venter konfigurasjon
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">Vipps</p>
                  <p className="text-sm text-gray-500">Mobilbetaling</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Venter konfigurasjon
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">DNB Bank</p>
                  <p className="text-sm text-gray-500">OCR/KID-matching</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Venter kundenummer
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
