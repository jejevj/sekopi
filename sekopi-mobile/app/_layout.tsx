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

  // Muat session tersimpan saat pertama kali app dibuka
  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (loaded && hydrated) SplashScreen.hideAsync();
  }, [loaded, hydrated]);

  // Tunggu font + auth selesai dimuat sebelum render navigator
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
        <Stack.Screen name="(inventori)/loading" />
      </Stack>
    </>
  );
}
