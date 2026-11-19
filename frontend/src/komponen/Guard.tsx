import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import type { Role } from '../lib/tipe';
import { Kartu } from './ui';
import { Ikon } from './Ikon';

function LayarMemuat() {
  return (
    <div className="login-bg grid min-h-screen w-full place-items-center p-4">
      <div className="flex flex-col items-center gap-3 rounded-kartu border border-garis bg-kartu px-8 py-7 shadow-kartu">
        <span className="size-10 animate-spin rounded-full border-[3px] border-pr/20 border-t-pr" aria-hidden="true" />
        <p className="text-xs font-semibold text-mu" role="status" aria-live="polite">Memuat sesi&hellip;</p>
      </div>
    </div>
  );
}

export function BelumMasukGuard({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const lokasi = useLocation();

  if (status === 'memuat') {
    return <LayarMemuat />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ dari: lokasi.pathname }} />;
  }
  return <>{children}</>;
}

export function SudahMasukGuard({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  if (status === 'memuat') {
    return <LayarMemuat />;
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
      <Kartu className="max-w-xl">
        <div className="flex flex-col items-center px-3 py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#b91c1c12] text-r">
            <Ikon nama="shield" className="size-6" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold tracking-tight text-r">Tidak diizinkan</h2>
          <p className="mt-1 max-w-[380px] text-xs leading-relaxed text-mu">
            Halaman ini hanya untuk peran <b className="text-teks">{role}</b>. Anda masuk sebagai{' '}
            <b className="text-teks">{user.role}</b>.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-pr px-3.5 py-2 text-xs font-bold text-white no-underline shadow-sm transition hover:brightness-110"
          >
            <Ikon nama="arrow" className="size-3.5 rotate-180" />
            Kembali ke beranda
          </Link>
        </div>
      </Kartu>
    );
  }
  return <>{children}</>;
}
