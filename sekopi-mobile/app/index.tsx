import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

/**
 * Entry point — redirect ke dashboard jika sudah login,
 * atau ke login jika belum / session expired.
 * _layout.tsx sudah memastikan hydrated = true sebelum screen ini dirender.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      router.replace('/(main)/dashboard');
    } else {
      router.replace('/(auth)/login');
    }
  }, [user]);

  return null;
}
