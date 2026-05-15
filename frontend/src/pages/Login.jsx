import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import api from '../lib/api';

function isProfileComplete(user) {
  return Boolean(user?.phone && String(user.phone).trim() && user?.address && String(user.address).trim());
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);

      if (isProfileComplete(user)) {
        navigate('/dashboard');
        return;
      }

      navigate('/settings/profile?complete=1');
    } catch (err) {
      const message = err.response?.data?.error || 'Email atau password salah. Silakan coba lagi.';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-600 to-emerald-800 rounded-b-[4rem] z-0 shadow-lg"></div>

      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 z-10 relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-emerald-600 mb-1">Mindfase</h1>
          <p className="text-gray-500 font-medium">Sistem Keuangan Pribadi</p>
        </div>

        <div className="flex border-b border-gray-200 mb-8 relative">
          <button className="flex-1 pb-3 text-emerald-600 font-bold border-b-2 border-emerald-600">Masuk</button>
          <Link to="/register" className="flex-1 pb-3 text-center text-gray-400 font-bold hover:text-gray-600 transition">Daftar Akun</Link>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium transition-colors"
                placeholder="Masukkan email"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium transition-colors"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
              <span className="text-sm font-medium text-gray-600">Ingat saya (7 hari)</span>
            </label>
            <a href="#" className="text-sm font-bold text-emerald-600 hover:text-emerald-700">Lupa Password?</a>
          </div>

          {error && <p className="text-red-500 text-sm font-bold mt-2 text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/30 mt-4"
          >
            Masuk
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-500 font-medium text-sm">
            Belum punya akun? <Link to="/register" className="text-emerald-600 font-bold hover:underline">Daftar sekarang</Link>
          </p>
        </div>
      </div>

      <p className="text-emerald-100/80 text-sm mt-8 z-10 font-medium text-center">
        &copy; 2026 Mindfase. All rights reserved.
      </p>
    </div>
  );
}
