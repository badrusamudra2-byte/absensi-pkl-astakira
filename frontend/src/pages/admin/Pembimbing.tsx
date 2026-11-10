import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisAdminUser } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';
import { useToast } from '../../komponen/Toast';

interface FormNilai {
  id?: number;
  nama: string;
  email: string;
  password: string;
  divisi: string;
}

const kosong: FormNilai = { nama: '', email: '', password: '', divisi: '' };

export default function Pembimbing() {
  const toast = useToast();
  const [rows, ubahRows] = useState<BarisAdminUser[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [form, ubahForm] = useState<FormNilai | null>(null);
  const [sedang, ubahSedang] = useState(false);

  const muat = useCallback(async () => {
    ubahRows(null);
    try {
      const r = await api<{ data: BarisAdminUser[] }>('/admin/pembimbing');
      ubahRows(r.data);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      if (form.id) {
        const { password: _hapus, ...isi } = form;
        void _hapus;
        await api<{ pesan: string }>(`/admin/pembimbing/${form.id}`, { method: 'PUT', json: isi });
        toast('Data pembimbing disimpan.');
      } else {
        await api('/admin/pembimbing', { method: 'POST', json: form });
        toast('Pembimbing dibuat. Bagikan kata sandi awal kepada pembimbing, lalu minta dia menggantinya dari menu Profil.');
      }
      ubahForm(null);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const toggling = async (b: BarisAdminUser) => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      await api(`/admin/pembimbing/${b.id}`, { method: 'PUT', json: { aktif: !b.aktif } });
      toast(b.aktif ? `${b.nama} dinonaktifkan.` : `${b.nama} diaktifkan kembali.`);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const hapus = async (b: BarisAdminUser) => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      await api<{ pesan: string }>(`/admin/pembimbing/${b.id}`, { method: 'DELETE' });
      toast(`${b.nama} dihapus.`);
      await muat();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  return (
    <Kartu t="Kelola pembimbing">
      {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      {form ? (
        <form onSubmit={simpan} className="mb-5 border-2 border-garis rounded-xl p-4 max-w-[560px]">
          <h3 className="font-bold text-sm mb-1">{form.id ? 'Edit pembimbing' : 'Tambah pembimbing'}</h3>
          <p className="text-mu text-sm mb-2">
            {form.id ? 'Kosongkan kolom yang tidak berubah untuk mempertahankan nilai lama.' : 'Email boleh buatan admin; kata sandi awal di bawah dipakai pembimbing untuk login pertama.'}
          </p>
          <Label htmlFor="pmb_nama">Nama lengkap</Label>
          <input id="pmb_nama" required maxLength={100} value={form.nama} onChange={(e) => ubahForm({ ...form, nama: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
          <Label htmlFor="pmb_email">Email</Label>
          <input id="pmb_email" required type="email" maxLength={120} value={form.email} onChange={(e) => ubahForm({ ...form, email: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
          {form.id ? null : (
            <>
              <Label htmlFor="pmb_sandi">Kata sandi awal</Label>
              <input
                id="pmb_sandi" required type="password" autoComplete="new-password" minLength={8} maxLength={72}
                value={form.password} onChange={(e) => ubahForm({ ...form, password: e.target.value })}
                className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
              />
              <small className="text-mu text-xs">Minimal 8 karakter, mengandung huruf dan angka. Pembimbing sebaiknya menggantinya setelah login pertama.</small>
            </>
          )}
          <Label htmlFor="pmb_divisi">Divisi</Label>
          <input id="pmb_divisi" maxLength={80} value={form.divisi} onChange={(e) => ubahForm({ ...form, divisi: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg" />
          <div className="flex gap-2 mt-4">
            <Tombol type="submit" disabled={sedang}>Simpan</Tombol>
            <Tombol varian="gh" onClick={() => ubahForm(null)} disabled={sedang}>Batal</Tombol>
          </div>
        </form>
      ) : (
        <p className="mb-4"><Tombol onClick={() => ubahForm({ ...kosong })}>Tambah pembimbing</Tombol></p>
      )}

      <FxDaftar
        rows={rows}
        kolom={[
          {
            t: 'Nama',
            isi: (b) => (
              <b>
                {b.nama}
                {!b.aktif ? <Badge s="Nonaktif" /> : null}
              </b>
            ),
          },
          { t: 'Email', isi: (b) => b.email },
          { t: 'Divisi', isi: (b) => b.pembimbing_profil?.divisi || '-' },
          {
            t: 'Aksi',
            isi: (b) => (
              <span className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    ubahForm({ id: b.id, nama: b.nama, email: b.email, password: '', divisi: b.pembimbing_profil?.divisi ?? '' })
                  }
                  className="text-pr underline text-sm cursor-pointer bg-transparent border-0 p-0"
                >
                  Edit
                </button>
                <button onClick={() => void toggling(b)} className="text-y underline text-sm cursor-pointer bg-transparent border-0 p-0">
                  {b.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => void hapus(b)} className="text-r underline text-sm cursor-pointer bg-transparent border-0 p-0">
                  Hapus
                </button>
              </span>
            ),
          },
        ]}
      />
      <p className="text-xs text-mu mt-3">
        Pembimbing yang punya peserta bimbingan tidak bisa dihapus — nonaktifkan saja.
      </p>
    </Kartu>
  );
}
