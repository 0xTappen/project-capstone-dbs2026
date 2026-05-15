import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Calendar, Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export default function Reports() {
  const reportRef = useRef(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState(() => [new Date().getFullYear()]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTransactions = async () => {
      const currentYear = new Date().getFullYear();
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/transactions');
        const rows = Array.isArray(response.data) ? response.data : [];
        setTransactions(rows);

        const yearsFromData = Array.from(
          new Set(
            rows
              .map((transaction) => toDate(transaction.transaction_date).getFullYear())
              .filter((year) => Number.isFinite(year))
          )
        ).sort((a, b) => b - a);

        const years = yearsFromData.length > 0
          ? yearsFromData
          : [currentYear, currentYear - 1, currentYear - 2];

        setAvailableYears(years);
        setSelectedYear((prev) => (years.includes(prev) ? prev : years[0]));
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data laporan.');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []);

  const yearlyTransactions = useMemo(
    () => transactions.filter((transaction) => toDate(transaction.transaction_date).getFullYear() === selectedYear),
    [transactions, selectedYear]
  );

  const openingBalance = useMemo(() => {
    const startOfYear = new Date(selectedYear, 0, 1);

    return transactions.reduce((balance, transaction) => {
      const date = toDate(transaction.transaction_date);
      if (date >= startOfYear) {
        return balance;
      }

      const amount = toNumber(transaction.amount);
      return normalizeTransactionType(transaction.type) === 'income' ? balance + amount : balance - amount;
    }, 0);
  }, [transactions, selectedYear]);

  const totalIncome = yearlyTransactions
    .filter((transaction) => normalizeTransactionType(transaction.type) === 'income')
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

  const totalExpense = yearlyTransactions
    .filter((transaction) => normalizeTransactionType(transaction.type) === 'expense')
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

  const netSavings = totalIncome - totalExpense;
  const closingBalance = openingBalance + netSavings;

  const yearlyData = useMemo(() => {
    const base = MONTHS.map((month) => ({ name: month, income: 0, expense: 0, savings: 0, cumulativeSavings: 0 }));

    yearlyTransactions.forEach((transaction) => {
      const month = toDate(transaction.transaction_date).getMonth();
      if (!Number.isInteger(month) || month < 0 || month > 11) {
        return;
      }
      const amount = toNumber(transaction.amount);

      if (normalizeTransactionType(transaction.type) === 'income') {
        base[month].income += amount;
      } else {
        base[month].expense += amount;
      }
    });

    return base
      .reduce(
        (acc, row) => {
          const monthlySavings = row.income - row.expense;
          const cumulativeSavings = acc.running + monthlySavings;
          acc.rows.push({
            ...row,
            savings: monthlySavings,
            cumulativeSavings,
          });
          return {
            rows: acc.rows,
            running: cumulativeSavings,
          };
        },
        { rows: [], running: 0 }
      )
      .rows;
  }, [yearlyTransactions]);

  const categoryData = useMemo(() => {
    const expenses = yearlyTransactions.filter((transaction) => normalizeTransactionType(transaction.type) === 'expense');
    const categoryMap = expenses.reduce((acc, transaction) => {
      const categoryName = transaction.category_name || 'Tanpa Kategori';
      acc[categoryName] = (acc[categoryName] || 0) + toNumber(transaction.amount);
      return acc;
    }, {});

    return Object.keys(categoryMap).map((key) => ({ name: key, value: categoryMap[key] }));
  }, [yearlyTransactions]);

  const exportToPDF = async () => {
    const element = reportRef.current;
    if (!element || exporting) return;

    setExporting(true);
    setError('');

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
      });

      const data = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(data, 'PNG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(data, 'PNG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`Laporan_Keuangan_${selectedYear}.pdf`);
    } catch (err) {
      console.error('Export PDF Error:', err);
      setError('Gagal export PDF. Coba lagi setelah halaman selesai dimuat.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500" ref={reportRef}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Laporan & Visualisasi</h1>
          <p className="text-gray-500 font-medium mt-1">Analisis performa keuangan bulanan dan tahunan</p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={exporting || loading}
          className="w-full md:w-auto justify-center flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
        </button>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

      <div className="flex flex-col md:flex-row gap-4 items-center mb-6" data-html2canvas-ignore>
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="bg-transparent border-none focus:ring-0 text-gray-700 font-bold outline-none cursor-pointer py-1 w-full md:w-auto"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{`Tahun ${year}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saldo Awal Tahun</p>
          <p className="text-2xl font-black text-gray-900 mt-2">Rp {openingBalance.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-2xl font-black text-gray-900 mt-2">Rp {totalIncome.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-bold text-red-600 uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-2xl font-black text-gray-900 mt-2">Rp {totalExpense.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-[1.5rem] border border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Tabungan Bersih</p>
          <p className="text-2xl font-black text-emerald-600 mt-2">Rp {netSavings.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <p className="text-sm font-bold text-gray-500">
        {`Saldo Akhir ${selectedYear}: `}
        <span className="text-gray-900">{`Rp ${closingBalance.toLocaleString('id-ID')}`}</span>
      </p>

      {loading ? (
        <div className="p-10 text-center text-gray-500 font-bold">Memuat laporan...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-2">
            <h3 className="text-xl font-extrabold text-gray-900 mb-6">Arus Kas Tahunan</h3>
            <div className="h-[260px] sm:h-[300px] w-full overflow-x-auto">
              <div className="min-w-[640px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} dx={-10} tickFormatter={(value) => `Rp${value / 1000}k`} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Pemasukan" />
                    <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Pengeluaran" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Distribusi Kategori</h3>
            <p className="text-sm text-gray-500 font-medium mb-4">Pengeluaran berdasarkan kategori</p>
            <div className="h-[200px] w-full flex-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
                <span className="text-xl font-black text-gray-900">{totalExpense > 0 ? `${(totalExpense / 1000).toLocaleString('id-ID')}k` : '0'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center text-xs font-bold text-gray-600">
                  <div className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-3">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Tren Pertumbuhan Tabungan (Per Bulan)</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Analisis tabungan bersih setiap bulan</p>
            <div className="h-[260px] sm:h-[300px] w-full overflow-x-auto">
              <div className="min-w-[640px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} dx={-10} tickFormatter={(value) => `Rp${value / 1000}k`} />
                    <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="cumulativeSavings" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} name="Tabungan Kumulatif" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
