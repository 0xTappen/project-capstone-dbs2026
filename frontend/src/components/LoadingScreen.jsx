import { useEffect, useMemo, useState } from 'react';

export default function LoadingScreen({
  title = 'Mindfase',
  subtitle = 'Mempersiapkan pengalaman terbaik untuk Anda',
  statusText = 'Memuat...',
  fullScreen = true,
}) {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        const increment = Math.random() * 10 + 3;
        return Math.min(92, prev + increment);
      });
    }, 180);

    return () => clearInterval(timer);
  }, []);

  const roundedProgress = useMemo(() => Math.round(progress), [progress]);

  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'min-h-[320px]'} w-full flex items-center justify-center px-6 py-10 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/40`}>
      <div className="w-full max-w-md text-center animate-[fadeIn_.35s_ease-out]">
        <div className="relative mx-auto mb-6 h-28 w-28 rounded-full bg-white shadow-[0_14px_40px_rgba(16,185,129,0.25)] flex items-center justify-center ring-4 ring-emerald-100">
          <img src="/apple-touch-icon.png" alt="Mindfase Logo" className="h-20 w-20 rounded-full object-cover" />
          <span className="absolute inset-0 rounded-full border-2 border-emerald-300/70 animate-ping" />
        </div>

        <h1 className="text-4xl font-black tracking-tight text-emerald-800">{title}</h1>
        <p className="mt-2 text-sm md:text-base text-gray-600 font-medium">{subtitle}</p>

        <div className="mt-8">
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-[width] duration-300 ease-out"
              style={{ width: `${roundedProgress}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-gray-500 font-medium">{statusText}</p>
            <p className="text-emerald-700 text-3xl font-extrabold tabular-nums">{roundedProgress}%</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-700/80 animate-bounce [animation-delay:-0.2s]" />
          <span className="h-3 w-3 rounded-full bg-emerald-600/70 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/70 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
