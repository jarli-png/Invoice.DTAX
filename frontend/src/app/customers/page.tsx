'use client';
import { useState, useEffect } from 'react';
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
  invoices?: any[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    orgNumber: ''
  });

  // Hent kunder fra API
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      postalCode: customer.postalCode || '',
      city: customer.city || '',
      orgNumber: customer.orgNumber || ''
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      postalCode: '',
      city: '',
      orgNumber: ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Navn er påkrevd');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        // Oppdater eksisterende kunde
        const updated = await api.updateCustomer(editingCustomer.id, formData);
        setCustomers(customers.map(c => c.id === editingCustomer.id ? updated : c));
      } else {
        // Opprett ny kunde
        const created = await api.createCustomer(formData);
        setCustomers([created, ...customers]);
      }
      setShowModal(false);
    } catch (error: any) {
      console.error('Failed to save customer:', error);
      alert('Kunne ikke lagre kunde: ' + (error.message || 'Ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne kunden?')) return;

    try {
      await api.deleteCustomer(id);
      setCustomers(customers.filter(c => c.id !== id));
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      alert('Kunne ikke slette kunde: ' + (error.message || 'Ukjent feil'));
    }
  };

  const getInvoiceCount = (customer: Customer) => customer.invoices?.length || 0;
  const getTotalAmount = (customer: Customer) => 
    customer.invoices?.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0) || 0;

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
          <h1 className="text-3xl font-bold text-gray-900">Kunder</h1>
          <p className="text-gray-600">{customers.length} kunder totalt</p>
        </div>
        <button 
          onClick={handleNew} 
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ➕ Ny kunde
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Søk etter navn eller e-post..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">👥</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen kunder ennå</h2>
          <p className="text-gray-600 mb-4">Opprett din første kunde for å komme i gang</p>
          <button 
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ Opprett kunde
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kundenr</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kontakt</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Adresse</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fakturaer</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Totalt</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-medium text-blue-600">
                      {customer.customerNumber || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/customers/${customer.id}`} className="hover:text-blue-600">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      {customer.orgNumber && (
                        <div className="text-sm text-gray-500">Org.nr: {customer.orgNumber}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {customer.email && (
                      <div className="text-sm text-gray-900">{customer.email}</div>
                    )}
                    {customer.phone && (
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {customer.address && (
                      <div className="text-sm text-gray-900">{customer.address}</div>
                    )}
                    {customer.postalCode && customer.city && (
                      <div className="text-sm text-gray-500">{customer.postalCode} {customer.city}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getInvoiceCount(customer)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(getTotalAmount(customer))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="Vis detaljer"
                      >
                        👁️
                      </Link>
                      <button
                        onClick={() => handleEdit(customer)}
                        className="text-gray-600 hover:text-gray-800"
                        title="Rediger"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Slett"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for ny/rediger kunde */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editingCustomer ? 'Rediger kunde' : 'Ny kunde'}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Firmanavn eller personnavn"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="epost@eksempel.no"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="99887766"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Gateadresse"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postnummer</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sted</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Oslo"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisasjonsnummer</label>
            <input
              type="text"
              value={formData.orgNumber}
              onChange={(e) => setFormData({ ...formData, orgNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456789 (valgfritt)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Lagrer...' : (editingCustomer ? 'Oppdater' : 'Opprett kunde')}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
