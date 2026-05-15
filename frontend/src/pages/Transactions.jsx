import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  FileText,
  CalendarDays,
  Tag as TagIcon,
  Plus,
} from 'lucide-react';
import api from '../lib/api';
import AppDialog from '../components/AppDialog';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

function toIsoToday() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateString) {
  return toDate(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

export default function Transactions() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('Semua');
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState('Pemasukan');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isEditInfoDialogOpen, setIsEditInfoDialogOpen] = useState(false);

  const [formData, setFormData] = useState({ title: '', amount: '', categoryId: '', date: '' });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [transactionsResult, categoriesResult] = await Promise.allSettled([
          api.get('/transactions'),
          api.get('/categories'),
        ]);

        if (transactionsResult.status === 'fulfilled') {
          const rows = Array.isArray(transactionsResult.value.data) ? transactionsResult.value.data : [];
          setTransactions(rows);

          if (rows.length > 0) {
            const latestDate = rows
              .map((transaction) => toDate(transaction.transaction_date))
              .filter((date) => !Number.isNaN(date.getTime()))
              .sort((a, b) => b - a)[0];

            if (latestDate) {
              setSelectedMonth(latestDate.getMonth());
              setSelectedYear(latestDate.getFullYear());
            }
          }
        } else {
          throw transactionsResult.reason;
        }

        if (categoriesResult.status === 'fulfilled') {
          setCategories(Array.isArray(categoriesResult.value.data) ? categoriesResult.value.data : []);
        } else {
          setCategories([]);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data transaksi.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const date = toDate(transaction.transaction_date);
      if (Number.isNaN(date.getTime())) {
        return false;
      }

      const inSelectedMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      if (!inSelectedMonth) {
        return false;
      }

      const normalizedType = normalizeTransactionType(transaction.type);

      if (activeTab === 'Masuk' && normalizedType !== 'income') {
        return false;
      }

      if (activeTab === 'Keluar' && normalizedType !== 'expense') {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const title = String(transaction.description || '').toLowerCase();
      const category = String(transaction.category_name || '').toLowerCase();
      return title.includes(normalizedQuery) || category.includes(normalizedQuery);
    });
  }, [transactions, activeTab, query, selectedMonth, selectedYear]);

  const selectableCategories = useMemo(() => {
    const selectedType = transactionType === 'Pemasukan' ? 'income' : 'expense';
    return categories.filter((category) => category.type === selectedType);
  }, [categories, transactionType]);

  const handleSave = async () => {
    const amount = toNumber(formData.amount);
    if (!formData.title || amount <= 0) {
      setError('Judul dan nominal wajib diisi dengan benar.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const payload = {
        category_id: formData.categoryId ? Number(formData.categoryId) : null,
        type: transactionType === 'Pemasukan' ? 'income' : 'expense',
        amount,
        description: formData.title,
        transaction_date: formData.date || toIsoToday(),
      };

      const response = await api.post('/transactions', payload);
      const saved = response.data;
      const selectedCategory = categories.find((category) => category.id === saved.category_id);

      setTransactions((prev) => [
        {
          ...saved,
          category_name: selectedCategory?.name || saved.category_name || null,
        },
        ...prev,
      ]);

      setShowModal(false);
      setFormData({ title: '', amount: '', categoryId: '', date: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/transactions/${deleteTargetId}`);
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus transaksi.');
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((year) => year - 1);
      return;
    }

    setSelectedMonth((month) => month - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((year) => year + 1);
      return;
    }

    setSelectedMonth((month) => month + 1);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-800">Pencatatan Keuangan</h1>
          <p className="text-gray-500 font-medium mt-1">Kelola dan pantau setiap arus kas Anda dengan rapi.</p>
        </div>
        <button
          onClick={() => {
            setTransactionType('Pemasukan');
            setShowModal(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white px-6 py-3 rounded-2xl font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          <span>Catat Transaksi</span>
        </button>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4 bg-gray-50/50 rounded-2xl p-2 w-full md:w-auto justify-center md:justify-start">
          <button onClick={prevMonth} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl transition text-gray-500 hover:text-emerald-600"><ChevronLeft className="w-5 h-5" /></button>
          <div className="bg-transparent font-extrabold text-gray-800 text-center tracking-wide p-2 text-sm sm:text-base">{`${MONTHS[selectedMonth]} ${selectedYear}`}</div>
          <button onClick={nextMonth} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl transition text-gray-500 hover:text-emerald-600"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="flex space-x-3 w-full md:w-auto">
          <button
            onClick={() => {
              setTransactionType('Pemasukan');
              setShowModal(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-emerald-50 text-emerald-700 px-6 py-3.5 rounded-2xl font-bold hover:bg-emerald-100 transition shadow-sm"
          >
            <ArrowUpCircle className="w-5 h-5" />
            <span>Pemasukan</span>
          </button>
          <button
            onClick={() => {
              setTransactionType('Pengeluaran');
              setShowModal(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-red-50 text-red-700 px-6 py-3.5 rounded-2xl font-bold hover:bg-red-100 transition shadow-sm"
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span>Pengeluaran</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari transaksi (ex: Gaji, Makan)..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none shadow-sm font-medium transition-all"
          />
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 w-full md:w-auto shadow-sm">
          {['Semua', 'Masuk', 'Keluar'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-none px-4 sm:px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab ? 'bg-emerald-500 text-white shadow-md transform scale-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Riwayat Transaksi</h3>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">{filteredTransactions.length} Transaksi</span>
        </div>
        <div className="transactions-list divide-y divide-gray-50">
          {!loading && filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50/80 transition-all duration-300 group cursor-pointer">
              <div className="flex items-start sm:items-center gap-3 sm:gap-5 min-w-0">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-sm transform group-hover:scale-110 transition-transform shrink-0 ${
                  normalizeTransactionType(transaction.type) === 'income' ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600' : 'bg-gradient-to-br from-red-100 to-red-50 text-red-500'
                }`}>
                  {normalizeTransactionType(transaction.type) === 'income' ? <ArrowUpCircle className="w-6 h-6 sm:w-7 sm:h-7" /> : <ArrowDownCircle className="w-6 h-6 sm:w-7 sm:h-7" />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 text-base sm:text-lg group-hover:text-emerald-700 transition-colors break-words">{transaction.description || 'Tanpa keterangan'}</h4>
                  <div className="flex flex-wrap items-center text-sm font-medium text-gray-500 mt-1 gap-x-3 gap-y-1">
                    <span className="flex items-center"><TagIcon className="w-3.5 h-3.5 mr-1 text-gray-400" /> {transaction.category_name || 'Tanpa Kategori'}</span>
                    <span className="flex items-center"><CalendarDays className="w-3.5 h-3.5 mr-1 text-gray-400" /> {formatDate(transaction.transaction_date)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end w-full sm:w-auto gap-3 sm:gap-4">
                <p className={`font-extrabold text-base sm:text-xl text-right whitespace-nowrap ${normalizeTransactionType(transaction.type) === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {normalizeTransactionType(transaction.type) === 'income' ? '+' : '-'} Rp {toNumber(transaction.amount).toLocaleString('id-ID')}
                </p>
                <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center space-x-2 sm:translate-x-4 sm:group-hover:translate-x-0 shrink-0">
                  <button onClick={() => setIsEditInfoDialogOpen(true)} className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(transaction.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filteredTransactions.length === 0 && (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold text-lg">Belum ada transaksi ditemukan.</p>
            </div>
          )}
          {loading && <div className="p-16 text-center text-gray-500 font-bold">Memuat transaksi...</div>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowModal(false)}></div>

          <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 border border-white/50">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`p-6 sm:p-8 text-white relative overflow-hidden ${transactionType === 'Pemasukan' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-red-500 to-red-700'}`}>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
              <h3 className="text-2xl sm:text-3xl font-extrabold mb-2 relative z-10">Catat {transactionType}</h3>
              <p className="text-emerald-50/90 text-sm font-medium relative z-10">Masukkan detail data keuangan dengan akurat.</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-extrabold text-gray-700">Judul Transaksi</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-bold text-gray-900 transition-colors"
                    placeholder="Contoh: Beli Makan Siang"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-extrabold text-gray-700">Nominal Uang</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="font-extrabold text-gray-500">Rp</span>
                  </div>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-black text-2xl text-gray-900 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-extrabold text-gray-700">Kategori</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <TagIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <select
                      value={formData.categoryId}
                      onChange={(event) => setFormData({ ...formData, categoryId: event.target.value })}
                      className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-bold text-gray-700 transition-colors appearance-none"
                    >
                      <option value="">Pilih...</option>
                      {selectableCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-extrabold text-gray-700">Tanggal</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CalendarDays className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                      className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-bold text-gray-700 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full py-4 text-white font-extrabold rounded-2xl shadow-lg transition-all transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed ${
                    transactionType === 'Pemasukan'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-emerald-500/40'
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-red-500/40'
                  }`}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AppDialog
        open={Boolean(deleteTargetId)}
        title="Hapus Transaksi?"
        description="Data transaksi yang sudah dihapus tidak bisa dikembalikan."
        confirmText="Hapus"
        cancelText="Batal"
        danger
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />

      <AppDialog
        open={isEditInfoDialogOpen}
        variant="info"
        title="Fitur Edit Belum Tersedia"
        description="Fitur edit transaksi akan segera hadir di update berikutnya."
        confirmText="Mengerti"
        onCancel={() => setIsEditInfoDialogOpen(false)}
        onConfirm={() => setIsEditInfoDialogOpen(false)}
      />
    </div>
  );
}
