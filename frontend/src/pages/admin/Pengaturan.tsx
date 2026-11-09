import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { MetodeAbsensi, Pengaturan } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Tabel } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';

const SESUAI: { metode: MetodeAbsensi; label: string; uraian: string }[] = [
  { metode: 'qr_wajah', label: 'QR + wajah', uraian: 'Peserta memverifikasi wajahnya sendiri di HP-nya (foto wajah saat absensi tersimpan terenkripsi untuk rekap), lalu menayangkan QR; pembimbing cukup memindai QR-nya.' },
  { metode: 'qr', label: 'QR saja', uraian: 'Peserta menayangkan QR-nya; pembimbing memindai — tanpa verifikasi wajah.' },
  { metode: 'wajah', label: 'Wajah saja', uraian: 'Peserta absen langsung dari HP-nya: wajah cocok dan liveness lolos, absensi (beserta foto) tercatat — tanpa QR.' },
];

type BarisPsrt = { id: number; nama: string; email: string };

export default function Pengaturan() {
  const toast = useToast();
  const [isi, ubahIsi] = useState<Pengaturan | null>(null);
  const [metode, ubahMetode] = useState<MetodeAbsensi>('qr_wajah');
  const [liveness, ubahLiveness] = useState(true);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [daftar, ubahDaftar] = useState<BarisPsrt[] | null>(null);
  const [pilih, ubahPilih] = useState<number | null>(null);

  useEffect(() => {
    api<Pengaturan>('/pengaturan/absensi')
      .then((r) => {
        ubahIsi(r);
        ubahMetode(r.metode);
        ubahLiveness(r.liveness_aktif);
      })
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
    api<{ data: BarisPsrt[] }>('/admin/peserta')
      .then((r) => ubahDaftar(r.data))
      .catch(() => ubahDaftar(null));
  }, []);

  const simpan = async () => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pengaturan: Pengaturan }>('/pengaturan/absensi', {
        method: 'PUT',
        json: { metode, liveness_aktif: liveness },
      });
      ubahIsi(r.pengaturan);
      toast('Pengaturan absensi disimpan.');
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  };

  const diubahIsi = !isi || isi.metode !== metode || isi.liveness_aktif !== liveness;

  const resetWajah = useCallback(async () => {
    if (pilih === null) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>(`/admin/face/${pilih}`, { method: 'DELETE' });
      toast(r.pesan);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  }, [pilih, toast]);

  return (
    <>
      <Kartu t="Pengaturan absensi">
        <fieldset disabled={sedang}>
          <legend className="text-sm font-semibold mb-2">Metode absensi untuk semua peserta</legend>
          {SESUAI.map((k) => (
            <label key={k.metode} className="flex items-start gap-2 my-2">
              <input
                type="radio"
                name="metode"
                value={k.metode}
                checked={metode === k.metode}
                onChange={() => ubahMetode(k.metode)}
                className="mt-1"
              />
              <span>
                <b>{k.label}</b>
                <small className="block text-mu">{k.uraian}</small>
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 mt-3">
            <input type="checkbox" checked={liveness} onChange={(e) => ubahLiveness(e.target.checked)} />
            Liveness aktif (tantangan gerakan: kedip / tengok / buka mulut)
          </label>
          <div className="mt-3 flex items-center gap-3">
            <Tombol onClick={() => void simpan()} disabled={sedang || !diubahIsi}>Simpan pengaturan</Tombol>
            {!diubahIsi && isi ? <small className="text-mu">Perubahan sejak: {isi.metode}</small> : null}
          </div>
          {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        </fieldset>
      </Kartu>

      <Kartu t="Reset template wajah peserta">
        <p className="text-mu text-sm mb-2">
          Menghapus template wajah peserta supaya mereka dapat mendaftar ulang.
        </p>
        {daftar === null ? (
          <p className="text-mu text-sm">Daftar peserta gagal dimuat — pastikan server aktif.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resetWajah();
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <p>
              <label htmlFor="pil_psr" className="block text-[13px] font-semibold mb-1">Pilih peserta</label>
              <select
                id="pil_psr"
                value={pilih ?? ''}
                onChange={(e) => ubahPilih(Number(e.target.value))}
                className="px-[11px] py-2 border border-garis rounded-lg bg-bg"
              >
                <option value="">— pilih —</option>
                {daftar.map((d) => (
                  <option key={d.id} value={d.id}>{d.nama} ({d.email})</option>
                ))}
              </select>
            </p>
            <p>
              <Tombol type="submit" varian="dg" disabled={pilih === null || sedang}>Reset template wajah</Tombol>
            </p>
          </form>
        )}
        <div className="mt-3">
          <Tabel
            h={['Nama', 'Email']}
            rows={(daftar ?? []).map((d) => [d.nama, d.email])}
            em="Tidak ada peserta terdaftar."
          />
          <p className="mt-2"><Link to="/" className="text-pr underline text-sm">Kembali ke beranda</Link></p>
        </div>
      </Kartu>
    </>
  );
}
