import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({});
  const loadAuth = useAuthStore((s) => s.loadAuth);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (loaded && hydrated) SplashScreen.hideAsync();
  }, [loaded, hydrated]);

  if (!loaded || !hydrated) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(main)/dashboard" />
        <Stack.Screen name="(main)/absensi" />
        <Stack.Screen name="(main)/profil" />
        <Stack.Screen name="(admin)/users" />
        <Stack.Screen name="(admin)/menu" />
        <Stack.Screen name="(admin)/gerobak" />
        <Stack.Screen name="(admin)/laporan" />
        <Stack.Screen name="(admin)/dividen" />
        <Stack.Screen name="(inventori)/dashboard" />
        <Stack.Screen name="(inventori)/po" />
        <Stack.Screen name="(inventori)/return" />
        <Stack.Screen name="(inventori)/loading" />
        <Stack.Screen name="(produksi)/dashboard" />
        <Stack.Screen name="(produksi)/menu" />
        <Stack.Screen name="(produksi)/mo" />
        <Stack.Screen name="(driver)/gerobak" />
        <Stack.Screen name="(driver)/penjualan" />
        <Stack.Screen name="(driver)/stok" />
        <Stack.Screen name="(shareholder)/laporan" />
        <Stack.Screen name="(shareholder)/dividen" />
      </Stack>
    </>
  );
}
