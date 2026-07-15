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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';

const { width: SW } = Dimensions.get('window');
const PAD  = 20;
const GAP  = 12;
const CW   = (SW - PAD * 2 - GAP) / 2;

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
};

const MENU_COMMON: MenuItem[] = [
  { icon: 'calendar-outline', label: 'Absensi', route: '/(main)/absensi', color: '#f44444' },
  { icon: 'person-outline',   label: 'Profil',  route: '/(main)/profil',  color: '#3b82f6' },
];

const MENU_BY_ROLE: Record<UserRole, MenuItem[]> = {
  admin: [
    { icon: 'people-outline',    label: 'Pengguna',    route: '/(admin)/users',         color: '#3b82f6' },
    { icon: 'fast-food-outline', label: 'Menu Produk', route: '/(admin)/menu',          color: '#22c55e' },
    { icon: 'car-outline',       label: 'Gerobak',     route: '/(admin)/gerobak',       color: '#eab308' },
    { icon: 'cube-outline',      label: 'Inventori',   route: '/(inventori)/dashboard', color: '#f97316' },
    { icon: 'hammer-outline',    label: 'Produksi',    route: '/(produksi)/dashboard',  color: '#a855f7' },
    { icon: 'bar-chart-outline', label: 'Laporan',     route: '/(admin)/laporan',       color: '#14b8a6' },
    { icon: 'cash-outline',      label: 'Dividen',     route: '/(admin)/dividen',       color: '#f44444' },
  ],
  produksi: [
    { icon: 'hammer-outline',    label: 'Produksi',    route: '/(produksi)/dashboard',  color: '#a855f7' },
    { icon: 'fast-food-outline', label: 'Menu Produk', route: '/(produksi)/menu',       color: '#22c55e' },
    { icon: 'clipboard-outline', label: 'Mfg Order',   route: '/(produksi)/mo',         color: '#f97316' },
  ],
  inventori: [
    { icon: 'cube-outline',      label: 'Stok',          route: '/(inventori)/dashboard', color: '#f97316' },
    { icon: 'cart-outline',      label: 'Purchase Order',route: '/(inventori)/po',        color: '#3b82f6' },
    { icon: 'refresh-outline',   label: 'Return',        route: '/(inventori)/return',    color: '#eab308' },
    { icon: 'archive-outline',   label: 'Loading',       route: '/(inventori)/loading',   color: '#22c55e' },
  ],
  driver: [
    { icon: 'archive-outline',   label: 'Loading',       route: '/(inventori)/loading',   color: '#22c55e' },
    { icon: 'car-outline',       label: 'Gerobak Saya',  route: '/(driver)/gerobak',      color: '#eab308' },
    { icon: 'receipt-outline',   label: 'Penjualan',     route: '/(driver)/penjualan',    color: '#22c55e' },
    { icon: 'cube-outline',      label: 'Stok Harian',   route: '/(driver)/stok',         color: '#f97316' },
  ],
  shareholder: [
    { icon: 'bar-chart-outline', label: 'Laporan',  route: '/(shareholder)/laporan', color: '#3b82f6' },
    { icon: 'cash-outline',      label: 'Dividen',  route: '/(shareholder)/dividen', color: '#f44444' },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  produksi: 'Tim Produksi',
  inventori: 'Tim Inventori',
  driver: 'Driver',
  shareholder: 'Shareholder',
};

function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }, index * 55);
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], width: CW }}>
      <TouchableOpacity onPress={() => router.push(item.route as any)} activeOpacity={0.78}>
        <BlurView intensity={15} tint="dark" style={{
          borderRadius: 16, overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          padding: 16, minHeight: 96,
          justifyContent: 'space-between',
        }}>
          <View style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: `${item.color}1a`,
            borderWidth: 1, borderColor: `${item.color}33`,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 10,
          }}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <Text style={{ color: '#e5e7eb', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 }}>
            {item.label}
          </Text>
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
            borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
            backgroundColor: item.color, opacity: 0.45,
          }} />
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Pindahkan redirect ke useEffect — tidak boleh navigate saat render
  useEffect(() => {
    if (!user) router.replace('/(auth)/login');
  }, [user]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Render kosong sementara sebelum redirect selesai
  if (!user) return null;

  const role     = user.role as UserRole;
  const allMenus = [...MENU_COMMON, ...(MENU_BY_ROLE[role] ?? [])];
  const rows: MenuItem[][] = [];
  for (let i = 0; i < allMenus.length; i += 2) rows.push(allMenus.slice(i, i + 2));

  return (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1117" />
      <View style={{
        position: 'absolute', width: 280, height: 280, borderRadius: 140,
        top: -60, right: -60, backgroundColor: 'rgba(244,68,68,0.08)',
      }} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <BlurView intensity={15} tint="dark" style={{
            paddingTop: (StatusBar.currentHeight ?? 44) + 16,
            paddingBottom: 18, paddingHorizontal: PAD,
            borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
            backgroundColor: 'rgba(15,17,23,0.6)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
                  Selamat datang,
                </Text>
                <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                  {user.full_name}
                </Text>
                <View style={{
                  alignSelf: 'flex-start', marginTop: 5,
                  backgroundColor: 'rgba(244,68,68,0.14)', borderWidth: 1,
                  borderColor: 'rgba(244,68,68,0.32)', borderRadius: 5,
                  paddingHorizontal: 7, paddingVertical: 2,
                }}>
                  <Text style={{ color: '#f44444', fontSize: 10, fontWeight: '600', letterSpacing: 1 }}>
                    {ROLE_LABEL[role]}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { clearAuth(); router.replace('/(auth)/login'); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(244,68,68,0.10)',
                  borderWidth: 1, borderColor: 'rgba(244,68,68,0.25)',
                  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                }}
              >
                <Ionicons name="log-out-outline" size={16} color="#f44444" />
                <Text style={{ color: '#f44444', fontSize: 11, fontWeight: '600' }}>Keluar</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Section title */}
          <View style={{ paddingHorizontal: PAD, marginTop: 22, marginBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>Menu</Text>
            <View style={{ width: 24, height: 2, borderRadius: 1, backgroundColor: '#f44444', marginTop: 5 }} />
          </View>

          {/* Grid */}
          <View style={{ paddingHorizontal: PAD }}>
            {rows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
                {row.map((item, ci) => <MenuCard key={item.label} item={item} index={ri * 2 + ci} />)}
                {row.length === 1 && <View style={{ width: CW }} />}
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}
