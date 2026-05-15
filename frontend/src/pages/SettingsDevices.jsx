import { useEffect, useState } from 'react';
import { ChevronLeft, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readDevices, saveDevices } from '../lib/settingsDevices';

export default function SettingsDevices() {
  const [devices, setDevices] = useState(() => readDevices());
  const [success, setSuccess] = useState('');

  useEffect(() => {
    saveDevices(devices);
  }, [devices]);

  const handleRemoveDevice = (deviceId) => {
    setSuccess('');
    const updatedDevices = devices.filter((device) => device.id !== deviceId || device.isCurrent);
    saveDevices(updatedDevices);
    setDevices(updatedDevices);
    setSuccess('Perangkat berhasil dihapus dari daftar.');
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition">
        <ChevronLeft className="w-4 h-4" />
        Kembali ke Pengaturan
      </Link>

      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perangkat Terhubung</h1>
          <p className="text-sm text-gray-500">Pantau sesi perangkat yang pernah login</p>
        </div>
      </header>

      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 space-y-3">
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
              <button
                onClick={() => handleRemoveDevice(device.id)}
                className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
              >
                Hapus
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
