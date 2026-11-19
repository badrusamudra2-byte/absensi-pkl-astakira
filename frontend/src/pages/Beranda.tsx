import { Link } from 'react-router-dom';
import { useAuth } from '../konteks/Auth';
import type { Role } from '../lib/tipe';
import { Kartu, JudulHalaman } from '../komponen/ui';
import KartuProfil from '../komponen/KartuProfil';
import { Ikon, type NamaIkon } from '../komponen/Ikon';

const TINDAKAN: Record<Role, { to: string; label: string; uraian: string; ikon: NamaIkon }[]> = {
  peserta: [
    { to: '/absensi', label: 'Absen masuk / pulang', uraian: 'Verifikasi wajah dan QR absensi.', ikon: 'absen' },
    { to: '/riwayat', label: 'Riwayat absensi', uraian: 'Rekap masuk dan pulang Anda.', ikon: 'clock' },
    { to: '/jurnal', label: 'Jurnal kegiatan', uraian: 'Tulis laporan kegiatan harian.', ikon: 'book' },
    { to: '/pengajuan', label: 'Pengajuan izin / sakit', uraian: 'Ajukan saat berhalangan hadir.', ikon: 'file' },
  ],
  pembimbing: [
    { to: '/pembimbing/scan', label: 'Scan QR absensi', uraian: 'Konfirmasi absen masuk atau pulang peserta.', ikon: 'scan' },
    { to: '/pembimbing/jurnal', label: 'Review jurnal', uraian: 'Setujui atau minta revisi jurnal peserta.', ikon: 'clipboard' },
    { to: '/pembimbing/izin', label: 'Lihat izin / sakit', uraian: 'Tinjau pengajuan izin peserta bimbingan.', ikon: 'file' },
  ],
  admin: [
    { to: '/admin/peserta', label: 'Kelola peserta', uraian: 'Tambah, edit, atau nonaktifkan data peserta.', ikon: 'users' },
    { to: '/admin/absensi', label: 'Absensi & koreksi', uraian: 'Koreksi absensi dan catat izin/sakit.', ikon: 'clock' },
    { to: '/admin/laporan', label: 'Laporan', uraian: 'Unduh rekap absensi dan jurnal.', ikon: 'chart' },
  ],
};

const PENGINGAT: Record<Role, string[]> = {
  peserta: [
    'Absensi hanya tercatat satu kali untuk setiap jenis per hari.',
    'Isi jurnal setiap hari kerja agar rekap PKL Anda lengkap.',
    'Pastikan wajah terdaftar sebelum memulai absensi.',
  ],
  pembimbing: [
    'Jurnal peserta menunggu review tampil di menu Review jurnal.',
    'Pengajuan izin/sakit baru ditandai titik merah pada menu.',
    'Rekap periode membantu memantau kehadiran bimbingan.',
  ],
  admin: [
    'Perubahan jadwal kerja memengaruhi perhitungan keterlambatan.',
    'Koreksi absensi tercatat pada audit log.',
    'Pastikan data peserta dan pembimbing selalu diperbarui.',
  ],
};

const PERAN: Record<Role, string> = { peserta: 'Peserta PKL', pembimbing: 'Pembimbing', admin: 'Admin' };

const SAMBUTAN: Record<Role, string> = {
  peserta: 'Ringkasan kehadiran dan kegiatan PKL Anda hari ini.',
  pembimbing: 'Pantau absensi dan jurnal peserta bimbingan Anda.',
  admin: 'Kelola data peserta, absensi, dan laporan PKL.',
};

export default function Beranda() {
  const { user } = useAuth();
  const peran = user?.role ?? 'peserta';
  const tindakan = TINDAKAN[peran];
  const pengingat = PENGINGAT[peran];

  return (
    <>
      <JudulHalaman eyebrow={PERAN[peran]} judul="Beranda" sub={SAMBUTAN[peran]} />
      <KartuProfil />

      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
        <Kartu t="Akses cepat">
          <div className="grid sm:grid-cols-2 gap-3">
            {tindakan.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group flex items-start gap-3 rounded-xl border border-garis bg-[#fbfcfe] p-3.5 no-underline text-inherit hover:border-pr hover:bg-pl/40 transition"
              >
                <span className="size-10 rounded-xl bg-pl text-pr grid place-items-center shrink-0 group-hover:bg-pr group-hover:text-white transition">
                  <Ikon nama={t.ikon} className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[12.5px] font-extrabold leading-tight">{t.label}</b>
                  <small className="block text-[11px] text-mu mt-1 leading-snug">{t.uraian}</small>
                </span>
                <Ikon nama="chevron" className="size-3.5 text-[#a9b6c8] ml-auto mt-1 shrink-0" />
              </Link>
            ))}
          </div>
        </Kartu>

        <Kartu t="Pengingat">
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {pengingat.map((p, i) => (
              <li key={p} className="flex items-start gap-2.5 text-[11.5px] text-[#4a5a72] leading-snug">
                <span className="size-5 rounded-full bg-pl text-pr grid place-items-center shrink-0 mt-0.5">
                  <Ikon nama={i === 0 ? 'info' : i === 1 ? 'bell' : 'checkCircle'} className="size-3" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-[#f8fafc] border border-garis px-3.5 py-3">
            <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[1px] uppercase text-mu">
              <Ikon nama="shield" className="size-3.5 text-pr" />
              Keamanan akun
            </div>
            <p className="text-[11px] text-mu mt-1.5 leading-relaxed">
              Jangan bagikan kata sandi. Absensi dan jurnal tercatat atas nama pemilik akun.
            </p>
            <Link to="/profil" className="inline-flex items-center gap-1 text-[11px] font-bold text-pr mt-2">
              Buka profil
              <Ikon nama="chevron" className="size-3" />
            </Link>
          </div>
        </Kartu>
      </div>

      {peran === 'peserta' ? (
        <div className="mt-4 rounded-kartu border border-[#c7dbff] bg-gradient-to-r from-[#eaf2ff] to-[#f5f9ff] p-4 md:p-5 flex items-center gap-3.5">
          <span className="size-10 rounded-xl bg-white text-pr grid place-items-center shrink-0 shadow-sm">
            <Ikon nama="face" className="size-5" />
          </span>
          <div className="min-w-0">
            <b className="block text-[12.5px] font-extrabold">Pendaftaran wajah</b>
            <p className="text-[11.5px] text-mu mt-0.5">
              Daftarkan atau cek status wajah untuk verifikasi saat absensi.
            </p>
          </div>
          <Link
            to="/wajah/daftar"
            className="ml-auto shrink-0 rounded-lg bg-pr text-white text-[11px] font-bold px-3.5 py-2 no-underline hover:brightness-110 transition"
          >
            Daftarkan
          </Link>
        </div>
      ) : null}
    </>
  );
}
