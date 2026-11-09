import { Link } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import type { Role } from '../lib/tipe';
import { Kartu } from '../komponen/ui';

const TINDAKAN: Record<Role, { to: string; label: string; uraian: string }[]> = {
  peserta: [
    { to: '/absensi', label: 'Absen masuk / pulang', uraian: 'Mulai proses absensi dengan verifikasi wajah dan QR.' },
    { to: '/riwayat', label: 'Lihat riwayat absensi', uraian: 'Rekap absensi masuk dan pulang Anda.' },
  ],
  pembimbing: [
    { to: '/pembimbing/scan', label: 'Scan QR absensi', uraian: 'Pindai QR peserta untuk mengkonfirmasi absen masuk atau pulang.' },
    { to: '/pembimbing/jurnal', label: 'Review jurnal', uraian: 'Setujui atau minta revisi jurnal peserta bimbingan.' },
  ],
  admin: [
    { to: '/admin/peserta', label: 'Kelola peserta', uraian: 'Tambah, edit, nonaktifkan, atau hapus data peserta.' },
    { to: '/admin/absensi', label: 'Absensi & koreksi', uraian: 'Lihat absensi per tanggal, koreksi, dan catat izin/sakit.' },
  ],
};

export default function Beranda() {
  const { user } = useAuth();
  const peran = user?.role ?? 'peserta';
  const tindakan = TINDAKAN[peran];

  return (
    <>
      <section className="bg-kartu border border-garis rounded-xl p-5 md:p-[18px] mb-4">
        <h2 className="text-lg font-extrabold mb-1">
          Selamat datang{user ? `, ${user.nama}` : ''}!
        </h2>
        <p className="text-mu text-sm">
          {peran === 'peserta' && 'Kumpulkan absensi masuk/pulang melalui verifikasi wajah dan QR, dan tulis jurnal kegiatan harian.'}
          {peran === 'pembimbing' && 'Pantau peserta bimbingan, konfirmasi absensi lewat scan QR, catat izin/sakit, dan review jurnal.'}
          {peran === 'admin' && 'Kelola peserta, pembimbing, jadwal, koreksi absensi, dan audit log dari panel di samping.'}
        </p>
      </section>
      {tindakan.length ? (
        <Kartu t="Mulai dari sini">
          <ul className="grid gap-3 sm:grid-cols-2">
            {tindakan.map((t) => (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className="block h-full rounded-xl border-2 border-garis p-4 no-underline text-inherit hover:border-pr bg-kartu"
                >
                  <b className="block">{t.label}</b>
                  <small className="text-mu">{t.uraian}</small>
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </>
  );
}
