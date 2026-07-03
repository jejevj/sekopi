import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { logout } from '../../lib/auth';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  ClipboardList,
  Factory,
  Undo2,
  Users,
  Package,
  FlaskConical,
  TriangleAlert,
  Truck,
  Coffee,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';

interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
  roles: string[];
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  // --- Admin & Produksi ---
  { label: 'Dashboard',     href: '/(admin)/dashboard',        Icon: LayoutDashboard, roles: ['ADMIN', 'PRODUKSI'],            group: 'Operasional' },
  { label: 'Mfg. Order',   href: '/(admin)/mo',               Icon: ClipboardList,   roles: ['ADMIN', 'PRODUKSI'],            group: 'Operasional' },
  { label: 'Produksi',     href: '/(admin)/produksi',         Icon: Factory,         roles: ['ADMIN', 'PRODUKSI'],            group: 'Operasional' },
  { label: 'Return',       href: '/(admin)/return',           Icon: Undo2,           roles: ['ADMIN', 'INVENTORI'],           group: 'Operasional' },
  { label: 'Users',        href: '/(admin)/users',            Icon: Users,           roles: ['ADMIN'],                        group: 'Operasional' },
  // --- Inventori ---
  { label: 'Bahan Baku',   href: '/(admin)/bahan-baku',       Icon: FlaskConical,    roles: ['ADMIN', 'INVENTORI'],           group: 'Inventori' },
  { label: 'Stok',         href: '/(inventori)/stok',         Icon: Package,         roles: ['INVENTORI', 'ADMIN'],           group: 'Inventori' },
  { label: 'Expiry Alert', href: '/(inventori)/expiry',       Icon: TriangleAlert,   roles: ['INVENTORI', 'ADMIN'],           group: 'Inventori' },
  // --- Driver ---
  { label: 'Pengiriman',   href: '/(driver)/pengiriman',      Icon: Truck,           roles: ['DRIVER'],                       group: 'Driver' },
  { label: 'Return',       href: '/(driver)/return',          Icon: Undo2,           roles: ['DRIVER'],                       group: 'Driver' },
  // --- Kasir ---
  { label: 'Scan Jual',    href: '/(kasir)/scan',             Icon: Coffee,          roles: ['KASIR'],                        group: 'Kasir' },
  // --- Shareholder ---
  { label: 'Laporan',      href: '/(shareholder)/laporan',    Icon: TrendingUp,      roles: ['SHAREHOLDER', 'ADMIN'],         group: 'Laporan' },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    item => user?.role && item.roles.includes(user.role)
  );

  // Group items untuk tampilkan divider
  const grouped: { group: string; items: NavItem[] }[] = [];
  for (const item of visibleItems) {
    const g = item.group ?? 'Lainnya';
    const existing = grouped.find(x => x.group === g);
    if (existing) existing.items.push(item);
    else grouped.push({ group: g, items: [item] });
  }

  const currentPath = '/' + segments.join('/');

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View
      className={cn(
        'glass-sidebar h-full flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <View className="flex-row items-center gap-2">
            <Coffee size={22} color="#f44444" />
            <Text className="text-white font-bold text-lg">SekoPi</Text>
          </View>
        )}
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg hover:bg-white/10"
        >
          {collapsed
            ? <ChevronRight size={18} color="white" />
            : <ChevronLeft size={18} color="white" />}
        </Pressable>
      </View>

      {/* Nav Items */}
      <ScrollView className="flex-1 px-2 py-3" showsVerticalScrollIndicator={false}>
        {grouped.map(({ group, items }, gi) => (
          <View key={group}>
            {/* Group label — hanya tampil jika tidak collapsed dan ada >1 group */}
            {!collapsed && grouped.length > 1 && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  paddingHorizontal: 12,
                  paddingTop: gi === 0 ? 4 : 14,
                  paddingBottom: 6,
                }}
              >
                {group}
              </Text>
            )}
            {gi > 0 && collapsed && (
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 6, marginHorizontal: 8 }} />
            )}

            {items.map((item) => {
              const isActive = currentPath.startsWith(item.href.replace('/index', ''));
              const iconColor = isActive ? '#f87171' : 'rgba(255,255,255,0.6)';
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href as any)}
                  className={cn(
                    'flex-row items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all',
                    isActive
                      ? 'bg-primary-500/20 border border-primary-500/40'
                      : 'hover:bg-white/10 border border-transparent'
                  )}
                >
                  <View className="w-6 items-center">
                    <item.Icon size={18} color={iconColor} />
                  </View>
                  {!collapsed && (
                    <Text className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-primary-400' : 'text-foreground/80'
                    )}>
                      {item.label}
                    </Text>
                  )}
                  {isActive && !collapsed && (
                    <View className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* User + Logout */}
      <View className="px-3 py-4 border-t border-white/10">
        {!collapsed && user && (
          <View className="mb-3 px-2">
            <Text className="text-white text-sm font-medium" numberOfLines={1}>{user.nama}</Text>
            <Text className="text-muted-foreground text-xs">{user.role}</Text>
          </View>
        )}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
        >
          <View className="w-6 items-center">
            <LogOut size={18} color="#f87171" />
          </View>
          {!collapsed && <Text className="text-red-400 text-sm font-medium">Keluar</Text>}
        </Pressable>
      </View>
    </View>
  );
}
