import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../konteks/Auth';
import { api } from '../lib/api';
import { ikutSinyal, sinyalPeriksa } from '../lib/notifikasi';
import type { Role } from '../lib/tipe';
import BannerLuring from './Offline';
import { Ikon, type NamaIkon } from './Ikon';

const MENU: Record<Role, { rote: string; label: string; ikon: NamaIkon; dot?: boolean }[]> = {
  peserta: [
    { rote: '/', label: 'Beranda', ikon: 'home' },
    { rote: '/absensi', label: 'Absensi', ikon: 'absen' },
    { rote: '/absensi/qr', label: 'Tayangkan QR absen', ikon: 'qr' },
    { rote: '/wajah/daftar', label: 'Pendaftaran wajah', ikon: 'face' },
    { rote: '/jurnal', label: 'Jurnal kegiatan', ikon: 'book' },
    { rote: '/pengajuan', label: 'Pengajuan izin/sakit', ikon: 'file' },
    { rote: '/riwayat', label: 'Riwayat absensi', ikon: 'clock' },
    { rote: '/profil', label: 'Profil', ikon: 'user' },
  ],
  pembimbing: [
    { rote: '/', label: 'Beranda', ikon: 'home' },
    { rote: '/pembimbing/scan', label: 'Scan QR peserta', ikon: 'scan' },
    { rote: '/pembimbing/peserta', label: 'Peserta bimbingan', ikon: 'users' },
    { rote: '/pembimbing/jurnal', label: 'Review jurnal', ikon: 'clipboard' },
    { rote: '/pembimbing/rekap', label: 'Rekap periode', ikon: 'chart' },
    { rote: '/pembimbing/izin', label: 'Lihat izin/sakit', ikon: 'file', dot: true },
    { rote: '/profil', label: 'Profil', ikon: 'user' },
  ],
  admin: [
    { rote: '/', label: 'Beranda', ikon: 'home' },
    { rote: '/admin/peserta', label: 'Kelola peserta', ikon: 'users' },
    { rote: '/admin/pembimbing', label: 'Kelola pembimbing', ikon: 'user' },
    { rote: '/admin/jadwal', label: 'Jadwal kerja', ikon: 'calendar' },
    { rote: '/admin/absensi', label: 'Absensi & koreksi', ikon: 'clock' },
    { rote: '/admin/laporan', label: 'Laporan', ikon: 'chart' },
    { rote: '/pengaturan', label: 'Pengaturan absensi', ikon: 'settings' },
    { rote: '/admin/audit', label: 'Audit log', ikon: 'shield' },
    { rote: '/profil', label: 'Profil', ikon: 'user' },
  ],
};

const PERAN: Record<Role, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

const labelHalaman = (menu: { rote: string; label: string }[], path: string) => {
  const tepat = menu.find((m) => m.rote === path);
  if (tepat) return tepat.label;
  if (path.startsWith('/pembimbing/jurnal')) return 'Review jurnal';
  if (path.startsWith('/pembimbing/')) return 'Pembimbing';
  if (path.startsWith('/admin/')) return 'Admin';
  if (path.startsWith('/jurnal')) return 'Jurnal kegiatan';
  if (path === '/pengaturan') return 'Pengaturan absensi';
  if (path.startsWith('/wajah/periksa')) return 'Absensi';
  return 'Panel';
};

const TANGGAL = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
}).format(new Date());

