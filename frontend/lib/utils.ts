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

export function formatDate(dateStr: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
