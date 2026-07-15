import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  TextInput, ActivityIndicator, Alert, StyleSheet, RefreshControl,
  Modal, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

// ─── Types
type StatusLoading = 'draft' | 'confirmed' | 'dispatched' | 'returned';
type Section = 'list' | 'create' | 'detail';

interface UserSnap    { id: number; full_name: string; }
interface GerobakSnap { id: number; nama: string; }
interface UnitSnap    { id: number; barcode: string; nama_menu: string; expiry_date: string | null; }

interface LoadingItem {
  id: number;
  production_unit_id: number;
  barcode_snapshot: string;
  harga_modal_snapshot: number;
  unit: UnitSnap | null;
}

interface LoadingOrder {
  id: number;
  nomor_loading: string;
  status: StatusLoading;
  catatan: string | null;
  gerobak: GerobakSnap;
  driver: UserSnap;
  pembuat: UserSnap;
  items: LoadingItem[];
  total_unit: number;
  created_at: string;
  updated_at: string;
}

interface GerobakResponse {
  id: number;
  nama: string;
  kode: string;
  is_active: boolean;
  driver: { id: number; full_name: string } | null;
}

interface UserResponse {
  id: number;
  full_name: string;
  role: string;
  is_active: boolean;
}

// ─── Helpers
function parseError(e: any): string {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join(', ');
  if (detail) return JSON.stringify(detail);
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error') return 'Tidak dapat terhubung ke server.';
  return e?.message ?? 'Terjadi kesalahan.';
}

const STATUS_LABEL: Record<StatusLoading, string> = {
  draft: 'Draft', confirmed: 'Dikonfirmasi', dispatched: 'Diberangkatkan', returned: 'Dikembalikan',
};
const STATUS_COLOR: Record<StatusLoading, string> = {
  draft: '#fbbf24', confirmed: '#60a5fa', dispatched: '#34d399', returned: '#a78bfa',
};
const NEXT_STATUS: Partial<Record<StatusLoading, { to: StatusLoading; label: string; color: string }>> = {
  draft:      { to: 'confirmed',  label: 'Konfirmasi',   color: '#60a5fa' },
  confirmed:  { to: 'dispatched', label: 'Berangkatkan', color: '#34d399' },
  dispatched: { to: 'returned',   label: 'Kembalikan',   color: '#a78bfa' },
};

