import { useRouter } from 'expo-router';
import {
  AlertTriangle, CheckCircle, Package, XCircle,
  RefreshCw, Clock, Scan
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

const STATUS_COLOR: Record<string, string> = {
  ready:             '#3b82f6',
  dispatched:        '#eab308',
  delivered:         '#9333ea',
  sold:              '#22c55e',
  expired:           '#ef4444',
  void:              '#6b7280',
  returned_good:     '#0d9488',
  returned_damaged:  '#ef4444',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProduksiScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'ready' | 'expiry' | 'void'>('ready');
  const [page, setPage] = useState(1);
  const [voidBarcode, setVoidBarcode] = useState('');
  const [voidAlasan, setVoidAlasan] = useState('');

  // ── Query: Unit Ready FEFO ──────────────────────────────────────────────
  const { data: readyData, isLoading: loadingReady, refetch: refetchReady } = useQuery({
    queryKey: ['prod-ready', page],
    queryFn: async () => (await api.get(`/production-units/ready-fefo?page=${page}&per_page=50`)).data,
    enabled: tab === 'ready',
  });

  // ── Query: Expiry Alert ─────────────────────────────────────────────────
  const { data: expiryData, isLoading: loadingExpiry, refetch: refetchExpiry } = useQuery({
    queryKey: ['prod-expiry'],
    queryFn: async () => (await api.get('/production-units/expiry-alerts?days=3')).data,
    enabled: tab === 'expiry',
  });

  // ── Mutation: Void Unit ─────────────────────────────────────────────────
  const voidMutation = useMutation({
    mutationFn: async () =>
      (await api.post('/production-units/scan/void', {
        barcode: voidBarcode.trim(),
        alasan: voidAlasan.trim(),
      })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['prod-ready'] });
      qc.invalidateQueries({ queryKey: ['prod-expiry'] });
      setVoidBarcode('');
      setVoidAlasan('');
      Alert.alert('Berhasil', `Unit ${data.barcode} berhasil di-void.`);
    },
    onError: (err: any) =>
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan'),
  });

  const handleVoid = () => {
    if (!voidBarcode.trim()) return Alert.alert('Error', 'Masukkan barcode unit');
    if (!voidAlasan.trim()) return Alert.alert('Error', 'Masukkan alasan void');
    Alert.alert(
      'Konfirmasi Void',
      `Void unit ${voidBarcode.trim()}?\nAlasan: ${voidAlasan.trim()}`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Void', style: 'destructive', onPress: () => voidMutation.mutate() },
      ]
    );
  };

  const readyItems: any[]  = readyData?.items  ?? [];
  const totalReady: number = readyData?.total  ?? 0;
  const totalPages: number = readyData?.total_pages ?? 1;

  const expiringSoon: any[] = expiryData?.units_expiring_soon ?? [];
  const expired: any[]      = expiryData?.units_expired       ?? [];
  const totalExpiringSoon   = expiryData?.total_akan_expired  ?? 0;
  const totalExpired        = expiryData?.total_sudah_expired ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Produksi" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Manajemen Unit Produksi</h1>
          <p style={{ color: '#555', fontSize: 14, margin: '4px 0 0' }}>Monitor stok unit, expiry, dan void unit rusak</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
          {([
            { key: 'ready',  label: 'Unit Ready',    icon: '📦' },
            { key: 'expiry', label: 'Expiry Alert',  icon: '⚠️' },
            { key: 'void',   label: 'Void Unit',     icon: '🚫' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid #f44444' : '2px solid transparent',
                color: tab === t.key ? '#f44444' : '#666',
                fontWeight: tab === t.key ? 700 : 400,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <span>{t.icon}</span> {t.label}
              {t.key === 'expiry' && totalExpiringSoon + totalExpired > 0 && (
                <span style={{ backgroundColor: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {totalExpiringSoon + totalExpired}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: READY ─────────────────────────────────────────────────── */}
        {tab === 'ready' && (
          <div>
            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Unit Ready" value={totalReady} color="#3b82f6" />
              <StatCard label="Halaman" value={`${page} / ${totalPages}`} color="#888" />
            </div>

            {/* Refresh */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => refetchReady()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', color: '#888', fontSize: 13, cursor: 'pointer' }}
              >
                <RefreshCw size={13} color="#888" /> Refresh
              </button>
            </div>

            {loadingReady ? (
              <LoadingSpinner />
            ) : readyItems.length === 0 ? (
              <EmptyState icon="📦" message="Tidak ada unit ready saat ini" />
            ) : (
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={sectionTitle}>Unit Ready — FEFO Order</p>
                  <span style={{ color: '#555', fontSize: 12 }}>Urut expiry tercepat</span>
                </div>
                {readyItems.map((unit: any) => (
                  <UnitRow key={unit.id} unit={unit} />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <PageBtn label="‹ Prev" disabled={page <= 1} onClick={() => setPage(p => p - 1)} />
                    <span style={{ color: '#555', fontSize: 13, lineHeight: '32px' }}>{page} / {totalPages}</span>
                    <PageBtn label="Next ›" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EXPIRY ────────────────────────────────────────────────── */}
        {tab === 'expiry' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Akan Expired (≤3 hari)" value={totalExpiringSoon} color="#eab308" />
              <StatCard label="Sudah Expired" value={totalExpired} color="#ef4444" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => refetchExpiry()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', color: '#888', fontSize: 13, cursor: 'pointer' }}
              >
                <RefreshCw size={13} color="#888" /> Refresh
              </button>
            </div>

            {loadingExpiry ? (
              <LoadingSpinner />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {expiringSoon.length > 0 && (
                  <div style={glassCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <AlertTriangle size={16} color="#eab308" />
                      <p style={{ ...sectionTitle, color: '#eab308', margin: 0 }}>Akan Expired ({expiringSoon.length})</p>
                    </div>
                    {expiringSoon.map((unit: any) => <UnitRow key={unit.id} unit={unit} />)}
                  </div>
                )}

                {expired.length > 0 && (
                  <div style={{ ...glassCard, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <XCircle size={16} color="#ef4444" />
                      <p style={{ ...sectionTitle, color: '#ef4444', margin: 0 }}>Sudah Expired ({expired.length})</p>
                    </div>
                    {expired.map((unit: any) => <UnitRow key={unit.id} unit={unit} />)}
                  </div>
                )}

                {expiringSoon.length === 0 && expired.length === 0 && (
                  <EmptyState icon="✅" message="Tidak ada unit yang akan atau sudah expired" />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: VOID ──────────────────────────────────────────────────── */}
        {tab === 'void' && (
          <div style={{ maxWidth: 560 }}>
            <div style={glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Scan size={16} color="#f44444" />
                <p style={sectionTitle}>Void Unit Rusak / Tidak Layak</p>
              </div>
              <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>
                Void unit yang rusak, tumpah, atau tidak layak jual. Unit akan ditandai void dan tidak bisa di-dispatch.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <GlassInput
                  label="Barcode Unit *"
                  value={voidBarcode}
                  onChange={setVoidBarcode}
                  placeholder="SKP-20260703-0001"
                />
                <GlassTextarea
                  label="Alasan Void *"
                  value={voidAlasan}
                  onChange={setVoidAlasan}
                  placeholder="Contoh: Cup pecah, kopi tumpah, kedaluwarsa sebelum dispatch"
                />

                <button
                  onClick={handleVoid}
                  disabled={!voidBarcode.trim() || !voidAlasan.trim() || voidMutation.isPending}
                  style={{
                    padding: '12px 0',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    backgroundColor: (!voidBarcode.trim() || !voidAlasan.trim() || voidMutation.isPending)
                      ? '#1a1a1a' : 'rgba(239,68,68,0.15)',
                    color: (!voidBarcode.trim() || !voidAlasan.trim()) ? '#333' : '#ef4444',
                    border: (!voidBarcode.trim() || !voidAlasan.trim()) ? '1px solid #222' : '1px solid rgba(239,68,68,0.4)',
                    cursor: (!voidBarcode.trim() || !voidAlasan.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <XCircle size={16} color={(!voidBarcode.trim() || !voidAlasan.trim()) ? '#333' : '#ef4444'} />
                  {voidMutation.isPending ? 'Memproses...' : 'Void Unit Ini'}
                </button>
              </div>
            </div>

            {/* Info box */}
            <div style={{ marginTop: 16, backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>ℹ️ Tentang Void</p>
              <ul style={{ color: '#555', fontSize: 13, paddingLeft: 16, margin: 0, lineHeight: 1.8 }}>
                <li>Unit yang di-void tidak bisa di-dispatch atau dijual</li>
                <li>Alasan void tercatat permanen di sistem</li>
                <li>Hanya unit berstatus <strong style={{ color: '#888' }}>ready</strong> yang bisa di-void dari sini</li>
                <li>Untuk void unit dispatched, hubungi admin</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function UnitRow({ unit }: { unit: any }) {
  const uColor = STATUS_COLOR[unit.status] ?? '#888';
  const isExpiring = unit.is_expiring_soon && !unit.is_expired;
  const isExpired  = unit.is_expired;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
        <p style={{ color: '#444', fontSize: 12, margin: '2px 0 0' }}>{unit.nama_produk}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#555', fontSize: 12 }}>Expiry: {unit.expiry_date}</span>
          {isExpired  && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>EXPIRED</span>}
          {isExpiring && <span style={{ color: '#eab308', fontSize: 11, fontWeight: 700 }}>⚠ {unit.hari_tersisa}h lagi</span>}
          {unit.harga_modal != null && <span style={{ color: '#333', fontSize: 12 }}>{formatRp(unit.harga_modal)}</span>}
        </div>
      </div>
      <span style={{ backgroundColor: uColor + '22', color: uColor, border: `1px solid ${uColor}44`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {unit.status}
      </span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', minWidth: 140 }}>
      <p style={{ color: '#666', fontSize: 12, margin: '0 0 4px' }}>{label}</p>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color="#f44444" />
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', color: '#444' }}>
      <span style={{ fontSize: 40, marginBottom: 12 }}>{icon}</span>
      <p style={{ color: '#444', fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: disabled ? '#333' : '#888',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{label}</button>
  );
}

function GlassInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '10px 14px',
          color: 'white', fontSize: 14, outline: 'none',
        }}
      />
    </div>
  );
}

function GlassTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
      <textarea
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%', boxSizing: 'border-box',
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '10px 14px',
          color: 'white', fontSize: 14, outline: 'none',
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 0,
};
const sectionTitle: React.CSSProperties = {
  color: 'white', fontWeight: 600, fontSize: 15, margin: '0 0 0'
};
