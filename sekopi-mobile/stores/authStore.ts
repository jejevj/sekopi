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
 * - Ada loginDate tersimpan
 * - loginDate masih di hari yang sama (WIB / Asia/Jakarta)
 * - Jam sekarang (WIB) BELUM mencapai 21:00
 */
export function isSessionValid(
  loginDateISO: string | null | undefined,
  now?: Date
): boolean {
  if (!loginDateISO) return false;

  const checkTime = now ?? new Date();

  // Waktu sekarang dalam WIB (UTC+7) — gunakan getTime() langsung, tidak campur getTimezoneOffset
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibNowMs  = checkTime.getTime() + WIB_OFFSET_MS;
  const wibNow    = new Date(wibNowMs);

  // Waktu login dalam WIB
  const loginMs   = new Date(loginDateISO).getTime(); // ISO string → UTC ms, langsung pakai
  const wibLogin  = new Date(loginMs + WIB_OFFSET_MS);

  // Harus hari yang sama (WIB)
  const sameDay =
    wibNow.getUTCFullYear() === wibLogin.getUTCFullYear() &&
    wibNow.getUTCMonth()    === wibLogin.getUTCMonth() &&
    wibNow.getUTCDate()     === wibLogin.getUTCDate();

  if (!sameDay) return false;

  // Belum jam 21:00 WIB
  const wibHour = wibNow.getUTCHours();
  return wibHour < 21;
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
  hydrated: boolean; // true setelah loadAuth selesai
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  loginDate: null,
  hydrated: false,

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
      if (!info.exists) { set({ hydrated: true }); return; }

      const raw = await FileSystem.readAsStringAsync(AUTH_FILE_URI, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(raw);
      if (!parsed?.user || !parsed?.accessToken) { set({ hydrated: true }); return; }

      if (isSessionValid(parsed.loginDate)) {
        set({
          user: parsed.user,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken ?? null,
          loginDate: parsed.loginDate,
          hydrated: true,
        });
      } else {
        // Session kadaluarsa, hapus file
        await deleteAuthFile();
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
