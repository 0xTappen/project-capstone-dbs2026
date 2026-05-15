import { useEffect, useMemo, useState } from 'react';
import { Target, AlertCircle, Plus, Wallet, Trash2 } from 'lucide-react';
import api from '../lib/api';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

export default function Budget() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [budgetsRes, transactionsRes, categoriesRes] = await Promise.all([
          api.get('/budgets'),
          api.get('/transactions'),
          api.get('/categories'),
        ]);

        setBudgets(Array.isArray(budgetsRes.data) ? budgetsRes.data : []);
        setTransactions(Array.isArray(transactionsRes.data) ? transactionsRes.data : []);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data anggaran.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const monthBudgets = useMemo(
    () => budgets.filter((budget) => Number(budget.month) === currentMonth && Number(budget.year) === currentYear),
    [budgets, currentMonth, currentYear]
  );

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const handleAddBudget = async (event) => {
    event.preventDefault();
    const limitAmount = toNumber(newAmount);

    if (!newCategoryId || limitAmount <= 0) {
      setError('Kategori dan batas anggaran wajib diisi dengan benar.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.post('/budgets', {
        category_id: Number(newCategoryId),
        limit_amount: limitAmount,
        month: currentMonth,
        year: currentYear,
      });

      setBudgets((prev) => {
        const next = prev.filter((budget) => !(
          Number(budget.category_id) === Number(response.data.category_id)
          && Number(budget.month) === Number(response.data.month)
          && Number(budget.year) === Number(response.data.year)
        ));
        return [response.data, ...next];
      });

      setShowAddForm(false);
      setNewCategoryId('');
      setNewAmount('');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      await api.delete(`/budgets/${budgetId}`);
      setBudgets((prev) => prev.filter((budget) => budget.id !== budgetId));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus anggaran.');
    }
  };

  const getSpentAmount = (budget) => {
    return transactions
      .filter((transaction) => {
        if (transaction.type !== 'expense') {
          return false;
        }

        const transactionDate = toDate(transaction.transaction_date);
        return (
          Number(transaction.category_id) === Number(budget.category_id)
          && transactionDate.getMonth() + 1 === Number(budget.month)
          && transactionDate.getFullYear() === Number(budget.year)
        );
      })
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Anggaran & Tracking</h1>
          <p className="text-gray-500 font-medium mt-1">Set anggaran per kategori dan pantau pengeluaran Anda</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
        >
          <Plus className="w-5 h-5" />
          <span>Set Anggaran</span>
        </button>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddBudget} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Set Anggaran Baru</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Kategori</label>
              <select
                value={newCategoryId}
                onChange={(event) => setNewCategoryId(event.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-3"
                required
              >
                <option value="">Pilih Kategori</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Batas Anggaran (Rp)</label>
              <input
                type="number"
                value={newAmount}
                onChange={(event) => setNewAmount(event.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-3"
                placeholder="Contoh: 1500000"
                required
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? 'Menyimpan...' : 'Simpan Anggaran'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!loading && monthBudgets.map((budget) => {
          const spent = getSpentAmount(budget);
          const limit = toNumber(budget.limit_amount);
          const remaining = limit - spent;
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOverBudget = spent > limit;
          const isWarning = percentage >= 80 && percentage < 100;

          let progressColor = 'bg-emerald-500';
          if (isWarning) progressColor = 'bg-orange-500';
          if (isOverBudget) progressColor = 'bg-red-500';

          return (
            <div key={budget.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{budget.category_name}</h3>
                </div>
                <button onClick={() => handleDeleteBudget(budget.id)} className="text-gray-400 hover:text-red-500 transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm gap-1">
                  <span className="text-gray-500 font-medium">Terpakai: <span className="font-bold text-gray-900">Rp {spent.toLocaleString('id-ID')}</span></span>
                  <span className="text-gray-500 font-medium">Batas: <span className="font-bold text-gray-900">Rp {limit.toLocaleString('id-ID')}</span></span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className={`${progressColor} h-3 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-gray-600">
                    Sisa: <span className={isOverBudget ? 'text-red-600' : 'text-emerald-600'}>Rp {remaining.toLocaleString('id-ID')}</span>
                  </span>
                  <span className="text-sm font-bold text-gray-500">{percentage.toFixed(1)}%</span>
                </div>
              </div>

              {isOverBudget && (
                <div className="mt-4 p-3 bg-red-50 rounded-xl flex items-start space-x-2 border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-bold text-red-700">Peringatan: Pengeluaran Anda melebihi anggaran!</p>
                </div>
              )}
              {isWarning && !isOverBudget && (
                <div className="mt-4 p-3 bg-orange-50 rounded-xl flex items-start space-x-2 border border-orange-100">
                  <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <p className="text-xs font-bold text-orange-700">Awas: Pengeluaran hampir mencapai batas anggaran.</p>
                </div>
              )}
            </div>
          );
        })}

        {!loading && monthBudgets.length === 0 && !showAddForm && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
            <Wallet className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium mb-4">Belum ada anggaran yang diatur untuk bulan ini.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-white border border-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm"
            >
              Mulai Set Anggaran
            </button>
          </div>
        )}

        {loading && <div className="col-span-full py-12 text-center text-gray-500 font-bold">Memuat anggaran...</div>}
      </div>
    </div>
  );
}
