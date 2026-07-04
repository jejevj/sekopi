import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { PackageCheck, Plus, Search, X, CheckCircle, AlertCircle, Truck } from 'lucide-react-native';
import api from '../../../lib/api';

// ── Types sesuai LoadingOrderResponse dari backend ──────────────────────────
interface GerobakSnap { id: number; nama: string; }
interface UserSnap    { id: number; full_name: string; }
interface LoadingItem {
  id: number;
  production_unit_id: number;
  barcode_snapshot: string;
  harga_modal_snapshot: number;
}
interface LoadingOrder {
  id: number;
  nomor_loading: string;
  status: 'draft' | 'confirmed' | 'dispatched' | 'returned';
  gerobak: GerobakSnap;
  driver: UserSnap;
  pembuat: UserSnap;
  catatan: string | null;
  items: LoadingItem[];
  total_unit: number;
  created_at: string;
  updated_at: string;
}

// Untuk form create — masih perlu list gerobak & user dari endpoint terpisah
interface Gerobak { id: number; nama: string; kode: string; }
interface User    { id: number; full_name: string; role: string; }

const STATUS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  draft:      { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: '#9ca3af', label: 'Draft' },
  confirmed:  { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  text: '#60a5fa', label: 'Confirmed' },
  dispatched: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80', label: 'Dispatched' },
  returned:   { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24', label: 'Returned' },
};
const STATUS_NEXT: Record<string, { label: string; status: string }> = {
  draft:      { label: 'Konfirmasi', status: 'confirmed' },
  confirmed:  { label: 'Dispatch',   status: 'dispatched' },
  dispatched: { label: 'Return',     status: 'returned' },
};

