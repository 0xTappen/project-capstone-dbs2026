import { useEffect, useMemo, useState } from 'react';
import { Plus, CheckCircle2, Circle, FileText, CalendarDays } from 'lucide-react';
import api from '../lib/api';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDate(dateString) {
  if (!dateString) {
    return '-';
  }

  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export default function Bills() {
  const [showModal, setShowModal] = useState(false);
  const [confirmBill, setConfirmBill] = useState(null);
  const [bills, setBills] = useState([]);
  const [newBill, setNewBill] = useState({ title: '', amount: '', dueDate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/bills');
        setBills(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Gagal memuat data tagihan.');
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, []);

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)),
    [bills]
  );

  const handleSaveBill = async () => {
    const amount = toNumber(newBill.amount);
    if (!newBill.title || amount <= 0) {
      setError('Nama tagihan dan nominal wajib diisi dengan benar.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await api.post('/bills', {
        title: newBill.title,
        amount,
        due_date: newBill.dueDate || todayIso(),
        status: 'unpaid',
      });

      setBills((prev) => [...prev, response.data]);
      setShowModal(false);
      setNewBill({ title: '', amount: '', dueDate: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan tagihan.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePaid = async (bill) => {
    try {
      if (bill.status === 'paid') {
        const response = await api.put(`/bills/${bill.id}`, {
          title: bill.title,
          amount: bill.amount,
          due_date: bill.due_date,
          status: 'unpaid',
        });

        setBills((prev) => prev.map((item) => (item.id === bill.id ? response.data : item)));
        return;
      }

      const response = await api.patch(`/bills/${bill.id}/pay`);
      setBills((prev) => prev.map((item) => (item.id === bill.id ? response.data : item)));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memperbarui status tagihan.');
    }
  };

  const totalBill = bills.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const totalPaid = bills.filter((bill) => bill.status === 'paid').reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const totalUnpaid = bills.filter((bill) => bill.status === 'unpaid').reduce((acc, curr) => acc + toNumber(curr.amount), 0);

  const currentMonthTitle = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tagihan & Pembayaran</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola tagihan bulananmu dengan mudah</p>
        </div>
      </header>

      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

      <div className="md:hidden bg-white p-3 rounded-[1.5rem] border border-gray-100 shadow-sm grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50 px-2 py-3 text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Total</p>
          <p className="text-sm font-extrabold text-gray-900">Rp {totalBill.toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-2 py-3 text-center border border-emerald-200">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Dibayar</p>
          <p className="text-sm font-extrabold text-emerald-500">Rp {totalPaid.toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl bg-red-50 px-2 py-3 text-center border border-red-200">
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">Belum</p>
          <p className="text-sm font-extrabold text-red-500">Rp {totalUnpaid.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Total Tagihan</p>
          <p className="text-2xl md:text-3xl font-extrabold text-gray-900">Rp {totalBill.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center items-center text-center">
          <p className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-2">Sudah Dibayar</p>
          <p className="text-2xl md:text-3xl font-extrabold text-emerald-500">Rp {totalPaid.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center items-center text-center">
          <p className="text-sm font-bold text-red-500 uppercase tracking-wider mb-2">Belum Dibayar</p>
          <p className="text-2xl md:text-3xl font-extrabold text-red-500">Rp {totalUnpaid.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mt-8 mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{`Daftar Tagihan ${currentMonthTitle}`}</h3>
        <button onClick={() => setShowModal(true)} className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm" title="Tambah Tagihan">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {!loading && sortedBills.length === 0 && <div className="p-8 text-center text-gray-500 font-bold">Belum ada tagihan dicatat.</div>}
          {!loading && sortedBills.map((bill) => (
            <div key={bill.id} className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bill.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 text-base sm:text-lg break-words">{bill.title}</h4>
                  <div className="flex items-center text-sm font-medium text-gray-500 mt-1">
                    <CalendarDays className="w-4 h-4 mr-1.5" />
                    {`Jatuh Tempo: ${formatDate(bill.due_date)}`}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:items-end space-y-2 w-full sm:w-auto">
                <p className="font-extrabold text-lg text-gray-900">Rp {toNumber(bill.amount).toLocaleString('id-ID')}</p>
                {bill.status === 'paid' ? (
                  <button onClick={() => setConfirmBill({ bill, action: 'cancel' })} className="flex items-center justify-center text-xs font-bold text-white bg-red-600 px-4 py-2 rounded-xl hover:bg-red-700 transition shadow-sm">
                    Batalkan
                  </button>
                ) : (
                  <button onClick={() => setConfirmBill({ bill, action: 'pay' })} className="flex items-center justify-center text-xs font-bold text-white bg-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-700 transition shadow-sm">
                    Bayar
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="p-8 text-center text-gray-500 font-bold">Memuat tagihan...</div>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-white bg-emerald-600">
              <h3 className="text-2xl font-bold">Tambah Tagihan Baru</h3>
              <p className="opacity-90 text-sm mt-1 font-medium">Catat tagihan yang perlu dibayar</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nama Tagihan</label>
                <input value={newBill.title} onChange={(event) => setNewBill({ ...newBill, title: event.target.value })} type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-gray-50 focus:bg-white transition-colors" placeholder="Contoh: SPP Sekolah" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nominal (Rp)</label>
                <input value={newBill.amount} onChange={(event) => setNewBill({ ...newBill, amount: event.target.value })} type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg bg-gray-50 focus:bg-white transition-colors" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tanggal Jatuh Tempo</label>
                <input value={newBill.dueDate} onChange={(event) => setNewBill({ ...newBill, dueDate: event.target.value })} type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-gray-50 focus:bg-white transition-colors" />
              </div>
              <div className="pt-4 flex space-x-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition">Batal</button>
                <button onClick={handleSaveBill} disabled={saving} className="flex-1 py-3.5 text-white font-bold bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmBill && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 text-white bg-emerald-600">
              <h3 className="text-xl font-bold">{confirmBill.action === 'pay' ? 'Konfirmasi Bayar' : 'Batalkan Bayar'}</h3>
            </div>
            <div className="p-6 space-y-4 text-center">
              <p className="text-gray-600 font-medium text-sm">
                {confirmBill.action === 'pay' 
                  ? `Apakah Anda yakin ingin menandai tagihan "${confirmBill.bill.title}" sebagai lunas?`
                  : `Apakah Anda yakin ingin membatalkan status lunas untuk tagihan "${confirmBill.bill.title}"?`}
              </p>
              <div className="flex space-x-3 pt-2">
                <button onClick={() => setConfirmBill(null)} className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition">Kembali</button>
                <button 
                  onClick={() => {
                    handleTogglePaid(confirmBill.bill);
                    setConfirmBill(null);
                  }} 
                  className="flex-1 py-3 text-white font-bold rounded-xl transition bg-emerald-600 hover:bg-emerald-700"
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
