export type UserRole = "admin" | "produksi" | "inventori" | "driver" | "shareholder";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}
