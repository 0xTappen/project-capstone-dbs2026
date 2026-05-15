import { useEffect, useState } from 'react';
import { ChevronLeft, Save, User, Camera, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { getProfileAvatarSrc } from '../lib/profileAvatar';

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_PREVIEW_MAX_SIZE = 320;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal membaca gambar.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

async function fileToCompressedDataUrl(file) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(1, AVATAR_PREVIEW_MAX_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function SettingsProfile() {
  const [searchParams] = useSearchParams();
  const isCompletionRequired = searchParams.get('complete') === '1';
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', avatar_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
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
            avatar_url: user.avatar_url || '',
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
      avatar_url: form.avatar_url || null,
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
          avatar_url: updatedUser.avatar_url || '',
        });
      }
      window.dispatchEvent(new Event('profile-updated'));
      setSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar.');
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setError('Ukuran gambar maksimal 5MB.');
      return;
    }

    setError('');
    setIsUploadingAvatar(true);

    try {
      const avatarDataUrl = await fileToCompressedDataUrl(file);
      setForm((prev) => ({ ...prev, avatar_url: avatarDataUrl }));
    } catch {
      setError('Gagal memproses gambar profil.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatar_url: '' }));
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Foto Profil</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-50 overflow-hidden shrink-0">
                  <img
                    src={getProfileAvatarSrc({ name: form.name || 'Pengguna', avatar_url: form.avatar_url })}
                    alt="Foto Profil"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition">
                    <Camera className="w-4 h-4" />
                    {isUploadingAvatar ? 'Memproses...' : 'Ganti Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      disabled={isUploadingAvatar || saving}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Foto
                  </button>
                </div>
              </div>
            </div>

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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
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
