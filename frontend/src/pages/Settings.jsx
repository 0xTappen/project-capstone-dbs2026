import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Moon, Lock, Tag, ChevronRight, LogOut, Smartphone, Sun, Monitor } from 'lucide-react';
import api from '../lib/api';
import { readDevices, saveDevices } from '../lib/settingsDevices';

const THEME_MODE_KEY = 'theme_mode';

function getThemeModeFromStorage() {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getResolvedSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Settings() {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({ name: 'Pengguna', email: 'user@example.com' });
  const [themeMode, setThemeMode] = useState(() => getThemeModeFromStorage());
  const [activeTheme, setActiveTheme] = useState(() => (getThemeModeFromStorage() === 'system' ? getResolvedSystemTheme() : getThemeModeFromStorage()));
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const [meResponse, settingsResponse] = await Promise.all([api.get('/auth/me'), api.get('/settings')]);

        if (meResponse.data?.user) {
          setUserData(meResponse.data.user);
        }

        const serverTheme = String(settingsResponse.data?.theme || '').trim().toLowerCase();
        const normalizedTheme = ['light', 'dark', 'system'].includes(serverTheme) ? serverTheme : getThemeModeFromStorage();

        setThemeMode(normalizedTheme);
        const resolved = normalizedTheme === 'system' ? getResolvedSystemTheme() : normalizedTheme;
        setActiveTheme(resolved);
        localStorage.setItem(THEME_MODE_KEY, normalizedTheme);
        window.dispatchEvent(new Event('theme-mode-updated'));

        const devices = readDevices();
        saveDevices(devices);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data pengaturan.');
      }
    };

    loadSettingsData();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      const currentMode = getThemeModeFromStorage();
      setThemeMode(currentMode);
      setActiveTheme(currentMode === 'system' ? getResolvedSystemTheme() : currentMode);
    };

    updateTheme();

    const handleMediaChange = () => updateTheme();
    const handleThemeChanged = () => updateTheme();

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('theme-changed', handleThemeChanged);
    window.addEventListener('theme-mode-updated', handleThemeChanged);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('theme-changed', handleThemeChanged);
      window.removeEventListener('theme-mode-updated', handleThemeChanged);
    };
  }, []);

  const handleSelectThemeMode = async (nextMode) => {
    if (nextMode === themeMode || isSavingTheme) return;

    setError('');
    setSuccess('');
    setIsSavingTheme(true);

    const previousMode = themeMode;
    const previousResolvedTheme = activeTheme;
    const resolvedTheme = nextMode === 'system' ? getResolvedSystemTheme() : nextMode;

    setThemeMode(nextMode);
    setActiveTheme(resolvedTheme);
    localStorage.setItem(THEME_MODE_KEY, nextMode);
    window.dispatchEvent(new Event('theme-mode-updated'));

    try {
      await api.put('/settings', { theme: nextMode });
      setSuccess(`Tema berhasil diubah ke ${nextMode === 'system' ? 'System' : nextMode === 'dark' ? 'Dark' : 'Light'}.`);
    } catch (err) {
      setThemeMode(previousMode);
      setActiveTheme(previousResolvedTheme);
      localStorage.setItem(THEME_MODE_KEY, previousMode);
      window.dispatchEvent(new Event('theme-mode-updated'));
      setError(err.response?.data?.error || 'Gagal menyimpan preferensi tema.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola akun, keamanan, dan preferensi sistem</p>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}
      <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 sm:gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`} alt="User" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words leading-tight">{userData.name}</h2>
          <p className="text-gray-500 font-medium mt-1 break-all">{userData.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Akun & Keamanan</h3>
          </div>
          <div className="p-3">
            <Link to="/settings/profile" className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50 rounded-2xl transition group gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-gray-900">Detail Personal</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5 break-words">Nama dan email akun</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition shrink-0" />
            </Link>

            <Link to="/settings/password" className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50 rounded-2xl transition group gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-gray-900">Ganti Password</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5 break-words">Perbarui kata sandi Anda</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition shrink-0" />
            </Link>

            <Link to="/settings/devices" className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50 rounded-2xl transition group gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-gray-900">Perangkat Terhubung</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5 break-words">Lihat sesi perangkat aktif</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition shrink-0" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Preferensi Sistem</h3>
            </div>
            <div className="p-3">
              <div className="w-full p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                      <Moon className="w-6 h-6" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-bold text-gray-900">Mode Tampilan</p>
                      <p className="text-xs font-medium text-gray-500 mt-0.5">Pilih Light, Dark, atau System</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${activeTheme === 'dark' ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {activeTheme === 'dark' ? 'Dark Aktif' : 'Light Aktif'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { key: 'light', label: 'Light', icon: Sun },
                    { key: 'dark', label: 'Dark', icon: Moon },
                    { key: 'system', label: 'System', icon: Monitor },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = themeMode === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectThemeMode(item.key)}
                        disabled={isSavingTheme}
                        className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-bold transition border ${
                          isActive
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        } disabled:opacity-60`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Link to="/settings/categories" className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50 rounded-2xl transition group gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-bold text-gray-900">Kategori Transaksi</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5 break-words">Kelola jenis pemasukan & pengeluaran</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition shrink-0" />
              </Link>
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
    </div>
  );
}
