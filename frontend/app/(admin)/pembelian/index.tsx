import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  ShoppingBag, Plus, X, Check, ChevronDown, ChevronUp,
  AlertTriangle, FileText, Building2, Pencil,
  ClipboardList, BarChart2,
} from 'lucide-react-native';

// ── Types ──────────────────────────────────────────────────────────────────
interface Supplier { id: number; nama: string; kontak?: string; telepon?: string; email?: string; alamat?: string; is_active: boolean; }
interface BahanBaku { id: number; nama: string; satuan: string; }
interface POItem { id: number; bahan_baku_id: number; bahan_baku_nama: string; jumlah: number; satuan: string; harga_satuan: number; subtotal: number; }
interface POUser { id: number; full_name: string; }
interface PO {
  id: number; nomor_po: string;
  supplier: { id: number; nama: string };
  dibuat_user: POUser;
  tanggal_invoice: string;
  tanggal_jatuh_tempo?: string;
  tanggal_bayar?: string;
  metode_bayar: 'tunai' | 'tempo' | 'transfer';
  status: 'draft' | 'diterima' | 'lunas' | 'jatuh_tempo';
  total_amount: number;
  catatan?: string;
  items: POItem[];
  created_at?: string;
}
interface LaporanPengeluaran {
  periode_dari: string; periode_sampai: string; generated_at: string;
  total_pengeluaran: number; total_lunas: number; total_outstanding: number; total_jatuh_tempo: number;
  jumlah_po: number; jumlah_po_outstanding: number;
  per_supplier: { supplier_id: number; supplier_nama: string; jumlah_po: number; total_pengeluaran: number; total_lunas: number; total_outstanding: number }[];
  per_bahan: { bahan_baku_id: number; bahan_baku_nama: string; total_jumlah: number; satuan: string; total_pengeluaran: number }[];
  po_outstanding: PO[];
}

// ── Style helpers ──────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  draft:       { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: 'rgba(107,114,128,0.3)', label: 'Draft' },
  diterima:    { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)',  label: 'Diterima' },
  lunas:       { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.3)',   label: 'Lunas' },
  jatuh_tempo: { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.3)',   label: 'Jatuh Tempo' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

// ── Tab icon map ───────────────────────────────────────────────────────────
const TAB_ICON = {
  po:       <ClipboardList size={14} />,
  supplier: <Building2    size={14} />,
  laporan:  <BarChart2    size={14} />,
} as const;
const TAB_LABEL = {
  po:       'Purchase Order',
  supplier: 'Supplier',
  laporan:  'Laporan',
} as const;

