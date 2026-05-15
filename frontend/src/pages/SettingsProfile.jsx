import { useEffect, useState } from 'react';
import { ChevronLeft, Save, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

export default function SettingsProfile() {
  const [searchParams] = useSearchParams();
  const isCompletionRequired = searchParams.get('complete') === '1';
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get('/auth/me');
        const user = response.data?.user;

        if (user) {
          setForm({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            address: user.address || '',
          });
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat profil.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };

    if (!payload.name || !payload.email) {
      setError('Nama dan email wajib diisi.');
      return;
    }

    if (!payload.phone || !payload.address) {
      setError('Telepon dan alamat wajib diisi agar akun bisa digunakan.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/auth/me', payload);
      const updatedUser = response.data?.user;
      if (updatedUser) {
        setForm({
          name: updatedUser.name || '',
          email: updatedUser.email || '',
          phone: updatedUser.phone || '',
          address: updatedUser.address || '',
        });
      }
      setSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition">
        <ChevronLeft className="w-4 h-4" />
        Kembali ke Pengaturan
      </Link>

      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detail Personal</h1>
          <p className="text-sm text-gray-500">Perbarui data akun utama Anda</p>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}
      {isCompletionRequired && (
        <p className="text-sm text-amber-700 font-bold bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl">
          Lengkapi telepon dan alamat dulu sebelum memakai fitur utama aplikasi.
        </p>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
        {loading ? (
          <p className="text-sm text-gray-500">Memuat data profil...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nama</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Telepon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="+6281234567890"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Alamat</label>
              <textarea
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-24 resize-y"
                placeholder="Masukkan alamat lengkap"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
