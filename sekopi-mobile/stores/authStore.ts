import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'admin' | 'produksi' | 'inventori' | 'driver' | 'shareholder';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

const AUTH_STORAGE_KEY = '@sekopi_auth';

/**
 * Cek apakah session masih valid.
 * Session valid jika:
 * - Ada user & token tersimpan
 * - loginDate masih di hari yang sama (WIB)
 * - Jam sekarang (WIB) BELUM mencapai 21:00 (jam 9 malam)
 */
export function isSessionValid(
  loginDateISO: string | null | undefined,
  now?: Date
): boolean {
  if (!loginDateISO) return false;

  const checkTime = now ?? new Date();

  // Waktu sekarang dalam WIB (UTC+7)
  const wibOffset = 7 * 60; // menit
  const utcMs = checkTime.getTime() + checkTime.getTimezoneOffset() * 60000;
  const wibNow = new Date(utcMs + wibOffset * 60000);

  // Waktu login dalam WIB
  const loginTime = new Date(loginDateISO);
  const loginUtcMs = loginTime.getTime() + loginTime.getTimezoneOffset() * 60000;
  const wibLogin = new Date(loginUtcMs + wibOffset * 60000);

  // Harus hari yang sama
  const sameDay =
    wibNow.getFullYear() === wibLogin.getFullYear() &&
    wibNow.getMonth() === wibLogin.getMonth() &&
    wibNow.getDate() === wibLogin.getDate();

  if (!sameDay) return false;

  // Belum jam 21:00 WIB
  const hour = wibNow.getHours();
  const minute = wibNow.getMinutes();
  const pastNinePM = hour > 21 || (hour === 21 && minute >= 0);

  return !pastNinePM;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loginDate: string | null; // ISO string waktu login
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  loginDate: null,

  setAuth: (user, accessToken, refreshToken) => {
    const loginDate = new Date().toISOString();
    const data = { user, accessToken, refreshToken, loginDate };
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data)).catch(() => {});
    set({ user, accessToken, refreshToken, loginDate });
  },

  clearAuth: () => {
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
    set({ user: null, accessToken: null, refreshToken: null, loginDate: null });
  },

  loadAuth: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.user || !parsed?.accessToken) return;

      // Validasi session — hanya restore jika masih valid
      if (isSessionValid(parsed.loginDate)) {
        set({
          user: parsed.user,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken ?? null,
          loginDate: parsed.loginDate,
        });
      } else {
        // Session kadaluarsa, hapus data tersimpan
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Abaikan error parsing
    }
  },
}));
