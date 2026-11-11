import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge, Label, Galat } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { waktuWib } from '../../komponen/umum';

export default function DetailJurnal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [jub, ubahJub] = useState<JurnalDetail | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [bukaRevisi, ubahBukaRevisi] = useState(false);
  const [catatan, ubahCatatan] = useState('');
  const [sedang, ubahSedang] = useState(false);

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
      <Kartu t="Detail jurnal">
        <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
        <div className="mt-2"><Tombol onClick={() => navigate('/pembimbing/jurnal')}>Kembali ke daftar</Tombol></div>
      </Kartu>
    );
  }
  if (!jub) return <Kartu t="Detail jurnal"><p className="text-mu text-sm">Memuat…</p></Kartu>;

  const bisaReview = jub.status === 'Dikirim';
  const review = (jub.reviews ?? []).map((r) => ({
    keputusan: r.keputusan,
    waktu: waktuWib(r.dibuat_pada),
    catatan: r.catatan,
    nama: r.pembimbing?.nama ?? 'Pembimbing',
  }));

  return (
    <>
      <Kartu t={jub.judul}>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Badge s={jub.status} />
          <small className="text-mu">Kegiatan tanggal {jub.tanggal} — {jub.peserta?.nama ?? 'Peserta'}</small>
        </div>

        {bisaReview ? (
          <div className="mt-4 border-2 border-garis rounded-xl p-4">
            <h3 className="font-bold text-sm mb-1">Keputusan review</h3>
            <p className="text-mu text-sm mb-3">Setujui langsung, atau minta revisi dengan catatan.</p>
            {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
            {bukaRevisi ? (
              <>
                <Label htmlFor="catatan_rev">
                  Catatan revisi <span className="text-r">wajib</span> (agar peserta tahu yang perlu diperbaiki)
                </Label>
                <textarea
                  id="catatan_rev"
                  value={catatan}
                  onChange={(e) => ubahCatatan(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
                  placeholder="Misal: Uraian kegiatan terlalu singkat, tambahkan hasil kerja hari ini."
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  <Tombol varian="dg" disabled={sedang || catatan.trim().length < 3} onClick={() => void putuskan('revisi')}>
                    Kirim permintaan revisi
                  </Tombol>
                  <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaRevisi(false)}>Batal</Tombol>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Tombol disabled={sedang} onClick={() => void putuskan('setujui')}>Setujui jurnal</Tombol>
                <Tombol varian="dg" disabled={sedang} onClick={() => ubahBukaRevisi(true)}>Minta revisi…</Tombol>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3"><Tombol varian="gh" onClick={() => navigate('/pembimbing/jurnal')}>Kembali ke daftar</Tombol></p>
        )}
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
        </dl>
      </Kartu>

      {review.length ? (
        <Kartu t="Riwayat review">
          <ul className="flex flex-col gap-2">
            {review.map((r, i) => (
              <li key={i} className="border-2 border-y rounded-lg px-[14px] py-3 bg-[#a1620712]">
                <b className="block text-sm">{r.keputusan} — {r.nama}</b>
                <small className="block text-mu mb-1">{r.waktu}</small>
                <p className="text-sm">{r.catatan || '(Tanpa catatan)'}</p>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
      <div className="sm:hidden"><Galat pesan={null} /></div>
    </>
  );
}
