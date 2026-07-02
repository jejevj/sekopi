import React from 'react';
import { View, Text } from 'react-native';
import { Navbar } from '../../components/layout/Navbar';

export default function LaporanPage() {
  return (
    <View className="flex-1 bg-background">
      <Navbar title="Laporan Shareholder" />
      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl mb-4">📈</Text>
        <Text className="text-white text-lg font-semibold">Halaman Laporan</Text>
        <Text className="text-muted-foreground text-sm mt-2">Coming soon...</Text>
      </View>
    </View>
  );
}
