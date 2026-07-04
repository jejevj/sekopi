import {
  Undo2, Search, X, Plus,
  RefreshCw, CheckCircle, AlertTriangle, Truck, AlertCircle,
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LoadingForReturn {
  id: number;
  nomor_loading: string;
  gerobak_nama: string;
  total_unit: number;
  status: string;
}
interface ReturnItemInput {
  barcode: string;
  kategori: 'sisa' | 'rusak';
  catatan_driver?: string;
  // error message dari backend setelah submit gagal
  error?: string;
}
interface ReturnItemResp {
  id: number;
  barcode: string;
  mo_id: number;
  kategori: string;
  kondisi_konfirmasi: string;
  catatan_driver?: string;
  catatan_reviewer?: string;
}
interface LoadingOrderSnap {
  id: number;
  nomor_loading: string;
}
interface ReturnOrder {
  id: number;
  nomor_return: string;
  driver_id: number;
  loading_order_id: number;
  loading_order: LoadingOrderSnap | null;
  status: string;
  catatan_driver?: string;
  created_at: string;
  items: ReturnItemResp[];
  total_sisa: number;
  total_rusak: number;
}

// ── CSS tokens ─────────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, padding: 20,
};
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const lbl: React.CSSProperties = {
  color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4,
  display: 'block', letterSpacing: 0.5,
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: '#141414', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  backgroundColor: '#f44444', border: 'none', borderRadius: 10,
  padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af' },
  submitted: { background: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)',   color: '#60a5fa' },
  reviewed:  { background: 'rgba(34,197,94,0.12)',   border: '1px solid rgba(34,197,94,0.3)',    color: '#4ade80' },
};

type Tab = 'buat' | 'log';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const colors: Record<string, string> = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  const color = colors[type] ?? '#3b82f6';
  React.useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, backgroundColor: '#1a1a1a', border: `1px solid ${color}50`, borderRadius: 10, padding: '12px 18px', minWidth: 260, maxWidth: 420, display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ width: 3, borderRadius: 99, backgroundColor: color, alignSelf: 'stretch', flexShrink: 0 }} />
      <p style={{ color: 'white', fontSize: 13, margin: 0, flex: 1, lineHeight: 1.5 }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: 0 }}>×</button>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
      <p style={{ color: '#555', fontSize: 12, margin: '0 0 4px' }}>{label}</p>
      <p style={{ color, fontSize: 24, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

// Parse error string dari backend: "Validasi gagal: msg1 | msg2 | msg3"
// Return: map barcode → pesan error
function parseBarcode(msg: string): string | null {
  // Coba ekstrak barcode dari pola umum: "Barcode XXXXX ..."
  const m = msg.match(/Barcode\s+(\S+)/);
  return m ? m[1] : null;
}
function parseValidationErrors(detail: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!detail) return map;
  const raw = detail.replace(/^Validasi gagal:\s*/i, '');
  const parts = raw.split(' | ');
  for (const part of parts) {
    const bc = parseBarcode(part);
    if (bc) map[bc] = part;
  }
  return map;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'buat', label: 'Buat Return' },
  { key: 'log',  label: 'Riwayat Return' },
];

