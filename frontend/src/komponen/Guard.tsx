import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import type { Role } from '../lib/tipe';

export function BelumMasukGuard({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const lokasi = useLocation();

  if (status === 'memuat') {
    return <p className="p-6 text-mu">Memuat…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ dari: lokasi.pathname }} />;
  }
  return <>{children}</>;
}

export function SudahMasukGuard({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  if (status === 'memuat') {
    return <p className="p-6 text-mu">Memuat…</p>;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/** Halaman di dalam Shell: bila tidak cocok peran, tampilkan 403 buatan dalam. */
export function GuardPeran({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return (
      <section className="bg-kartu border border-garis rounded-xl p-6 mb-4 max-w-lg">
        <h2 className="text-base font-bold mb-2 text-r">Tidak diizinkan</h2>
        <p className="text-mu text-sm">
          Halaman ini hanya untuk peran <b>{role}</b>. Anda masuk sebagai <b>{user.role}</b>.
        </p>
      </section>
    );
  }
  return <>{children}</>;
}
