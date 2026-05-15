import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function AppDialog({
  open,
  variant = 'confirm',
  title,
  description = '',
  confirmText = 'OK',
  cancelText = 'Batal',
  defaultValue = '',
  placeholder = '',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const isPrompt = variant === 'prompt';
  const isInfo = variant === 'info';
  const confirmClass = danger
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300'
    : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300';

  const handleConfirm = () => {
    if (isPrompt) {
      const nextValue = inputRef.current?.value || '';
      if (!nextValue.trim()) return;
      onConfirm?.(nextValue);
      return;
    }

    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]" onClick={onCancel} aria-label="Tutup dialog" />
      <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          onClick={onCancel}
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-7">
          <h3 className="pr-8 text-lg font-extrabold text-gray-900">{title}</h3>
          {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}

          {isPrompt && (
            <input
              type="text"
              defaultValue={defaultValue}
              ref={inputRef}
              placeholder={placeholder}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          )}

          <div className="mt-6 flex justify-end gap-2">
            {!isInfo && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition focus:outline-none focus:ring-2 ${confirmClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
