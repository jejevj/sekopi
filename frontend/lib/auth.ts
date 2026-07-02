import { api } from "./api";
import { useAuthStore, AuthUser } from "../stores/authStore";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  await useAuthStore.getState().setAuth(
    data.user,
    data.access_token,
    data.refresh_token
  );
  return data.user;
}

export async function logout(): Promise<void> {
  await useAuthStore.getState().clearAuth();
}

/** Redirect path setelah login berdasarkan role */
export function getDashboardPath(role: string): string {
  switch (role) {
    case "ADMIN":       return "/(admin)/dashboard";
    case "PRODUKSI":    return "/(admin)/dashboard";
    case "INVENTORI":   return "/(inventori)/stok";
    case "DRIVER":      return "/(driver)/pengiriman";
    case "SHAREHOLDER": return "/(shareholder)/laporan";
    default:            return "/";
  }
}
