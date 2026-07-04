import { View, Text, Pressable, ScrollView } from "react-native";
import { Link, usePathname } from "expo-router";
import { useAuthStore } from "@/lib/stores/authStore";
import { UserRole } from "@/lib/types/user";

const menuByRole: Record<UserRole, { label: string; href: string; icon?: string }[]> = {
  admin: [
    { label: "Dashboard",    href: "/(admin)/dashboard",   icon: "📊" },
    { label: "Menu & Resep", href: "/(admin)/menu",        icon: "📖" },
    { label: "Bahan Baku",   href: "/(admin)/bahan-baku",  icon: "🧪" },
    { label: "Pembelian",    href: "/(admin)/pembelian",   icon: "🛒" },
    { label: "Mfg. Order",   href: "/(admin)/mo",          icon: "📋" },
    { label: "Produksi",     href: "/(admin)/produksi",    icon: "⚡" },
    { label: "Loading",      href: "/(admin)/loading",     icon: "📦" },
    { label: "Gerobak",      href: "/(admin)/gerobak",     icon: "🛵" },
    { label: "Return",       href: "/(admin)/return",      icon: "↩️" },
    { label: "Absensi",      href: "/(admin)/absensi",     icon: "📅" },
    { label: "Pengguna",     href: "/(admin)/users",       icon: "👥" },
  ],
  produksi:    [{ label: "Dashboard", href: "/(produksi)/dashboard" }],
  inventori:   [{ label: "Dashboard", href: "/(inventori)/dashboard" }],
  driver:      [{ label: "Pengiriman", href: "/(driver)/pengiriman" }],
  shareholder: [{ label: "Laporan",   href: "/(shareholder)/laporan" }],
};

// Petakan href ke segmen path real di URL browser
const HREF_TO_PATH: Record<string, string> = {
  "/(admin)/dashboard":  "/dashboard",
  "/(admin)/menu":       "/menu",
  "/(admin)/bahan-baku": "/bahan-baku",
  "/(admin)/pembelian":  "/pembelian",
  "/(admin)/mo":         "/mo",
  "/(admin)/produksi":   "/produksi",
  "/(admin)/loading":    "/loading",
  "/(admin)/gerobak":    "/gerobak",
  "/(admin)/return":     "/return",
  "/(admin)/absensi":    "/absensi",
  "/(admin)/users":      "/users",
};

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  if (!user) return null;

  const menus = menuByRole[user.role] ?? [];

  const isActive = (href: string) => {
    const mapped = HREF_TO_PATH[href] ?? href;
    if (mapped === "/dashboard") return pathname === mapped || pathname === "/";
    return pathname === mapped || pathname.startsWith(mapped + "/");
  };

  return (
    <View style={{ width: 220, height: '100%', backgroundColor: '#111', borderRightWidth: 1, borderRightColor: '#1f1f1f', padding: 16, display: 'flex', flexDirection: 'column' } as any}>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 24 }}>☕ SekoPi</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {menus.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as any}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderRadius: 8,
                marginBottom: 2,
                backgroundColor: active ? 'rgba(244,68,68,0.12)' : 'transparent',
                color: active ? '#f87171' : '#666',
                fontSize: 14,
                fontWeight: active ? '600' : '400',
                textDecorationLine: 'none',
              } as any}
            >
              {item.icon && <Text style={{ fontSize: 14 }}>{item.icon}</Text>}
              <Text style={{ color: active ? '#f87171' : '#666', fontSize: 14, fontWeight: active ? '600' : '400' }}>
                {item.label}
              </Text>
            </Link>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={logout}
        style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1f1f1f', marginTop: 8 }}
      >
        <Text style={{ color: '#555', fontSize: 14 }}>🚪 Logout</Text>
      </Pressable>
    </View>
  );
}
