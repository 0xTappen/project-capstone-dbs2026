import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Tag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import AppDialog from '../components/AppDialog';

export default function SettingsCategories() {
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '', type: 'expense' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTargetCategory, setDeleteTargetCategory] = useState(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.get('/categories');
        if (Array.isArray(response.data)) {
          setCategories(response.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat kategori.');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.id) - Number(b.id)),
    [categories]
  );

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      name: categoryForm.name.trim(),
      type: categoryForm.type,
    };

    if (!payload.name) {
      setError('Nama kategori wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (categoryForm.id) {
        const response = await api.put(`/categories/${categoryForm.id}`, payload);
        setCategories((prev) => prev.map((category) => (category.id === categoryForm.id ? response.data : category)));
        setSuccess('Kategori berhasil diperbarui.');
      } else {
        const response = await api.post('/categories', payload);
        setCategories((prev) => [response.data, ...prev]);
        setSuccess('Kategori berhasil ditambahkan.');
      }

      setCategoryForm({ id: null, name: '', type: 'expense' });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = (category) => {
    setError('');
    setSuccess('');
    setCategoryForm({
      id: category.id,
      name: category.name,
      type: category.type,
    });
  };

  const handleDeleteCategory = (category) => {
    setError('');
    setSuccess('');
    setDeleteTargetCategory(category);
  };

  const confirmDeleteCategory = async () => {
    if (!deleteTargetCategory) return;

    try {
      await api.delete(`/categories/${deleteTargetCategory.id}`);
      setCategories((prev) => prev.filter((category) => category.id !== deleteTargetCategory.id));
      setSuccess('Kategori berhasil dihapus.');
      setDeleteTargetCategory(null);

      if (categoryForm.id === deleteTargetCategory.id) {
        setCategoryForm({ id: null, name: '', type: 'expense' });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus kategori.');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition">
        <ChevronLeft className="w-4 h-4" />
        Kembali ke Pengaturan
      </Link>

      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Tag className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategori Transaksi</h1>
          <p className="text-sm text-gray-500">Kelola kategori pemasukan dan pengeluaran</p>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nama Kategori</label>
            <input
              type="text"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tipe</label>
            <select
              value={categoryForm.type}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, type: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setCategoryForm({ id: null, name: '', type: 'expense' })}
              className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : categoryForm.id ? 'Update' : 'Tambah'}
            </button>
          </div>
        </form>

        <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
          {loading && <p className="text-sm text-gray-500">Memuat kategori...</p>}

          {!loading && sortedCategories.length === 0 && (
            <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
              Belum ada kategori.
            </div>
          )}

          {sortedCategories.map((category) => (
            <div key={category.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 break-words">{category.name}</p>
                <p className="text-xs text-gray-500">{category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEditCategory(category)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteCategory(category)} className="p-2 rounded-lg text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AppDialog
        open={Boolean(deleteTargetCategory)}
        title="Hapus Kategori?"
        description={`Kategori "${deleteTargetCategory?.name || ''}" akan dihapus permanen.`}
        confirmText="Hapus"
        cancelText="Batal"
        danger
        onCancel={() => setDeleteTargetCategory(null)}
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}
