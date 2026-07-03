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
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/(admin)/dashboard',     Icon: LayoutDashboard, roles: ['ADMIN','PRODUKSI'] },
  { label: 'Mfg. Order',   href: '/(admin)/mo',            Icon: ClipboardList,   roles: ['ADMIN','PRODUKSI'] },
  { label: 'Produksi',     href: '/(admin)/produksi',      Icon: Factory,         roles: ['ADMIN','PRODUKSI'] },
  { label: 'Return',       href: '/(admin)/return',        Icon: Undo2,           roles: ['ADMIN','INVENTORI'] },
  { label: 'Users',        href: '/(admin)/users',         Icon: Users,           roles: ['ADMIN'] },
  { label: 'Stok',         href: '/(inventori)/stok',      Icon: Package,         roles: ['INVENTORI','ADMIN'] },
  { label: 'Expiry Alert', href: '/(inventori)/expiry',    Icon: TriangleAlert,   roles: ['INVENTORI','ADMIN'] },
  { label: 'Pengiriman',   href: '/(driver)/pengiriman',   Icon: Truck,           roles: ['DRIVER'] },
  { label: 'Return',       href: '/(driver)/return',       Icon: Undo2,           roles: ['DRIVER'] },
  { label: 'Scan Jual',    href: '/(kasir)/scan',          Icon: Coffee,          roles: ['KASIR'] },
  { label: 'Laporan',      href: '/(shareholder)/laporan', Icon: TrendingUp,      roles: ['SHAREHOLDER','ADMIN'] },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

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
      <ScrollView className="flex-1 px-2 py-4" showsVerticalScrollIndicator={false}>
        {visibleItems.map((item) => {
          const isActive = currentPath.startsWith(item.href.replace('/index',''));
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