// ── Component ──────────────────────────────────────────────────────────────
export default function PembelianPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'po' | 'supplier' | 'laporan'>('po');
  const [expandedPO, setExpandedPO] = useState<number | null>(null);

  // ── Filter PO list
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // ── Form PO
  const [showPOForm, setShowPOForm] = useState(false);
  const emptyPOForm = { supplier_id: '', tanggal_invoice: todayStr(), tanggal_jatuh_tempo: '', metode_bayar: 'tunai', catatan: '' };
  const [poForm, setPOForm] = useState({ ...emptyPOForm });
  const emptyItem = { bahan_baku_id: '', jumlah: '', satuan: '', harga_satuan: '' };
  const [poItems, setPOItems] = useState([{ ...emptyItem }]);
  const [poError, setPOError] = useState('');

  // ── Form Supplier
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const emptySupplier = { nama: '', kontak: '', telepon: '', email: '', alamat: '', catatan: '' };
  const [supplierForm, setSupplierForm] = useState({ ...emptySupplier });
  const [supplierError, setSupplierError] = useState('');

  // ── Modal Bayar
  const [bayarPO, setBayarPO] = useState<PO | null>(null);
  const [tanggalBayar, setTanggalBayar] = useState(todayStr());

  // ── Laporan
  const [lDari, setLDari] = useState(firstOfMonth());
  const [lSampai, setLSampai] = useState(todayStr());
  const [fetchLaporan, setFetchLaporan] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rawPO, isLoading: loadingPO } = useQuery<PO[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/pembelian/').then(r => r.data),
  });
  const { data: rawSupplier } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/pembelian/suppliers').then(r => r.data),
  });
  const { data: rawBahan } = useQuery<BahanBaku[]>({
    queryKey: ['bahan-baku'],
    queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data),
  });
  const { data: laporan, isLoading: loadingLaporan, refetch: refetchLaporan } = useQuery<LaporanPengeluaran>({
    queryKey: ['laporan-pengeluaran', lDari, lSampai],
    queryFn: () => api.get(`/pembelian/laporan?dari=${lDari}&sampai=${lSampai}`).then(r => r.data),
    enabled: fetchLaporan,
  });

  const poList = rawPO ?? [];
  const supplierList = rawSupplier ?? [];
  const bahanList = rawBahan ?? [];

  const filteredPO = poList.filter(po => {
    if (filterStatus && po.status !== filterStatus) return false;
    if (filterSupplier && String(po.supplier.id) !== filterSupplier) return false;
    return true;
  });

  const overdueCount = poList.filter(po =>
    po.status !== 'lunas' && po.tanggal_jatuh_tempo && new Date(po.tanggal_jatuh_tempo) < new Date()
  ).length;

  // ── Shortcut helpers ───────────────────────────────────────────────────────
  const applyBulanIni = () => {
    const dari = firstOfMonth();
    const sampai = todayStr();
    setLDari(dari);
    setLSampai(sampai);
    setFetchLaporan(true);
    setTimeout(() => refetchLaporan(), 0);
  };

  const applyBulanLalu = () => {
    const d = new Date();
    const firstThisMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastPrev = new Date(firstThisMonth.getTime() - 86400000);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    const dari = firstPrev.toISOString().split('T')[0];
    const sampai = lastPrev.toISOString().split('T')[0];
    setLDari(dari);
    setLSampai(sampai);
    setFetchLaporan(true);
    setTimeout(() => refetchLaporan(), 0);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createPO = useMutation({
    mutationFn: (p: any) => api.post('/pembelian/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); resetPOForm(); },
    onError: (e: any) => setPOError(e.response?.data?.detail ?? 'Gagal membuat PO'),
  });
  const updatePO = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/pembelian/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setBayarPO(null); },
  });
  const createSupplier = useMutation({
    mutationFn: (p: any) => api.post('/pembelian/suppliers', p).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowSupplierForm(false);
      setSupplierForm({ ...emptySupplier });
      setSupplierError('');
    },
    onError: (e: any) => setSupplierError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetPOForm = () => {
    setShowPOForm(false);
    setPOForm({ ...emptyPOForm });
    setPOItems([{ ...emptyItem }]);
    setPOError('');
  };

  const updateItem = (idx: number, field: string, val: string) => {
    const next = [...poItems];
    (next[idx] as any)[field] = val;
    if (field === 'bahan_baku_id') {
      const bb = bahanList.find(b => b.id === parseInt(val));
      if (bb) next[idx].satuan = bb.satuan;
    }
    setPOItems(next);
  };

  const poTotal = poItems.reduce((s, i) => s + (parseFloat(i.jumlah || '0') * parseFloat(i.harga_satuan || '0')), 0);

  const submitPO = () => {
    setPOError('');
    if (!poForm.supplier_id || !poForm.tanggal_invoice) { setPOError('Supplier dan tanggal invoice wajib diisi'); return; }
    if (poForm.metode_bayar === 'tempo' && !poForm.tanggal_jatuh_tempo) { setPOError('Tagihan tempo wajib isi tanggal jatuh tempo'); return; }
    const validItems = poItems.filter(i => i.bahan_baku_id && i.jumlah && i.harga_satuan);
    if (validItems.length === 0) { setPOError('Minimal satu item bahan baku harus diisi'); return; }
    createPO.mutate({
      supplier_id: parseInt(poForm.supplier_id),
      tanggal_invoice: poForm.tanggal_invoice,
      tanggal_jatuh_tempo: poForm.tanggal_jatuh_tempo || null,
      metode_bayar: poForm.metode_bayar,
      catatan: poForm.catatan || null,
      items: validItems.map(i => ({
        bahan_baku_id: parseInt(i.bahan_baku_id),
        jumlah: parseFloat(i.jumlah),
        satuan: i.satuan || '-',
        harga_satuan: parseFloat(i.harga_satuan),
      })),
    });
  };

  const isOverdue = (po: PO) =>
    po.status !== 'lunas' && po.tanggal_jatuh_tempo && new Date(po.tanggal_jatuh_tempo) < new Date();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Pembelian & Supplier" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Pembelian Bahan Baku</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>
            {poList.length} purchase order · {supplierList.length} supplier terdaftar
          </p>
        </div>

        {/* Overdue warning */}
        {overdueCount > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '11px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color="#f87171" />
            <span style={{ color: '#f87171', fontSize: 13 }}>{overdueCount} tagihan melewati jatuh tempo dan belum dibayar</span>
          </div>
        )}

        {/* Tabs + action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {(['po', 'supplier', 'laporan'] as const).map(t => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 8, border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: active ? 'rgba(244,68,68,0.15)' : 'transparent',
                    color: active ? '#f87171' : '#666',
                    outline: active ? '1px solid rgba(244,68,68,0.3)' : 'none',
                  }}
                >
                  <span style={{ display: 'flex', color: active ? '#f87171' : '#555' }}>
                    {TAB_ICON[t]}
                  </span>
                  {TAB_LABEL[t]}
                </button>
              );
            })}
          </div>
          {tab === 'po' && (
            <button onClick={() => { resetPOForm(); setShowPOForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Buat PO
            </button>
          )}
          {tab === 'supplier' && (
            <button onClick={() => { setSupplierForm({ ...emptySupplier }); setShowSupplierForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Tambah Supplier
            </button>
          )}
        </div>

        {/* ─── TAB: PURCHASE ORDER ─── */}
        {tab === 'po' && (
          <>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ ...inp, width: 160, cursor: 'pointer' }}>
                <option value="">Semua Status</option>
                <option value="draft" style={{ background: '#1a1a1a' }}>Draft</option>
                <option value="diterima" style={{ background: '#1a1a1a' }}>Diterima</option>
                <option value="lunas" style={{ background: '#1a1a1a' }}>Lunas</option>
                <option value="jatuh_tempo" style={{ background: '#1a1a1a' }}>Jatuh Tempo</option>
              </select>
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                style={{ ...inp, width: 200, cursor: 'pointer' }}>
                <option value="">Semua Supplier</option>
                {supplierList.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1a1a' }}>{s.nama}</option>)}
              </select>
              {(filterStatus || filterSupplier) && (
                <button onClick={() => { setFilterStatus(''); setFilterSupplier(''); }} style={btnGhost}>Reset</button>
              )}
              <span style={{ color: '#555', fontSize: 12, alignSelf: 'center', marginLeft: 4 }}>{filteredPO.length} PO ditampilkan</span>
            </div>

            {loadingPO
              ? <div style={{ color: '#555', textAlign: 'center', padding: 48 }}>Memuat...</div>
              : filteredPO.length === 0
                ? <div style={{ ...card, padding: 48, textAlign: 'center', color: '#444' }}>Belum ada purchase order</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredPO.map(po => {
                    const st = STATUS_STYLE[po.status] ?? STATUS_STYLE.draft;
                    const overdue = isOverdue(po);
                    const open = expandedPO === po.id;
                    return (
                      <div key={po.id} style={{
                        ...card,
                        border: overdue ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                        {/* Row header */}
                        <div
                          onClick={() => setExpandedPO(open ? null : po.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {overdue && <AlertTriangle size={14} color="#f87171" />}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{po.nomor_po}</span>
                                <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                                {po.metode_bayar === 'tempo' && (
                                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Tempo</span>
                                )}
                              </div>
                              <div style={{ color: '#555', fontSize: 12, marginTop: 3 }}>
                                {po.supplier.nama}
                                {' · '}Invoice: {fmtDate(po.tanggal_invoice)}
                                {po.tanggal_jatuh_tempo && ` · Jatuh tempo: ${fmtDate(po.tanggal_jatuh_tempo)}`}
                                {po.tanggal_bayar && ` · Dibayar: ${fmtDate(po.tanggal_bayar)}`}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{fmt(po.total_amount)}</span>
                            {po.status !== 'lunas' && (
                              <button
                                onClick={e => { e.stopPropagation(); setBayarPO(po); setTanggalBayar(todayStr()); }}
                                style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              >Bayar</button>
                            )}
                            {open ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {open && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: po.catatan ? 12 : 0 }}>
                              <thead>
                                <tr>
                                  {['Bahan Baku', 'Jumlah', 'Harga Satuan', 'Subtotal'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, padding: '5px 8px', textTransform: 'uppercase' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {po.items.map(item => (
                                  <tr key={item.id}>
                                    <td style={{ padding: '8px', color: '#ddd', fontSize: 13 }}>{item.bahan_baku_nama}</td>
                                    <td style={{ padding: '8px', color: '#aaa', fontSize: 13 }}>{item.jumlah} {item.satuan}</td>
                                    <td style={{ padding: '8px', color: '#aaa', fontSize: 13 }}>{fmt(item.harga_satuan)}</td>
                                    <td style={{ padding: '8px', color: 'white', fontSize: 13, fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {po.catatan && <div style={{ color: '#666', fontSize: 12 }}>📝 {po.catatan}</div>}
                            <div style={{ marginTop: 8, color: '#444', fontSize: 11 }}>Dibuat oleh {po.dibuat_user.full_name}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            }
          </>
        )}

        {/* ─── TAB: SUPPLIER ─── */}
        {tab === 'supplier' && (
          <div style={card}>
            {supplierList.length === 0
              ? <div style={{ padding: 48, textAlign: 'center', color: '#444' }}>Belum ada supplier terdaftar</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Nama Supplier', 'Kontak PIC', 'Telepon', 'Email', 'Alamat'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supplierList.map(s => (
                      <tr key={s.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(244,68,68,0.08)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Building2 size={14} color="#f87171" />
                            </div>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{s.nama}</span>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.kontak ?? '—'}</td>
                        <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.telepon ?? '—'}</td>
                        <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.email ?? '—'}</td>
                        <td style={{ padding: '13px 16px', color: '#666', fontSize: 12 }}>{s.alamat ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        )}

        {/* ─── TAB: LAPORAN ─── */}
        {tab === 'laporan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter */}
            <div style={{ ...card, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={lbl}>DARI (tanggal invoice)</label>
                  <input type="date" value={lDari} onChange={e => { setLDari(e.target.value); setFetchLaporan(false); }} style={{ ...inp, width: 180 }} />
                </div>
                <div>
                  <label style={lbl}>SAMPAI</label>
                  <input type="date" value={lSampai} onChange={e => { setLSampai(e.target.value); setFetchLaporan(false); }} style={{ ...inp, width: 180 }} />
                </div>
                <button onClick={() => { setFetchLaporan(true); refetchLaporan(); }} style={btnPrimary}>
                  <FileText size={14} color="white" /> Tampilkan
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={applyBulanIni}
                    style={{
                      ...btnGhost,
                      ...(lDari === firstOfMonth() && lSampai === todayStr() && fetchLaporan
                        ? { borderColor: 'rgba(244,68,68,0.4)', color: '#f87171' }
                        : {}),
                    }}
                  >Bulan Ini</button>
                  <button onClick={applyBulanLalu} style={btnGhost}>Bulan Lalu</button>
                </div>
              </div>
              <div style={{ color: '#444', fontSize: 11, marginTop: 10 }}>⚡ Laporan dihitung berdasarkan <strong style={{ color: '#666' }}>tanggal invoice</strong> — tagihan tempo tetap masuk bulan invoice, bukan bulan bayar.</div>
            </div>

            {fetchLaporan && (
              loadingLaporan
                ? <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Memuat laporan...</div>
                : laporan && (
                  <>
                    {/* Kartu ringkasan */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                      {[
                        { label: 'Total Pengeluaran', value: fmt(laporan.total_pengeluaran), color: '#f87171', sub: `${laporan.jumlah_po} PO` },
                        { label: 'Sudah Lunas',       value: fmt(laporan.total_lunas),       color: '#22c55e', sub: null },
                        { label: 'Outstanding',        value: fmt(laporan.total_outstanding), color: '#fbbf24', sub: `${laporan.jumlah_po_outstanding} PO` },
                        { label: 'Jatuh Tempo',        value: fmt(laporan.total_jatuh_tempo), color: '#ef4444', sub: 'belum dibayar' },
                      ].map(k => (
                        <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
                          <div style={{ color: k.color, fontSize: 19, fontWeight: 700 }}>{k.value}</div>
                          {k.sub && <div style={{ color: '#444', fontSize: 11, marginTop: 4 }}>{k.sub}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Per supplier */}
                    <div style={card}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, fontSize: 14 }}>Per Supplier</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Supplier', 'Jml PO', 'Total', 'Lunas', 'Outstanding'].map(h => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {laporan.per_supplier.map(s => (
                            <tr key={s.supplier_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '12px 16px', color: 'white', fontWeight: 600 }}>{s.supplier_nama}</td>
                              <td style={{ padding: '12px 16px', color: '#888' }}>{s.jumlah_po}</td>
                              <td style={{ padding: '12px 16px', color: '#f87171', fontWeight: 600 }}>{fmt(s.total_pengeluaran)}</td>
                              <td style={{ padding: '12px 16px', color: '#22c55e' }}>{fmt(s.total_lunas)}</td>
                              <td style={{ padding: '12px 16px', color: '#fbbf24' }}>{fmt(s.total_outstanding)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Per bahan baku */}
                    <div style={card}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, fontSize: 14 }}>Per Bahan Baku</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Bahan Baku', 'Total Qty', 'Total Pengeluaran'].map(h => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {laporan.per_bahan.map(b => (
                            <tr key={b.bahan_baku_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '12px 16px', color: 'white', fontWeight: 600 }}>{b.bahan_baku_nama}</td>
                              <td style={{ padding: '12px 16px', color: '#888' }}>{b.total_jumlah} {b.satuan}</td>
                              <td style={{ padding: '12px 16px', color: '#f87171', fontWeight: 600 }}>{fmt(b.total_pengeluaran)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* PO outstanding */}
                    {laporan.po_outstanding.length > 0 && (
                      <div style={card}>
                        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={14} color="#fbbf24" />
                          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Tagihan Outstanding ({laporan.jumlah_po_outstanding})</span>
                        </div>
                        {laporan.po_outstanding.map(po => {
                          const overdue = po.tanggal_jatuh_tempo && new Date(po.tanggal_jatuh_tempo) < new Date();
                          return (
                            <div key={po.id} style={{ padding: '13px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>{po.nomor_po}</span>
                                  {overdue && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>Lewat Jatuh Tempo</span>}
                                </div>
                                <div style={{ color: '#555', fontSize: 12, marginTop: 3 }}>
                                  {po.supplier.nama} · Invoice: {fmtDate(po.tanggal_invoice)}
                                  {po.tanggal_jatuh_tempo && ` · Jatuh tempo: ${fmtDate(po.tanggal_jatuh_tempo)}`}
                                </div>
                              </div>
                              <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 15 }}>{fmt(po.total_amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )
            )}
          </div>
        )}
      </div>

      {/* ══ Modal: Buat PO ══════════════════════════════════════════════════ */}
      {showPOForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ShoppingBag size={17} color="#f87171" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Buat Purchase Order</span>
              </div>
              <button onClick={resetPOForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>

            {poError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{poError}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>SUPPLIER</label>
                <select value={poForm.supplier_id} onChange={e => setPOForm({ ...poForm, supplier_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Pilih supplier...</option>
                  {supplierList.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1a1a' }}>{s.nama}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>TANGGAL INVOICE</label>
                <input type="date" value={poForm.tanggal_invoice} onChange={e => setPOForm({ ...poForm, tanggal_invoice: e.target.value })} style={inp} />
                <div style={{ color: '#444', fontSize: 10, marginTop: 3 }}>⚡ Acuan laporan pengeluaran</div>
              </div>
              <div>
                <label style={lbl}>METODE BAYAR</label>
                <select value={poForm.metode_bayar} onChange={e => setPOForm({ ...poForm, metode_bayar: e.target.value, tanggal_jatuh_tempo: '' })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="tunai" style={{ background: '#1a1a1a' }}>Tunai</option>
                  <option value="tempo" style={{ background: '#1a1a1a' }}>Tempo (kredit)</option>
                  <option value="transfer" style={{ background: '#1a1a1a' }}>Transfer</option>
                </select>
              </div>
              {poForm.metode_bayar === 'tempo' && (
                <div>
                  <label style={lbl}>TANGGAL JATUH TEMPO <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={poForm.tanggal_jatuh_tempo} onChange={e => setPOForm({ ...poForm, tanggal_jatuh_tempo: e.target.value })} style={{ ...inp, borderColor: !poForm.tanggal_jatuh_tempo ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)' }} />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>CATATAN (opsional)</label>
                <textarea value={poForm.catatan} onChange={e => setPOForm({ ...poForm, catatan: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            {/* Items bahan baku */}
            <div style={{ color: '#666', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Item Bahan Baku</div>
            {poItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div>
                  {idx === 0 && <label style={lbl}>BAHAN BAKU</label>}
                  <select value={item.bahan_baku_id} onChange={e => updateItem(idx, 'bahan_baku_id', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Pilih bahan...</option>
                    {bahanList.map(b => <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>{b.nama}</option>)}
                  </select>
                </div>
                <div>
                  {idx === 0 && <label style={lbl}>JUMLAH</label>}
                  <input type="number" min="0" step="0.001" value={item.jumlah} onChange={e => updateItem(idx, 'jumlah', e.target.value)} placeholder="0" style={inp} />
                </div>
                <div>
                  {idx === 0 && <label style={lbl}>SATUAN</label>}
                  <input value={item.satuan} onChange={e => updateItem(idx, 'satuan', e.target.value)} placeholder="kg" style={inp} />
                </div>
                <div>
                  {idx === 0 && <label style={lbl}>HARGA/SATUAN</label>}
                  <input type="number" min="0" value={item.harga_satuan} onChange={e => updateItem(idx, 'harga_satuan', e.target.value)} placeholder="0" style={inp} />
                </div>
                <button onClick={() => setPOItems(poItems.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', marginTop: idx === 0 ? 16 : 0 }}>
                  <X size={14} color="#f87171" />
                </button>
              </div>
            ))}

            <button onClick={() => setPOItems([...poItems, { ...emptyItem }])}
              style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
              <Plus size={13} color="#aaa" /> Tambah Bahan
            </button>

            {/* Total preview */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '11px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666' }}>Total PO</span>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{fmt(poTotal)}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={resetPOForm} style={btnGhost}>Batal</button>
              <button onClick={submitPO} disabled={createPO.isPending} style={btnPrimary}>
                {createPO.isPending ? 'Menyimpan...' : 'Buat PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Tambah Supplier ═══════════════════════════════════════════ */}
      {showSupplierForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 460, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Building2 size={17} color="#f87171" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Tambah Supplier</span>
              </div>
              <button onClick={() => setShowSupplierForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {supplierError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{supplierError}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>NAMA SUPPLIER <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={supplierForm.nama} onChange={e => setSupplierForm({ ...supplierForm, nama: e.target.value })} placeholder="PT. Sumber Susu Segar" style={inp} />
              </div>
              <div>
                <label style={lbl}>KONTAK / PIC</label>
                <input value={supplierForm.kontak} onChange={e => setSupplierForm({ ...supplierForm, kontak: e.target.value })} placeholder="Nama orang" style={inp} />
              </div>
              <div>
                <label style={lbl}>TELEPON</label>
                <input value={supplierForm.telepon} onChange={e => setSupplierForm({ ...supplierForm, telepon: e.target.value })} placeholder="08xxxxxxxxxx" style={inp} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>EMAIL</label>
                <input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="supplier@email.com" style={inp} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>ALAMAT</label>
                <textarea value={supplierForm.alamat} onChange={e => setSupplierForm({ ...supplierForm, alamat: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSupplierForm(false)} style={btnGhost}>Batal</button>
              <button onClick={() => createSupplier.mutate(supplierForm)} disabled={!supplierForm.nama || createSupplier.isPending} style={btnPrimary}>
                {createSupplier.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Tandai Lunas ══════════════════════════════════════════════ */}
      {bayarPO && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 380, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Tandai Lunas</span>
              <button onClick={() => setBayarPO(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{bayarPO.nomor_po}</div>
              <div style={{ color: '#888', fontSize: 13, marginTop: 3 }}>{bayarPO.supplier.nama} · {fmt(bayarPO.total_amount)}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>TANGGAL BAYAR</label>
              <input type="date" value={tanggalBayar} onChange={e => setTanggalBayar(e.target.value)} style={inp} />
            </div>
            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8, padding: '9px 13px', marginBottom: 18, fontSize: 12, color: '#4ade80' }}>
              ✓ Laporan bulan <strong>{new Date(bayarPO.tanggal_invoice).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong> tidak berubah — invoice tetap tercatat di tanggal invoice.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setBayarPO(null)} style={btnGhost}>Batal</button>
              <button
                onClick={() => updatePO.mutate({ id: bayarPO.id, p: { tanggal_bayar: tanggalBayar, status: 'lunas' } })}
                disabled={updatePO.isPending}
                style={{ ...btnPrimary, backgroundColor: '#16a34a' }}
              >
                {updatePO.isPending ? 'Menyimpan...' : <><Check size={14} color="white" /> Tandai Lunas</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
