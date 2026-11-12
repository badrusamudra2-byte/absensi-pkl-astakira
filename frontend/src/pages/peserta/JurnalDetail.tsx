import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge, Galat } from '../../komponen/ui';
import { PenampilFoto } from '../../komponen/PenampilFoto';
import { waktuWib } from '../../komponen/umum';

const jam = (iso: string) => (iso ? waktuWib(iso) + ' WIB' : '-');

/** Ikhtisar perjalanan status jurnal. */
function GarisWaktu({ status, buat, ubah, review }: { status: string; buat: string; ubah: string; review: { keputusan: string; waktu: string }[] }) {
  const langkah = [
    { s: 'Draft', t: buat },
    { s: 'Dikirim', t: ubah },
  ];
  // Revisi/Disetujui berasal dari keputusan pembimbing (review)
  for (const r of review) langkah.push({ s: r.keputusan, t: r.waktu });

  // Draft: hanya langkah pertama; setelah dikirim: tampilkan seluruh riwayat
  const tampil = status === 'Draft' ? langkah.slice(0, 1) : langkah;

  return (
    <ol className="flex flex-col gap-1.5">
      {tampil.map((l, n) => (
        <li key={n} className="flex items-center gap-2 text-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${n === tampil.length - 1 ? 'bg-pr' : 'bg-g'}`} aria-hidden="true" />
          <b>{l.s}</b>
          <small className="text-mu">{l.t}</small>
          {n === tampil.length - 1 && <Badge s={status} />}
        </li>
      ))}
    </ol>
  );
}

export default function JurnalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jub, ubahJub] = useState<JurnalDetail | null>(null);
  const [galat, ubahGalat] = useState<string | null>(null);
  const [sedangTarik, ubahSedangTarik] = useState(false);
  const [bukaFoto, ubahBukaFoto] = useState(false);

  useEffect(() => {
    api<JurnalDetail>(`/jurnal/${id}`)
      .then((r) => ubahJub(r))
      .catch((e) => {
        const err = e as ApiError;
        ubahGalat(err.status === 404 ? 'Jurnal tidak ditemukan atau bukan milik Anda.' : 'Jurnal belum bisa dimuat. Muat ulang halaman.');
      });
  }, [id]);

  /** Tarik jurnal Dikirim (belum direview) kembali menjadi draft, lalu buka editor. */
  const tarik = async () => {
    if (!jub) return;
    ubahSedangTarik(true);
    try {
      await api<JurnalDetail>(`/jurnal/${jub.id}/tarik`, { method: 'POST' });
      ubahGalat(null);
      navigate(`/jurnal/${jub.id}/edit`);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(err.status === 404 ? 'Jurnal tidak ditemukan atau bukan milik Anda.' : 'Jurnal belum bisa ditarik. Muat ulang halaman lalu coba lagi.');
    } finally {
      ubahSedangTarik(false);
    }
  };

  if (galat) {
    return (
      <Kartu t="Detail jurnal">
        <Pemberitahuan jenis="er" judul="Belum berhasil dibuka" uraian={galat} />
        <div className="mt-2"><Tombol onClick={() => navigate('/jurnal')}>Kembali ke daftar jurnal</Tombol></div>
      </Kartu>
    );
  }
  if (!jub) return <Kartu t="Detail jurnal"><Galat pesan={null} /><p className="text-mu text-sm">Memuat…</p></Kartu>;

  const bisaUbah = ['Draft', 'Revisi'].includes(jub.status);
  const review = (jub.reviews ?? []).map((r) => ({
    keputusan: r.keputusan,
    waktu: jam(r.dibuat_pada),
    catatan: r.catatan,
    nama: r.pembimbing?.nama ?? 'Pembimbing',
  }));

  return (
    <>
      <Kartu t={jub.judul}>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Badge s={jub.status} />
          <small className="text-mu">Kegiatan tanggal {jub.tanggal}</small>
        </div>

        <h3 className="text-[13px] font-semibold mt-4 mb-1">Perjalanan status</h3>
        <GarisWaktu status={jub.status} buat={jam(jub.dibuat_pada)} ubah={jam(jub.diubah_pada)} review={review} />

        {review.length ? (
          <>
            <h3 className="text-[13px] font-semibold mt-5 mb-2">Catatan pembimbing</h3>
            <div className="flex flex-col gap-2">
              {review.map((r, i) => (
                <div key={i} className="border-2 border-y rounded-lg px-[14px] py-3 bg-[#a1620712] max-w-full">
                  <b className="block text-sm">{r.keputusan} — {r.nama}</b>
                  <small className="block text-mu mb-1">{r.waktu}</small>
                  <p className="text-sm">{r.catatan ?? '(Tanpa catatan)'}</p>
                </div>
              ))}
            </div>
          </>
        ) : jub.status === 'Draft' ? (
          <Pemberitahuan jenis="info" judul="Masih draf" uraian="Simpan sekarang atau kirim ke pembimbing bila sudah siap." />
        ) : null}

        <div className="flex flex-wrap gap-2 mt-4">
          {bisaUbah ? (
            <>
              <Tombol onClick={() => navigate(`/jurnal/${jub.id}/edit`)}>
                {jub.status === 'Revisi' ? 'Perbaiki dan kirim ulang' : 'Edit jurnal'}
              </Tombol>
              {jub.status === 'Draft' ? (
                <Tombol varian="gh" onClick={() => navigate(`/jurnal/${jub.id}/edit`)}>Buka di editor</Tombol>
              ) : null}
            </>
          ) : jub.status === 'Dikirim' ? (
            <Tombol varian="gh" disabled={sedangTarik} onClick={() => void tarik()}>
              {sedangTarik ? 'Menarik…' : 'Tarik ke draft untuk diedit'}
            </Tombol>
          ) : null}
          <Tombol varian="gh" onClick={() => navigate('/jurnal')}>Kembali ke daftar</Tombol>
        </div>
      </Kartu>

      <Kartu t="Isi jurnal">
        <dl className="grid gap-4">
          {[
            ['Uraian kegiatan', jub.uraian],
            ['Hasil', jub.hasil],
            ['Kendala', jub.kendala],
            ['Rencana berikutnya', jub.rencana],
          ].map(([a, b]) => (
            <div key={a as string}>
              <dt className="text-[13px] font-semibold mb-0.5">{a}</dt>
              <dd className="text-sm whitespace-pre-wrap">{b || <span className="text-mu">(tidak diisi)</span>}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[13px] font-semibold mb-0.5">Lampiran kegiatan</dt>
            <dd>
              {jub.lampiran ? (
                <button
                  type="button"
                  onClick={() => ubahBukaFoto(true)}
                  className="text-pr underline"
                >
                  Lihat lampiran
                </button>
              ) : (
                <span className="text-mu text-sm">(tidak ada lampiran)</span>
              )}
            </dd>
          </div>
        </dl>
      </Kartu>

      <PenampilFoto
        buka={bukaFoto}
        judul={`Lampiran kegiatan ${jub.tanggal}`}
        sumber={`/jurnal/${jub.id}/lampiran`}
        namaBerkas={`lampiran-jurnal-${jub.tanggal}`}
        tutup={() => ubahBukaFoto(false)}
      />
    </>
  );
}
