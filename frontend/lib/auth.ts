import { api } from "./api";
import { useAuthStore, AuthUser } from "../stores/authStore";

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface MeResponse {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded
  // with field 'username' (not 'email')
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const { data: tokenData } = await api.post<TokenResponse>(
    "/auth/login",
    formData.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  // Set token dulu supaya /me bisa pakai Authorization header
  api.defaults.headers.common["Authorization"] = `Bearer ${tokenData.access_token}`;

  // Ambil data user
  const { data: me } = await api.get<MeResponse>("/auth/me");

  const user: AuthUser = {
    id: me.id,
    email: me.email,
    nama: me.full_name,
    role: me.role.toUpperCase(),   // db: 'admin' → store: 'ADMIN'
  };

  await useAuthStore.getState().setAuth(user, tokenData.access_token, "");
  return user;
}

export async function logout(): Promise<void> {
  delete api.defaults.headers.common["Authorization"];
  await useAuthStore.getState().clearAuth();
}

export function getDashboardPath(role: string): string {
  switch (role.toUpperCase()) {
    case "ADMIN":       return "/(admin)/dashboard";
    case "PRODUKSI":    return "/(admin)/dashboard";
    case "INVENTORI":   return "/(inventori)/stok";
    case "DRIVER":      return "/(driver)/pengiriman";
    case "SHAREHOLDER": return "/(shareholder)/laporan";
    default:            return "/(admin)/dashboard";
  }
}