export default function ReturnPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('buat');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type });

  // ── BUAT RETURN state ──
  const [selectedLoading, setSelectedLoading] = useState<LoadingForReturn | null>(null);
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<ReturnItemInput[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [kategoriInput, setKategoriInput] = useState<'sisa' | 'rusak'>('sisa');
  const [catatanItemInput, setCatatanItemInput] = useState('');

  // ── Log state ──
  const [searchLog, setSearchLog] = useState('');
  const [detailModal, setDetailModal] = useState<ReturnOrder | null>(null);

  const hasItemErrors = items.some(i => !!i.error);

  // ── Query: loading order hari ini ──
  const { data: loadingToday = [], isLoading: loadingTodayLoad } = useQuery<LoadingForReturn[]>({
    queryKey: ['my-loading-today'],
    queryFn: () => api.get('/return/my-loading-today').then(r => r.data),
    enabled: tab === 'buat',
  });

  // ── Query: riwayat return ──
  const { data: returnLog = [], isLoading: logLoading, refetch: refetchLog } = useQuery<ReturnOrder[]>({
    queryKey: ['return-log'],
    queryFn: () => api.get('/return/').then(r => r.data),
    enabled: tab === 'log',
  });

  // ── Mutation: buat return order ──
  const createReturn = useMutation({
    mutationFn: () => api.post('/return/', {
      loading_order_id: selectedLoading!.id,
      catatan_driver: catatan || null,
      items,
    }).then(r => r.data),
    onSuccess: (data: ReturnOrder) => {
      showToast(`Return ${data.nomor_return} berhasil dibuat`, 'success');
      resetForm();
      qc.invalidateQueries({ queryKey: ['return-log'] });
      qc.invalidateQueries({ queryKey: ['my-loading-today'] });
    },
    onError: (e: any) => {
      const detail: string = e?.response?.data?.detail ?? 'Gagal membuat return';
      // Parse error per-barcode dan tandai item yang bermasalah
      const errorMap = parseValidationErrors(detail);
      if (Object.keys(errorMap).length > 0) {
        setItems(prev => prev.map(item => ({
          ...item,
          error: errorMap[item.barcode] ?? undefined,
        })));
        showToast(`${Object.keys(errorMap).length} barcode gagal validasi. Hapus item yang bermasalah lalu coba lagi.`, 'error');
      } else {
        showToast(detail, 'error');
      }
    },
  });

  // ── Mutation: submit return order ──
  const submitReturn = useMutation({
    mutationFn: (id: number) => api.post(`/return/${id}/submit`).then(r => r.data),
    onSuccess: () => { showToast('Return berhasil disubmit ke gudang', 'success'); qc.invalidateQueries({ queryKey: ['return-log'] }); },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Gagal submit', 'error'),
  });

  const resetForm = () => {
    setSelectedLoading(null);
    setCatatan(''); setItems([]);
    setBarcodeInput(''); setKategoriInput('sisa'); setCatatanItemInput('');
  };

  const addItem = () => {
    const b = barcodeInput.trim();
    if (!b) return;
    if (items.find(i => i.barcode === b)) { showToast(`Barcode ${b} sudah ada di list`, 'error'); return; }
    setItems(prev => [...prev, { barcode: b, kategori: kategoriInput, catatan_driver: catatanItemInput.trim() || undefined }]);
    setBarcodeInput(''); setCatatanItemInput('');
  };

  const removeItem = (barcode: string) => setItems(prev => prev.filter(i => i.barcode !== barcode));

  // Hapus semua item yang punya error
  const removeErrorItems = () => setItems(prev => prev.filter(i => !i.error));

  const filteredLog = useMemo(() => {
    const q = searchLog.trim().toLowerCase();
    if (!q) return returnLog;
    return returnLog.filter(r =>
      r.nomor_return.toLowerCase().includes(q) ||
      (r.loading_order?.nomor_loading ?? '').toLowerCase().includes(q)
    );
  }, [returnLog, searchLog]);

  const totalSisa  = returnLog.reduce((s, r) => s + r.total_sisa,  0);
  const totalRusak = returnLog.reduce((s, r) => s + r.total_rusak, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Navbar title="Return Gerobak" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Return Gerobak</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>Proses pengembalian cup sisa jualan oleh driver</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '10px 20px', background: 'none', border: 'none',
                borderBottom: active ? '2px solid #f87171' : '2px solid transparent',
                color: active ? '#f87171' : '#555',
                fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB: BUAT RETURN ───────────────────────────────────────────── */}
        {tab === 'buat' && (
          <div style={{ maxWidth: 600 }}>

            {/* Step 1: Pilih Loading Order */}
            <div style={{ ...glassCard, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: selectedLoading ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${selectedLoading ? '#4ade80' : '#f87171'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: selectedLoading ? '#4ade80' : '#f87171' }}>1</div>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Pilih Loading Trip Hari Ini</span>
                {selectedLoading && <CheckCircle size={14} color="#4ade80" />}
              </div>

              {loadingTodayLoad ? (
                <p style={{ color: '#555', fontSize: 13 }}>Memuat loading order...</p>
              ) : loadingToday.length === 0 ? (
                <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ color: '#fbbf24', fontSize: 13, margin: 0 }}>⚠ Tidak ada loading order hari ini yang sudah dispatched.</p>
                  <p style={{ color: '#78716c', fontSize: 12, margin: '4px 0 0' }}>Loading order harus berstatus <strong>dispatched</strong> sebelum bisa dibuat return.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {loadingToday.map(lo => {
                    const selected = selectedLoading?.id === lo.id;
                    return (
                      <button key={lo.id} onClick={() => { setSelectedLoading(selected ? null : lo); setItems(prev => prev.map(i => ({ ...i, error: undefined }))); }} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        background: selected ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
                        border: selected ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Truck size={15} color={selected ? '#f87171' : '#555'} />
                          <div>
                            <p style={{ color: selected ? '#f87171' : 'white', fontWeight: 600, fontSize: 13, margin: 0, fontFamily: 'monospace' }}>{lo.nomor_loading}</p>
                            <p style={{ color: '#666', fontSize: 12, margin: '2px 0 0' }}>{lo.gerobak_nama} • {lo.total_unit} unit dimuat</p>
                          </div>
                        </div>
                        {selected && <CheckCircle size={16} color="#f87171" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Catatan Driver */}
            <div style={{ ...glassCard, marginBottom: 16, opacity: selectedLoading ? 1 : 0.4, pointerEvents: selectedLoading ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#f87171' }}>2</div>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Catatan Pengiriman</span>
              </div>
              <div>
                <label style={lbl}>CATATAN DRIVER (OPSIONAL)</label>
                <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan umum return..." rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            {/* Step 3: Scan Item */}
            <div style={{ ...glassCard, marginBottom: 16, opacity: selectedLoading ? 1 : 0.4, pointerEvents: selectedLoading ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: hasItemErrors ? 'rgba(239,68,68,0.2)' : 'rgba(248,113,113,0.15)', border: `1px solid ${hasItemErrors ? '#ef4444' : '#f87171'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: hasItemErrors ? '#ef4444' : '#f87171' }}>3</div>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Scan Barcode Cup Sisa</span>
                {items.length > 0 && !hasItemErrors && (
                  <span style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{items.length} item</span>
                )}
                {hasItemErrors && (
                  <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                    {items.filter(i => i.error).length} error
                  </span>
                )}
              </div>

              {/* Banner error summary */}
              {hasItemErrors && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} color="#ef4444" />
                    <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                      {items.filter(i => i.error).length} barcode tidak valid — hapus item bermasalah sebelum submit
                    </span>
                  </div>
                  <button onClick={removeErrorItems} style={{ ...btnGhost, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>
                    Hapus Semua Error
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  placeholder="Scan atau ketik barcode..."
                  autoComplete="off"
                  style={{ ...inp, flex: 1, fontFamily: 'monospace' }}
                />
                <select value={kategoriInput} onChange={e => setKategoriInput(e.target.value as 'sisa' | 'rusak')} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
                  <option value="sisa" style={{ background: '#1a1a1a' }}>Sisa</option>
                  <option value="rusak" style={{ background: '#1a1a1a' }}>Rusak</option>
                </select>
                <button onClick={addItem} style={{ ...btnPrimary, flexShrink: 0 }}>
                  <Plus size={14} color="white" /> Add
                </button>
              </div>

              {items.length > 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                  {items.map(item => (
                    <div key={item.barcode}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderBottom: item.error ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        background: item.error ? 'rgba(239,68,68,0.06)' : 'transparent',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          {item.error
                            ? <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                            : <span style={{ width: 13, flexShrink: 0 }} />
                          }
                          <span style={{
                            fontSize: 12, fontFamily: 'monospace',
                            color: item.error ? '#f87171' : '#aaa',
                            textDecoration: item.error ? 'line-through' : 'none',
                          }}>{item.barcode}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, flexShrink: 0,
                            background: item.kategori === 'sisa' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                            color: item.kategori === 'sisa' ? '#60a5fa' : '#f87171',
                            border: `1px solid ${item.kategori === 'sisa' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}>{item.kategori.toUpperCase()}</span>
                        </div>
                        <button onClick={() => removeItem(item.barcode)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, flexShrink: 0, marginLeft: 8 }}>
                          <X size={13} color={item.error ? '#ef4444' : '#f87171'} />
                        </button>
                      </div>
                      {/* Error message inline di bawah row */}
                      {item.error && (
                        <div style={{
                          padding: '4px 12px 8px 35px',
                          background: 'rgba(239,68,68,0.06)',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          <span style={{ color: '#f87171', fontSize: 11 }}>{item.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Belum ada item. Scan barcode cup yang dikembalikan.</p>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={() => createReturn.mutate()}
              disabled={createReturn.isPending || !selectedLoading || items.length === 0 || hasItemErrors}
              style={{
                ...btnPrimary, width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 14,
                opacity: (!selectedLoading || items.length === 0 || hasItemErrors) ? 0.35 : 1,
                cursor: hasItemErrors ? 'not-allowed' : 'pointer',
              }}>
              {createReturn.isPending
                ? 'Menyimpan...'
                : hasItemErrors
                  ? `⚠ Perbaiki ${items.filter(i => i.error).length} item bermasalah dulu`
                  : `Buat Return Order (${items.length} item)`
              }
            </button>
          </div>
        )}

        {/* ── TAB: LOG ──────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Return Order" value={returnLog.length} color="#a855f7" />
              <StatCard label="Cup Sisa" value={totalSisa}  color="#60a5fa" />
              <StatCard label="Cup Rusak" value={totalRusak} color="#f87171" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ position: 'relative', maxWidth: 300, flex: 1 }}>
                <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={searchLog} onChange={e => setSearchLog(e.target.value)} placeholder="Cari nomor return atau loading..." style={{ ...inp, paddingLeft: 30 }} />
              </div>
              <button onClick={() => { setSearchLog(''); refetchLog(); }} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
                <RefreshCw size={12} color="#aaa" /> Refresh
              </button>
            </div>

            {logLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>Memuat...</div>
            ) : filteredLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <Undo2 size={32} color="#2a2a2a" style={{ marginBottom: 12 }} />
                <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>Belum ada return order</p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Nomor Return', 'Loading Trip', 'Status', 'Sisa', 'Rusak', 'Dibuat', ''].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLog.map(ro => {
                      const ss = STATUS_STYLE[ro.status] ?? STATUS_STYLE.draft;
                      return (
                        <tr key={ro.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 14px', color: 'white', fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{ro.nomor_return}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {ro.loading_order ? (
                              <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{ro.loading_order.nomor_loading}</span>
                            ) : (
                              <span style={{ color: '#444', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ ...ss, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{ro.status}</span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#60a5fa', fontWeight: 700 }}>{ro.total_sisa}</td>
                          <td style={{ padding: '12px 14px', color: '#f87171', fontWeight: 700 }}>{ro.total_rusak}</td>
                          <td style={{ padding: '12px 14px', color: '#555', fontSize: 12 }}>
                            {new Date(ro.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setDetailModal(ro)} style={btnGhost}>Detail</button>
                              {ro.status === 'draft' && (
                                <button onClick={() => submitReturn.mutate(ro.id)} disabled={submitReturn.isPending} style={{ ...btnGhost, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>Submit</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Detail Return Order ──────────────────────────────────────── */}
      {detailModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: 0 }}>{detailModal.nomor_return}</p>
                {detailModal.loading_order && (
                  <p style={{ color: '#60a5fa', fontSize: 12, margin: '3px 0 0', fontFamily: 'monospace' }}>
                    ↗ Loading: {detailModal.loading_order.nomor_loading}
                  </p>
                )}
              </div>
              <button onClick={() => setDetailModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ ...(STATUS_STYLE[detailModal.status] ?? STATUS_STYLE.draft), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{detailModal.status}</span>
              <span style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{detailModal.total_sisa} sisa</span>
              <span style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{detailModal.total_rusak} rusak</span>
            </div>

            <p style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Item ({detailModal.items.length})</p>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              {detailModal.items.length === 0 ? (
                <p style={{ padding: '12px 14px', color: '#444', fontSize: 13, margin: 0 }}>Belum ada item.</p>
              ) : detailModal.items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{item.barcode}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                      background: item.kategori === 'sisa' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                      color: item.kategori === 'sisa' ? '#60a5fa' : '#f87171',
                      border: `1px solid ${item.kategori === 'sisa' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>{item.kategori.toUpperCase()}</span>
                    <span style={{ fontSize: 10, color: '#555' }}>{item.kondisi_konfirmasi}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {detailModal.status === 'draft' && (
                <button onClick={() => { submitReturn.mutate(detailModal.id); setDetailModal(null); }} style={{ ...btnPrimary, background: '#22c55e' }}>Submit ke Gudang</button>
              )}
              <button onClick={() => setDetailModal(null)} style={btnGhost}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
