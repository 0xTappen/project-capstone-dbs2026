import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Moon, Lock, Tag, ChevronRight, LogOut, Smartphone } from 'lucide-react';
import api from '../lib/api';
import { readDevices, saveDevices } from '../lib/settingsDevices';

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
}

export default function Settings() {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({ name: 'Pengguna', email: 'user@example.com' });
  const [theme, setTheme] = useState('light');
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const [meResponse, settingsResponse] = await Promise.all([
          api.get('/auth/me'),
          api.get('/settings'),
        ]);

        if (meResponse.data?.user) {
          setUserData(meResponse.data.user);
        }

        const loadedTheme = settingsResponse.data?.theme || 'light';
        setTheme(loadedTheme);
        applyTheme(loadedTheme);
        localStorage.setItem('theme', loadedTheme);

        const devices = readDevices();
        saveDevices(devices);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data pengaturan.');
      }
    };

    loadSettingsData();
  }, []);

  const handleToggleTheme = async () => {
    setError('');
    setSuccess('');

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola akun, keamanan, dan preferensi sistem</p>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center space-x-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center overflow-hidden shadow-sm">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`} alt="User" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2>
          <p className="text-gray-500 font-medium mt-1">{userData.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Akun & Keamanan</h3>
          </div>
          <div className="p-3">
            <Link to="/settings/profile" className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Detail Personal</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Nama dan email akun</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition" />
            </Link>

            <Link to="/settings/password" className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
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
            </Link>

            <Link to="/settings/devices" className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
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
            </Link>
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
                <div className={`w-12 h-6 rounded-full relative border transition-colors ${theme === 'dark' ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-200 border-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-[1px] shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-[24px]' : 'translate-x-[2px]'}`} />
                </div>
              </button>

              <Link to="/settings/categories" className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition group">
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
