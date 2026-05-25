import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CreditCard, Activity, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getProfileAvatarSrc } from '../lib/profileAvatar';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDate(dateString) {
  if (!dateString) {
    return new Date(NaN);
  }

  const value = String(dateString);
  if (value.includes('T')) {
    return new Date(value);
  }

  return new Date(`${value}T00:00:00`);
}

function normalizeTransactionType(type) {
  const normalized = String(type || '').toLowerCase();
  if (['income', 'pemasukan', 'masuk'].includes(normalized)) {
    return 'income';
  }
  if (['expense', 'pengeluaran', 'keluar'].includes(normalized)) {
    return 'expense';
  }
  return normalized;
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [userProfile, setUserProfile] = useState({ name: 'Pengguna', avatar_url: '' });
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [meRes, transactionsRes, billsRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/transactions'),
          api.get('/bills'),
        ]);

        setUserProfile({
          name: meRes.data?.user?.name || 'Pengguna',
          avatar_url: meRes.data?.user?.avatar_url || '',
        });
        setTransactions(Array.isArray(transactionsRes.data) ? transactionsRes.data : []);
        setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const metrics = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => normalizeTransactionType(t.type) === 'income')
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    const totalExpense = transactions
      .filter((t) => normalizeTransactionType(t.type) === 'expense')
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    const totalInvestment = transactions
      .filter((t) => String(t.category_name || '').toLowerCase().includes('investasi'))
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    const unpaidBills = bills
      .filter((bill) => bill.status === 'unpaid')
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalInvestment,
      unpaidBills,
    };
  }, [transactions, bills]);

  const chartData = useMemo(() => {
    const rows = MONTH_LABELS.map((name) => ({ name, value: 0 }));

    transactions.forEach((transaction) => {
      if (!transaction.transaction_date) {
        return;
      }

      const date = toDate(transaction.transaction_date);
      if (date.getFullYear() !== selectedYear) {
        return;
      }

      const month = date.getMonth();
      const amount = toNumber(transaction.amount);
      rows[month].value += normalizeTransactionType(transaction.type) === 'income' ? amount : -amount;
    });

    return rows.map((row, index) => ({
      ...row,
      value: rows.slice(0, index + 1).reduce((sum, item) => sum + item.value, 0),
    }));
  }, [transactions, selectedYear]);

  const statusLabel = metrics.netBalance >= 0 ? 'Sangat Baik' : 'Perlu Kontrol';

  if (loading) {
    return <div className="p-6 md:p-8 max-w-7xl mx-auto">Memuat dashboard...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

      <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 font-medium mt-1">Selamat datang kembali, {userProfile.name}!</p>
        </div>
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3">
          <Link to="/transactions" className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition shadow-sm" title="Catat Transaksi">
            <Plus className="w-6 h-6 text-emerald-600" />
          </Link>
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold border-2 border-emerald-500 overflow-hidden shadow-sm hover:scale-105 transition-transform cursor-pointer">
            <img src={getProfileAvatarSrc(userProfile)} alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      <div className="bg-emerald-700 rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-white shadow-xl relative overflow-hidden group">

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6 gap-4">
            <div>
              <p className="text-emerald-50 text-sm font-bold uppercase tracking-widest mb-2 opacity-90">Total Saldo Saat Ini</p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight drop-shadow-sm break-words">Rp {metrics.netBalance.toLocaleString('id-ID')}</h2>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-inner">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-8 md:mt-10">
            <div className="bg-white/10 rounded-[1.5rem] p-5 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
              <div className="flex items-center text-emerald-50 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mr-3 shadow-sm">
                  <ArrowUpRight className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Pemasukan</span>
              </div>
              <p className="text-2xl font-black">Rp {metrics.totalIncome.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white/10 rounded-[1.5rem] p-5 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
              <div className="flex items-center text-emerald-50 mb-3">
                <div className="w-8 h-8 rounded-full bg-red-400/30 flex items-center justify-center mr-3 shadow-sm">
                  <ArrowDownRight className="w-4 h-4 text-red-100" strokeWidth={3} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-red-50">Pengeluaran</span>
              </div>
              <p className="text-2xl font-black">Rp {metrics.totalExpense.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <Wallet className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Saldo Bersih</p>
          <p className="text-xl font-black text-gray-900 mt-1">Rp {(metrics.netBalance / 1000).toLocaleString('id-ID')}k</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <CreditCard className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Tagihan Belum Lunas</p>
          <p className="text-xl font-black text-gray-900 mt-1">Rp {metrics.unpaidBills > 0 ? (metrics.unpaidBills / 1000).toLocaleString('id-ID') + 'k' : '0'}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <TrendingUp className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Investasi</p>
          <p className="text-xl font-black text-gray-900 mt-1">Rp {metrics.totalInvestment > 0 ? (metrics.totalInvestment / 1000).toLocaleString('id-ID') + 'k' : '0'}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <Activity className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Status</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{statusLabel}</p>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Tren Saldo</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Statistik pertumbuhan uang Anda</p>
          </div>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 py-2.5 px-5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shadow-sm"
          >
            {[currentYear, currentYear - 1].map((year) => (
              <option key={year} value={year}>{`Tahun ${year}`}</option>
            ))}
          </select>
        </div>
        <div className="h-[260px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 700 }} dy={15} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 700 }} dx={-15} tickFormatter={(value) => `Rp${value / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 'bold', padding: '12px 20px' }}
                formatter={(value) => [`Rp ${toNumber(value).toLocaleString('id-ID')}`, 'Saldo']}
                cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorValue)" activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
