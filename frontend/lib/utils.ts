import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Format tanggal: "09 Jul 2026" — selalu WIB */
export function formatDate(dateStr: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(dateStr));
}

/** Format tanggal + jam: "09 Jul 2026, 07.30" — selalu WIB */
export function formatDateTime(dateStr: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(dateStr));
}

/** Format hanya jam: "07:30" — selalu WIB */
export function formatTime(dateStr: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(dateStr));
}

/**
 * Tanggal hari ini dalam format YYYY-MM-DD menurut WIB.
 * Gunakan ini saat mengirim `tanggal` ke API, bukan new Date().toISOString().
 */
export function getTanggalWIB(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" })
    .format(new Date()); // sv-SE menghasilkan format ISO YYYY-MM-DD
}

/**
 * Jam sekarang dalam format HH:MM:SS menurut WIB.
 * Gunakan ini saat mengirim `jam_masuk` / `jam_keluar` ke API.
 */
export function getJamWIB(): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date()).replace(/\./g, ":");
}

/** Label tanggal panjang WIB, misal: "Kamis, 09 Juli 2026" */
export function getLabelTanggalWIB(): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export function daysUntilExpiry(expiryDate: string): number {
  // Bandingkan dalam WIB: ambil tanggal hari ini WIB lalu hitung selisih
  const todayWIB = new Date(getTanggalWIB() + "T00:00:00+07:00");
  const expiry   = new Date(expiryDate + "T00:00:00+07:00");
  return Math.floor((expiry.getTime() - todayWIB.getTime()) / (1000 * 60 * 60 * 24));
}

export const STATUS_COLORS: Record<string, string> = {
  ready:             "bg-blue-500/20 text-blue-400 border-blue-500/30",
  dispatched:        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  delivered:         "bg-orange-500/20 text-orange-400 border-orange-500/30",
  sold:              "bg-green-500/20 text-green-400 border-green-500/30",
  expired:           "bg-red-500/20 text-red-400 border-red-500/30",
  void:              "bg-gray-500/20 text-gray-400 border-gray-500/30",
  returned_good:     "bg-teal-500/20 text-teal-400 border-teal-500/30",
  returned_damaged:  "bg-red-500/20 text-red-400 border-red-500/30",
  // MO statuses
  draft:             "bg-gray-500/20 text-gray-400 border-gray-500/30",
  confirmed:         "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress:       "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  done:              "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled:         "bg-red-500/20 text-red-400 border-red-500/30",
  // Return statuses
  submitted:         "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reviewed:          "bg-green-500/20 text-green-400 border-green-500/30",
};

export const STATUS_LABELS: Record<string, string> = {
  ready: "Ready", dispatched: "Dispatched", delivered: "Delivered",
  sold: "Terjual", expired: "Expired", void: "Void",
  returned_good: "Kembali Baik", returned_damaged: "Kembali Rusak",
  draft: "Draft", confirmed: "Confirmed", in_progress: "In Progress",
  done: "Done", cancelled: "Cancelled",
  submitted: "Menunggu Review", reviewed: "Selesai",
};
