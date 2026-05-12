import { useEffect, useMemo, useState } from 'react';
import {
  User,
  Moon,
  Lock,
  Tag,
  ChevronRight,
  LogOut,
  Smartphone,
  X,
  Pencil,
  Trash2,
  Monitor,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const DEVICES_STORAGE_KEY = 'mindfase_devices';

function detectBrowser(userAgent) {
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return 'Safari';
  return 'Browser';
}

function getCurrentDevice() {
  const userAgent = navigator.userAgent || 'Unknown Agent';
  const platform = navigator.platform || 'Unknown Platform';
  const browser = detectBrowser(userAgent);
  const id = `${platform}-${browser}`;

  return {
    id,
    name: `${browser} di ${platform}`,
    platform,
    browser,
    isCurrent: true,
    lastActive: new Date().toISOString(),
  };
}

function mergeCurrentDevice(devices) {
  const current = getCurrentDevice();
  const now = new Date().toISOString();

  const existing = Array.isArray(devices) ? devices : [];
  const others = existing.filter((device) => device.id !== current.id).map((device) => ({
    ...device,
    isCurrent: false,
  }));

  return [{ ...current, lastActive: now }, ...others].slice(0, 8);
}

function readDevices() {
  try {
    const raw = localStorage.getItem(DEVICES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return mergeCurrentDevice(parsed);
  } catch {
    return mergeCurrentDevice([]);
  }
}

function saveDevices(devices) {
  localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
}

export default function Settings() {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({ name: 'Pengguna', email: 'user@example.com' });
  const [theme, setTheme] = useState('light');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isDevicesOpen, setIsDevicesOpen] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '', type: 'expense' });
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [meResponse, settingsResponse, categoriesResponse] = await Promise.all([
          api.get('/auth/me'),
          api.get('/settings'),
          api.get('/categories'),
        ]);

        if (meResponse.data?.user) {
          const user = meResponse.data.user;
          setUserData(user);
          setProfileForm({
            name: user.name || '',
            email: user.email || '',
          });
        }

        if (settingsResponse.data?.theme) {
          const loadedTheme = settingsResponse.data.theme;
          setTheme(loadedTheme);
          applyTheme(loadedTheme);
          localStorage.setItem('theme', loadedTheme);
        }

        if (Array.isArray(categoriesResponse.data)) {
          setCategories(categoriesResponse.data);
        }

        const mergedDevices = readDevices();
        saveDevices(mergedDevices);
        setDevices(mergedDevices);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data pengaturan.');
      }
    };

    loadInitialData();
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const openEditModal = () => {
    clearMessages();
    setProfileForm({ name: userData.name || '', email: userData.email || '' });
    setIsEditOpen(true);
  };

  const openPasswordModal = () => {
    clearMessages();
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsPasswordOpen(true);
  };

  const openCategoryModal = () => {
    clearMessages();
    setCategoryForm({ id: null, name: '', type: 'expense' });
    setIsCategoryOpen(true);
  };

  const openDevicesModal = () => {
    clearMessages();
    const latestDevices = readDevices();
    saveDevices(latestDevices);
    setDevices(latestDevices);
    setIsDevicesOpen(true);
  };

  const closeAllModals = () => {
    if (isSavingProfile || isSavingPassword || isSavingCategory) return;
    setIsEditOpen(false);
    setIsPasswordOpen(false);
    setIsCategoryOpen(false);
    setIsDevicesOpen(false);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim().toLowerCase(),
    };

    if (!payload.name || !payload.email) {
      setError('Nama dan email wajib diisi.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await api.put('/auth/me', payload);
      const updatedUser = response.data?.user;

      if (updatedUser) {
        setUserData(updatedUser);
        setProfileForm({ name: updatedUser.name || '', email: updatedUser.email || '' });
      }

      setSuccess('Profil berhasil diperbarui.');
      setIsEditOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memperbarui profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Semua field password wajib diisi.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setSuccess('Password berhasil diperbarui.');
      setIsPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memperbarui password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleTheme = async () => {
    clearMessages();
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    setIsSavingTheme(true);

    try {
      await api.put('/settings', { theme: nextTheme });
      setSuccess(`Tema ${nextTheme === 'dark' ? 'gelap' : 'terang'} berhasil diterapkan.`);
    } catch (err) {
      const fallbackTheme = nextTheme === 'dark' ? 'light' : 'dark';
      setTheme(fallbackTheme);
      applyTheme(fallbackTheme);
      localStorage.setItem('theme', fallbackTheme);
      setError(err.response?.data?.error || 'Gagal menyimpan preferensi tema.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    clearMessages();

    const payload = {
      name: categoryForm.name.trim(),
      type: categoryForm.type,
    };

    if (!payload.name) {
      setError('Nama kategori wajib diisi.');
      return;
    }

    setIsSavingCategory(true);
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
      setIsSavingCategory(false);
    }
  };

  const handleEditCategory = (category) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      type: category.type,
    });
  };

  const handleDeleteCategory = async (id) => {
    clearMessages();
    if (!window.confirm('Hapus kategori ini?')) return;

    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((category) => category.id !== id));
      setSuccess('Kategori berhasil dihapus.');

      if (categoryForm.id === id) {
        setCategoryForm({ id: null, name: '', type: 'expense' });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus kategori.');
    }
  };

  const handleRemoveDevice = (deviceId) => {
    const updatedDevices = devices.filter((device) => device.id !== deviceId || device.isCurrent);
    saveDevices(updatedDevices);
    setDevices(updatedDevices);
    setSuccess('Perangkat berhasil dihapus dari daftar.');
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.id) - Number(b.id)),
    [categories]
  );

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola preferensi dan akun Anda</p>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center space-x-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center overflow-hidden shadow-sm">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`} alt="User" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2>
          <p className="text-gray-500 font-medium mt-1 mb-3">{userData.email}</p>
          <button
            onClick={openEditModal}
            className="text-sm font-bold text-emerald-600 bg-emerald-50 px-5 py-2 rounded-xl hover:bg-emerald-100 transition border border-emerald-100"
          >
            Edit Profil
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Akun & Keamanan</h3>
          </div>
          <div className="p-3">
            <button onClick={openEditModal} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Detail Personal</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Email, Telepon, Alamat</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition" />
            </button>
            <button onClick={openPasswordModal} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Ganti Password</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Perbarui kata sandi Anda</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition" />
            </button>
            <button onClick={openDevicesModal} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Perangkat Terhubung</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Lihat sesi perangkat aktif</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Preferensi Sistem</h3>
            </div>
            <div className="p-3">
              <button
                onClick={handleToggleTheme}
                disabled={isSavingTheme}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group disabled:opacity-60"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Moon className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Tema Gelap (Dark Mode)</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Kurangi silau pada layar</p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full relative cursor-pointer border transition-colors ${theme === 'dark' ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-200 border-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-[1px] shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-[24px]' : 'translate-x-[2px]'}`}></div>
                </div>
              </button>
              <button onClick={openCategoryModal} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Kategori Transaksi</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Kelola jenis pemasukan & pengeluaran</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition" />
              </button>
            </div>
          </div>
          <div className="p-6 mt-auto">
            <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-600 py-3.5 rounded-xl font-bold hover:bg-red-100 transition border border-red-100 shadow-sm">
              <LogOut className="w-5 h-5" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Edit Profil</h3>
              <button onClick={closeAllModals} disabled={isSavingProfile} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nama</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={closeAllModals} disabled={isSavingProfile} className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSavingProfile} className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50">{isSavingProfile ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Ganti Password</h3>
              <button onClick={closeAllModals} disabled={isSavingPassword} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Password Saat Ini</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Password Baru</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={closeAllModals} disabled={isSavingPassword} className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSavingPassword} className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50">{isSavingPassword ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCategoryOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Kelola Kategori Transaksi</h3>
              <button onClick={closeAllModals} disabled={isSavingCategory} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    disabled={isSavingCategory}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSavingCategory ? 'Menyimpan...' : categoryForm.id ? 'Update' : 'Tambah'}
                  </button>
                </div>
              </form>

              <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
                {sortedCategories.length === 0 && (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                    Belum ada kategori.
                  </div>
                )}

                {sortedCategories.map((category) => (
                  <div key={category.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditCategory(category)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCategory(category.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isDevicesOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Perangkat Terhubung</h3>
              <button onClick={closeAllModals} className="p-2 rounded-lg hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[420px] overflow-auto">
              {devices.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                  Belum ada data perangkat.
                </div>
              )}

              {devices.map((device) => (
                <div key={device.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{device.name}</p>
                      <p className="text-xs text-gray-500">Terakhir aktif: {new Date(device.lastActive).toLocaleString('id-ID')}</p>
                      {device.isCurrent && (
                        <span className="inline-block mt-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          Perangkat Saat Ini
                        </span>
                      )}
                    </div>
                  </div>

                  {!device.isCurrent && (
                    <button onClick={() => handleRemoveDevice(device.id)} className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
                      Hapus
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
