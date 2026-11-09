import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './konteks/Auth';
import { ToastProvider } from './komponen/Toast';
import { BelumMasukGuard, SudahMasukGuard, GuardPeran } from './komponen/Guard';
import Shell from './komponen/Shell';
import Login from './pages/Login';
import LupaSandi from './pages/LupaSandi';
import AturUlang from './pages/AturUlang';
import BerandaPeserta from './pages/Beranda';
import DashboardPembimbing from './pages/pembimbing/Dashboard';
import DashboardAdmin from './pages/admin/Dashboard';
import Profil from './pages/Profil';
import Absensi from './pages/peserta/Absensi';
import TayangQr from './pages/peserta/TayangQr';
import Riwayat from './pages/peserta/Riwayat';
import WajahDaftar from './pages/peserta/WajahDaftar';
import WajahPeriksa from './pages/peserta/WajahPeriksa';
import JurnalList from './pages/peserta/JurnalList';
import JurnalForm from './pages/peserta/JurnalForm';
import JurnalDetail from './pages/peserta/JurnalDetail';
import PengajuanIzin from './pages/peserta/PengajuanIzin';
import Scan from './pages/pembimbing/Scan';
import PesertaPembimbing from './pages/pembimbing/Peserta';
import JurnalReview from './pages/pembimbing/Jurnal';
import DetailJurnalPmb from './pages/pembimbing/DetailJurnal';
import Rekap from './pages/pembimbing/Rekap';
import IzinPmb from './pages/pembimbing/Izin';
import PesertaAdmin from './pages/admin/Peserta';
import PembimbingAdmin from './pages/admin/Pembimbing';
import Jadwal from './pages/admin/Jadwal';
import AbsensiAdmin from './pages/admin/Absensi';
import Audit from './pages/admin/Audit';
import Pengaturan from './pages/admin/Pengaturan';

/** Beranda sesuai peran: dashboard ringkasan untuk pembimbing dan admin. */
function BerandaPeran() {
  const { user } = useAuth();
  if (user?.role === 'pembimbing') return <DashboardPembimbing />;
  if (user?.role === 'admin') return <DashboardAdmin />;
  return <BerandaPeserta />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Publik */}
            <Route
              path="/login"
              element={
                <SudahMasukGuard>
                  <Login />
                </SudahMasukGuard>
              }
            />
            <Route path="/lupa-sandi" element={<LupaSandi />} />
            <Route path="/reset-password" element={<AturUlang />} />

            {/* Terlindungi: tata letak + halaman per peran */}
            <Route
              element={
                <BelumMasukGuard>
                  <Shell />
                </BelumMasukGuard>
              }
            >
              <Route path="/" element={<GuardPeran><BerandaPeran /></GuardPeran>} />
              <Route path="/profil" element={<GuardPeran><Profil /></GuardPeran>} />

              {/* Fasilitas peserta */}
              <Route path="/absensi" element={<GuardPeran role="peserta"><Absensi /></GuardPeran>} />
              <Route path="/absensi/qr" element={<GuardPeran role="peserta"><TayangQr /></GuardPeran>} />
              <Route path="/riwayat" element={<GuardPeran role="peserta"><Riwayat /></GuardPeran>} />
              <Route path="/wajah/daftar" element={<GuardPeran role="peserta"><WajahDaftar /></GuardPeran>} />
              <Route path="/wajah/periksa" element={<GuardPeran role="peserta"><WajahPeriksa /></GuardPeran>} />
              <Route path="/jurnal" element={<GuardPeran role="peserta"><JurnalList /></GuardPeran>} />
              <Route path="/jurnal/baru" element={<GuardPeran role="peserta"><JurnalForm /></GuardPeran>} />
              <Route path="/jurnal/:id" element={<GuardPeran role="peserta"><JurnalDetail /></GuardPeran>} />
              <Route path="/jurnal/:id/edit" element={<GuardPeran role="peserta"><JurnalForm /></GuardPeran>} />
              <Route path="/pengajuan" element={<GuardPeran role="peserta"><PengajuanIzin /></GuardPeran>} />

              {/* Fasilitas pembimbing */}
              <Route path="/pembimbing/scan" element={<GuardPeran role="pembimbing"><Scan /></GuardPeran>} />
              <Route path="/pembimbing/peserta" element={<GuardPeran role="pembimbing"><PesertaPembimbing /></GuardPeran>} />
              <Route path="/pembimbing/jurnal" element={<GuardPeran role="pembimbing"><JurnalReview /></GuardPeran>} />
              <Route path="/pembimbing/jurnal/:id" element={<GuardPeran role="pembimbing"><DetailJurnalPmb /></GuardPeran>} />
              <Route path="/pembimbing/rekap" element={<GuardPeran role="pembimbing"><Rekap /></GuardPeran>} />
              <Route path="/pembimbing/izin" element={<GuardPeran role="pembimbing"><IzinPmb /></GuardPeran>} />

              {/* Fasilitas admin */}
              <Route path="/admin/peserta" element={<GuardPeran role="admin"><PesertaAdmin /></GuardPeran>} />
              <Route path="/admin/pembimbing" element={<GuardPeran role="admin"><PembimbingAdmin /></GuardPeran>} />
              <Route path="/admin/jadwal" element={<GuardPeran role="admin"><Jadwal /></GuardPeran>} />
              <Route path="/admin/absensi" element={<GuardPeran role="admin"><AbsensiAdmin /></GuardPeran>} />
              <Route path="/admin/audit" element={<GuardPeran role="admin"><Audit /></GuardPeran>} />
              <Route path="/pengaturan" element={<GuardPeran role="admin"><Pengaturan /></GuardPeran>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
