import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../../lib/api';
import { PackageCheck, Plus, Search, ChevronRight, Truck, X, CheckCircle, AlertCircle } from 'lucide-react-native';

interface LoadingOrder {
  id: number;
  nomor_loading: string;
  status: 'draft' | 'confirmed' | 'dispatched' | 'returned';
  gerobak_id: number;
  driver_id: number;
  catatan: string | null;
  items: LoadingItem[];
  created_at: string;
}

interface LoadingItem {
  id: number;
  production_unit_id: number;
  barcode_snapshot: string;
  harga_modal_snapshot: number;
}

interface Gerobak { id: number; nama: string; kode: string; }
interface User    { id: number; full_name: string; role: string; }

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  draft:      { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
  confirmed:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Confirmed' },
  dispatched: { bg: '#dcfce7', text: '#15803d', label: 'Dispatched' },
  returned:   { bg: '#fef3c7', text: '#b45309', label: 'Returned' },
};

const STATUS_NEXT: Record<string, { label: string; status: string }> = {
  draft:      { label: 'Konfirmasi', status: 'confirmed' },
  confirmed:  { label: 'Dispatch',   status: 'dispatched' },
  dispatched: { label: 'Return',     status: 'returned' },
};

export default function LoadingPage() {
  const router = useRouter();
  const [orders, setOrders]     = useState<LoadingOrder[]>([]);
  const [gerobaks, setGerobaks] = useState<Gerobak[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // Modal buat baru
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ gerobak_id: '', driver_id: '', catatan: '' });
  const [saving, setSaving] = useState(false);

  // Modal scan
  const [scanTarget, setScanTarget]   = useState<LoadingOrder | null>(null);
  const [barcode, setBarcode]         = useState('');
  const [scanning, setScanning]       = useState(false);
  const [scanMsg, setScanMsg]         = useState<{ ok: boolean; msg: string } | null>(null);

  // Toast
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
      setOrders(o.data);
      setGerobaks(g.data);
      setUsers(u.data.filter((x: User) => x.role === 'DRIVER' || x.role === 'ADMIN'));
    } catch {
      showToast('Gagal memuat data', false);
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
    } catch {
      showToast('Gagal membuat loading order', false);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(order: LoadingOrder, newStatus: string) {
    try {
      await api.patch(`/loading/${order.id}/status`, { status: newStatus });
      showToast(`Status diubah ke ${newStatus}`);
      fetchAll();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Gagal ubah status', false);
    }
  }

  async function doScan() {
    if (!scanTarget || !barcode.trim()) return;
    setScanning(true);
    setScanMsg(null);
    try {
      await api.post(`/loading/${scanTarget.id}/scan`, { barcode: barcode.trim() });
      setScanMsg({ ok: true, msg: `✓ ${barcode} berhasil ditambahkan` });
      setBarcode('');
      fetchAll();
    } catch (e: any) {
      setScanMsg({ ok: false, msg: e?.response?.data?.detail ?? 'Gagal scan' });
    } finally {
      setScanning(false);
    }
  }

  async function removeItem(orderId: number, itemId: number) {
    try {
      await api.delete(`/loading/${orderId}/items/${itemId}`);
      showToast('Item dihapus');
      fetchAll();
    } catch {
      showToast('Gagal hapus item', false);
    }
  }

  const filtered = orders.filter(o =>
    o.nomor_loading.toLowerCase().includes(search.toLowerCase())
  );

  const gerobakName = (id: number) => gerobaks.find(g => g.id === id)?.nama ?? `#${id}`;
  const driverName  = (id: number) => users.find(u => u.id === id)?.full_name ?? `#${id}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Toast */}
      {toast && (
        <View style={{
          position: 'absolute', top: 20, right: 20, zIndex: 99,
          backgroundColor: toast.ok ? '#16a34a' : '#dc2626',
          paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
        }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{toast.msg}</Text>
        </View>
      )}

      {/* Header */}
      <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PackageCheck size={22} color="#2563eb" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Loading Gerobak</Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
        >
          <Plus size={16} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Buat Loading</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Cari nomor loading..."
            style={{ flex: 1, fontSize: 14, color: '#111827' }}
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2563eb" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PackageCheck size={48} color="#d1d5db" />
          <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 15 }}>Belum ada loading order</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {filtered.map(order => {
            const s = STATUS_COLOR[order.status];
            const next = STATUS_NEXT[order.status];
            return (
              <View key={order.id} style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12, overflow: 'hidden' }}>
                {/* Card Header */}
                <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>{order.nomor_loading}</Text>
                      <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                        <Text style={{ color: s.text, fontSize: 11, fontWeight: '600' }}>{s.label}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>
                      <Truck size={12} color="#9ca3af" /> {gerobakName(order.gerobak_id)} • {driverName(order.driver_id)}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
                      {order.items.length} unit dimuat
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    {/* Tombol scan hanya saat DRAFT */}
                    {order.status === 'draft' && (
                      <Pressable
                        onPress={() => { setScanTarget(order); setBarcode(''); setScanMsg(null); }}
                        style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>Scan</Text>
                      </Pressable>
                    )}
                    {/* Tombol next status */}
                    {next && (
                      <Pressable
                        onPress={() => updateStatus(order, next.status)}
                        style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#15803d', fontSize: 12, fontWeight: '600' }}>{next.label}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Items list */}
                {order.items.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10 }}>
                    {order.items.map(item => (
                      <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{item.barcode_snapshot}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ fontSize: 12, color: '#6b7280' }}>Rp {Number(item.harga_modal_snapshot).toLocaleString('id')}</Text>
                          {order.status === 'draft' && (
                            <Pressable onPress={() => removeItem(order.id, item.id)}>
                              <X size={14} color="#ef4444" />
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

      {/* Modal Buat Loading Order */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 18, width: '100%', maxWidth: 420, padding: 24 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827', marginBottom: 16 }}>Buat Loading Order</Text>

            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Gerobak</Text>
            <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
              {gerobaks.map(g => (
                <Pressable key={g.id} onPress={() => setForm(f => ({ ...f, gerobak_id: String(g.id) }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10,
                    backgroundColor: form.gerobak_id === String(g.id) ? '#eff6ff' : 'white' }}
                >
                  <Text style={{ fontSize: 13, color: '#111827' }}>{g.nama} ({g.kode})</Text>
                  {form.gerobak_id === String(g.id) && <CheckCircle size={16} color="#2563eb" />}
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Driver</Text>
            <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
              {users.map(u => (
                <Pressable key={u.id} onPress={() => setForm(f => ({ ...f, driver_id: String(u.id) }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10,
                    backgroundColor: form.driver_id === String(u.id) ? '#eff6ff' : 'white' }}
                >
                  <Text style={{ fontSize: 13, color: '#111827' }}>{u.full_name} ({u.role})</Text>
                  {form.driver_id === String(u.id) && <CheckCircle size={16} color="#2563eb" />}
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Catatan (opsional)</Text>
            <TextInput
              value={form.catatan} onChangeText={t => setForm(f => ({ ...f, catatan: t }))}
              placeholder="Catatan tambahan..."
              multiline numberOfLines={2}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, fontSize: 13, color: '#111827', marginBottom: 16, textAlignVertical: 'top' }}
            />

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setShowCreate(false)}
                style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' }}
              >
                <Text style={{ color: '#374151', fontSize: 13 }}>Batal</Text>
              </Pressable>
              <Pressable onPress={createOrder} disabled={saving || !form.gerobak_id || !form.driver_id}
                style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: saving ? '#93c5fd' : '#2563eb', opacity: (!form.gerobak_id || !form.driver_id) ? 0.5 : 1 }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{saving ? 'Menyimpan...' : 'Buat'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Scan Barcode */}
      <Modal visible={!!scanTarget} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827' }}>Scan Barcode</Text>
              <Pressable onPress={() => setScanTarget(null)}><X size={20} color="#6b7280" /></Pressable>
            </View>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Loading: <Text style={{ fontWeight: '600', color: '#111827' }}>{scanTarget?.nomor_loading}</Text>
              {' — '}{scanTarget?.items.length ?? 0} unit terscan
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                value={barcode} onChangeText={setBarcode}
                onSubmitEditing={doScan}
                placeholder="Scan atau ketik barcode..."
                autoFocus
                style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'monospace', color: '#111827' }}
              />
              <Pressable onPress={doScan} disabled={scanning || !barcode.trim()}
                style={{ backgroundColor: '#2563eb', paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: !barcode.trim() ? 0.4 : 1 }}
              >
                {scanning
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: 'white', fontWeight: '700' }}>OK</Text>
                }
              </Pressable>
            </View>

            {scanMsg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10,
                backgroundColor: scanMsg.ok ? '#f0fdf4' : '#fef2f2' }}
              >
                {scanMsg.ok
                  ? <CheckCircle size={16} color="#16a34a" />
                  : <AlertCircle size={16} color="#dc2626" />
                }
                <Text style={{ fontSize: 13, color: scanMsg.ok ? '#15803d' : '#dc2626', flex: 1 }}>{scanMsg.msg}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
