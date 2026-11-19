import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Badge, Label } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { PenampilFoto } from '../../komponen/PenampilFoto';
import { waktuWib } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';

export default function DetailJurnal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [jub, ubahJub] = useState<JurnalDetail | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [bukaRevisi, ubahBukaRevisi] = useState(false);
  const [catatan, ubahCatatan] = useState('');
  const [sedang, ubahSedang] = useState(false);
  const [bukaFoto, ubahBukaFoto] = useState(false);

  useEffect(() => {
    api<JurnalDetail>(`/pembimbing/jurnal/${id}`)
      .then(ubahJub)
      .catch((e) => {
        const err = e as ApiError;
        ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      });
  }, [id]);

  const putuskan = async (keputusan: 'setujui' | 'revisi') => {
    if (keputusan === 'revisi' && catatan.trim().length < 3) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string; status: string }>(`/pembimbing/jurnal/${id}/review`, {
        method: 'POST',
        json: { keputusan, catatan },
      });
      toast(r.pesan);
      navigate('/pembimbing/jurnal');
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      ubahSedang(false);
    }
  };

  if (galat && !jub) {
    return (
      <>
        <JudulHalaman eyebrow="Pembimbing" judul="Detail jurnal" sub="Jurnal peserta bimbingan." />
        <Kartu>
          <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
          <div className="mt-2"><Tombol onClick={() => navigate('/pembimbing/jurnal')}>Kembali ke daftar</Tombol></div>
        </Kartu>
      </>
    );
  }
  if (!jub) {
    return (
      <>
        <JudulHalaman eyebrow="Pembimbing" judul="Detail jurnal" sub="Jurnal peserta bimbingan." />
        <Kartu><p className="text-sm text-mu">Memuat jurnal&hellip;</p></Kartu>
      </>
    );
  }

  const bisaReview = jub.status === 'Dikirim';
  const review = (jub.reviews ?? []).map((r) => ({
    keputusan: r.keputusan,
    waktu: waktuWib(r.dibuat_pada),
    catatan: r.catatan,
    nama: r.pembimbing?.nama ?? 'Pembimbing',
  }));

  return (
    <>
      <JudulHalaman
        eyebrow="Review jurnal"
        judul={jub.judul}
        sub={`Kegiatan tanggal ${jub.tanggal} — ${jub.peserta?.nama ?? 'Peserta'}`}
        aksi={
          <Link
            to="/pembimbing/jurnal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-garis bg-kartu px-3 py-2 text-xs font-bold text-pr no-underline transition hover:border-pr hover:bg-pl"
          >
            <Ikon nama="arrow" className="size-3.5 rotate-180" />
            Kembali
          </Link>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <Kartu t="Isi jurnal">
            <dl className="grid gap-4">
              {[
                ['Uraian kegiatan', jub.uraian],
                ['Hasil', jub.hasil],
                ['Kendala', jub.kendala],
                ['Rencana berikutnya', jub.rencana],
              ].map(([a, b]) => (
                <div key={a as string} className="rounded-xl border border-garis/80 bg-[#fbfcfe] p-3.5">
                  <dt className="mb-1 text-[10px] font-extrabold uppercase tracking-[.5px] text-mu">{a}</dt>
                  <dd className="text-sm leading-relaxed whitespace-pre-wrap">{b || <span className="text-mu">(tidak diisi)</span>}</dd>
                </div>
              ))}
              <div className="rounded-xl border border-garis/80 bg-[#fbfcfe] p-3.5">
                <dt className="mb-1 text-[10px] font-extrabold uppercase tracking-[.5px] text-mu">Lampiran kegiatan</dt>
                <dd>
                  {jub.lampiran ? (
                    <button
                      type="button"
                      onClick={() => ubahBukaFoto(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-pr no-underline hover:underline"
                    >
                      <Ikon nama="image" className="size-4" />
                      Lihat lampiran
                    </button>
                  ) : (
                    <span className="text-sm text-mu">(tidak ada lampiran)</span>
                  )}
                </dd>
              </div>
            </dl>
          </Kartu>

          {review.length ? (
            <Kartu t="Riwayat review">
              <ol className="relative m-0 flex list-none flex-col gap-4 p-0 before:absolute before:bottom-1 before:left-[11px] before:top-1 before:w-px before:bg-garis">
                {review.map((r, i) => (
                  <li key={i} className="relative pl-8">
                    <span className="absolute left-0 top-0 grid size-[23px] place-items-center rounded-full border-2 border-kartu bg-pl text-pr">
                      <Ikon nama={r.keputusan === 'Disetujui' ? 'check' : 'edit'} className="size-3" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm">{r.keputusan}</b>
                      <span className="text-[11px] text-mu">{r.nama}</span>
                    </div>
                    <small className="block text-[11px] text-mu">{r.waktu}</small>
                    <p className="mt-1 text-sm leading-relaxed">{r.catatan || '(Tanpa catatan)'}</p>
                  </li>
                ))}
              </ol>
            </Kartu>
          ) : null}
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <Kartu t={bisaReview ? 'Keputusan review' : 'Status jurnal'}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge s={jub.status} />
              <span className="text-[11px] text-mu">Tanggal {jub.tanggal}</span>
            </div>

            {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

            {bisaReview ? (
              <>
                <p className="mb-3 text-xs leading-relaxed text-mu">
                  Setujui langsung bila isi jurnal sudah sesuai, atau minta revisi dengan catatan yang jelas.
                </p>
                {bukaRevisi ? (
                  <>
                    <Label htmlFor="catatan_rev">
                      Catatan revisi <span className="text-r">wajib</span>
                    </Label>
                    <textarea
                      id="catatan_rev"
                      value={catatan}
                      onChange={(e) => ubahCatatan(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      className="mt-1 block w-full rounded-[11px] border border-garis bg-kartu px-3 py-2.5 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10"
                      placeholder="Misal: Uraian kegiatan terlalu singkat, tambahkan hasil kerja hari ini."
                    />
                    <div className="mt-3 flex flex-col gap-2">
                      <Tombol varian="dg" disabled={sedang || catatan.trim().length < 3} onClick={() => void putuskan('revisi')}>
                        Kirim permintaan revisi
                      </Tombol>
                      <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaRevisi(false)}>Batal</Tombol>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Tombol disabled={sedang} onClick={() => void putuskan('setujui')}>
                      <Ikon nama="check" className="size-4" />
                      Setujui jurnal
                    </Tombol>
                    <Tombol varian="dg" disabled={sedang} onClick={() => ubahBukaRevisi(true)}>
                      <Ikon nama="edit" className="size-4" />
                      Minta revisi
                    </Tombol>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-mu">
                  Jurnal ini tidak lagi menunggu keputusan review. Riwayat keputusan tetap dapat dilihat.
                </p>
                <div className="mt-3">
                  <Tombol varian="gh" onClick={() => navigate('/pembimbing/jurnal')}>Kembali ke daftar</Tombol>
                </div>
              </>
            )}
          </Kartu>

          <div className="rounded-kartu border border-[#c7dbff] bg-gradient-to-r from-[#eaf2ff] to-[#f5f9ff] p-4">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[1px] text-pr">
              <Ikon nama="info" className="size-3.5" />
              Catatan
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-mu">
              Peserta menerima hasil review dan dapat mengirim ulang jurnal setelah diperbaiki.
            </p>
          </div>
        </div>
      </div>

      <PenampilFoto
        buka={bukaFoto}
        judul={`Lampiran kegiatan ${jub.tanggal} — ${jub.peserta?.nama ?? 'Peserta'}`}
        sumber={`/jurnal/${jub.id}/lampiran`}
        namaBerkas={`lampiran-jurnal-${jub.tanggal}`}
        tutup={() => ubahBukaFoto(false)}
      />
    </>
  );
}
