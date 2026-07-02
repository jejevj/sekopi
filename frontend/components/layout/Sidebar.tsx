import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { logout } from '../../lib/auth';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/(admin)/dashboard',        icon: '📊', roles: ['ADMIN','PRODUKSI'] },
  { label: 'Mfg. Order',   href: '/(admin)/mo',               icon: '📋', roles: ['ADMIN','PRODUKSI'] },
  { label: 'Produksi',     href: '/(admin)/produksi',         icon: '🏭', roles: ['ADMIN','PRODUKSI'] },
  { label: 'Return',       href: '/(admin)/return',           icon: '↩️',  roles: ['ADMIN','INVENTORI'] },
  { label: 'Users',        href: '/(admin)/users',            icon: '👤', roles: ['ADMIN'] },
  { label: 'Stok',         href: '/(inventori)/stok',         icon: '📦', roles: ['INVENTORI','ADMIN'] },
  { label: 'Expiry Alert', href: '/(inventori)/expiry',       icon: '⚠️',  roles: ['INVENTORI','ADMIN'] },
  { label: 'Pengiriman',   href: '/(driver)/pengiriman',      icon: '🚗', roles: ['DRIVER'] },
  { label: 'Return',       href: '/(driver)/return',          icon: '↩️',  roles: ['DRIVER'] },
  { label: 'Scan Jual',    href: '/(kasir)/scan',             icon: '☕', roles: ['KASIR'] },
  { label: 'Laporan',      href: '/(shareholder)/laporan',    icon: '📈', roles: ['SHAREHOLDER','ADMIN'] },
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
            <Text className="text-2xl">☕</Text>
            <Text className="text-white font-bold text-lg">SekoPi</Text>
          </View>
        )}
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <Text className="text-white text-lg">{collapsed ? '→' : '←'}</Text>
        </Pressable>
      </View>

      {/* Nav Items */}
      <ScrollView className="flex-1 px-2 py-4" showsVerticalScrollIndicator={false}>
        {visibleItems.map((item) => {
          const isActive = currentPath.startsWith(item.href.replace('/index',''));
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
              <Text className="text-lg w-6 text-center">{item.icon}</Text>
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
          <Text className="text-lg w-6 text-center">🚪</Text>
          {!collapsed && <Text className="text-red-400 text-sm font-medium">Keluar</Text>}
        </Pressable>
      </View>
    </View>
  );
}
