import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

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
        className="fixed right-4 bottom-4 flex flex-col gap-2 z-50"
        aria-live="polite"
      >
        {daftar.map((t) => (
          <div
            key={t.id}
            className={`bg-kartu border border-garis rounded-lg px-[14px] py-[10px] shadow-lg max-w-[320px] font-semibold text-sm border-l-4 ${
              t.j === 'ok' ? 'border-l-g' : 'border-l-y'
            }`}
          >
            {t.m}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
