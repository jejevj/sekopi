import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { login, getDashboardPath } from '../../lib/auth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const loginSchema = z.object({
  email:    z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({ email, password }: LoginForm) => {
      setDebugMsg('Menghubungi server...');
      return login(email, password);
    },
    onSuccess: (user) => {
      setDebugMsg('Login berhasil! Redirecting...');
      router.replace(getDashboardPath(user.role) as any);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Koneksi gagal';
      setDebugMsg(`Error: ${msg}`);
    },
  });

  const onSubmit = (data: LoginForm) => {
    setDebugMsg('');
    mutate(data);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Background blobs */}
      <View style={{
        position: 'absolute', top: -80, left: -80,
        width: 350, height: 350, borderRadius: 175,
        backgroundColor: '#f44444', opacity: 0.12,
      }} />
      <View style={{
        position: 'absolute', bottom: -60, right: -60,
        width: 250, height: 250, borderRadius: 125,
        backgroundColor: '#f44444', opacity: 0.07,
      }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 18,
              backgroundColor: '#f44444',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
              shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6, shadowRadius: 20, elevation: 10,
            }}>
              <Text style={{ fontSize: 36 }}>☕</Text>
            </View>
            <Text style={{ color: '#f44444', fontSize: 28, fontWeight: 'bold' }}>SekoPi</Text>
            <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>Sistem Manajemen Kopi Gerobakan</Text>
          </View>

          {/* Glass Card */}
          <View style={{
            width: '100%', maxWidth: 380,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 16, padding: 28,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
          }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 24 }}>Masuk ke Akun</Text>

            {/* Error dari API */}
            {error && (
              <View style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                borderRadius: 8, padding: 12, marginBottom: 16,
              }}>
                <Text style={{ color: '#f87171', fontSize: 13 }}>
                  {(error as any)?.response?.data?.detail ?? 'Email atau password salah'}
                </Text>
              </View>
            )}

            {/* Debug message */}
            {!!debugMsg && (
              <View style={{
                backgroundColor: 'rgba(59,130,246,0.1)',
                borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
                borderRadius: 8, padding: 10, marginBottom: 12,
              }}>
                <Text style={{ color: '#60a5fa', fontSize: 12 }}>{debugMsg}</Text>
              </View>
            )}

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    label="Email"
                    placeholder="admin@sekopi.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={onChange}
                    value={value}
                    onBlur={onBlur}
                    error={errors.email?.message}
                  />
                )}
              />
            </View>

            {/* Password */}
            <View style={{ marginBottom: 24 }}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry={!showPass}
                    onChangeText={onChange}
                    value={value}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    rightIcon={
                      <Pressable onPress={() => setShowPass(!showPass)}>
                        <Text style={{ color: '#888', fontSize: 11 }}>
                          {showPass ? 'Sembunyikan' : 'Tampilkan'}
                        </Text>
                      </Pressable>
                    }
                  />
                )}
              />
            </View>

            {/* Tombol Login */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isPending}
              style={({ pressed }) => ({
                backgroundColor: isPending ? '#a33' : '#f44444',
                borderRadius: 10, height: 48,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isPending ? 0 : 0.4, shadowRadius: 12,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>
                {isPending ? 'Memproses...' : 'Masuk'}
              </Text>
            </Pressable>

            {/* Akun demo */}
            <View style={{ marginTop: 20, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <Text style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>Akun Demo:</Text>
              <Text style={{ color: '#888', fontSize: 11 }}>admin@sekopi.com / admin123</Text>
              <Text style={{ color: '#888', fontSize: 11 }}>driver@sekopi.com / driver123</Text>
              <Text style={{ color: '#888', fontSize: 11 }}>kasir@sekopi.com / kasir123</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