function Avatar({ nama, foto, ukuran = 'md' }: { nama?: string; foto?: string | null; ukuran?: 'sm' | 'md' }) {
  const kelas = ukuran === 'sm' ? 'size-8 text-[11px]' : 'size-[34px] text-xs';
  if (foto) {
    return <img src={foto} alt="" className={`${kelas} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span className={`${kelas} rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1e40af] text-white font-extrabold grid place-items-center shrink-0`}>
      {nama?.slice(0, 2).toUpperCase() ?? '?'}
    </span>
  );
}

export default function Shell() {
  const { user, keluar } = useAuth();
  const [buka, setBuka] = useState(false);
  const [adaBaru, setAdaBaru] = useState(false);
  const lokasi = useLocation();
  const menu = MENU[user?.role ?? 'peserta'];
  const halaman = labelHalaman(menu, lokasi.pathname);

  useEffect(() => {
    let hidup = true;
    const periksa = async () => {
      try {
        const r = await api<{ ada: boolean }>('/pengajuan/notifikasi');
        if (hidup) setAdaBaru(r.ada);
      } catch {
        /* notifikasi gagal: titik biarkan seperti sebelumnya */
      }
    };
    periksa();
    const t = setInterval(periksa, 30000);
    const berhenti = ikutSinyal(periksa);
    return () => {
      hidup = false;
      clearInterval(t);
      berhenti();
    };
  }, []);

  useEffect(() => {
    sinyalPeriksa();
  }, [lokasi]);

  const isiMenu = (
    <>
      <div className="relative flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-white/10">
        <img
          src="/ikon/astakira.jpg"
          alt="Logo Astakira Media"
          className="size-[38px] rounded-[11px] object-contain bg-white shadow-[0_8px_18px_-8px_rgba(37,99,235,.8)] shrink-0"
        />
        <div className="min-w-0">
          <b className="block text-white text-base font-extrabold leading-tight">Astakira Media</b>
          <small className="block text-[#8fb0ee] text-[9.5px] tracking-wide">Absensi PKL dan jurnal</small>
        </div>
      </div>
      <nav className="relative flex-1 px-[10px] pt-2 pb-3 flex flex-col gap-0.5 overflow-y-auto" aria-label="Menu utama">
        <div className="px-2.5 pt-3 pb-1.5 text-[9px] font-bold tracking-[1.5px] uppercase text-[#7f9cd7]">
          Menu {user ? PERAN[user.role] : ''}
        </div>
        {menu.map((m) => (
          <NavLink
            key={m.rote}
            to={m.rote}
            end
            onClick={() => setBuka(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[12.25px] leading-tight no-underline transition ${
                isActive
                  ? 'bg-white text-nv font-bold shadow-[0_8px_18px_-10px_rgba(0,0,0,.55)]'
                  : 'text-nv-t font-medium hover:bg-white/10'
              }`
            }
          >
            <Ikon nama={m.ikon} className="size-4 shrink-0 opacity-85" />
            <span className="min-w-0 truncate">{m.label}</span>
            {m.dot && adaBaru ? <span className="ml-auto inline-block size-2 rounded-full bg-r" aria-hidden="true" /> : null}
          </NavLink>
        ))}
      </nav>
      <div className="relative px-4 pt-3 pb-4 border-t border-white/10 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar nama={user?.nama} foto={user?.foto_url} />
          <div className="min-w-0">
            <b className="block text-white text-[11.5px] leading-tight truncate">{user?.nama}</b>
            <small className="block text-[#8fb0ee] text-[10px]">{user ? PERAN[user.role] : ''}</small>
          </div>
        </div>
        <button
          onClick={keluar}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 text-nv-t px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/10 cursor-pointer transition"
        >
          <Ikon nama="logout" className="size-3.5" />
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sisi-grad hidden lg:flex w-60 shrink-0 flex-col sticky top-0 h-screen z-40 text-nv-t relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-24 size-64 rounded-full border border-blue-200/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-24 size-40 rounded-full border border-blue-200/10" />
        {isiMenu}
      </aside>

      <div
        className={`lg:hidden fixed inset-0 bg-black/60 z-40 transition-opacity ${buka ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setBuka(false)}
        aria-hidden="true"
      />
      <aside
        className={`sisi-grad lg:hidden fixed inset-y-0 left-0 w-64 flex flex-col z-50 text-nv-t overflow-hidden transition-transform duration-200 ${
          buka ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu samping"
      >
        {isiMenu}
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-kartu/95 backdrop-blur border-b border-garis">
          <div className="h-16 flex items-center gap-3 px-4 md:px-6">
            <button
              className="lg:hidden size-9 rounded-lg border border-garis grid place-items-center text-base text-teks cursor-pointer bg-kartu"
              onClick={() => setBuka(true)}
              aria-label="Buka menu"
            >
              &#9776;
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[14px] md:text-[15px] font-extrabold tracking-tight whitespace-nowrap">Panel Absensi PKL</span>
              <span className="hidden sm:block h-5 w-px bg-garis" aria-hidden="true" />
              <span className="hidden sm:block text-xs text-mu font-semibold truncate">{halaman}</span>
            </div>
            <div className="flex-1" />
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-garis bg-[#f7f9fc] px-3 py-1.5 text-[11.5px] text-mu font-semibold">
              <Ikon nama="calendar" className="size-3.5" />
              {TANGGAL}
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-pl text-pr px-3 py-1.5 text-[11px] font-bold">
              {user ? PERAN[user.role] : ''}
            </span>
            <Link
              to="/profil"
              aria-label="Buka halaman profil"
              title="Profil"
              className="rounded-full no-underline transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-pr focus-visible:outline-offset-2"
            >
              <Avatar nama={user?.nama} foto={user?.foto_url} ukuran="sm" />
            </Link>
          </div>
        </header>
        <main className="p-4 md:px-6 md:py-6 w-full max-w-[1200px] mx-auto">
          <BannerLuring />
          <div key={lokasi.pathname} className="hal-masuk">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
