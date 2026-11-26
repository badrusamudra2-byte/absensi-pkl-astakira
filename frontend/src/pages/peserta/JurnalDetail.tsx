import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge, Galat, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
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
    <ol className="list-none p-0 m-0 flex flex-col gap-3">
      {tampil.map((l, n) => (
        <li key={n} className="flex items-start gap-2.5 text-[11.5px]">
          <span
            className={`size-6 rounded-full grid place-items-center shrink-0 ${
              n === tampil.length - 1 ? 'bg-pr text-white' : 'bg-[#dcfce7] text-[#15803d]'
            }`}
            aria-hidden="true"
          >
            <Ikon nama={n === tampil.length - 1 ? 'clock' : 'check'} className="size-3" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 flex-wrap">
              <b className="font-bold">{l.s}</b>
              {n === tampil.length - 1 && <Badge s={status} />}
            </span>
            <small className="block text-mu text-[10.5px] mt-0.5">{l.t}</small>
          </span>
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
      <>
        <JudulHalaman eyebrow="Peserta PKL" judul="Detail Jurnal" sub="Jurnal tidak dapat ditampilkan." />
        <Kartu>
          <Pemberitahuan jenis="er" judul="Belum berhasil dibuka" uraian={galat} />
          <div className="mt-3"><Tombol onClick={() => navigate('/jurnal')}>Kembali ke daftar jurnal</Tombol></div>
        </Kartu>
      </>
    );
  }
  if (!jub) {
    return (
      <>
        <JudulHalaman eyebrow="Peserta PKL" judul="Detail Jurnal" sub="Memuat jurnal…" />
        <Kartu>
          <Galat pesan={null} />
          <div className="flex items-center gap-2 text-mu text-sm py-2">
            <Ikon nama="refresh" className="size-4 animate-spin" />
            Memuat…
          </div>
        </Kartu>
      </>
    );
  }

  const bisaUbah = ['Draft', 'Revisi'].includes(jub.status);
  const review = (jub.reviews ?? []).map((r) => ({
    keputusan: r.keputusan,
    waktu: jam(r.dibuat_pada),
    catatan: r.catatan,
    nama: r.pembimbing?.nama ?? 'Pembimbing',
  }));

  return (
    <>
      <JudulHalaman
        eyebrow={`Jurnal · ${jub.tanggal}`}
        judul={jub.judul}
        sub={`Terakhir diperbarui ${jam(jub.diubah_pada)} WIB`}
        aksi={<Badge s={jub.status} />}
      />

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
        <Kartu t="Isi jurnal" className="order-2 lg:order-1">
          <dl className="grid gap-4 m-0">
            {[
              { a: 'Uraian kegiatan', b: jub.uraian, i: 'file' as const },
              { a: 'Hasil', b: jub.hasil, i: 'checkCircle' as const },
              { a: 'Kendala', b: jub.kendala, i: 'alert' as const },
              { a: 'Rencana berikutnya', b: jub.rencana, i: 'arrow' as const },
            ].map((x) => (
              <div key={x.a} className="rounded-xl border border-garis bg-[#fbfcfe] p-3.5">
                <dt className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">
                  <Ikon nama={x.i} className="size-3.5 text-pr" />
                  {x.a}
                </dt>
                <dd className="text-[12px] whitespace-pre-wrap leading-relaxed text-[#334155] m-0">
                  {x.b || <span className="text-mu">(tidak diisi)</span>}
                </dd>
              </div>
            ))}
            <div className="rounded-xl border border-garis bg-[#fbfcfe] p-3.5">
              <dt className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">
                <Ikon nama="image" className="size-3.5 text-pr" />
                Lampiran kegiatan
              </dt>
              <dd className="m-0">
                {jub.lampiran ? (
                  <button
                    type="button"
                    onClick={() => ubahBukaFoto(true)}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-pr"
                  >
                    <Ikon nama="eye" className="size-3.5" />
                    Lihat lampiran
                  </button>
                ) : (
                  <span className="text-mu text-[11.5px]">(tidak ada lampiran)</span>
                )}
              </dd>
            </div>
          </dl>
        </Kartu>

        <div className="order-1 lg:order-2">
          <Kartu t="Perjalanan status">
            <GarisWaktu status={jub.status} buat={jam(jub.dibuat_pada)} ubah={jam(jub.diubah_pada)} review={review} />

            {!review.length && jub.status === 'Draft' ? (
              <div className="mt-3">
                <Pemberitahuan jenis="info" judul="Masih draf" uraian="Simpan sekarang atau kirim ke pembimbing bila sudah siap." />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-garis">
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

          {review.length ? (
            <Kartu t="Catatan pembimbing">
              <div className="flex flex-col gap-2.5">
                {review.map((r, i) => (
                  <div key={i} className="rounded-xl border border-[#fde68a] px-3.5 py-3 bg-[#fffbeb]">
                    <b className="block text-[11.5px]">{r.keputusan} — {r.nama}</b>
                    <small className="block text-mu text-[10px] mb-1">{r.waktu}</small>
                    <p className="text-[11.5px] text-[#4a5a72] m-0 leading-relaxed">{r.catatan ?? '(Tanpa catatan)'}</p>
                  </div>
                ))}
              </div>
            </Kartu>
          ) : null}
        </div>
      </div>

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
