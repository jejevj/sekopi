import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { PackageCheck, Plus, X, Truck, CheckCircle, AlertCircle, Search } from 'lucide-react-native';

// ── Styles (web CSS-in-JS, sesuai pola halaman lain) ──────────────────────
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modalBox: React.CSSProperties = { background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' };

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:      { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af' },
  confirmed:  { background: 'rgba(59,130,246,0.12)',  border: '1px solid rgba(59,130,246,0.3)',   color: '#60a5fa' },
  dispatched: { background: 'rgba(34,197,94,0.12)',   border: '1px solid rgba(34,197,94,0.3)',    color: '#4ade80' },
  returned:   { background: 'rgba(251,191,36,0.12)',  border: '1px solid rgba(251,191,36,0.3)',   color: '#fbbf24' },
};
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', confirmed: 'Confirmed', dispatched: 'Dispatched', returned: 'Returned' };
const STATUS_NEXT: Record<string, { label: string; status: string }> = {
  draft:      { label: 'Konfirmasi',  status: 'confirmed' },
  confirmed:  { label: 'Dispatch',    status: 'dispatched' },
  dispatched: { label: 'Return',      status: 'returned' },
};

// ── Types ──────────────────────────────────────────────────────────────────
interface GerobakSnap { id: number; nama: string; }
interface UserSnap    { id: number; full_name: string; }
interface LoadingItem { id: number; production_unit_id: number; barcode_snapshot: string; harga_modal_snapshot: number; }
interface LoadingOrder {
  id: number; nomor_loading: string;
  status: 'draft' | 'confirmed' | 'dispatched' | 'returned';
  gerobak: GerobakSnap; driver: UserSnap; pembuat: UserSnap;
  catatan: string | null; items: LoadingItem[];
  total_unit: number; created_at: string; updated_at: string;
}
interface Gerobak { id: number; nama: string; kode: string; }
interface User    { id: number; full_name: string; role: string; }

export default function LoadingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  // ── Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ gerobak_id: '', driver_id: '', catatan: '' });
  const [formError, setFormError] = useState('');

  // ── Scan modal
  const [scanTarget, setScanTarget] = useState<LoadingOrder | null>(null);
  const [barcode, setBarcode] = useState('');
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Queries
  const { data: rawOrders, isLoading } = useQuery<LoadingOrder[]>({
    queryKey: ['loading-orders'],
    queryFn: () => api.get('/loading/').then(r => r.data),
  });
  const { data: rawGerobak } = useQuery<Gerobak[]>({
    queryKey: ['gerobak'],
    queryFn: () => api.get('/gerobak/').then(r => r.data),
  });
  const { data: rawUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then(r => r.data),
  });

  const orders:   LoadingOrder[] = Array.isArray(rawOrders)  ? rawOrders  : [];
  const gerobaks: Gerobak[]      = Array.isArray(rawGerobak) ? rawGerobak : [];
  const drivers:  User[]         = Array.isArray(rawUsers)
    ? rawUsers.filter((u: User) => u.role === 'DRIVER' || u.role === 'driver' || u.role === 'ADMIN' || u.role === 'admin')
    : [];

  // ── Mutations
  const createOrder = useMutation({
    mutationFn: (p: any) => api.post('/loading/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loading-orders'] }); resetCreate(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal membuat loading order'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/loading/${id}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loading-orders'] }),
  });

  const scanItem = useMutation({
    mutationFn: ({ id, barcode }: { id: number; barcode: string }) =>
      api.post(`/loading/${id}/scan`, { barcode }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loading-orders'] });
      setScanMsg({ ok: true, msg: `✓ ${barcode} berhasil ditambahkan` });
      setBarcode('');
    },
    onError: (e: any) => setScanMsg({ ok: false, msg: e.response?.data?.detail ?? 'Gagal scan' }),
  });

  const removeItem = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: number; itemId: number }) =>
      api.delete(`/loading/${orderId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loading-orders'] }),
  });

  const resetCreate = () => { setShowCreate(false); setForm({ gerobak_id: '', driver_id: '', catatan: '' }); setFormError(''); };
  const openScan = (order: LoadingOrder) => { setScanTarget(order); setBarcode(''); setScanMsg(null); };

  const submitCreate = () => {
    if (!form.gerobak_id || !form.driver_id) { setFormError('Gerobak dan driver wajib dipilih'); return; }
    createOrder.mutate({
      gerobak_id: parseInt(form.gerobak_id),
      driver_id:  parseInt(form.driver_id),
      catatan:    form.catatan || null,
    });
  };

  const filtered = orders.filter(o =>
    o.nomor_loading.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Loading Gerobak" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Loading Gerobak</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{orders.length} loading order</p>
          </div>
          <button onClick={() => { resetCreate(); setShowCreate(true); }} style={btnPrimary}>
            <Plus size={14} color="white" /> Buat Loading
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
          <Search size={14} color="#555" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor loading..."
            style={{ ...inp, paddingLeft: 34 }}
          />
        </div>

        {/* Table */}
        <div style={card}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ marginBottom: 12, opacity: 0.2 }}><PackageCheck size={36} color="white" /></div>
              <div style={{ color: '#444', marginBottom: 16 }}>Belum ada loading order</div>
              <button onClick={() => { resetCreate(); setShowCreate(true); }} style={btnPrimary}>
                <Plus size={14} color="white" /> Buat Loading Pertama
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nomor', 'Status', 'Gerobak', 'Driver', 'Unit', 'Dibuat', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const ss = STATUS_STYLE[order.status] ?? STATUS_STYLE.draft;
                  const next = STATUS_NEXT[order.status];
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(244,68,68,0.08)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Truck size={13} color="#f87171" />
                          </div>
                          <span style={{ color: 'white', fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>{order.nomor_loading}</span>
                        </div>
                      </td>

                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ ...ss, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </td>

                      <td style={{ padding: '13px 16px', color: '#aaa', fontSize: 13 }}>{order.gerobak.nama}</td>
                      <td style={{ padding: '13px 16px', color: '#aaa', fontSize: 13 }}>{order.driver.full_name}</td>

                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ color: '#aaa', fontSize: 13 }}>{order.total_unit} unit</span>
                      </td>

                      <td style={{ padding: '13px 16px', color: '#555', fontSize: 12 }}>
                        {new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {order.status === 'draft' && (
                            <button onClick={() => openScan(order)} style={{ ...btnGhost, color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}>
                              Scan
                            </button>
                          )}
                          {next && (
                            <button
                              onClick={() => updateStatus.mutate({ id: order.id, status: next.status })}
                              disabled={updateStatus.isPending}
                              style={{ ...btnGhost, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
                              {next.label}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal: Buat Loading Order ────────────────────────────────────── */}
      {showCreate && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Buat Loading Order</span>
              <button onClick={resetCreate} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={17} color="#555" />
              </button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>GEROBAK *</label>
                <select value={form.gerobak_id} onChange={e => setForm({ ...form, gerobak_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Pilih gerobak —</option>
                  {gerobaks.map(g => <option key={g.id} value={g.id} style={{ background: '#1a1a1a' }}>{g.nama} ({g.kode})</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>DRIVER *</label>
                <select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Pilih driver —</option>
                  {drivers.map(u => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name} ({u.role})</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>CATATAN</label>
                <textarea
                  value={form.catatan}
                  onChange={e => setForm({ ...form, catatan: e.target.value })}
                  placeholder="Opsional..."
                  rows={3}
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetCreate} style={btnGhost}>Batal</button>
              <button
                onClick={submitCreate}
                disabled={createOrder.isPending || !form.gerobak_id || !form.driver_id}
                style={{ ...btnPrimary, opacity: (!form.gerobak_id || !form.driver_id) ? 0.4 : 1 }}>
                {createOrder.isPending ? 'Menyimpan...' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Scan Barcode ──────────────────────────────────────────── */}
      {scanTarget && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Scan Barcode</span>
              <button onClick={() => setScanTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={17} color="#555" />
              </button>
            </div>

            <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>
              <span style={{ color: '#aaa', fontFamily: 'monospace' }}>{scanTarget.nomor_loading}</span>
              &nbsp;—&nbsp;{scanTarget.total_unit} unit terscan
            </p>

            {/* Items terscan */}
            {scanTarget && (() => {
              const live = orders.find(o => o.id === scanTarget.id);
              const items = live?.items ?? scanTarget.items;
              return items.length > 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{item.barcode_snapshot}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 12, color: '#555' }}>Rp {Number(item.harga_modal_snapshot).toLocaleString('id')}</span>
                        {scanTarget.status === 'draft' && (
                          <button
                            onClick={() => removeItem.mutate({ orderId: scanTarget.id, itemId: item.id })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                            <X size={12} color="#f87171" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Input barcode */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && barcode.trim() && scanItem.mutate({ id: scanTarget.id, barcode: barcode.trim() })}
                placeholder="Scan atau ketik barcode..."
                autoFocus
                style={{ ...inp, flex: 1, fontFamily: 'monospace' }}
              />
              <button
                onClick={() => barcode.trim() && scanItem.mutate({ id: scanTarget.id, barcode: barcode.trim() })}
                disabled={scanItem.isPending || !barcode.trim()}
                style={{ ...btnPrimary, opacity: !barcode.trim() ? 0.4 : 1 }}>
                {scanItem.isPending ? '...' : 'OK'}
              </button>
            </div>

            {scanMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: scanMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${scanMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                {scanMsg.ok
                  ? <CheckCircle size={14} color="#4ade80" />
                  : <AlertCircle size={14} color="#f87171" />}
                <span style={{ fontSize: 13, color: scanMsg.ok ? '#4ade80' : '#f87171' }}>{scanMsg.msg}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setScanTarget(null)} style={btnGhost}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
