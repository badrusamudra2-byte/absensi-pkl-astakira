import { useAuth } from '../konteks/Auth';
import type { ProfilPeserta, ProfilPembimbing, Role } from '../lib/tipe';
import { Ikon } from './Ikon';

const PERAN: Record<Role, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

export default function KartuProfil() {
  const { user, profil } = useAuth();
  if (!user || (user.role !== 'peserta' && user.role !== 'pembimbing')) return null;
  const p = profil as ProfilPeserta | ProfilPembimbing | null;
  const divisi = p?.divisi ?? null;
  const pembimbing = p && 'pembimbing' in p ? p.pembimbing?.nama ?? null : null;
  const potong = user.nama?.slice(0, 2).toUpperCase() || '?';

  return (
    <section className="relative overflow-hidden bg-kartu border border-garis rounded-kartu shadow-kartu p-5 md:p-6 mb-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-[radial-gradient(circle,#dbeafe,transparent_70%)]"
      />
      <div className="relative flex items-center gap-4 md:gap-5">
        {user.foto_url ? (
          <div className="size-[64px] md:size-[72px] rounded-full shrink-0 ring-4 ring-pl overflow-hidden">
            <img src={user.foto_url} alt={`Foto profil ${user.nama}`} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="size-[64px] md:size-[72px] rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1e40af] text-white text-xl md:text-2xl font-extrabold grid place-items-center shrink-0 ring-4 ring-pl">
            {potong}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold tracking-[1.3px] uppercase text-pr mb-1">Selamat datang kembali</div>
          <h2 className="text-lg md:text-[22px] font-extrabold tracking-tight leading-tight truncate">{user.nama}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-[11.5px] text-mu">
            <span className="inline-flex items-center gap-1">
              <Ikon nama="briefcase" className="size-3.5" />
              {PERAN[user.role]}
            </span>
            {divisi ? <span className="hidden sm:inline text-[#c3cede]">|</span> : null}
            {divisi ? <span>Divisi {divisi}</span> : null}
            {pembimbing ? <span className="hidden sm:inline text-[#c3cede]">|</span> : null}
            {pembimbing ? <span>Pembimbing {pembimbing}</span> : null}
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 self-start rounded-full bg-[#dcfce7] text-[#15803d] px-3 py-1.5 text-[10.5px] font-bold">
          <span className="size-1.5 rounded-full bg-[#15803d]" aria-hidden="true" />
          Akun aktif
        </span>
      </div>
    </section>
  );
}
