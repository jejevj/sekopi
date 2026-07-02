import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Sidebar } from '../../components/layout/Sidebar';

export default function DriverLayout() {
  return (
    <View className="flex-1 flex-row bg-background">
      <Sidebar />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
