import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP    = 12;
const PADDING_H   = 20;
const CARD_WIDTH  = (SCREEN_WIDTH - PADDING_H * 2 - CARD_GAP) / 2;

// ── Menu per role ───────────────────────────────────────────────────────────
type MenuItem = { icon: string; label: string; route: string; color: string };

const MENU_BY_ROLE: Record<UserRole, MenuItem[]> = {
  admin: [
    { icon: '📊', label: 'Dashboard',     route: '/(main)/dashboard',       color: '#f44444' },
    { icon: '👥', label: 'Pengguna',      route: '/(admin)/users',          color: '#3b82f6' },
    { icon: '🛒', label: 'Menu Produk',   route: '/(admin)/menu',           color: '#22c55e' },
    { icon: '🚛', label: 'Gerobak',       route: '/(admin)/gerobak',        color: '#eab308' },
    { icon: '📦', label: 'Inventori',     route: '/(inventori)/dashboard',  color: '#f97316' },
    { icon: '🏭', label: 'Produksi',      route: '/(produksi)/dashboard',   color: '#a855f7' },
    { icon: '💰', label: 'Laporan',       route: '/(admin)/laporan',        color: '#14b8a6' },
    { icon: '📄', label: 'Dividen',       route: '/(admin)/dividen',        color: '#f44444' },
  ],
  produksi: [
    { icon: '🏭', label: 'Produksi',      route: '/(produksi)/dashboard',   color: '#a855f7' },
    { icon: '🛒', label: 'Menu Produk',   route: '/(produksi)/menu',        color: '#22c55e' },
    { icon: '📋', label: 'Mfg Order',     route: '/(produksi)/mo',          color: '#f97316' },
    { icon: '✅',       label: 'Absensi',       route: '/(produksi)/absensi',     color: '#14b8a6' },
  ],
  inventori: [
    { icon: '📦', label: 'Stok',          route: '/(inventori)/dashboard',  color: '#f97316' },
    { icon: '🛒', label: 'Purchase Order', route: '/(inventori)/po',         color: '#3b82f6' },
    { icon: '🔄', label: 'Return',         route: '/(inventori)/return',     color: '#eab308' },
    { icon: '📋', label: 'Loading',        route: '/(inventori)/loading',    color: '#22c55e' },
  ],
  driver: [
    { icon: '🚛', label: 'Gerobak Saya',  route: '/(driver)/gerobak',       color: '#eab308' },
    { icon: '💳', label: 'Penjualan',     route: '/(driver)/penjualan',     color: '#22c55e' },
    { icon: '📦', label: 'Stok Harian',   route: '/(driver)/stok',          color: '#f97316' },
    { icon: '✅',       label: 'Absensi',       route: '/(driver)/absensi',       color: '#14b8a6' },
  ],
  shareholder: [
    { icon: '📊', label: 'Laporan',       route: '/(shareholder)/laporan',  color: '#3b82f6' },
    { icon: '💰', label: 'Dividen',       route: '/(shareholder)/dividen',  color: '#f44444' },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  produksi: 'Tim Produksi',
  inventori: 'Tim Inventori',
  driver: 'Driver',
  shareholder: 'Shareholder',
};

// ── Komponen Card Menu ───────────────────────────────────────────────────────
function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 60;
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, []);

  const handlePress = () => {
    // Navigasi ke route — halaman belum dibuat akan di-handle oleh +not-found
    router.push(item.route as any);
  };

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ scale: scaleAnim }],
      width: CARD_WIDTH,
    }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.80}>
        <BlurView intensity={15} tint="dark" style={{
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          padding: 18,
          alignItems: 'flex-start',
          minHeight: 100,
          justifyContent: 'space-between',
        }}>
          {/* Icon dengan warna unik per menu */}
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: `${item.color}22`,
            borderWidth: 1, borderColor: `${item.color}44`,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Text style={{ fontSize: 22 }}>{item.icon}</Text>
          </View>
          <Text style={{
            color: '#ffffff', fontSize: 13, fontWeight: '600',
            letterSpacing: 0.3, lineHeight: 18,
          }}>
            {item.label}
          </Text>
          {/* Garis aksen bawah berwarna */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 2, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
            backgroundColor: item.color, opacity: 0.5,
          }} />
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Dashboard Screen ─────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  if (!user) {
    router.replace('/(auth)/login');
    return null;
  }

  const role  = user.role as UserRole;
  const menus = MENU_BY_ROLE[role] ?? [];

  const handleLogout = () => {
    clearAuth();
    router.replace('/(auth)/login');
  };

  // Bagi menu jadi baris berpasangan untuk grid 2 kolom
  const rows: MenuItem[][] = [];
  for (let i = 0; i < menus.length; i += 2) {
    rows.push(menus.slice(i, i + 2));
  }

  return (
    <LinearGradient
      colors={['#0f1117', '#13151e', '#0f1117']}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0f1117" />

      {/* Dekorasi glow */}
      <View style={{
        position: 'absolute', width: 300, height: 300, borderRadius: 150,
        top: -60, right: -60, backgroundColor: 'rgba(244,68,68,0.09)',
        pointerEvents: 'none',
      }} />
      <View style={{
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        bottom: 80, left: -50, backgroundColor: 'rgba(244,68,68,0.06)',
        pointerEvents: 'none',
      }} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header / Greeting ── */}
          <BlurView intensity={15} tint="dark" style={{
            paddingTop: (StatusBar.currentHeight ?? 44) + 16,
            paddingBottom: 20,
            paddingHorizontal: PADDING_H,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.07)',
            backgroundColor: 'rgba(15,17,23,0.6)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Kiri: nama & role */}
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.45)', fontSize: 11,
                  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
                }}>
                  Selamat datang,
                </Text>
                <Text style={{
                  color: '#ffffff', fontSize: 18, fontWeight: '700',
                  letterSpacing: 0.3,
                }} numberOfLines={1}>
                  {user.full_name}
                </Text>
                {/* Badge role */}
                <View style={{
                  alignSelf: 'flex-start', marginTop: 6,
                  backgroundColor: 'rgba(244,68,68,0.15)',
                  borderWidth: 1, borderColor: 'rgba(244,68,68,0.35)',
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{ color: '#f44444', fontSize: 10, fontWeight: '600', letterSpacing: 1 }}>
                    {ROLE_LABEL[role]}
                  </Text>
                </View>
              </View>

              {/* Kanan: avatar + logout */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(244,68,68,0.15)',
                  borderWidth: 1.5, borderColor: 'rgba(244,68,68,0.35)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 22 }}>☕</Text>
                </View>
                <TouchableOpacity onPress={handleLogout}>
                  <Text style={{
                    color: 'rgba(244,68,68,0.7)', fontSize: 10,
                    letterSpacing: 1, textTransform: 'uppercase',
                  }}>Keluar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>

          {/* ── Section Title ── */}
          <View style={{ paddingHorizontal: PADDING_H, marginTop: 24, marginBottom: 14 }}>
            <Text style={{
              color: 'rgba(255,255,255,0.55)', fontSize: 10,
              letterSpacing: 3, textTransform: 'uppercase',
            }}>Menu Utama</Text>
            <View style={{
              width: 28, height: 2, borderRadius: 1,
              backgroundColor: '#f44444', marginTop: 6,
              shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7, shadowRadius: 4,
            }} />
          </View>

          {/* ── Grid Menu ── */}
          <View style={{ paddingHorizontal: PADDING_H }}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={{
                flexDirection: 'row',
                gap: CARD_GAP,
                marginBottom: CARD_GAP,
              }}>
                {row.map((item, colIdx) => (
                  <MenuCard key={item.label} item={item} index={rowIdx * 2 + colIdx} />
                ))}
                {/* Jika baris ganjil, isi dengan placeholder kosong */}
                {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
              </View>
            ))}
          </View>

          {/* ── Footer info ── */}
          <Text style={{
            color: 'rgba(255,255,255,0.15)', fontSize: 11,
            textAlign: 'center', marginTop: 20, letterSpacing: 1,
          }}>© 2026 Sekopi Platform</Text>
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}
