/**
 * Utilitas tanggal/waktu dengan timezone Asia/Jakarta (WIB, UTC+7).
 * Gunakan fungsi ini di seluruh app agar konsisten — jangan pakai
 * new Date().toISOString() langsung karena itu UTC bukan WIB.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/** Kembalikan objek Date yang sudah di-shift ke WIB */
function nowWIB(): Date {
  const utc = Date.now();
  return new Date(utc + WIB_OFFSET_MS);
}

/**
 * Tanggal hari ini dalam format YYYY-MM-DD menurut WIB.
 * Contoh: "2026-07-09"
 */
export function getTanggalWIB(): string {
  return nowWIB().toISOString().split('T')[0];
}

/**
 * Jam sekarang dalam format HH:MM:SS menurut WIB.
 * Contoh: "07:30:00"
 */
export function getJamWIB(): string {
  return nowWIB().toISOString().split('T')[1].slice(0, 8);
}

/**
 * Format label waktu WIB untuk ditampilkan di UI.
 * Contoh: "Rabu, 09 Juli 2026"
 */
export function getLabelTanggalWIB(): string {
  // Buat Date object dengan nilai WIB untuk formatting lokal
  const d = nowWIB();
  // toLocaleDateString perlu tanggal asli WIB, bukan UTC
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  ).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
