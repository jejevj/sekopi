import { useRouter } from 'expo-router';
import {
  AlertTriangle, Package, XCircle,
  RefreshCw, Scan, Ban, Info, Search, X,
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
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

type Tab = 'ready' | 'expiry' | 'void';

const TABS: { key: Tab; label: string; Icon: any; activeColor: string }[] = [
  { key: 'ready',  label: 'Unit Ready',   Icon: Package,       activeColor: '#3b82f6' },
  { key: 'expiry', label: 'Expiry Alert', Icon: AlertTriangle, activeColor: '#eab308' },
  { key: 'void',   label: 'Void Unit',    Icon: Ban,           activeColor: '#ef4444' },
];

// Reusable inline search bar component
function SearchBar({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 8,
      padding: '7px 12px',
      marginBottom: 14,
    }}>
      <Search size={13} color="#444" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Cari barcode atau nama produk...'}
        style={{
          flex: 1, background: 'none', border: 'none',
          outline: 'none', color: 'white', fontSize: 13, minWidth: 0,
        }}
      />
      {value.length > 0 && (
        <button
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <X size={13} color="#444" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default function ProduksiScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('ready');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchExpiry, setSearchExpiry] = useState('');
  const [voidBarcode, setVoidBarcode] = useState('');
  const [voidAlasan, setVoidAlasan] = useState('');

  const { data: readyData, isLoading: loadingReady, refetch: refetchReady } = useQuery({
    queryKey: ['prod-ready', page],
    queryFn: async () => (await api.get(`/production-units/ready-fefo?page=${page}&per_page=50`)).data,
    enabled: tab === 'ready',
  });

  const { data: expiryData, isLoading: loadingExpiry, refetch: refetchExpiry } = useQuery({
    queryKey: ['prod-expiry'],
    queryFn: async () => (await api.get('/production-units/expiry-alerts?days=3')).data,
    enabled: tab === 'expiry',
  });

  const { data: expiryBadge } = useQuery({
    queryKey: ['prod-expiry-badge'],
    queryFn: async () => (await api.get('/production-units/expiry-alerts?days=3')).data,
    staleTime: 60_000,
  });

  const voidMutation = useMutation({
    mutationFn: async () =>
      (await api.post('/production-units/scan/void', {
        barcode: voidBarcode.trim(),
        alasan: voidAlasan.trim(),
      })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['prod-ready'] });
      qc.invalidateQueries({ queryKey: ['prod-expiry'] });
      qc.invalidateQueries({ queryKey: ['prod-expiry-badge'] });
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

  const filteredReady = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return readyItems;
    return readyItems.filter((u: any) =>
      u.barcode.toLowerCase().includes(q) || u.nama_produk.toLowerCase().includes(q)
    );
  }, [readyItems, search]);

  const expiringSoon: any[] = expiryData?.units_expiring_soon ?? [];
  const expired: any[]      = expiryData?.units_expired       ?? [];
  const totalExpiringSoon   = expiryData?.total_akan_expired  ?? 0;
  const totalExpired        = expiryData?.total_sudah_expired ?? 0;

  // filter expiry — single search covers both cards
  const filteredExpiringSoon = useMemo(() => {
    const q = searchExpiry.trim().toLowerCase();
    if (!q) return expiringSoon;
    return expiringSoon.filter((u: any) =>
      u.barcode.toLowerCase().includes(q) || u.nama_produk.toLowerCase().includes(q)
    );
  }, [expiringSoon, searchExpiry]);

  const filteredExpired = useMemo(() => {
    const q = searchExpiry.trim().toLowerCase();
    if (!q) return expired;
    return expired.filter((u: any) =>
      u.barcode.toLowerCase().includes(q) || u.nama_produk.toLowerCase().includes(q)
    );
  }, [expired, searchExpiry]);

  const totalExpiryAll   = expiringSoon.length + expired.length;
  const totalExpiryFiltered = filteredExpiringSoon.length + filteredExpired.length;

  const badgeCount =
    (expiryBadge?.total_akan_expired ?? 0) +
    (expiryBadge?.total_sudah_expired ?? 0);

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
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const showBadge = t.key === 'expiry' && badgeCount > 0;
            const iconColor = active ? t.activeColor : '#555';
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPage(1); setSearch(''); setSearchExpiry(''); }}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `2px solid ${t.activeColor}` : '2px solid transparent',
                  color: active ? t.activeColor : '#555',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'color 0.15s',
                }}
              >
                <t.Icon size={14} color={iconColor} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
                {showBadge && (
                  <span style={{
                    backgroundColor: 'rgba(234,179,8,0.15)',
                    color: '#eab308',
                    border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: 99,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: '16px',
                  }}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB: READY ─────────────────────────────────────────────── */}
        {tab === 'ready' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Unit Ready" value={totalReady} color="#3b82f6" />
              <StatCard label="Halaman" value={`${page} / ${totalPages}`} color="#666" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <RefreshBtn onClick={() => { setSearch(''); refetchReady(); }} />
            </div>
            {loadingReady ? (
              <LoadingSpinner />
            ) : readyItems.length === 0 ? (
              <EmptyState Icon={Package} message="Tidak ada unit ready saat ini" />
            ) : (
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={sectionTitle}>Unit Ready — FEFO Order</p>
                  <span style={{ color: '#444', fontSize: 12 }}>Urut expiry tercepat</span>
                </div>
                <SearchBar value={search} onChange={setSearch} />
                {search.trim() && (
                  <p style={{ color: '#444', fontSize: 12, margin: '0 0 10px' }}>
                    {filteredReady.length} hasil dari {readyItems.length} unit
                  </p>
                )}
                {filteredReady.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
                    Tidak ada unit yang cocok dengan “{search}”
                  </div>
                ) : (
                  filteredReady.map((unit: any) => <UnitRow key={unit.id} unit={unit} />)
                )}
                {!search.trim() && totalPages > 1 && (
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

        {/* ── TAB: EXPIRY ────────────────────────────────────────────── */}
        {tab === 'expiry' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Akan Expired (≤3 hari)" value={totalExpiringSoon} color="#eab308" />
              <StatCard label="Sudah Expired" value={totalExpired} color="#ef4444" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <RefreshBtn onClick={() => { setSearchExpiry(''); refetchExpiry(); }} />
            </div>
            {loadingExpiry ? (
              <LoadingSpinner />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Search bar — satu bar untuk kedua card */}
                {(expiringSoon.length > 0 || expired.length > 0) && (
                  <div style={glassCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Search size={13} color="#eab308" strokeWidth={2} />
                      <p style={{ ...sectionTitle, color: '#eab308', margin: 0, fontSize: 13 }}>Filter Expiry Alert</p>
                    </div>
                    <SearchBar
                      value={searchExpiry}
                      onChange={setSearchExpiry}
                      placeholder="Cari barcode atau nama produk..."
                    />
                    {searchExpiry.trim() && (
                      <p style={{ color: '#444', fontSize: 12, margin: '-6px 0 0' }}>
                        {totalExpiryFiltered} hasil dari {totalExpiryAll} unit
                      </p>
                    )}
                  </div>
                )}

                {/* Card: Akan Expired */}
                {expiringSoon.length > 0 && (
                  <div style={glassCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <AlertTriangle size={14} color="#eab308" strokeWidth={2} />
                      <p style={{ ...sectionTitle, color: '#eab308', margin: 0 }}>
                        Akan Expired ({searchExpiry.trim() ? `${filteredExpiringSoon.length}/` : ''}{expiringSoon.length})
                      </p>
                    </div>
                    {filteredExpiringSoon.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: '#333', fontSize: 13 }}>
                        Tidak ada unit yang cocok dengan “{searchExpiry}”
                      </div>
                    ) : (
                      filteredExpiringSoon.map((unit: any) => <UnitRow key={unit.id} unit={unit} />)
                    )}
                  </div>
                )}

                {/* Card: Sudah Expired */}
                {expired.length > 0 && (
                  <div style={{ ...glassCard, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <XCircle size={14} color="#ef4444" strokeWidth={2} />
                      <p style={{ ...sectionTitle, color: '#ef4444', margin: 0 }}>
                        Sudah Expired ({searchExpiry.trim() ? `${filteredExpired.length}/` : ''}{expired.length})
                      </p>
                    </div>
                    {filteredExpired.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: '#333', fontSize: 13 }}>
                        Tidak ada unit yang cocok dengan “{searchExpiry}”
                      </div>
                    ) : (
                      filteredExpired.map((unit: any) => <UnitRow key={unit.id} unit={unit} />)
                    )}
                  </div>
                )}

                {expiringSoon.length === 0 && expired.length === 0 && (
                  <EmptyState Icon={AlertTriangle} message="Tidak ada unit yang akan atau sudah expired" />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: VOID ──────────────────────────────────────────────── */}
        {tab === 'void' && (
          <div style={{ maxWidth: 560 }}>
            <div style={glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Scan size={14} color="#ef4444" strokeWidth={2} />
                <p style={sectionTitle}>Void Unit Rusak / Tidak Layak</p>
              </div>
              <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>
                Void unit yang rusak, tumpah, atau tidak layak jual. Unit akan ditandai void dan tidak bisa di-dispatch.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <GlassInput label="Barcode Unit *" value={voidBarcode} onChange={setVoidBarcode} placeholder="SKP-20260703-0001" />
                <GlassTextarea label="Alasan Void *" value={voidAlasan} onChange={setVoidAlasan} placeholder="Contoh: Cup pecah, kopi tumpah, kedaluwarsa sebelum dispatch" />
                <button
                  onClick={handleVoid}
                  disabled={!voidBarcode.trim() || !voidAlasan.trim() || voidMutation.isPending}
                  style={{
                    padding: '11px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    backgroundColor: (!voidBarcode.trim() || !voidAlasan.trim() || voidMutation.isPending) ? '#111' : 'rgba(239,68,68,0.12)',
                    color: (!voidBarcode.trim() || !voidAlasan.trim()) ? '#2a2a2a' : '#ef4444',
                    border: (!voidBarcode.trim() || !voidAlasan.trim()) ? '1px solid #1f1f1f' : '1px solid rgba(239,68,68,0.35)',
                    cursor: (!voidBarcode.trim() || !voidAlasan.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Ban size={14} color={(!voidBarcode.trim() || !voidAlasan.trim()) ? '#2a2a2a' : '#ef4444'} strokeWidth={2} />
                  {voidMutation.isPending ? 'Memproses...' : 'Void Unit Ini'}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 14, backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Info size={13} color="#3b82f6" strokeWidth={2} />
                <p style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600, margin: 0 }}>Tentang Void</p>
              </div>
              <ul style={{ color: '#555', fontSize: 13, paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                <li>Unit yang di-void tidak bisa di-dispatch atau dijual</li>
                <li>Alasan void tercatat permanen di sistem</li>
                <li>Hanya unit berstatus <strong style={{ color: '#777' }}>ready</strong> yang bisa di-void dari sini</li>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
        <p style={{ color: '#444', fontSize: 12, margin: '2px 0 0' }}>{unit.nama_produk}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#444', fontSize: 12 }}>Expiry: {unit.expiry_date}</span>
          {isExpired  && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em' }}>EXPIRED</span>}
          {isExpiring && <span style={{ color: '#eab308', fontSize: 11, fontWeight: 600 }}>{unit.hari_tersisa}h lagi</span>}
          {unit.harga_modal != null && <span style={{ color: '#333', fontSize: 12 }}>{'Rp ' + unit.harga_modal.toLocaleString('id-ID')}</span>}
        </div>
      </div>
      <span style={{ backgroundColor: uColor + '18', color: uColor, border: `1px solid ${uColor}33`, borderRadius: 5, padding: '2px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {unit.status}
      </span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 4px' }}>{label}</p>
      <p style={{ color, fontSize: 24, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  );
}

function RefreshBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 12px', color: '#555', fontSize: 12, cursor: 'pointer' }}
    >
      <RefreshCw size={12} color="#555" strokeWidth={2} /> Refresh
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </div>
  );
}

function EmptyState({ Icon, message }: { Icon: any; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <Icon size={32} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: disabled ? '#2a2a2a' : '#666',
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
      <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
      <input type="text" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none' }}
      />
    </div>
  );
}

function GlassTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
      <textarea value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  );
}

const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: 20,
};
const sectionTitle: React.CSSProperties = {
  color: 'white', fontWeight: 600, fontSize: 14, margin: 0,
};
