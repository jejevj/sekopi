import React, { useState } from 'react';
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
      setDebugMsg('Login berhasil!');
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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 350, height: 350, borderRadius: '50%',
        backgroundColor: '#f44444', opacity: 0.12,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, right: -60,
        width: 250, height: 250, borderRadius: '50%',
        backgroundColor: '#f44444', opacity: 0.07,
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            backgroundColor: '#f44444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(244,68,68,0.5)',
          }}>
            <span style={{ fontSize: 36 }}>☕</span>
          </div>
          <h1 style={{ color: '#f44444', fontSize: 28, fontWeight: 'bold', margin: 0 }}>SekoPi</h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>Sistem Manajemen Kopi Gerobakan</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 16, padding: 28,
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 24 }}>Masuk ke Akun</h2>

          {/* API Error */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: 12, marginBottom: 16,
            }}>
              <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
                {(error as any)?.response?.data?.detail ?? 'Email atau password salah'}
              </p>
            </div>
          )}

          {/* Debug */}
          {!!debugMsg && (
            <div style={{
              backgroundColor: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 8, padding: 10, marginBottom: 12,
            }}>
              <p style={{ color: '#60a5fa', fontSize: 12, margin: 0 }}>{debugMsg}</p>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  label="Email"
                  placeholder="admin@sekopi.com"
                  type="email"
                  autoComplete="email"
                  {...field}
                  error={errors.email?.message}
                />
              )}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input
                  label="Password"
                  placeholder="••••••••"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...field}
                  error={errors.password?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer' }}
                    >
                      {showPass ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  }
                />
              )}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isPending}
            style={{
              width: '100%', height: 48,
              backgroundColor: isPending ? '#a33' : '#f44444',
              border: 'none', borderRadius: 10,
              color: 'white', fontWeight: 600, fontSize: 15,
              cursor: isPending ? 'not-allowed' : 'pointer',
              boxShadow: isPending ? 'none' : '0 0 20px rgba(244,68,68,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {isPending ? 'Memproses...' : 'Masuk'}
          </button>

          {/* Demo accounts */}
          <div style={{
            marginTop: 20, padding: 12,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
          }}>
            <p style={{ color: '#555', fontSize: 11, margin: '0 0 6px' }}>Akun Demo:</p>
            <p style={{ color: '#888', fontSize: 11, margin: '2px 0' }}>admin@sekopi.com / admin123</p>
            <p style={{ color: '#888', fontSize: 11, margin: '2px 0' }}>driver@sekopi.com / driver123</p>
            <p style={{ color: '#888', fontSize: 11, margin: '2px 0' }}>shareholder@sekopi.com / holder123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
