import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import type { Role } from '../lib/tipe';
import BannerLuring from './Offline';

/** Menu mengikuti peran. */
const MENU: Record<Role, { rote: string; label: string }[]> = {
  peserta: [
    { rote: '/', label: 'Beranda' },
    { rote: '/absensi', label: 'Absensi' },
    { rote: '/wajah/daftar', label: 'Pendaftaran wajah' },
    { rote: '/jurnal', label: 'Jurnal kegiatan' },
    { rote: '/absensi/scan', label: 'Scan QR pembimbing' },
    { rote: '/riwayat', label: 'Riwayat absensi' },
    { rote: '/profil', label: 'Profil' },
  ],
  pembimbing: [
    { rote: '/', label: 'Beranda' },
    { rote: '/pembimbing/scan', label: 'Tampilkan QR absensi' },
    { rote: '/pembimbing/peserta', label: 'Peserta bimbingan' },
    { rote: '/pembimbing/jurnal', label: 'Review jurnal' },
    { rote: '/pembimbing/rekap', label: 'Rekap periode' },
    { rote: '/pembimbing/izin', label: 'Catat izin/sakit' },
    { rote: '/profil', label: 'Profil' },
  ],
  admin: [
    { rote: '/', label: 'Beranda' },
    { rote: '/admin/peserta', label: 'Kelola peserta' },
    { rote: '/admin/pembimbing', label: 'Kelola pembimbing' },
    { rote: '/admin/jadwal', label: 'Jadwal kerja' },
    { rote: '/admin/absensi', label: 'Absensi & koreksi' },
    { rote: '/pengaturan', label: 'Pengaturan absensi' },
    { rote: '/admin/audit', label: 'Audit log' },
    { rote: '/profil', label: 'Profil' },
  ],
};

const PERAN: Record<Role, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

export default function Shell() {
  const { user, keluar } = useAuth();
  const [buka, setBuka] = useState(false);
  const menu = MENU[user?.role ?? 'peserta'];

  const isiMenu = (
    <>
      <div className="px-5 pt-[22px] pb-4 text-lg text-white">
        <b className="font-extrabold">Astakira</b> Media
        <small className="block text-xs text-[#8fb0ee]">Absensi PKL dan jurnal</small>
      </div>
      <nav className="flex-1 px-[10px] flex flex-col gap-0.5 overflow-auto" aria-label="Menu utama">
        {menu.map((m) => (
          <NavLink
            key={m.rote}
            to={m.rote}
            end
            onClick={() => setBuka(false)}
            className={({ isActive }) =>
              `rounded-lg px-3 py-[10px] font-medium no-underline ${
                isActive ? 'bg-white text-nv font-bold' : 'text-nv-t hover:bg-white/10'
              }`
            }
          >
            {m.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-[#8fb0ee]">
        Masuk sebagai
        <b className="block text-white text-[13px]">{user?.nama}</b>
        <small className="block">{user ? PERAN[user.role] : ''}</small>
        <button
          onClick={keluar}
          className="mt-[10px] w-full rounded-lg border border-white/30 text-nv-t bg-transparent px-4 py-2 text-sm font-semibold hover:bg-white/10 cursor-pointer"
        >
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 bg-nv text-nv-t flex-col sticky top-0 h-screen shrink-0 z-40">{isiMenu}</aside>

      {/* Overlay drawer HP */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/60 z-40 transition-opacity ${buka ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setBuka(false)}
        aria-hidden="true"
      />
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-nv text-nv-t flex flex-col z-50 transition-transform duration-200 ${
          buka ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu samping"
      >
        {isiMenu}
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-kartu border-b border-garis flex items-center gap-3 px-4 md:px-5 py-[10px] flex-wrap">
          <button
            className="lg:hidden border border-garis rounded-lg px-[10px] py-1 text-base"
            onClick={() => setBuka(true)}
            aria-label="Buka menu"
          >
            &#9776;
          </button>
          <h1 className="text-base md:text-lg font-bold flex-1 min-w-16">Panel Absensi PKL</h1>
          <small className="text-xs text-mu">{user ? PERAN[user.role] : ''}</small>
        </header>
        <main className="p-4 md:p-5 max-w-[1080px]">
          <BannerLuring />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
