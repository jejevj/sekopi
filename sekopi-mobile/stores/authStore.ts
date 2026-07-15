import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';

export type UserRole = 'admin' | 'produksi' | 'inventori' | 'driver' | 'shareholder';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

const AUTH_FILE_URI = FileSystem.documentDirectory + 'sekopi_auth.json';

/**
 * Cek apakah session masih valid.
 * Session valid jika:
 * - Ada user & token tersimpan
 * - loginDate masih di hari yang sama (WIB / Asia/Jakarta)
 * - Jam sekarang (WIB) BELUM mencapai 21:00
 */
export function isSessionValid(
  loginDateISO: string | null | undefined,
  now?: Date
): boolean {
  if (!loginDateISO) return false;

  const checkTime = now ?? new Date();

  // Konversi ke WIB (UTC+7)
  const wibOffset = 7 * 60;
  const utcMs = checkTime.getTime() + checkTime.getTimezoneOffset() * 60000;
  const wibNow = new Date(utcMs + wibOffset * 60000);

  const loginTime = new Date(loginDateISO);
  const loginUtcMs = loginTime.getTime() + loginTime.getTimezoneOffset() * 60000;
  const wibLogin = new Date(loginUtcMs + wibOffset * 60000);

  // Harus hari yang sama (WIB)
  const sameDay =
    wibNow.getFullYear() === wibLogin.getFullYear() &&
    wibNow.getMonth() === wibLogin.getMonth() &&
    wibNow.getDate() === wibLogin.getDate();

  if (!sameDay) return false;

  // Belum jam 21:00 WIB
  const hour = wibNow.getHours();
  const pastNinePM = hour >= 21;

  return !pastNinePM;
}

async function saveAuthToFile(data: object): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(AUTH_FILE_URI, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // Abaikan error write
  }
}

async function deleteAuthFile(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(AUTH_FILE_URI);
    if (info.exists) {
      await FileSystem.deleteAsync(AUTH_FILE_URI, { idempotent: true });
    }
  } catch {
    // Abaikan error delete
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loginDate: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
  // Perbarui data user di store + file (setelah update profil berhasil)
  updateUser: (partial: Partial<AuthUser>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  loginDate: null,

  setAuth: (user, accessToken, refreshToken) => {
    const loginDate = new Date().toISOString();
    saveAuthToFile({ user, accessToken, refreshToken, loginDate });
    set({ user, accessToken, refreshToken, loginDate });
  },

  clearAuth: () => {
    deleteAuthFile();
    set({ user: null, accessToken: null, refreshToken: null, loginDate: null });
  },

  updateUser: async (partial) => {
    const state = get();
    if (!state.user) return;
    const updatedUser = { ...state.user, ...partial };
    await saveAuthToFile({
      user: updatedUser,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      loginDate: state.loginDate,
    });
    set({ user: updatedUser });
  },

  loadAuth: async () => {
    try {
      const info = await FileSystem.getInfoAsync(AUTH_FILE_URI);
      if (!info.exists) return;

      const raw = await FileSystem.readAsStringAsync(AUTH_FILE_URI, {
        encoding: FileSystem.EncodingType.UTF8,
      });
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
        // Session kadaluarsa, hapus file
        await deleteAuthFile();
      }
    } catch {
      // Abaikan error parsing
    }
  },
}));
