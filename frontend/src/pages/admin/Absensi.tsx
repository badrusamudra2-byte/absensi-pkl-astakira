import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLokasiKantor, teksJarak } from '../../lib/kantor';
import type { Absensi, Jenis, StatusAbsensi } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Label, Masukan, Badge } from '../../komponen/ui';
import PetaAbsensi, { warnaTitik } from '../../komponen/PetaAbsensi';
import { useToast } from '../../komponen/Toast';
import { isoHariIni, gunakanTerbaru, titikTerbaruBerlokasi } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07152e]/70 p-4 backdrop-blur-sm" onClick={tutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Foto wajah saat absensi"
        className="max-h-[92vh] max-w-[92vw] overflow-auto rounded-2xl bg-kartu p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <b className="flex items-center gap-1.5 text-xs">
            <Ikon nama="camera" className="size-3.5 text-pr" />
            Foto wajah saat absensi
          </b>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup foto"
            className="grid size-7 place-items-center rounded-lg text-mu transition hover:bg-bg hover:text-teks"
          >
            <Ikon nama="x" className="size-4" />
          </button>
        </div>
        <img src={url} alt="Foto wajah peserta saat absensi dicatat" className="max-h-[70vh] max-w-full rounded-xl" />
        <p className="mt-2 text-center">
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
  const [kantor, ubahKantor] = useState<{ lat: number; lng: number; radius_m: number } | null>(null);
  const terbaru = gunakanTerbaru();

  useEffect(() => {
    void ambilLokasiKantor().then(ubahKantor);
  }, []);

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

  const pesertaTerpilih = peserta.find((p) => p.id === uid);

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Absensi & koreksi"
        sub="Periksa catatan absensi peserta per tanggal dan koreksi bila diperlukan."
      />

      <Kartu t="Pilih peserta dan tanggal">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="adm_psr" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">Peserta</label>
            <select
              id="adm_psr"
              value={uid}
              onChange={(e) => ubahUid(e.target.value ? Number(e.target.value) : '')}
              className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10"
            >
              <option value="">— pilih peserta —</option>
              {peserta.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="adm_tgl" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">Tanggal</label>
            <input
              id="adm_tgl" type="date" value={tanggal} onChange={(e) => ubahTanggal(e.target.value)}
              className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10"
            />
          </div>
          <Tombol onClick={() => void muat()} disabled={!uid}>
            <Ikon nama="search" className="size-4" />
            Tampilkan
          </Tombol>
        </div>

        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        {galatPeserta ? (
          <div className="mt-3">
            <Pemberitahuan jenis="warn" judul={galatPeserta[0]} uraian={`${galatPeserta[1]} Pilih peserta pada daftar menurun untuk mengaktifkan tombol.`} />
          </div>
        ) : null}
        {!uid ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-mu">
            <Ikon nama="info" className="size-3.5" />
            Pilih peserta dan tanggal, lalu tekan Tampilkan.
          </p>
        ) : null}
      </Kartu>

      {rows !== null && rows.length ? (
        <>
          <Kartu t={`Catatan absensi${pesertaTerpilih ? ` — ${pesertaTerpilih.nama}` : ''}`}>
            <p className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-mu">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pl px-2.5 py-1 font-semibold text-pr">
                <Ikon nama="calendar" className="size-3.5" />
                {tanggal}
              </span>
              <span>{rows.length} catatan</span>
            </p>
            <ul className="flex flex-col gap-2.5">
              {rows.map((a) => (
                <li key={a.id} className="rounded-[13px] border border-garis bg-kartu p-3.5">
                  {editId === a.id ? (
                    <form onSubmit={koreksi} className="max-w-[680px]">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-pl text-pr">
                          <Ikon nama="edit" className="size-3.5" />
                        </span>
                        <b className="text-sm">Koreksi absensi</b>
                      </div>
                      <div className="grid gap-x-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="k_jam" className="mt-0">Jam</Label>
                          <Masukan id="k_jam" type="time" step={60} value={fJam} onChange={(e) => ubahFJam(e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="k_status" className="mt-0">Status</Label>
                          <select
                            id="k_status" value={fStatus} onChange={(e) => ubahFStatus(e.target.value as StatusAbsensi)}
                            className="mt-1 block h-[38px] w-full rounded-lg border border-garis bg-bg px-[11px] text-sm outline-none focus:border-pr focus:ring-4 focus:ring-pr/10"
                          >
                            {STATUS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="k_jenis">Jenis</Label>
                          <select
                            id="k_jenis" value={fJenis} onChange={(e) => ubahFJenis(e.target.value as Jenis)}
                            className="mt-1 block h-[38px] w-full rounded-lg border border-garis bg-bg px-[11px] text-sm outline-none focus:border-pr focus:ring-4 focus:ring-pr/10"
                          >
                            <option value="masuk">masuk</option>
                            <option value="pulang">pulang</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="k_alasan">
                            Alasan koreksi <span className="text-r">wajib</span> (tercatat di audit log)
                          </Label>
                          <textarea
                            id="k_alasan" required minLength={3} maxLength={500} rows={2} value={fAlasan}
                            onChange={(e) => ubahFAlasan(e.target.value)}
                            className="mt-1 block w-full rounded-[11px] border border-garis bg-kartu px-3 py-2.5 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10"
                            placeholder="Misal: Salah pindai, waktu sebenarnya 07:55."
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Tombol type="submit" disabled={sedang || fAlasan.trim().length < 3}>
                          <Ikon nama="check" className="size-4" />
                          Simpan koreksi
                        </Tombol>
                        <Tombol varian="gh" onClick={() => ubahEditId(null)} disabled={sedang}>Batal</Tombol>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pl text-pr">
                          <Ikon nama={a.jenis === 'masuk' ? 'clock' : 'logout'} className="size-4" />
                        </span>
                        <b className="text-sm capitalize">{a.jenis}</b>
                        <span className="text-lg font-extrabold tabular-nums">{a.jam.slice(0, 5)}</span>
                        <Badge s={a.status} />
                        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-mu">{a.metode}</span>
                        <span className="ml-auto flex flex-wrap gap-1.5">
                          {a.metode.includes('Wajah') ? (
                            <button
                              onClick={() => void lihatFoto(a)}
                              disabled={fotoMuat !== null}
                              className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-pr transition hover:border-pr hover:bg-pl disabled:opacity-60"
                            >
                              <Ikon nama="camera" className="size-3" />
                              {fotoMuat === a.id ? 'Memuat…' : 'Lihat foto'}
                            </button>
                          ) : null}
                          <button
                            onClick={() => bukaEdit(a)}
                            className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-pr transition hover:border-pr hover:bg-pl"
                          >
                            <Ikon nama="edit" className="size-3" />
                            Koreksi
                          </button>
                        </span>
                      </div>
                      {a.keterangan ? (
                        <p className="mt-2 rounded-lg bg-[#f8fafc] px-2.5 py-2 text-xs leading-relaxed text-mu">“{a.keterangan}”</p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {fotoUrl ? <ModalFoto url={fotoUrl} tutup={tutupFoto} /> : null}
          </Kartu>

          <Kartu t="Peta lokasi absensi">
            {rows.some((a) => a.lat !== null && a.lng !== null) || kantor ? (
              <>
                <PetaAbsensi
                  kantor={kantor}
                  titik={titikTerbaruBerlokasi(rows)
                    .map((a) => ({
                      lat: a.lat as number,
                      lng: a.lng as number,
                      jenis: a.jenis,
                      warna: warnaTitik(a.user_id),
                      label: `${a.jenis} ${a.jam.slice(0, 5)} (${teksJarak(a.jarak_m)} dari kantor)`,
                    }))}
                />
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-mu">
                  <Ikon nama="info" className="mt-0.5 size-3.5 shrink-0" />
                  Hanya absen terbaru berlokasi yang ditampilkan agar titik tidak menumpuk.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center px-4 py-7 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-pl text-pr">
                  <Ikon nama="pin" className="size-5" />
                </span>
                <b className="mt-2.5 text-sm">Belum ada data lokasi</b>
                <p className="mt-1 max-w-[520px] text-xs leading-relaxed text-mu">
                  Titik absensi muncul bila area kantor sudah diatur pada Pengaturan dan peserta mengirim lokasi saat absen.
                </p>
              </div>
            )}
          </Kartu>
        </>
      ) : rows !== null && !galat ? (
        <Kartu>
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-pl text-pr">
              <Ikon nama="absen" className="size-6" />
            </span>
            <b className="mt-3 text-sm">Tidak ada catatan absensi</b>
            <p className="mt-1 max-w-[360px] text-xs leading-relaxed text-mu">
              Peserta ini tidak memiliki catatan absensi pada tanggal yang dipilih.
            </p>
          </div>
        </Kartu>
      ) : null}
    </>
  );
}