// Driver sekarang juga bisa create & scan
const CAN_CREATE      = ['admin', 'inventori', 'driver'];
const CAN_ADVANCE     = ['admin', 'inventori', 'driver'];
const CAN_DELETE_ITEM = ['admin', 'inventori'];

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Main Screen
export default function LoadingScreen() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';

  const [section, setSection]         = useState<Section>('list');
  const [orders, setOrders]           = useState<LoadingOrder[]>([]);
  const [selected, setSelected]       = useState<LoadingOrder | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusLoading | ''>('');

  // create form
  const [gerobaks, setGerobaks]       = useState<GerobakResponse[]>([]);
  const [drivers, setDrivers]         = useState<UserResponse[]>([]);
  const [selGerobak, setSelGerobak]   = useState<GerobakResponse | null>(null);
  const [selDriver, setSelDriver]     = useState<UserResponse | null>(null);
  const [catatan, setCatatan]         = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  // scanner
  const [scanOpen, setScanOpen]           = useState(false);
  const [permission, requestPermission]   = useCameraPermissions();
  const [scanLoading, setScanLoading]     = useState(false);
  const [scanMsg, setScanMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const scanCooldown = useRef(false);

  // detail action
  const [advancing, setAdvancing]         = useState(false);
  const [deletingItem, setDeletingItem]   = useState<number | null>(null);

  // ── Fetch list
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setListLoading(true);
    setListError('');
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/loading/', { params });
      setOrders(res.data);
    } catch (e) {
      setListError(parseError(e));
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Fetch data untuk form create
  const fetchCreateData = useCallback(async () => {
    try {
      // Driver hanya lihat gerobak, tidak perlu list semua user
      const gRes = await api.get('/gerobak/');
      setGerobaks((gRes.data as GerobakResponse[]).filter((g) => g.is_active));

      if (role !== 'driver') {
        // Admin & inventori bisa pilih driver bebas
        const uRes = await api.get('/users/');
        setDrivers((uRes.data as UserResponse[]).filter((u) => u.role === 'driver' && u.is_active));
      } else {
        // Driver hanya bisa assign diri sendiri
        if (user) setDrivers([{ id: user.id, full_name: user.full_name, role: 'driver', is_active: true }]);
      }
    } catch (_) {}
  }, [role, user]);

  // ── Auto-select driver diri sendiri saat role=driver
  useEffect(() => {
    if (role === 'driver' && user && drivers.length === 1) {
      setSelDriver(drivers[0]);
    }
  }, [drivers, role, user]);

  // ── Refresh detail
  const refreshDetail = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/loading/${id}`);
      setSelected(res.data);
      setOrders((prev) => prev.map((o) => (o.id === id ? res.data : o)));
    } catch (_) {}
  }, []);

  // ── Create
  const handleCreate = async () => {
    if (!selGerobak) { setCreateError('Pilih gerobak terlebih dahulu.'); return; }
    if (!selDriver)  { setCreateError('Pilih driver terlebih dahulu.'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await api.post('/loading/', {
        gerobak_id: selGerobak.id,
        driver_id:  selDriver.id,
        catatan:    catatan.trim() || undefined,
      });
      const newOrder: LoadingOrder = res.data;
      setOrders((prev) => [newOrder, ...prev]);
      setSelected(newOrder);
      setSelGerobak(null); setSelDriver(null); setCatatan('');
      setSection('detail');
    } catch (e) {
      setCreateError(parseError(e));
    } finally {
      setCreating(false);
    }
  };

  // ── Advance status
  const handleAdvance = async () => {
    if (!selected) return;
    const next = NEXT_STATUS[selected.status];
    if (!next) return;
    Alert.alert(
      `${next.label}?`,
      `Ubah status ke "${STATUS_LABEL[next.to]}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: next.label,
          onPress: async () => {
            setAdvancing(true);
            try {
              const res = await api.patch(`/loading/${selected.id}`, { status: next.to });
              setSelected(res.data);
              setOrders((prev) => prev.map((o) => (o.id === selected.id ? res.data : o)));
            } catch (e) { Alert.alert('Gagal', parseError(e)); }
            finally { setAdvancing(false); }
          },
        },
      ]
    );
  };

  // ── Hapus item
  const handleDeleteItem = async (itemId: number) => {
    if (!selected) return;
    Alert.alert('Hapus item?', 'Item akan dihapus dari loading ini.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          setDeletingItem(itemId);
          try {
            const res = await api.delete(`/loading/${selected.id}/items/${itemId}`);
            setSelected(res.data);
          } catch (e) { Alert.alert('Gagal', parseError(e)); }
          finally { setDeletingItem(null); }
        },
      },
    ]);
  };

  // ── Scan barcode
  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanCooldown.current || scanLoading || !selected) return;
    scanCooldown.current = true;
    setScanLoading(true); setScanMsg(null);
    try {
      await api.post(`/loading/${selected.id}/scan`, { barcode: data });
      setScanMsg({ ok: true, text: `✓ ${data} berhasil ditambahkan` });
      await refreshDetail(selected.id);
    } catch (e) {
      setScanMsg({ ok: false, text: parseError(e) });
    } finally {
      setScanLoading(false);
      setTimeout(() => { scanCooldown.current = false; setScanMsg(null); }, 2000);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert('Izin Kamera', 'Akses kamera diperlukan untuk scan barcode.'); return; }
    }
    setScanMsg(null);
    setScanOpen(true);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER helpers
  const SECTION_TITLE: Record<Section, string> = {
    list:   'Loading Order',
    create: 'Buat Loading',
    detail: selected ? selected.nomor_loading : 'Detail',
  };

  const renderHeader = (onBack?: () => void) => (
    <BlurView intensity={15} tint="dark" style={styles.header}>
      <TouchableOpacity onPress={() => { if (onBack) onBack(); else if (section !== 'list') setSection('list'); else router.back(); }}>
        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{SECTION_TITLE[section]}</Text>
      <View style={{ width: 22 }} />
    </BlurView>
  );

  const StatusBadge = ({ status }: { status: StatusLoading }) => (
    <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[status]}20`, borderColor: `${STATUS_COLOR[status]}50` }]}>
      <Text style={[styles.badgeText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION: List
  const renderList = () => (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      {renderHeader()}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {(['', 'draft', 'confirmed', 'dispatched', 'returned'] as const).map((s) => {
          const active = filterStatus === s;
          const color  = s ? STATUS_COLOR[s] : '#94a3b8';
          return (
            <TouchableOpacity key={s || 'all'} onPress={() => setFilterStatus(s)}
              style={[styles.filterChip, active && { backgroundColor: `${color}20`, borderColor: `${color}60` }]}>
              <Text style={[styles.filterChipText, active && { color }]}>{s ? STATUS_LABEL[s] : 'Semua'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {listLoading ? (
        <View style={styles.centerBox}><ActivityIndicator color="#60a5fa" size="large" /></View>
      ) : listError ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={40} color="#f44444" />
          <Text style={styles.errorText}>{listError}</Text>
          <TouchableOpacity onPress={() => fetchOrders()} style={styles.retryBtn}>
            <Text style={{ color: '#60a5fa', fontSize: 13 }}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrders(true); }} tintColor="#60a5fa" />}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="cube-outline" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>Belum ada loading order</Text>
            </View>
          }
          renderItem={({ item: o }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => { setSelected(o); setSection('detail'); }}>
              <BlurView intensity={12} tint="dark" style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{o.nomor_loading}</Text>
                  <StatusBadge status={o.status} />
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="storefront-outline" size={13} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.cardMeta}>{o.gerobak.nama}</Text>
                  <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.35)" style={{ marginLeft: 10 }} />
                  <Text style={styles.cardMeta}>{o.driver.full_name}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="cube-outline" size={13} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.cardMeta}>{o.total_unit} unit</Text>
                  <Text style={[styles.cardMeta, { marginLeft: 'auto' }]}>
                    {new Date(o.created_at).toLocaleDateString('id-ID')}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}
        />
      )}

      {CAN_CREATE.includes(role) && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}
          onPress={() => {
            setCreateError('');
            setSelGerobak(null);
            // Driver auto-select dirinya sendiri, tidak perlu reset driver
            if (role !== 'driver') setSelDriver(null);
            setCatatan('');
            fetchCreateData();
            setSection('create');
          }}>
          <LinearGradient colors={['#60a5fa', '#3b82f6']} style={styles.fabGrad}>
            <Ionicons name="add" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION: Create
  const renderCreate = () => (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      {renderHeader(() => setSection('list'))}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!!createError && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color="#f44444" />
            <Text style={{ color: '#f44444', fontSize: 12, flex: 1 }}>{createError}</Text>
          </View>
        )}

        {/* Pilih Gerobak */}
        <Text style={styles.sectionLabel}>Pilih Gerobak</Text>
        {gerobaks.length === 0 ? (
          <ActivityIndicator color="#60a5fa" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {gerobaks.map((g) => {
                const active = selGerobak?.id === g.id;
                return (
                  <TouchableOpacity key={g.id} onPress={() => setSelGerobak(g)} activeOpacity={0.8}>
                    <BlurView intensity={12} tint="dark"
                      style={[styles.pickChip, active && { borderColor: '#60a5fa80', backgroundColor: '#60a5fa15' }]}>
                      <Ionicons name="storefront-outline" size={14} color={active ? '#60a5fa' : 'rgba(255,255,255,0.4)'} />
                      <Text style={[styles.pickChipText, active && { color: '#60a5fa' }]}>{g.nama}</Text>
                      <Text style={styles.pickChipSub}>{g.kode}</Text>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Pilih Driver */}
        <Text style={styles.sectionLabel}>
          {role === 'driver' ? 'Driver (Anda)' : 'Pilih Driver'}
        </Text>
        {drivers.length === 0 ? (
          <ActivityIndicator color="#60a5fa" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {drivers.map((d) => {
                const active = selDriver?.id === d.id;
                const locked = role === 'driver'; // driver tidak bisa ganti
                return (
                  <TouchableOpacity key={d.id} onPress={() => !locked && setSelDriver(d)} activeOpacity={locked ? 1 : 0.8}>
                    <BlurView intensity={12} tint="dark"
                      style={[
                        styles.pickChip,
                        active && { borderColor: '#34d39980', backgroundColor: '#34d39915' },
                        locked && { opacity: 0.7 },
                      ]}>
                      <Ionicons name={locked ? 'lock-closed-outline' : 'person-outline'} size={14}
                        color={active ? '#34d399' : 'rgba(255,255,255,0.4)'} />
                      <Text style={[styles.pickChipText, active && { color: '#34d399' }]}>{d.full_name}</Text>
                      {locked && <Text style={styles.pickChipSub}>Otomatis</Text>}
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Catatan */}
        <Text style={styles.sectionLabel}>Catatan (opsional)</Text>
        <BlurView intensity={10} tint="dark" style={styles.textAreaWrap}>
          <TextInput
            value={catatan} onChangeText={setCatatan}
            placeholder="Catatan tambahan..." placeholderTextColor="rgba(255,255,255,0.2)"
            multiline numberOfLines={3} style={styles.textArea}
          />
        </BlurView>

        <TouchableOpacity onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
          <LinearGradient
            colors={creating ? ['#1a1a2e', '#12121e'] : ['#60a5fa', '#3b82f6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            {creating
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="add-circle-outline" size={18} color="#fff" /><Text style={styles.submitText}>BUAT LOADING ORDER</Text></>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION: Detail
  const renderDetail = () => {
    if (!selected) return null;
    const next = NEXT_STATUS[selected.status];
    const canAdvance    = CAN_ADVANCE.includes(role);
    const canDeleteItem = CAN_DELETE_ITEM.includes(role);
    const isDraft       = selected.status === 'draft';

    return (
      <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
        {renderHeader(() => setSection('list'))}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          <BlurView intensity={14} tint="dark" style={styles.card}>
            <View style={[styles.cardRow, { marginBottom: 8 }]}>
              <Text style={styles.cardTitle}>{selected.nomor_loading}</Text>
              <StatusBadge status={selected.status} />
            </View>
            <InfoRow icon="storefront-outline" label="Gerobak" value={selected.gerobak.nama} />
            <InfoRow icon="person-outline"     label="Driver"  value={selected.driver.full_name} />
            <InfoRow icon="construct-outline"  label="Dibuat"  value={selected.pembuat.full_name} />
            <InfoRow icon="calendar-outline"   label="Tanggal" value={new Date(selected.created_at).toLocaleString('id-ID')} />
            {selected.catatan ? <InfoRow icon="document-text-outline" label="Catatan" value={selected.catatan} /> : null}
          </BlurView>

          <View style={{ gap: 8 }}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel2}>Item ({selected.total_unit} unit)</Text>
              {isDraft && (
                <TouchableOpacity onPress={openScanner} style={styles.scanBtn} activeOpacity={0.85}>
                  <Ionicons name="scan-outline" size={15} color="#0f1117" />
                  <Text style={styles.scanBtnText}>Scan Barcode</Text>
                </TouchableOpacity>
              )}
            </View>

            {selected.items.length === 0 ? (
              <BlurView intensity={10} tint="dark" style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Ionicons name="cube-outline" size={36} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>Belum ada item. Scan barcode untuk menambah.</Text>
              </BlurView>
            ) : (
              selected.items.map((item) => (
                <BlurView key={item.id} intensity={10} tint="dark"
                  style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="cube" size={16} color="#60a5fa" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.unit?.nama_menu ?? item.barcode_snapshot}
                    </Text>
                    <Text style={styles.itemSub}>{item.barcode_snapshot}</Text>
                    {item.unit?.expiry_date ? <Text style={styles.itemSub}>Exp: {item.unit.expiry_date}</Text> : null}
                    <Text style={[styles.itemSub, { color: '#fbbf24' }]}>
                      Rp {item.harga_modal_snapshot.toLocaleString('id-ID')}
                    </Text>
                  </View>
                  {isDraft && canDeleteItem && (
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)}
                      disabled={deletingItem === item.id} style={{ padding: 8 }}>
                      {deletingItem === item.id
                        ? <ActivityIndicator size="small" color="#f44444" />
                        : <Ionicons name="trash-outline" size={18} color="#f44444" />}
                    </TouchableOpacity>
                  )}
                </BlurView>
              ))
            )}
          </View>
        </ScrollView>

        {canAdvance && next && (
          <View style={styles.actionBar}>
            <TouchableOpacity onPress={handleAdvance} disabled={advancing} activeOpacity={0.85} style={{ flex: 1 }}>
              <LinearGradient
                colors={advancing ? ['#1a1a2e', '#12121e'] : [next.color, next.color + 'cc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.actionBtn}
              >
                {advancing
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.actionBtnText}>{next.label.toUpperCase()}</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Scanner Modal
  const renderScanner = () => (
    <Modal visible={scanOpen} animationType="slide" statusBarTranslucent>
      <View style={styles.scanModal}>
        <BlurView intensity={20} tint="dark" style={styles.scanHeader}>
          <TouchableOpacity onPress={() => setScanOpen(false)}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.scanHeaderTitle}>Scan Barcode</Text>
          <View style={{ width: 24 }} />
        </BlurView>

        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr','code128','code39','ean13','ean8','upc_a','upc_e','itf14','datamatrix','pdf417','aztec','codabar'],
          }}
          onBarcodeScanned={scanLoading ? undefined : handleBarcodeScan}
        >
          <View style={styles.scanOverlay}>
            <View style={styles.scanTopShade} />
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.scanSideShade} />
              <View style={styles.scanBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.scanLine} />
              </View>
              <View style={styles.scanSideShade} />
            </View>
            <View style={styles.scanBottomShade}>
              <Text style={styles.scanHint}>Arahkan kamera ke barcode produk</Text>
              {scanLoading && <ActivityIndicator color="#60a5fa" style={{ marginTop: 8 }} />}
              {scanMsg && (
                <View style={[styles.scanMsgBox, { borderColor: scanMsg.ok ? '#22c55e50' : '#f4444450' }]}>
                  <Ionicons name={scanMsg.ok ? 'checkmark-circle' : 'warning-outline'} size={15}
                    color={scanMsg.ok ? '#22c55e' : '#f44444'} />
                  <Text style={{ color: scanMsg.ok ? '#22c55e' : '#f44444', fontSize: 13, flex: 1 }}>
                    {scanMsg.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );

  return (
    <>
      {section === 'list'   && renderList()}
      {section === 'create' && renderCreate()}
      {section === 'detail' && renderDetail()}
      {renderScanner()}
    </>
  );
}

// ─── Sub-component
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.35)" style={{ marginTop: 2 }} />
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, width: 64 }}>{label}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, flex: 1 }}>{value}</Text>
    </View>
  );
}

// ─── Styles
const styles = StyleSheet.create({
  header: {
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  errorText: { color: '#f44444', fontSize: 13, textAlign: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', marginTop: 6 },
  retryBtn:  { marginTop: 4, padding: 8 },

  card: {
    borderRadius: 14, overflow: 'hidden', padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle:{ color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  badge:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  filterChip: {
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },

  pickChip: {
    borderRadius: 10, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', gap: 4, minWidth: 90,
  },
  pickChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  pickChipSub:  { color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center' },

  sectionLabel:  { color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionLabel2: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', flex: 1 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center' },

  textAreaWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  textArea:     { color: '#fff', fontSize: 14, padding: 12, minHeight: 80, textAlignVertical: 'top' },

  submitBtn:  { borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  itemIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(96,165,250,0.12)', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  itemSub:  { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 },

  scanBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fbbf24', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  scanBtnText: { color: '#0f1117', fontSize: 12, fontWeight: '700' },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32,
    backgroundColor: 'rgba(13,15,23,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn:     { borderRadius: 14, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },

  fab:     { position: 'absolute', bottom: 28, right: 20 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8 },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(244,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(244,68,68,0.3)',
    borderRadius: 10, padding: 10,
  },

  scanModal:       { flex: 1, backgroundColor: '#000' },
  scanHeader:      { paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  scanHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  scanOverlay:    { flex: 1 },
  scanTopShade:   { height: 120, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanSideShade:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanBottomShade:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },

  scanBox:  { width: SCREEN_W * 0.65, height: SCREEN_W * 0.65, position: 'relative' },
  scanLine: { position: 'absolute', left: 12, right: 12, top: '50%', height: 2, backgroundColor: '#fbbf2480', borderRadius: 1 },

  corner:   { position: 'absolute', width: 24, height: 24, borderColor: '#fbbf24', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },

  scanHint:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
  scanMsgBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)', width: '100%' },
});
