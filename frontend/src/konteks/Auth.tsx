import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, bersihkanToken, simpanToken } from '../lib/api';
import type { ProfilPeserta, ProfilPembimbing, SesiMe, User } from '../lib/tipe';

type StatusSesi = 'memuat' | 'siap';

interface Konteks {
  user: User | null;
  profil: ProfilPeserta | ProfilPembimbing | null;
  /** 'memuat' sedang memulihkan sesi dari /auth/me */
  status: StatusSesi;
  masuk: (identifier: string, password: string) => Promise<User>;
  keluar: () => void;
  /** Setelah mengubah sandi/sukses reset, panggilan token lama tetap valid; dipakai untuk keluar bersih. */
  perbaruiUser: (u: User) => void;
}

const Ctx = createContext<Konteks | null>(null);

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return v;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profil, setProfil] = useState<ProfilPeserta | ProfilPembimbing | null>(null);
  const [status, setStatus] = useState<StatusSesi>('memuat');

  // Pulihkan sesi dari token di sessionStorage saat tab dibuka
  useEffect(() => {
    if (!sessionStorage.getItem('astakira_token')) {
      setStatus('siap');
      return;
    }
    api<SesiMe>('/auth/me')
      .then((r) => {
        setUser(r.user);
        setProfil(r.profil);
        setStatus('siap');
      })
      .catch(() => {
        bersihkanToken();
        setStatus('siap');
      });
  }, []);

  const masuk = useCallback(async (identifier: string, password: string) => {
    const sesi = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      json: { identifier, password },
    });
    simpanToken(sesi.token);
    setUser(sesi.user);
    // Ambil profil (divisi, pembimbing, dsb.) sekali setelah login
    api<SesiMe>('/auth/me').then((r) => setProfil(r.profil)).catch(() => {});
    return sesi.user;
  }, []);

  const keluar = useCallback(() => {
    bersihkanToken();
    setUser(null);
    setProfil(null);
  }, []);

  const perbaruiUser = useCallback((u: User) => setUser(u), []);

  return <Ctx.Provider value={{ user, profil, status, masuk, keluar, perbaruiUser }}>{children}</Ctx.Provider>;
}

// Re-export agar pengimporr dari konteks tidak memakai lib/api langsung jika tidak perlu
export { ApiError };
