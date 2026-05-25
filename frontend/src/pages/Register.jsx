import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Mail } from 'lucide-react';
import api from '../lib/api';

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (!/(?=.*[a-z])/.test(password)) {
      setError('Password harus mengandung huruf kecil.');
      return;
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      setError('Password harus mengandung huruf besar.');
      return;
    }
    if (!/(?=.*\d)/.test(password)) {
      setError('Password harus mengandung angka.');
      return;
    }

    try {
      await api.post('/auth/register', { name, email, password });
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.error || 'Registrasi gagal. Silakan coba lagi.';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-600 to-emerald-800 rounded-b-[4rem] z-0 shadow-lg"></div>
      
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 z-10 relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-emerald-600 mb-1">Mindfase</h1>
          <p className="text-gray-500 font-medium">Buat Akun Baru</p>
        </div>

        <div className="flex border-b border-gray-200 mb-8 relative">
          <Link to="/login" className="flex-1 pb-3 text-center text-gray-400 font-bold hover:text-gray-600 transition">Masuk</Link>
          <button className="flex-1 pb-3 text-emerald-600 font-bold border-b-2 border-emerald-600">Daftar Akun</button>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lengkap</label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium transition-colors" 
                placeholder="Masukkan nama" 
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
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
                type={showPassword ? "text" : "password"} 
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

          <button 
            type="submit" 
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/30 mt-4"
          >
            Daftar Sekarang
          </button>

          {error && <p className="text-red-500 text-sm font-bold mt-2 text-center">{error}</p>}
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-500 font-medium text-sm">
            Sudah punya akun? <Link to="/login" className="text-emerald-600 font-bold hover:underline">Masuk di sini</Link>
          </p>
        </div>
      </div>
      
    </div>
  );
}
