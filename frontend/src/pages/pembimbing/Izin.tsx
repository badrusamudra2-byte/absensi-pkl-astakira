import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { Kartu, Tombol, Pemberitahuan, Label } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { isoHariIni } from '../../komponen/umum';

/** Halaman catat Izin/Sakit: pembimbing untuk bimbingannya, hari itu otomatis terkunci dari absensi. */
export default function Izin() {
  const toast = useToast();
  const [peserta, ubahPeserta] = useState<{ id: number; nama: string }[]>([]);
  const [user_id, ubahUid] = useState<number | ''>('');
  const [tanggal, ubahTanggal] = useState(isoHariIni());
  const [status, ubahStatus] = useState<'Izin' | 'Sakit'>('Izin');
  const [keterangan, ubahKet] = useState('');
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);

  useEffect(() => {
    api<{ data: { id: number; nama: string; aktif: boolean }[] }>('/pembimbing/peserta')
      .then((r) => {
        const aktif = r.data.filter((p) => p.aktif);
        ubahPeserta(aktif.map((p) => ({ id: p.id, nama: p.nama })));
        if (aktif.length === 1) ubahUid(aktif[0].id);
      })
      .catch(() => ubahPeserta([]));
  }, []);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>('/pembimbing/keterangan', {
        method: 'POST',
        json: { user_id, tanggal, status, keterangan },
      });
      toast(r.pesan);
      ubahKet('');
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  return (
    <Kartu t="Catat izin / sakit">
      <p className="text-mu text-sm mb-1 max-w-[560px]">
        Hari yang tercatat Izin atau Sakit otomatis terkunci — peserta tidak perlu absen QR/wajah dan
        tidak akan ditandai Tidak hadir.
      </p>
      <form onSubmit={kirim} className="max-w-[560px]">
        <p>
          <Label htmlFor="izin_psr">Peserta</Label>
          <select
            id="izin_psr"
            required
            value={user_id}
            onChange={(e) => ubahUid(e.target.value ? Number(e.target.value) : '')}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
          >
            <option value="">— pilih peserta —</option>
            {peserta.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </p>
        <p>
          <Label htmlFor="izin_tgl">Tanggal (maksimal 7 hari ke belakang)</Label>
          <input
            id="izin_tgl"
            type="date"
            required
            max={isoHariIni()}
            value={tanggal}
            onChange={(e) => ubahTanggal(e.target.value)}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
          />
        </p>
        <fieldset className="mt-3">
          <legend className="text-[13px] font-semibold">Status</legend>
          <div className="flex gap-4 mt-1">
            {(['Izin', 'Sakit'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="izin_status" checked={status === s} onChange={() => ubahStatus(s)} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <p>
          <Label htmlFor="izin_ket">
            Keterangan <span className="text-r">wajib</span> (3–1000 karakter)
          </Label>
          <textarea
            id="izin_ket"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            value={keterangan}
            onChange={(e) => ubahKet(e.target.value)}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            placeholder="Misal: Menghadiri acara keluarga di luar kota."
          />
        </p>
        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        <p className="mt-4">
          <Tombol type="submit" disabled={sedang || !user_id || keterangan.trim().length < 3}>
            Catat {status.toLowerCase()}
          </Tombol>
        </p>
      </form>
    </Kartu>
  );
}
