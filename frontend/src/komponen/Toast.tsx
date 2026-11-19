import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Ikon } from './Ikon';

type Jenis = 'ok' | 'warn';
const ToastCtx = createContext<(m: string, j?: Jenis) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<{ id: number; m: string; j: Jenis }[]>([]);

  const tampil = useCallback((m: string, j: Jenis = 'ok') => {
    const id = Date.now() + Math.random();
    setDaftar((d) => [...d, { id, m, j }]);
    setTimeout(() => setDaftar((d) => d.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={tampil}>
      {children}
      <div
        id="toasts"
        className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-[360px] flex-col gap-2"
        aria-live="polite"
      >
        {daftar.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-xl border border-garis bg-kartu p-3.5 shadow-[0_18px_40px_-20px_rgba(11,31,77,.45)] ${
              t.j === 'ok' ? 'border-l-4 border-l-g' : 'border-l-4 border-l-y'
            }`}
          >
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${t.j === 'ok' ? 'bg-[#15803d18] text-g' : 'bg-[#a1620716] text-y'}`}>
              <Ikon nama={t.j === 'ok' ? 'checkCircle' : 'alert'} className="size-3.5" />
            </span>
            <p className="min-w-0 pt-0.5 text-sm font-semibold leading-snug">{t.m}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
