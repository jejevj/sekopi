import { create } from "zustand";
import { TokenStore } from "../lib/api";

export type UserRole = "ADMIN" | "PRODUKSI" | "INVENTORI" | "DRIVER" | "SHAREHOLDER";

export interface AuthUser {
  id: number;
  nama: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  initFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await TokenStore.set("access_token", accessToken);
    await TokenStore.set("refresh_token", refreshToken);
    // Store user info for reload
    await TokenStore.set("user_info", JSON.stringify(user));
    set({ user, accessToken, isLoading: false });
  },

  clearAuth: async () => {
    await TokenStore.remove("access_token");
    await TokenStore.remove("refresh_token");
    await TokenStore.remove("user_info");
    set({ user: null, accessToken: null, isLoading: false });
  },

  initFromStorage: async () => {
    try {
      const token = await TokenStore.get("access_token");
      const userInfo = await TokenStore.get("user_info");
      if (token && userInfo) {
        set({ user: JSON.parse(userInfo), accessToken: token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
