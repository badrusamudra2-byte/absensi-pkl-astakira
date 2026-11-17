import { useAuth } from '../konteks/Auth';
import type { ProfilPeserta, ProfilPembimbing, Role } from '../lib/tipe';

const PERAN: Record<Role, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

/** Kartu profil tampilan saja untuk peserta & pembimbing (foto, nama, divisi).
 * Pengubahan foto tetap lewat menu Profil di sidebar. */
export default function KartuProfil() {
  const { user, profil } = useAuth();
  if (!user || (user.role !== 'peserta' && user.role !== 'pembimbing')) return null;
  const divisi = profil ? (profil as ProfilPeserta | ProfilPembimbing).divisi : null;
  const potong = user.nama?.[0] ?? '?';

  return (
    <section className="bg-kartu border border-garis rounded-xl p-4 md:p-5 mb-4 flex items-center gap-4">
      {user.foto_url ? (
        <img
          src={user.foto_url}
          alt={`Foto profil ${user.nama}`}
          className="w-16 h-16 rounded-full object-cover bg-pr shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-pr text-white text-2xl font-extrabold grid place-items-center shrink-0">
          {potong}
        </div>
      )}
      <div className="min-w-0">
        <b className="block truncate">{user.nama}</b>
        <p className="text-mu text-sm">
          {PERAN[user.role]}
          {divisi ? `, Divisi ${divisi}` : ''}
        </p>
      </div>
    </section>
  );
}
