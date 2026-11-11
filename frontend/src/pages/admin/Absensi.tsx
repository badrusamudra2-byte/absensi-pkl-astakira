import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Absensi, Jenis, StatusAbsensi } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { isoHariIni, gunakanTerbaru } from '../../komponen/umum';

/** Modal foto wajah absensi: gambar diunduh mentah (blob JWT) lalu ditampilkan. */
function ModalFoto({ url, tutup }: { url: string; tutup: () => void }) {
  useEffect(() => {
    const kbd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup();
    };
    window.addEventListener('keydown', kbd);
    return () => window.removeEventListener('keydown', kbd);
  }, [tutup]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={tutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Foto wajah saat absensi"
        className="bg-kartu rounded-xl p-3 max-w-[92vw] max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={url} alt="Foto wajah peserta saat absensi dicatat" className="max-w-full max-h-[70vh] rounded-lg" />
        <p className="text-center mt-2">
          <Tombol varian="gh" onClick={tutup}>Tutup</Tombol>
        </p>
      </div>
    </div>
  );
}

const STATUS: StatusAbsensi[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'];

/** Absensi per tanggal: koreksi baris (alasan wajib). Izin/Sakit kini hanya datang
 * dari pengajuan peserta yang disetujui pembimbing. */
export default function AbsensiAdmin() {
  const toast = useToast();
  const [peserta, ubahPeserta] = useState<{ id: number; nama: string }[]>([]);
  const [galatPeserta, ubahGalatPeserta] = useState<[string, string] | null>(null);
  const [uid, ubahUid] = useState<number | ''>('');
  const [tanggal, ubahTanggal] = useState(isoHariIni());
  const [rows, ubahRows] = useState<Absensi[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  // Form koreksi per baris
  const [editId, ubahEditId] = useState<number | null>(null);
  const [fJam, ubahFJam] = useState('');
  const [fStatus, ubahFStatus] = useState<StatusAbsensi>('Hadir');
  const [fJenis, ubahFJenis] = useState<Jenis>('masuk');
  const [fAlasan, ubahFAlasan] = useState('');
  const [sedang, ubahSedang] = useState(false);

  // Foto wajah absensi (dipakai untuk rekap pembuktian kehadiran)
  const [fotoUrl, ubahFotoUrl] = useState<string | null>(null);
  const [fotoMuat, ubahFotoMuat] = useState<number | null>(null); // id absensi yang sedang diunduh
  const terbaru = gunakanTerbaru();

  const tutupFoto = () => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    ubahFotoUrl(null);
  };

  const lihatFoto = async (a: Absensi) => {
    ubahFotoMuat(a.id);
    ubahGalat(null);
    try {
      const res = await api<Response>(`/admin/absensi/${a.id}/foto`, { raw: true });
      const blob = await res.blob();
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
      ubahFotoUrl(URL.createObjectURL(blob));
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahFotoMuat(null);
    }
  };

  // Daftar peserta: galat tidak boleh ditelan senyap — dropdown kosong membuat
  // tombol "Tampilkan" mati tanpa penjelasan.
  useEffect(() => {
    api<{ data: { id: number; nama: string; aktif: boolean }[] }>('/admin/peserta')
      .then((r) => ubahPeserta(r.data.map((p) => ({ id: p.id, nama: p.nama }))))
      .catch((e) => ubahGalatPeserta(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  const muat = useCallback(async () => {
    if (!uid) {
      ubahRows(null);
      return;
    }
    const sah = terbaru();
    ubahRows(null);
    ubahGalat(null);
    try {
      const r = await api<{ data: Absensi[] }>(`/admin/absensi?user_id=${uid}&tanggal=${tanggal}`);
      if (sah(true)) ubahRows(r.data);
    } catch (e) {
      if (!sah(true)) return;
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, [uid, tanggal, terbaru]);

  const bukaEdit = (a: Absensi) => {
    ubahEditId(a.id);
    ubahFJam(a.jam.slice(0, 5));
    ubahFStatus(a.status);
    ubahFJenis(a.jenis);
    ubahFAlasan('');
  };

  const koreksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>(`/admin/absensi/${editId}`, {
        method: 'PUT',
        json: { jam: fJam + ':00', status: fStatus, jenis: fJenis, alasan: fAlasan },
      });
      toast(r.pesan);
      ubahEditId(null);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  return (
    <>
      <Kartu t="Absensi per tanggal">
        <p className="flex flex-wrap items-end gap-3">
          <p>
            <Label htmlFor="adm_psr">Peserta</Label>
            <select id="adm_psr" value={uid} onChange={(e) => ubahUid(e.target.value ? Number(e.target.value) : '')}
              className="px-[11px] py-2 border border-garis rounded-lg bg-bg">
              <option value="">— pilih peserta —</option>
              {peserta.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </p>
          <p>
            <Label htmlFor="adm_tgl">Tanggal</Label>
            <input id="adm_tgl" type="date" value={tanggal} onChange={(e) => ubahTanggal(e.target.value)}
              className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
          </p>
          <p><Tombol onClick={() => void muat()} disabled={!uid}>Tampilkan</Tombol></p>
        </p>
        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        {galatPeserta ? (
          <div className="mt-2">
            <Pemberitahuan jenis="warn" judul={galatPeserta[0]} uraian={`${galatPeserta[1]} Pilih peserta pada daftar menurun untuk mengaktifkan tombol.`} />
          </div>
        ) : null}

        {rows !== null && rows.length ? (
          <>
            <ul className="mt-4 flex flex-col gap-2">
            {rows.map((a) => (
              <li key={a.id} className="border border-garis rounded-xl p-3">
                {editId === a.id ? (
                  <form onSubmit={koreksi} className="grid gap-2 sm:grid-cols-2 max-w-[640px]">
                    <p>
                      <Label htmlFor="k_jam">Jam</Label>
                      <input id="k_jam" type="time" step={60} value={fJam} onChange={(e) => ubahFJam(e.target.value)}
                        className="block w-full mt-1 px-[11px] py-2 border border-garis rounded-lg bg-bg" />
                    </p>
                    <p>
                      <Label htmlFor="k_status">Status</Label>
                      <select id="k_status" value={fStatus} onChange={(e) => ubahFStatus(e.target.value as StatusAbsensi)}
                        className="block w-full mt-1 px-[11px] py-2 border border-garis rounded-lg bg-bg">
                        {STATUS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </p>
                    <p>
                      <Label htmlFor="k_jenis">Jenis</Label>
                      <select id="k_jenis" value={fJenis} onChange={(e) => ubahFJenis(e.target.value as Jenis)}
                        className="block w-full mt-1 px-[11px] py-2 border border-garis rounded-lg bg-bg">
                        <option value="masuk">masuk</option>
                        <option value="pulang">pulang</option>
                      </select>
                    </p>
                    <p className="sm:col-span-2">
                      <Label htmlFor="k_alasan">
                        Alasan koreksi <span className="text-r">wajib</span> (tercatat di audit log)
                      </Label>
                      <textarea id="k_alasan" required minLength={3} maxLength={500} rows={2} value={fAlasan}
                        onChange={(e) => ubahFAlasan(e.target.value)}
                        className="block w-full mt-1 px-[11px] py-2 border border-garis rounded-lg bg-bg"
                        placeholder="Misal: Salah pindai, waktu sebenarnya 07:55." />
                    </p>
                    <p className="flex gap-2 sm:col-span-2">
                      <Tombol type="submit" disabled={sedang || fAlasan.trim().length < 3}>Simpan koreksi</Tombol>
                      <Tombol varian="gh" onClick={() => ubahEditId(null)} disabled={sedang}>Batal</Tombol>
                    </p>
                  </form>
                ) : (
                  <p className="flex flex-wrap items-center gap-3 text-sm">
                    <b className="capitalize">{a.jenis}</b>
                    <span>{a.jam.slice(0, 5)}</span>
                    <Badge s={a.status} />
                    <span className="text-mu">{a.metode}</span>
                    {a.keterangan ? <span className="text-mu w-full">“{a.keterangan}”</span> : null}
                    <span className="flex gap-3">
                      {a.metode.includes('Wajah') ? (
                        <button
                          onClick={() => void lihatFoto(a)}
                          disabled={fotoMuat !== null}
                          className="text-pr underline cursor-pointer bg-transparent border-0 p-0 text-sm"
                        >
                          {fotoMuat === a.id ? 'Memuat foto…' : 'Lihat foto…'}
                        </button>
                      ) : null}
                      <button onClick={() => bukaEdit(a)} className="text-pr underline cursor-pointer bg-transparent border-0 p-0 text-sm">
                        Koreksi…
                      </button>
                    </span>
                  </p>
                )}
              </li>
            ))}
            </ul>
            {fotoUrl ? <ModalFoto url={fotoUrl} tutup={tutupFoto} /> : null}
          </>
        ) : rows !== null ? (
          <p className="text-mu text-sm mt-4">Tidak ada catatan absensi peserta ini pada tanggal tersebut.</p>
        ) : null}
      </Kartu>
    </>
  );
}