export default function LoadingPage() {
  const [orders,   setOrders]   = useState<LoadingOrder[]>([]);
  const [gerobaks, setGerobaks] = useState<Gerobak[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form,   setForm]   = useState({ gerobak_id: '', driver_id: '', catatan: '' });
  const [saving, setSaving] = useState(false);

  const [scanTarget, setScanTarget] = useState<LoadingOrder | null>(null);
  const [barcode,    setBarcode]    = useState('');
  const [scanning,   setScanning]   = useState(false);
  const [scanMsg,    setScanMsg]    = useState<{ ok: boolean; msg: string } | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  async function fetchAll() {
    setLoading(true);
    try {
      const [o, g, u] = await Promise.all([
        api.get('/loading/'),
        api.get('/gerobak/'),
        api.get('/users/'),
      ]);
      setOrders(o.data ?? []);
      setGerobaks(g.data ?? []);
      setUsers((u.data ?? []).filter((x: User) => x.role === 'DRIVER' || x.role === 'ADMIN'));
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Gagal memuat data', false);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchAll(); }, []);

  async function createOrder() {
    if (!form.gerobak_id || !form.driver_id) return;
    setSaving(true);
    try {
      await api.post('/loading/', {
        gerobak_id: parseInt(form.gerobak_id),
        driver_id:  parseInt(form.driver_id),
        catatan:    form.catatan || null,
      });
      showToast('Loading order dibuat');
      setShowCreate(false);
      setForm({ gerobak_id: '', driver_id: '', catatan: '' });
      fetchAll();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Gagal membuat loading order', false);
    } finally { setSaving(false); }
  }

  async function updateStatus(order: LoadingOrder, newStatus: string) {
    try {
      await api.patch(`/loading/${order.id}`, { status: newStatus });
      showToast(`Status → ${newStatus}`);
      fetchAll();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Gagal ubah status', false);
    }
  }

  async function doScan() {
    if (!scanTarget || !barcode.trim()) return;
    setScanning(true); setScanMsg(null);
    try {
      await api.post(`/loading/${scanTarget.id}/scan`, { barcode: barcode.trim() });
      setScanMsg({ ok: true, msg: `✓ ${barcode} berhasil ditambahkan` });
      setBarcode('');
      fetchAll();
    } catch (e: any) {
      setScanMsg({ ok: false, msg: e?.response?.data?.detail ?? 'Gagal scan' });
    } finally { setScanning(false); }
  }

  async function removeItem(orderId: number, itemId: number) {
    try {
      await api.delete(`/loading/${orderId}/items/${itemId}`);
      showToast('Item dihapus'); fetchAll();
    } catch { showToast('Gagal hapus item', false); }
  }

  const filtered = orders.filter(o =>
    o.nomor_loading.toLowerCase().includes(search.toLowerCase())
  );

  // glass design tokens
  const glass      = { backgroundColor: '#161b27', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16 } as const;
  const glassCard  = { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14 } as const;
  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: 'white' } as const;
  const btnPrimary = { backgroundColor: '#f44444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 };
  const btnGhost   = { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1117' }}>
      {toast && (
        <View style={{ position: 'absolute', top: 20, right: 20, zIndex: 99,
          backgroundColor: toast.ok ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{toast.msg}</Text>
        </View>
      )}

      {/* Header */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PackageCheck size={22} color="#f87171" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Loading Gerobak</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={btnPrimary}>
          <Plus size={15} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Buat Loading</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Search size={15} color="rgba(255,255,255,0.25)" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Cari nomor loading..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={{ flex: 1, fontSize: 14, color: 'white' }} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f87171" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <PackageCheck size={48} color="rgba(255,255,255,0.08)" />
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 15 }}>Belum ada loading order</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {filtered.map(order => {
            const s    = STATUS[order.status] ?? STATUS.draft;
            const next = STATUS_NEXT[order.status];
            return (
              <View key={order.id} style={{ ...glassCard, marginBottom: 12, overflow: 'hidden' }}>
                <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: 'white' }}>{order.nomor_loading}</Text>
                      <View style={{ backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                        <Text style={{ color: s.text, fontSize: 11, fontWeight: '600' }}>{s.label}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Truck size={12} color="rgba(255,255,255,0.25)" />
                      {/* Gunakan order.gerobak.nama & order.driver.full_name sesuai schema backend */}
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                        {order.gerobak.nama} • {order.driver.full_name}
                      </Text>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                      {order.total_unit} unit dimuat
                    </Text>
                  </View>
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    {order.status === 'draft' && (
                      <Pressable onPress={() => { setScanTarget(order); setBarcode(''); setScanMsg(null); }} style={btnGhost}>
                        <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '600' }}>Scan</Text>
                      </Pressable>
                    )}
                    {next && (
                      <Pressable onPress={() => updateStatus(order, next.status)} style={btnGhost}>
                        <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600' }}>{next.label}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {order.items.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 10 }}>
                    {order.items.map(item => (
                      <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>{item.barcode_snapshot}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Rp {Number(item.harga_modal_snapshot).toLocaleString('id')}</Text>
                          {order.status === 'draft' && (
                            <Pressable onPress={() => removeItem(order.id, item.id)}>
                              <X size={13} color="#f87171" />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal Buat Loading */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ ...glass, width: '100%', maxWidth: 440, padding: 24 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: 'white', marginBottom: 18 }}>Buat Loading Order</Text>

            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Gerobak</Text>
            <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
              {gerobaks.map(g => (
                <Pressable key={g.id} onPress={() => setForm(f => ({ ...f, gerobak_id: String(g.id) }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11,
                    backgroundColor: form.gerobak_id === String(g.id) ? 'rgba(244,68,68,0.1)' : 'transparent' }}>
                  <Text style={{ fontSize: 13, color: form.gerobak_id === String(g.id) ? '#f87171' : 'rgba(255,255,255,0.65)' }}>
                    {g.nama} <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>({g.kode})</Text>
                  </Text>
                  {form.gerobak_id === String(g.id) && <CheckCircle size={15} color="#f87171" />}
                </Pressable>
              ))}
              {gerobaks.length === 0 && (
                <Text style={{ padding: 12, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Tidak ada gerobak</Text>
              )}
            </View>

            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Driver</Text>
            <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
              {users.map(u => (
                <Pressable key={u.id} onPress={() => setForm(f => ({ ...f, driver_id: String(u.id) }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11,
                    backgroundColor: form.driver_id === String(u.id) ? 'rgba(244,68,68,0.1)' : 'transparent' }}>
                  <Text style={{ fontSize: 13, color: form.driver_id === String(u.id) ? '#f87171' : 'rgba(255,255,255,0.65)' }}>
                    {u.full_name} <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>({u.role})</Text>
                  </Text>
                  {form.driver_id === String(u.id) && <CheckCircle size={15} color="#f87171" />}
                </Pressable>
              ))}
              {users.length === 0 && (
                <Text style={{ padding: 12, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Tidak ada driver</Text>
              )}
            </View>

            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Catatan</Text>
            <TextInput value={form.catatan} onChangeText={t => setForm(f => ({ ...f, catatan: t }))}
              placeholder="Opsional..." placeholderTextColor="rgba(255,255,255,0.2)"
              multiline numberOfLines={2}
              style={{ ...inputStyle, textAlignVertical: 'top', minHeight: 60, marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setShowCreate(false)} style={{ ...btnGhost, paddingHorizontal: 16, paddingVertical: 9 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Batal</Text>
              </Pressable>
              <Pressable onPress={createOrder} disabled={saving || !form.gerobak_id || !form.driver_id}
                style={{ ...btnPrimary, paddingVertical: 9, opacity: (!form.gerobak_id || !form.driver_id) ? 0.35 : 1 }}>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{saving ? 'Menyimpan...' : 'Buat'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Sheet Scan */}
      <Modal visible={!!scanTarget} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161b27', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: 'white' }}>Scan Barcode</Text>
              <Pressable onPress={() => setScanTarget(null)}>
                <X size={20} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              {scanTarget?.nomor_loading}
              <Text style={{ color: 'rgba(255,255,255,0.5)' }}> — {scanTarget?.total_unit ?? 0} unit terscan</Text>
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput value={barcode} onChangeText={setBarcode} onSubmitEditing={doScan}
                placeholder="Scan atau ketik barcode..." autoFocus
                placeholderTextColor="rgba(255,255,255,0.2)"
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
              <Pressable onPress={doScan} disabled={scanning || !barcode.trim()}
                style={{ ...btnPrimary, paddingHorizontal: 18, opacity: !barcode.trim() ? 0.35 : 1 }}>
                {scanning
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>OK</Text>
                }
              </Pressable>
            </View>

            {scanMsg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10,
                backgroundColor: scanMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                borderWidth: 1, borderColor: scanMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }}>
                {scanMsg.ok
                  ? <CheckCircle size={14} color="#4ade80" />
                  : <AlertCircle size={14} color="#f87171" />
                }
                <Text style={{ fontSize: 13, color: scanMsg.ok ? '#4ade80' : '#f87171', flex: 1 }}>{scanMsg.msg}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
