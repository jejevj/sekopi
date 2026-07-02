import React from 'react';
import { View, Text } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

interface NavbarProps {
  title?: string;
}

export function Navbar({ title }: NavbarProps) {
  const { user } = useAuthStore();
  return (
    <View className="glass-navbar h-14 flex-row items-center justify-between px-6">
      <Text className="text-white font-semibold text-base">{title ?? 'SekoPi'}</Text>
      <View className="flex-row items-center gap-3">
        <View className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/40 items-center justify-center">
          <Text className="text-primary-400 text-xs font-bold">
            {user?.nama?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <View>
          <Text className="text-white text-sm font-medium">{user?.nama}</Text>
          <Text className="text-muted-foreground text-xs">{user?.role}</Text>
        </View>
      </View>
    </View>
  );
}
