import {
  Undo2, Package, Scan, Search, X,
  RefreshCw, Info, CheckCircle, AlertTriangle,
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

type Tab = 'scan' | 'log';

const TABS: { key: Tab; label: string; Icon: any; activeColor: string }[] = [
  { key: 'scan', label: 'Scan Return',  Icon: Scan,   activeColor: '#3b82f6' },
  { key: 'log',  label: 'Riwayat Return', Icon: Undo2, activeColor: '#a855f7' },
];

const KONDISI_OPTIONS = [
  { value: 'good',    label: 'Baik — Masuk stok kembali',   color: '#22c55e', Icon: CheckCircle },
  { value: 'damaged', label: 'Rusak — Tidak bisa dijual',   color: '#ef4444', Icon: AlertTriangle },
];

function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 8, padding: '7px 12px', marginBottom: 14,
    }}>
      <Search size={13} color="#444" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        type="text" value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Cari barcode atau nama produk...'}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 13, minWidth: 0 }}
      />
      {value.length > 0 && (
        <button onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
          <X size={13} color="#444" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default function ReturnScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('scan');

  // Scan Return state
  const [barcode, setBarcode] = useState('');
  const [kondisi, setKondisi] = useState<'good' | 'damaged'>('good');
  const [catatan, setCatatan] = useState('');

  // Log state
  const [searchLog, setSearchLog] = useState('');

  // Fetch riwayat returned units
  const { data: logData, isLoading: loadingLog, refetch: refetchLog } = useQuery({
    queryKey: ['return-log'],
    queryFn: async () => (await api.get('/production-units/returned')).data,
    enabled: tab === 'log',
  });

  const returnMutation = useMutation({
    mutationFn: async () =>
      (await api.post('/production-units/scan/return', {
        barcode: barcode.trim(),
        kondisi,
        catatan: catatan.trim() || undefined,
      })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['return-log'] });
      qc.invalidateQueries({ queryKey: ['prod-ready'] });
      const statusLabel = kondisi === 'good' ? 'returned_good' : 'returned_damaged';
      Alert.alert(
        'Return Berhasil',
        `Unit ${data.barcode} berhasil di-return.\nStatus: ${statusLabel}`,
      );
      setBarcode('');
      setCatatan('');
      setKondisi('good');
    },
    onError: (err: any) =>
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan'),
  });

  const handleReturn = () => {
    if (!barcode.trim()) return Alert.alert('Error', 'Masukkan barcode unit');
    Alert.alert(
      'Konfirmasi Return',
      `Return unit ${barcode.trim()}?\nKondisi: ${kondisi === 'good' ? 'Baik' : 'Rusak'}`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Return', onPress: () => returnMutation.mutate() },
      ]
    );
  };

  const logItems: any[] = logData?.items ?? logData ?? [];

  const filteredLog = useMemo(() => {
    const q = searchLog.trim().toLowerCase();
    if (!q) return logItems;
    return logItems.filter((u: any) =>
      u.barcode?.toLowerCase().includes(q) ||
      u.nama_produk?.toLowerCase().includes(q)
    );
  }, [logItems, searchLog]);

  const totalGood    = logItems.filter((u: any) => u.status === 'returned_good').length;
  const totalDamaged = logItems.filter((u: any) => u.status === 'returned_damaged').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Return" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Return Unit</h1>
          <p style={{ color: '#555', fontSize: 14, margin: '4px 0 0' }}>Proses return driver dan monitor unit yang kembali ke gudang</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key}
                onClick={() => { setTab(t.key); setSearchLog(''); }}
                style={{
                  padding: '10px 20px', background: 'none', border: 'none',
                  borderBottom: active ? `2px solid ${t.activeColor}` : '2px solid transparent',
                  color: active ? t.activeColor : '#555',
                  fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7, transition: 'color 0.15s',
                }}
              >
                <t.Icon size={14} color={active ? t.activeColor : '#555'} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB: SCAN RETURN ─────────────────────────────────────────── */}
        {tab === 'scan' && (
          <div style={{ maxWidth: 560 }}>
            <div style={glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Scan size={14} color="#3b82f6" strokeWidth={2} />
                <p style={sectionTitle}>Scan Unit Return dari Driver</p>
              </div>
              <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>
                Scan barcode unit yang dikembalikan driver. Pilih kondisi unit sebelum submit.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Barcode input */}
                <div>
                  <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>Barcode Unit *</label>
                  <input
                    type="text" value={barcode}
                    onChange={(e: any) => setBarcode(e.target.value)}
                    placeholder="SKP-20260703-0001"
                    onKeyDown={(e: any) => e.key === 'Enter' && handleReturn()}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '10px 14px',
                      color: 'white', fontSize: 14, outline: 'none',
                    }}
                  />
                  <p style={{ color: '#333', fontSize: 12, margin: '4px 0 0' }}>Tekan Enter untuk langsung submit</p>
                </div>

                {/* Kondisi selector */}
                <div>
                  <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 8 }}>Kondisi Unit *</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {KONDISI_OPTIONS.map(opt => {
                      const selected = kondisi === opt.value;
                      return (
                        <button key={opt.value}
                          onClick={() => setKondisi(opt.value as any)}
                          style={{
                            flex: 1, padding: '10px 12px', borderRadius: 10,
                            backgroundColor: selected ? `${opt.color}14` : 'rgba(255,255,255,0.03)',
                            border: selected ? `1px solid ${opt.color}50` : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.15s',
                          }}
                        >
                          <opt.Icon size={14} color={selected ? opt.color : '#444'} strokeWidth={2} />
                          <span style={{ color: selected ? opt.color : '#555', fontSize: 12, fontWeight: selected ? 600 : 400, textAlign: 'left' }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Catatan optional */}
                <div>
                  <label style={{ color: '#666', fontSize: 13, display: 'block', marginBottom: 6 }}>Catatan <span style={{ color: '#333' }}>(opsional)</span></label>
                  <textarea
                    value={catatan}
                    onChange={(e: any) => setCatatan(e.target.value)}
                    placeholder="Contoh: Cup penyok, segel rusak, dll"
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '10px 14px',
                      color: 'white', fontSize: 13, outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Submit button */}
                <button
                  onClick={handleReturn}
                  disabled={!barcode.trim() || returnMutation.isPending}
                  style={{
                    padding: '11px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    backgroundColor: !barcode.trim() ? '#111' : 'rgba(59,130,246,0.12)',
                    color: !barcode.trim() ? '#2a2a2a' : '#3b82f6',
                    border: !barcode.trim() ? '1px solid #1f1f1f' : '1px solid rgba(59,130,246,0.35)',
                    cursor: !barcode.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Undo2 size={14} color={!barcode.trim() ? '#2a2a2a' : '#3b82f6'} strokeWidth={2} />
                  {returnMutation.isPending ? 'Memproses...' : 'Proses Return'}
                </button>
              </div>
            </div>

            {/* Info box */}
            <div style={{ marginTop: 14, backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Info size={13} color="#3b82f6" strokeWidth={2} />
                <p style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600, margin: 0 }}>Tentang Return</p>
              </div>
              <ul style={{ color: '#555', fontSize: 13, paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
                <li>Hanya unit berstatus <strong style={{ color: '#777' }}>dispatched</strong> yang bisa di-return dari sini</li>
                <li>Kondisi <strong style={{ color: '#22c55e' }}>Baik</strong> → unit kembali ke stok siap jual (<code style={{ color: '#777' }}>returned_good</code>)</li>
                <li>Kondisi <strong style={{ color: '#ef4444' }}>Rusak</strong> → unit tidak bisa dijual lagi (<code style={{ color: '#777' }}>returned_damaged</code>)</li>
                <li>Return driver dari app driver akan otomatis masuk ke riwayat ini</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── TAB: LOG RETURN ──────────────────────────────────────────── */}
        {tab === 'log' && (
          <div>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Returned" value={logItems.length} color="#a855f7" />
              <StatCard label="Kondisi Baik"   value={totalGood}       color="#22c55e" />
              <StatCard label="Kondisi Rusak"  value={totalDamaged}    color="#ef4444" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => { setSearchLog(''); refetchLog(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 12px', color: '#555', fontSize: 12, cursor: 'pointer' }}
              >
                <RefreshCw size={12} color="#555" strokeWidth={2} /> Refresh
              </button>
            </div>

            {loadingLog ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color="#a855f7" />
              </div>
            ) : logItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
                <Undo2 size={32} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
                <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>Belum ada unit yang di-return</p>
              </div>
            ) : (
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={sectionTitle}>Riwayat Return</p>
                  <span style={{ color: '#444', fontSize: 12 }}>Urut terbaru</span>
                </div>

                <SearchBar value={searchLog} onChange={setSearchLog} />

                {searchLog.trim() && (
                  <p style={{ color: '#444', fontSize: 12, margin: '0 0 10px' }}>
                    {filteredLog.length} hasil dari {logItems.length} unit
                  </p>
                )}

                {filteredLog.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
                    Tidak ada unit yang cocok dengan “{searchLog}”
                  </div>
                ) : (
                  filteredLog.map((unit: any) => <ReturnRow key={unit.id} unit={unit} />)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReturnRow({ unit }: { unit: any }) {
  const isGood = unit.status === 'returned_good';
  const statusColor = isGood ? '#22c55e' : '#ef4444';
  const statusLabel = isGood ? 'returned_good' : 'returned_damaged';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
        <p style={{ color: '#444', fontSize: 12, margin: '2px 0 0' }}>{unit.nama_produk}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          {unit.return_at && (
            <span style={{ color: '#333', fontSize: 12 }}>
              {new Date(unit.return_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {unit.catatan && <span style={{ color: '#333', fontSize: 12, fontStyle: 'italic' }}>“{unit.catatan}”</span>}
        </div>
      </div>
      <span style={{ backgroundColor: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}33`, borderRadius: 5, padding: '2px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 12, flexShrink: 0 }}>
        {statusLabel}
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

const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: 20,
};
const sectionTitle: React.CSSProperties = {
  color: 'white', fontWeight: 600, fontSize: 14, margin: 0,
};
