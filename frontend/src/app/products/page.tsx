'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  vatRate: number;
  unit: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unitPrice: 0,
    vatRate: 0.25,
    unit: 'stk',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const handleNew = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      unitPrice: 0,
      vatRate: 0.25,
      unit: 'stk',
    });
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      unitPrice: product.unitPrice,
      vatRate: product.vatRate,
      unit: product.unit || 'stk',
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
      if (editingProduct) {
        const updated = await api.updateProduct(editingProduct.id, formData);
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        const created = await api.createProduct(formData);
        setProducts([created, ...products]);
      }
      setShowModal(false);
    } catch (error: any) {
      console.error('Failed to save product:', error);
      alert('Kunne ikke lagre produkt: ' + (error.message || 'Ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette dette produktet?')) return;

    try {
      await api.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      alert('Kunne ikke slette produkt: ' + (error.message || 'Ukjent feil'));
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produkter</h1>
          <p className="text-gray-600">{products.length} produkter</p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ➕ Nytt produkt
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-4">📦</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen produkter ennå</h2>
          <p className="text-gray-600 mb-4">Opprett ditt første produkt for å bruke det i fakturaer</p>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ Opprett produkt
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Produkt</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beskrivelse</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pris</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">MVA</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Enhet</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {product.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(product.unitPrice)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100">
                      {(product.vatRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {product.unit || 'stk'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-gray-600 hover:text-gray-800"
                        title="Rediger"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
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

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Rediger produkt' : 'Nytt produkt'}
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
              placeholder="Produktnavn"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Kort beskrivelse (valgfritt)"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pris (NOK)</label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MVA</label>
              <select
                value={formData.vatRate}
                onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0.25">25%</option>
                <option value="0.15">15%</option>
                <option value="0.12">12%</option>
                <option value="0">0%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enhet</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="stk">Stk</option>
                <option value="time">Time</option>
                <option value="dag">Dag</option>
                <option value="måned">Måned</option>
                <option value="kg">Kg</option>
                <option value="m">Meter</option>
              </select>
            </div>
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
              {saving ? 'Lagrer...' : (editingProduct ? 'Oppdater' : 'Opprett')}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
