import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  ShoppingBag, Plus, X, Check, ChevronDown, ChevronUp,
  AlertTriangle, Clock, Pencil, FileText,
} from 'lucide-react-native';

// ── Types
interface Supplier { id: number; nama: string; telepon?: string; email?: string; }
interface BahanBaku { id: number; nama: string; satuan: string; }
interface POItem { id: number; bahan_baku_id: number; bahan_baku_nama: string; jumlah: number; satuan: string; harga_satuan: number; subtotal: number; }
interface PO {
  id: number; nomor_po: string; supplier: { id: number; nama: string };
  dibuat_user: { id: number; full_name: string };
  tanggal_invoice: string; tanggal_jatuh_tempo?: string; tanggal_bayar?: string;
  metode_bayar: string; status: string; total_amount: number;
  catatan?: string; items: POItem[];
}

// ── Styles
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 16px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 12 };

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  draft:       { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: 'rgba(107,114,128,0.25)', label: 'Draft' },
  diterima:    { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.25)',  label: 'Diterima' },
  lunas:       { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.25)',   label: 'Lunas' },
  jatuh_tempo: { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.25)',   label: 'Jatuh Tempo' },
};

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function PembelianPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'po' | 'supplier' | 'laporan'>('po');
  const [expandedPO, setExpandedPO] = useState<number | null>(null);

  // PO form state
  const [showPOForm, setShowPOForm] = useState(false);
  const [poForm, setPOForm] = useState({ supplier_id: '', tanggal_invoice: '', tanggal_jatuh_tempo: '', metode_bayar: 'tunai', catatan: '' });
  const [poItems, setPOItems] = useState<{ bahan_baku_id: string; jumlah: string; satuan: string; harga_satuan: string }[]>([{ bahan_baku_id: '', jumlah: '', satuan: '', harga_satuan: '' }]);
  const [poError, setPOError] = useState('');

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ nama: '', kontak: '', telepon: '', email: '', alamat: '', catatan: '' });
  const [supplierError, setSupplierError] = useState('');

  // Bayar modal
  const [bayarPO, setBayarPO] = useState<PO | null>(null);
  const [tanggalBayar, setTanggalBayar] = useState(new Date().toISOString().split('T')[0]);

  // Laporan
  const [laporanDari, setLaporanDari] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
  const [laporanSampai, setLaporanSampai] = useState(() => new Date().toISOString().split('T')[0]);
  const [fetchLaporan, setFetchLaporan] = useState(false);

  // ── Queries
  const { data: poData, isLoading: loadingPO } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => api.get('/pembelian/').then(r => r.data) });
  const { data: supplierData } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/pembelian/suppliers').then(r => r.data) });
  const { data: bahanData } = useQuery({ queryKey: ['bahan-baku'], queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data) });
  const { data: laporanData, isLoading: loadingLaporan } = useQuery({
    queryKey: ['laporan-pengeluaran', laporanDari, laporanSampai],
    queryFn: () => api.get(`/pembelian/laporan?dari=${laporanDari}&sampai=${laporanSampai}`).then(r => r.data),
    enabled: fetchLaporan,
  });

  const poList: PO[] = Array.isArray(poData) ? poData : [];
  const supplierList: Supplier[] = Array.isArray(supplierData) ? supplierData : [];
  const bahanList: BahanBaku[] = Array.isArray(bahanData) ? bahanData : [];

  // ── Mutations
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowSupplierForm(false); setSupplierForm({ nama: '', kontak: '', telepon: '', email: '', alamat: '', catatan: '' }); },
    onError: (e: any) => setSupplierError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });

  const resetPOForm = () => { setShowPOForm(false); setPOForm({ supplier_id: '', tanggal_invoice: '', tanggal_jatuh_tempo: '', metode_bayar: 'tunai', catatan: '' }); setPOItems([{ bahan_baku_id: '', jumlah: '', satuan: '', harga_satuan: '' }]); setPOError(''); };

  const submitPO = () => {
    setPOError('');
    if (!poForm.supplier_id || !poForm.tanggal_invoice) { setPOError('Supplier dan tanggal invoice wajib diisi'); return; }
    const validItems = poItems.filter(i => i.bahan_baku_id && i.jumlah && i.harga_satuan);
    if (validItems.length === 0) { setPOError('Minimal satu item bahan baku'); return; }
    const payload = {
      supplier_id: parseInt(poForm.supplier_id),
      tanggal_invoice: poForm.tanggal_invoice,
      tanggal_jatuh_tempo: poForm.tanggal_jatuh_tempo || null,
      metode_bayar: poForm.metode_bayar,
      catatan: poForm.catatan || null,
      items: validItems.map(i => ({
        bahan_baku_id: parseInt(i.bahan_baku_id),
        jumlah: parseFloat(i.jumlah),
        satuan: i.satuan || bahanList.find(b => b.id === parseInt(i.bahan_baku_id))?.satuan || '-',
        harga_satuan: parseFloat(i.harga_satuan),
      })),
    };
    createPO.mutate(payload);
  };

  const isJatuhTempo = (po: PO) => po.status !== 'lunas' && po.tanggal_jatuh_tempo && new Date(po.tanggal_jatuh_tempo) < new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Pembelian & Supplier" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {([['po', '📋 Purchase Order'], ['supplier', '🏭 Supplier'], ['laporan', '📈 Laporan']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '7px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'rgba(244,68,68,0.2)' : 'transparent',
                  color: tab === t ? '#f87171' : '#666',
                  outline: tab === t ? '1px solid rgba(244,68,68,0.3)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          {tab !== 'laporan' && (
            <button onClick={() => tab === 'po' ? (resetPOForm(), setShowPOForm(true)) : setShowSupplierForm(true)} style={btnPrimary}>
              <Plus size={14} color="white" />
              {tab === 'po' ? 'Buat PO' : 'Tambah Supplier'}
            </button>
          )}
        </div>

        {/* ─ TAB: PURCHASE ORDER ─ */}
        {tab === 'po' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingPO ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
              : poList.length === 0 ? <div style={{ ...card, padding: 40, textAlign: 'center', color: '#444' }}>Belum ada purchase order</div>
              : poList.map(po => {
                const st = STATUS_STYLE[po.status] ?? STATUS_STYLE.draft;
                const jatuhTempo = isJatuhTempo(po);
                const isOpen = expandedPO === po.id;
                return (
                  <div key={po.id} style={{ ...card, border: jatuhTempo ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                      onClick={() => setExpandedPO(isOpen ? null : po.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {jatuhTempo && <AlertTriangle size={15} color="#f87171" />}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{po.nomor_po}</span>
                            <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                            {po.metode_bayar === 'tempo' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Tempo</span>}
                          </div>
                          <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>
                            {po.supplier.nama} · Invoice: {fmtDate(po.tanggal_invoice)}
                            {po.tanggal_jatuh_tempo && ` · Jatuh tempo: ${fmtDate(po.tanggal_jatuh_tempo)}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{fmt(po.total_amount)}</span>
                        {po.status !== 'lunas' && (
                          <button onClick={e => { e.stopPropagation(); setBayarPO(po); setTanggalBayar(new Date().toISOString().split('T')[0]); }}
                            style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Bayar
                          </button>
                        )}
                        {isOpen ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['Bahan Baku', 'Jumlah', 'Harga Satuan', 'Subtotal'].map(h => (
                                <th key={h} style={{ textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, padding: '6px 8px', textTransform: 'uppercase' }}>{h}</th>
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
                        {po.catatan && <div style={{ marginTop: 10, color: '#666', fontSize: 12 }}>📝 {po.catatan}</div>}
                        {po.tanggal_bayar && <div style={{ marginTop: 6, color: '#22c55e', fontSize: 12 }}>✅ Dibayar: {fmtDate(po.tanggal_bayar)} · oleh {po.dibuat_user.full_name}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ─ TAB: SUPPLIER ─ */}
        {tab === 'supplier' && (
          <div style={card}>
            {supplierList.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>Belum ada supplier</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Nama', 'Kontak', 'Telepon', 'Email'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {supplierList.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '13px 16px', color: 'white', fontWeight: 600, fontSize: 14 }}>{s.nama}</td>
                      <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.kontak ?? '—'}</td>
                      <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.telepon ?? '—'}</td>
                      <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{s.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ─ TAB: LAPORAN ─ */}
        {tab === 'laporan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter */}
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div><label style={lbl}>DARI (tanggal invoice)</label><input type="date" value={laporanDari} onChange={e => setLaporanDari(e.target.value)} style={{ ...inp, width: 180 }} /></div>
                <div><label style={lbl}>SAMPAI</label><input type="date" value={laporanSampai} onChange={e => setLaporanSampai(e.target.value)} style={{ ...inp, width: 180 }} /></div>
                <button onClick={() => setFetchLaporan(true)} style={btnPrimary}><FileText size={14} color="white" /> Tampilkan</button>
              </div>
              <div style={{ color: '#555', fontSize: 11, marginTop: 8 }}>⚡ Tagihan tempo dihitung berdasarkan tanggal invoice, bukan tanggal pembayaran.</div>
            </div>

            {fetchLaporan && (
              loadingLaporan ? <div style={{ padding: 30, textAlign: 'center', color: '#555' }}>Memuat laporan...</div>
              : laporanData && (
                <>
                  {/* Kartu ringkasan */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Total Pengeluaran', value: fmt(laporanData.total_pengeluaran), color: '#f87171' },
                      { label: 'Sudah Lunas', value: fmt(laporanData.total_lunas), color: '#22c55e' },
                      { label: 'Outstanding', value: fmt(laporanData.total_outstanding), color: '#fbbf24' },
                      { label: 'Jatuh Tempo', value: fmt(laporanData.total_jatuh_tempo), color: '#ef4444' },
                      { label: 'Jumlah PO', value: laporanData.jumlah_po, color: '#60a5fa' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                        <div style={{ color: '#666', fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{k.label}</div>
                        <div style={{ color: k.color, fontSize: 18, fontWeight: 700 }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per supplier */}
                  <div style={card}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700 }}>Per Supplier</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Supplier', 'Jml PO', 'Total', 'Lunas', 'Outstanding'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {laporanData.per_supplier.map((s: any) => (
                          <tr key={s.supplier_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '11px 14px', color: 'white', fontWeight: 600 }}>{s.supplier_nama}</td>
                            <td style={{ padding: '11px 14px', color: '#888' }}>{s.jumlah_po}</td>
                            <td style={{ padding: '11px 14px', color: '#f87171', fontWeight: 600 }}>{fmt(s.total_pengeluaran)}</td>
                            <td style={{ padding: '11px 14px', color: '#22c55e' }}>{fmt(s.total_lunas)}</td>
                            <td style={{ padding: '11px 14px', color: '#fbbf24' }}>{fmt(s.total_outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Per bahan baku */}
                  <div style={card}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700 }}>Per Bahan Baku</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Bahan Baku', 'Total Qty', 'Total Pengeluaran'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {laporanData.per_bahan.map((b: any) => (
                          <tr key={b.bahan_baku_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '11px 14px', color: 'white', fontWeight: 600 }}>{b.bahan_baku_nama}</td>
                            <td style={{ padding: '11px 14px', color: '#888' }}>{b.total_jumlah} {b.satuan}</td>
                            <td style={{ padding: '11px 14px', color: '#f87171', fontWeight: 600 }}>{fmt(b.total_pengeluaran)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Outstanding */}
                  {laporanData.po_outstanding.length > 0 && (
                    <div style={card}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={14} color="#fbbf24" />
                        <span style={{ color: 'white', fontWeight: 700 }}>Tagihan Outstanding ({laporanData.jumlah_po_outstanding})</span>
                      </div>
                      {laporanData.po_outstanding.map((po: any) => {
                        const overdue = po.tanggal_jatuh_tempo && new Date(po.tanggal_jatuh_tempo) < new Date();
                        return (
                          <div key={po.id} style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{po.nomor_po}</span>
                                {overdue && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>Lewat Jatuh Tempo</span>}
                              </div>
                              <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{po.supplier.nama} · Invoice: {fmtDate(po.tanggal_invoice)}{po.tanggal_jatuh_tempo && ` · Jatuh tempo: ${fmtDate(po.tanggal_jatuh_tempo)}`}</div>
                            </div>
                            <span style={{ color: '#fbbf24', fontWeight: 700 }}>{fmt(po.total_amount)}</span>
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

      {/* Modal: Form PO */}
      {showPOForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 600, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ShoppingBag size={17} color="#f87171" /><span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Buat Purchase Order</span></div>
              <button onClick={resetPOForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {poError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{poError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>SUPPLIER</label>
                <select value={poForm.supplier_id} onChange={e => setPOForm({ ...poForm, supplier_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Pilih supplier...</option>
                  {supplierList.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1a1a' }}>{s.nama}</option>)}
                </select>
              </div>
              <div><label style={lbl}>TANGGAL INVOICE</label><input type="date" value={poForm.tanggal_invoice} onChange={e => setPOForm({ ...poForm, tanggal_invoice: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>METODE BAYAR</label>
                <select value={poForm.metode_bayar} onChange={e => setPOForm({ ...poForm, metode_bayar: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="tunai" style={{ background: '#1a1a1a' }}>Tunai</option>
                  <option value="tempo" style={{ background: '#1a1a1a' }}>Tempo</option>
                  <option value="transfer" style={{ background: '#1a1a1a' }}>Transfer</option>
                </select>
              </div>
              {poForm.metode_bayar === 'tempo' && (
                <div><label style={lbl}>TANGGAL JATUH TEMPO</label><input type="date" value={poForm.tanggal_jatuh_tempo} onChange={e => setPOForm({ ...poForm, tanggal_jatuh_tempo: e.target.value })} style={inp} /></div>
              )}
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>CATATAN (opsional)</label><textarea value={poForm.catatan} onChange={e => setPOForm({ ...poForm, catatan: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
            </div>

            {/* Items */}
            <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Bahan Baku</div>
            {poItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div>
                  {idx === 0 && <label style={lbl}>BAHAN BAKU</label>}
                  <select value={item.bahan_baku_id}
                    onChange={e => { const bb = bahanList.find(b => b.id === parseInt(e.target.value)); const updated = [...poItems]; updated[idx] = { ...updated[idx], bahan_baku_id: e.target.value, satuan: bb?.satuan ?? '' }; setPOItems(updated); }}
                    style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Pilih...</option>
                    {bahanList.map(b => <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>{b.nama}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>{idx === 0 ? 'JUMLAH' : ''}</label><input type="number" value={item.jumlah} onChange={e => { const u = [...poItems]; u[idx].jumlah = e.target.value; setPOItems(u); }} placeholder="0" style={inp} /></div>
                <div><label style={lbl}>{idx === 0 ? 'SATUAN' : ''}</label><input value={item.satuan} onChange={e => { const u = [...poItems]; u[idx].satuan = e.target.value; setPOItems(u); }} placeholder="kg" style={inp} /></div>
                <div><label style={lbl}>{idx === 0 ? 'HARGA/SATUAN' : ''}</label><input type="number" value={item.harga_satuan} onChange={e => { const u = [...poItems]; u[idx].harga_satuan = e.target.value; setPOItems(u); }} placeholder="0" style={inp} /></div>
                <button onClick={() => setPOItems(poItems.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', marginTop: idx === 0 ? 16 : 0 }}><X size={14} color="#f87171" /></button>
              </div>
            ))}
            <button onClick={() => setPOItems([...poItems, { bahan_baku_id: '', jumlah: '', satuan: '', harga_satuan: '' }])}
              style={{ ...btnGhost, marginBottom: 20, fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              <Plus size={12} color="#aaa" /> Tambah Bahan
            </button>

            {/* Total preview */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Total</span>
              <span style={{ color: 'white', fontWeight: 700 }}>{fmt(poItems.reduce((s, i) => s + (parseFloat(i.jumlah || '0') * parseFloat(i.harga_satuan || '0')), 0))}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={resetPOForm} style={btnGhost}>Batal</button>
              <button onClick={submitPO} disabled={createPO.isPending} style={btnPrimary}>{createPO.isPending ? 'Menyimpan...' : 'Buat PO'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Supplier */}
      {showSupplierForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 440, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Tambah Supplier</span>
              <button onClick={() => setShowSupplierForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {supplierError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{supplierError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>NAMA SUPPLIER</label><input value={supplierForm.nama} onChange={e => setSupplierForm({ ...supplierForm, nama: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>KONTAK PIC</label><input value={supplierForm.kontak} onChange={e => setSupplierForm({ ...supplierForm, kontak: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>TELEPON</label><input value={supplierForm.telepon} onChange={e => setSupplierForm({ ...supplierForm, telepon: e.target.value })} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>EMAIL</label><input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>ALAMAT</label><textarea value={supplierForm.alamat} onChange={e => setSupplierForm({ ...supplierForm, alamat: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSupplierForm(false)} style={btnGhost}>Batal</button>
              <button onClick={() => createSupplier.mutate(supplierForm)} disabled={createSupplier.isPending} style={btnPrimary}>{createSupplier.isPending ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tandai Bayar */}
      {bayarPO && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 360, maxWidth: '92vw' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Tandai Lunas</div>
              <div style={{ color: '#666', fontSize: 13 }}>{bayarPO.nomor_po} · {fmt(bayarPO.total_amount)}</div>
            </div>
            <div style={{ marginBottom: 20 }}><label style={lbl}>TANGGAL BAYAR</label><input type="date" value={tanggalBayar} onChange={e => setTanggalBayar(e.target.value)} style={inp} /></div>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 16 }}>⚡ Pembayaran ini tidak mengubah periode laporan. Invoice tetap dicatat di bulan {new Date(bayarPO.tanggal_invoice).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setBayarPO(null)} style={btnGhost}>Batal</button>
              <button onClick={() => updatePO.mutate({ id: bayarPO.id, p: { tanggal_bayar: tanggalBayar, status: 'lunas' } })} disabled={updatePO.isPending}
                style={{ ...btnPrimary, backgroundColor: '#16a34a' }}>
                {updatePO.isPending ? 'Menyimpan...' : <><Check size={14} color="white" /> Tandai Lunas</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
