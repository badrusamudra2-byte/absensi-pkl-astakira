/* ============================================================
   Mockup UI/UX — Website Absensi PKL & Jurnal Kegiatan
   Astakira Media
   ------------------------------------------------------------
   Berkas ini menyusun sidebar, topbar, ikon, dan QR agar seluruh
   halaman mockup konsisten. Halaman hanya menulis isi konten.
   ============================================================ */

const IKON = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  absen: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="m8.5 15 2 2 4-4"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01M20 17v.01M17 20v.01"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M3 12h18"/>',
  face: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8 7h8M8 11h5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21c0-3.5 3-5.8 6.5-5.8s6.5 2.3 6.5 5.8"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.4c2.2.6 3.5 2.5 3.5 5.1"/>',
  clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4"/><path d="m9 13 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx=".5"/><rect x="12" y="8" width="3" height="10" rx=".5"/><rect x="17" y="5" width="3" height="13" rx=".5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera: '<path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 9 5-5 5 5M12 4v12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M14 9l2 2"/>',
  activity: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6"/>',
  alert: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  checkCircle: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
};

const MENU = {
  peserta: [
    { r: '/', t: 'Beranda', i: 'home' },
    { r: '/absensi', t: 'Absensi', i: 'absen' },
    { r: '/absensi/qr', t: 'Tayangkan QR absen', i: 'qr' },
    { r: '/wajah/daftar', t: 'Pendaftaran wajah', i: 'face' },
    { r: '/jurnal', t: 'Jurnal kegiatan', i: 'book' },
    { r: '/pengajuan', t: 'Pengajuan izin/sakit', i: 'file' },
    { r: '/riwayat', t: 'Riwayat absensi', i: 'clock' },
    { r: '/profil', t: 'Profil', i: 'user' },
  ],
  pembimbing: [
    { r: '/', t: 'Beranda', i: 'home' },
    { r: '/pembimbing/scan', t: 'Scan QR peserta', i: 'scan' },
    { r: '/pembimbing/peserta', t: 'Peserta bimbingan', i: 'users' },
    { r: '/pembimbing/jurnal', t: 'Review jurnal', i: 'clipboard' },
    { r: '/pembimbing/rekap', t: 'Rekap periode', i: 'chart' },
    { r: '/pembimbing/izin', t: 'Lihat izin/sakit', i: 'file', dot: true },
    { r: '/profil', t: 'Profil', i: 'user' },
  ],
  admin: [
    { r: '/', t: 'Beranda', i: 'home' },
    { r: '/admin/peserta', t: 'Kelola peserta', i: 'users' },
    { r: '/admin/pembimbing', t: 'Kelola pembimbing', i: 'user' },
    { r: '/admin/jadwal', t: 'Jadwal kerja', i: 'calendar' },
    { r: '/admin/absensi', t: 'Absensi & koreksi', i: 'clock' },
    { r: '/admin/laporan', t: 'Laporan', i: 'chart' },
    { r: '/pengaturan', t: 'Pengaturan absensi', i: 'settings' },
    { r: '/admin/audit', t: 'Audit log', i: 'shield' },
    { r: '/profil', t: 'Profil', i: 'user' },
  ],
};

const USER = {
  peserta: { nama: 'Nabila Putri Ramadhani', peran: 'Peserta PKL', ini: 'NP' },
  pembimbing: { nama: 'Rizky Pratama', peran: 'Pembimbing', ini: 'RP' },
  admin: { nama: 'Admin Astakira', peran: 'Admin', ini: 'AD' },
};

const svg = (nama, kelas = '') =>
  `<svg class="${kelas}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[nama] || ''}</svg>`;

function isiSidebar(el) {
  const peran = el.closest('.mockup')?.dataset.peran || 'peserta';
  const aktif = el.closest('.mockup')?.dataset.aktif || '/';
  const u = USER[peran];
  el.innerHTML = `
    <div class="brand">
      <div class="brand-mark">A</div>
      <div class="brand-txt"><b>Astakira Media</b><small>Absensi PKL dan jurnal</small></div>
    </div>
    <nav class="nav" aria-label="Menu utama">
      <div class="nav-label">Menu ${u.peran}</div>
      ${MENU[peran].map((m) => `
        <a href="${m.r}" class="${m.r === aktif ? 'active' : ''}">
          ${svg(m.i)}<span>${m.t}</span>${m.dot ? '<span class="dot"></span>' : ''}
        </a>`).join('')}
    </nav>
    <div class="side-foot">
      <div class="side-user">
        <div class="avatar">${u.ini}</div>
        <div style="min-width:0"><b>${u.nama}</b><small>${u.peran}</small></div>
      </div>
      <button class="logout" type="button">${svg('logout')} Keluar</button>
    </div>`;
}

function isiTopbar(el) {
  const peran = el.closest('.mockup')?.dataset.peran || 'peserta';
  const u = USER[peran];
  const halaman = el.dataset.halaman || '';
  const tanggal = el.dataset.tanggal || 'Rabu, 18 November 2026';
  el.innerHTML = `
    <div class="topbar-title">Panel Absensi PKL</div>
    <div class="topbar-sep"></div>
    <div class="topbar-page">${halaman}</div>
    <div class="topbar-spacer"></div>
    <div class="topbar-date">${svg('calendar')} ${tanggal}</div>
    <button class="icon-btn" type="button" aria-label="Notifikasi">${svg('bell')}<span class="notif"></span></button>
    <span class="role-pill">${u.peran}</span>
    <div class="avatar">${u.ini}</div>`;
}

/* QR dekoratif deterministik (bukan QR fungsional) */
function acak(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gambarQr(el) {
  const n = 25;
  const q = 2;
  const rnd = acak(0x9e3779b9);
  const isi = Array.from({ length: n }, () => Array(n).fill(false));
  const finder = (r0, c0) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const tepi = r === 0 || r === 6 || c === 0 || c === 6;
      const inti = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (tepi || inti) isi[r0 + r][c0 + c] = true;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { isi[6][i] = i % 2 === 0; isi[i][6] = i % 2 === 0; }
  const terlarang = (r, c) =>
    (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8) || r === 6 || c === 6;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!terlarang(r, c) && rnd() > 0.52) isi[r][c] = true;
  }
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (isi[r][c]) path += `M${c + q} ${r + q}h1v1h-1z`;
  }
  const total = n + q * 2;
  el.innerHTML = `<svg viewBox="0 0 ${total} ${total}" role="img" aria-label="Kode QR absensi" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="#fff"/>
    <path d="${path}" fill="#0b1f4d"/>
  </svg>`;
}

window.Mockup = { svg, gambarQr };

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-shell-sidebar]').forEach(isiSidebar);
  document.querySelectorAll('[data-shell-topbar]').forEach(isiTopbar);
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = svg(el.dataset.icon);
  });
  document.querySelectorAll('[data-qr]').forEach(gambarQr);
});
