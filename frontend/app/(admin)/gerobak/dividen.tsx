import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { TrendingUp, ChevronDown, ChevronUp, Plus, X, Pencil, Trash2, Receipt } from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const KATEGORI_LABELS: Record<string, string> = {
  gaji:        'Gaji',
  operasional: 'Operasional',
  bahan_baku:  'Bahan Baku',
  utilitas:    'Utilitas',
  lainnya:     'Lainnya',
};

const emptyPengeluaran = { nama: '', jumlah: '', kategori: 'gaji', tanggal: todayStr(), catatan: '' };

export default function DividenAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'kalkulasi' | 'pengeluaran'>('kalkulasi');
  const [expandedPreviewGrp, setExpandedPreviewGrp] = useState<number | null>(null);

  // ── Filter pengeluaran
  const [filterDari, setFilterDari] = useState(firstOfMonth());
  const [filterSampai, setFilterSampai] = useState(todayStr());

  // ── Pengeluaran form
  const [showPForm, setShowPForm] = useState(false);
  const [editPId, setEditPId] = useState<number | null>(null);
  const [pForm, setPForm] = useState({ ...emptyPengeluaran });
  const [pError, setPError] = useState('');

  // ── Kalkulasi form
  const [divForm, setDivForm] = useState({
    periode_label: '',
    periode_dari: firstOfMonth(),
    periode_sampai: todayStr(),
    catatan: '',
  });
  const [preview, setPreview] = useState<any>(null);
  const [divError, setDivError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // ── Queries
  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: rawDividen } = useQuery({
    queryKey: ['dividen'],
    queryFn: () => api.get('/dividen/').then(r => r.data),
  });
  const { data: rawPengeluaran, isLoading: loadingP } = useQuery({
    queryKey: ['pengeluaran', filterDari, filterSampai],
    queryFn: () => api.get('/pengeluaran/', { params: { dari: filterDari, sampai: filterSampai } }).then(r => r.data),
  });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const pengeluaranList: any[] = Array.isArray(rawPengeluaran) ? rawPengeluaran : [];
  const totalPengeluaran = pengeluaranList.reduce((s: number, p: any) => s + p.jumlah, 0);

  // ── Mutations Pengeluaran
  const createP = useMutation({
    mutationFn: (p: any) => api.post('/pengeluaran/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pengeluaran'] }); resetPForm(); },
    onError: (e: any) => setPError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateP = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/pengeluaran/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pengeluaran'] }); resetPForm(); },
    onError: (e: any) => setPError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const deleteP = useMutation({
    mutationFn: (id: number) => api.delete(`/pengeluaran/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pengeluaran'] }),
  });

  const resetPForm = () => { setShowPForm(false); setEditPId(null); setPForm({ ...emptyPengeluaran }); setPError(''); };
  const openEditP = (p: any) => {
    setPForm({ nama: p.nama, jumlah: String(p.jumlah), kategori: p.kategori, tanggal: p.tanggal, catatan: p.catatan ?? '' });
    setEditPId(p.id); setPError(''); setShowPForm(true);
  };
  const submitP = () => {
    if (!pForm.nama || !pForm.jumlah) { setPError('Nama dan jumlah wajib diisi'); return; }
    const payload = { nama: pForm.nama, jumlah: parseFloat(pForm.jumlah), kategori: pForm.kategori, tanggal: pForm.tanggal, catatan: pForm.catatan || null };
    editPId ? updateP.mutate({ id: editPId, p: payload }) : createP.mutate(payload);
  };

  // ── Mutations Dividen
  const previewMut = useMutation({
    mutationFn: (p: any) => api.post('/dividen/kalkulasi/preview', p).then(r => r.data),
    onSuccess: (data) => { setPreview(data); setConfirmed(false); setDivError(''); },
    onError: (e: any) => setDivError(e.response?.data?.detail ?? 'Gagal kalkulasi'),
  });
  const konfirmasiMut = useMutation({
    mutationFn: (p: any) => api.post('/dividen/kalkulasi/konfirmasi', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dividen'] }); setConfirmed(true); setPreview(null); },
    onError: (e: any) => setDivError(e.response?.data?.detail ?? 'Gagal konfirmasi'),
  });
  const bayarMut = useMutation({
    mutationFn: ({ id, tgl }: any) => api.patch(`/dividen/${id}/bayar`, { tanggal_bayar: tgl }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dividen'] }),
  });

  const submitPreview = () => {
    setDivError('');
    if (!divForm.periode_label) { setDivError('Label periode wajib diisi'); return; }
    previewMut.mutate({
      periode_label: divForm.periode_label,
      periode_dari: divForm.periode_dari,
      periode_sampai: divForm.periode_sampai,
      catatan: divForm.catatan || null,
    });
  };

  const KATEGORI_COLOR: Record<string, string> = {
    gaji: '#f87171', operasional: '#fbbf24', bahan_baku: '#60a5fa', utilitas: '#a78bfa', lainnya: '#6b7280',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Dividen" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Kalkulasi & Distribusi Dividen</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{grupList.length} grup aktif · {dividenList.length} record distribusi</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {([['kalkulasi', '📊 Kalkulasi Dividen'], ['pengeluaran', '🧾 Pengeluaran']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? 'rgba(244,68,68,0.15)' : 'transparent',
              color: tab === t ? '#f87171' : '#666',
              outline: tab === t ? '1px solid rgba(244,68,68,0.3)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {/* ─── TAB: PENGELUARAN ─── */}
        {tab === 'pengeluaran' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Filter + CTA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <label style={lbl}>DARI</label>
                  <input type="date" value={filterDari} onChange={e => setFilterDari(e.target.value)} style={{ ...inp, width: 160 }} />
                </div>
                <div>
                  <label style={lbl}>SAMPAI</label>
                  <input type="date" value={filterSampai} onChange={e => setFilterSampai(e.target.value)} style={{ ...inp, width: 160 }} />
                </div>
              </div>
              <button onClick={() => { resetPForm(); setShowPForm(true); }} style={btnPrimary}>
                <Plus size={14} color="white" /> Tambah Pengeluaran
              </button>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Pengeluaran', value: fmt(totalPengeluaran), color: '#f87171' },
                { label: 'Jumlah Item', value: String(pengeluaranList.length), color: 'white' },
                { label: 'Beban / Grup', value: grupList.length > 0 ? fmt(totalPengeluaran / grupList.length) : '—', color: '#fbbf24' },
              ].map(k => (
                <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
                  <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{k.label}</div>
                  <div style={{ color: k.color, fontWeight: 700, fontSize: 18 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabel pengeluaran */}
            <div style={card}>
              {loadingP
                ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
                : pengeluaranList.length === 0
                  ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <Receipt size={32} color="#333" style={{ marginBottom: 10 }} />
                      <div style={{ color: '#444', marginBottom: 14 }}>Belum ada pengeluaran di periode ini</div>
                      <button onClick={() => { resetPForm(); setShowPForm(true); }} style={btnPrimary}><Plus size={14} color="white" /> Tambah Pengeluaran</button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          {['Nama', 'Kategori', 'Tanggal', 'Jumlah', 'Catatan', ''].map(h => (
                            <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pengeluaranList.map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '12px 16px', color: 'white', fontWeight: 600 }}>{p.nama}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${KATEGORI_COLOR[p.kategori]}18`, color: KATEGORI_COLOR[p.kategori], border: `1px solid ${KATEGORI_COLOR[p.kategori]}40` }}>
                                {KATEGORI_LABELS[p.kategori] ?? p.kategori}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>{fmtDate(p.tanggal)}</td>
                            <td style={{ padding: '12px 16px', color: '#f87171', fontWeight: 700, fontSize: 14 }}>{fmt(p.jumlah)}</td>
                            <td style={{ padding: '12px 16px', color: '#555', fontSize: 12 }}>{p.catatan ?? '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEditP(p)} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                  <Pencil size={12} color="#888" />
                                </button>
                                <button onClick={() => { if (confirm(`Hapus "${p.nama}"?`)) deleteP.mutate(p.id); }} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
                                  <Trash2 size={12} color="#f87171" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
            </div>
          </div>
        )}

        {/* ─── TAB: KALKULASI ─── */}
        {tab === 'kalkulasi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Info pengeluaran periode aktif */}
            {pengeluaranList.length > 0 && (
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d97706', fontSize: 13 }}>🧾 Total pengeluaran periode ({fmtDate(filterDari)} – {fmtDate(filterSampai)}): <strong>{fmt(totalPengeluaran)}</strong> ÷ {grupList.length} grup = <strong>{grupList.length > 0 ? fmt(totalPengeluaran / grupList.length) : '—'}</strong> / grup</span>
                <button onClick={() => setTab('pengeluaran')} style={{ ...btnGhost, fontSize: 12, padding: '5px 12px' }}>Kelola</button>
              </div>
            )}
            {pengeluaranList.length === 0 && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f87171', fontSize: 13 }}>⚠️ Belum ada pengeluaran di periode ini. Laba dihitung tanpa pengeluaran.</span>
                <button onClick={() => setTab('pengeluaran')} style={{ ...btnGhost, fontSize: 12, padding: '5px 12px' }}>Tambah</button>
              </div>
            )}

            {/* Form kalkulasi */}
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Kalkulasi Dividen</div>
              {divError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{divError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: '1 / 3' }}>
                  <label style={lbl}>LABEL PERIODE</label>
                  <input value={divForm.periode_label} onChange={e => setDivForm({ ...divForm, periode_label: e.target.value })} placeholder="Juli 2026" style={inp} />
                </div>
                <div>
                  <label style={lbl}>DARI</label>
                  <input type="date" value={divForm.periode_dari}
                    onChange={e => { setDivForm({ ...divForm, periode_dari: e.target.value }); setFilterDari(e.target.value); }}
                    style={inp} />
                </div>
                <div>
                  <label style={lbl}>SAMPAI</label>
                  <input type="date" value={divForm.periode_sampai}
                    onChange={e => { setDivForm({ ...divForm, periode_sampai: e.target.value }); setFilterSampai(e.target.value); }}
                    style={inp} />
                </div>
                <div style={{ gridColumn: '1 / 5' }}>
                  <label style={lbl}>CATATAN (opsional)</label>
                  <input value={divForm.catatan} onChange={e => setDivForm({ ...divForm, catatan: e.target.value })} style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={submitPreview} disabled={previewMut.isPending} style={btnPrimary}>
                  <TrendingUp size={14} color="white" /> {previewMut.isPending ? 'Menghitung...' : 'Hitung Preview'}
                </button>
                <span style={{ color: '#555', fontSize: 12 }}>Pengeluaran periode ini: <strong style={{ color: '#fbbf24' }}>{fmt(totalPengeluaran)}</strong> akan otomatis dipotong dari laba.</span>
              </div>
            </div>

            {/* Preview result */}
            {preview && (
              <div style={card}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>Preview: {preview.periode_label}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>{preview.jumlah_grup} grup · pengeluaran {fmt(preview.total_pengeluaran)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: 'Total Penjualan', value: fmt(preview.total_penjualan), color: '#22c55e' },
                    { label: 'Total Pembelian', value: fmt(preview.total_pembelian), color: '#f87171' },
                    { label: 'Total Pengeluaran', value: fmt(preview.total_pengeluaran), color: '#fbbf24' },
                    { label: 'Beban / Grup', value: fmt(preview.beban_pengeluaran_per_grup), color: '#fbbf24' },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '12px 18px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                      <div style={{ color: k.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {preview.per_grup.map((g: any) => (
                  <div key={g.group_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => setExpandedPreviewGrp(expandedPreviewGrp === g.group_id ? null : g.group_id)}
                    >
                      <div>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{g.group_nama}</span>
                        <span style={{ color: '#555', fontSize: 12, marginLeft: 10 }}>{g.per_member.length} pemegang saham</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Penjualan</div>
                          <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 13 }}>{fmt(g.total_penjualan)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Pengeluaran</div>
                          <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: 13 }}>{fmt(g.total_pengeluaran_grup)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Laba bersih</div>
                          <div style={{ color: g.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171', fontWeight: 700, fontSize: 14 }}>{fmt(g.laba_bersih_grup)}</div>
                        </div>
                        {expandedPreviewGrp === g.group_id ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                      </div>
                    </div>
                    {expandedPreviewGrp === g.group_id && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0 18px 12px' }}>
                        {g.per_member.length === 0
                          ? <div style={{ color: '#555', fontSize: 12, padding: '10px 0' }}>Tidak ada anggota yang memiliki porsi saham</div>
                          : g.per_member.map((pm: any) => (
                            <div key={pm.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#f87171', fontWeight: 700 }}>
                                  {pm.user_nama?.[0]?.toUpperCase()}
                                </div>
                                <span style={{ color: '#ccc', fontSize: 13 }}>{pm.user_nama}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <span style={{ color: '#f87171', fontSize: 13 }}>{pm.porsi_saham.toFixed(2)}%</span>
                                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{fmt(pm.jumlah_dividen)}</span>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                ))}
                {!confirmed && (
                  <div style={{ padding: '14px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setPreview(null)} style={btnGhost}>Batal</button>
                    <button
                      onClick={() => konfirmasiMut.mutate({ ...divForm, catatan: divForm.catatan || null })}
                      disabled={konfirmasiMut.isPending}
                      style={{ ...btnPrimary, backgroundColor: '#16a34a' }}
                    >
                      {konfirmasiMut.isPending ? 'Menyimpan...' : '✓ Konfirmasi & Simpan'}
                    </button>
                  </div>
                )}
                {confirmed && <div style={{ padding: '12px 20px', color: '#22c55e', fontSize: 13 }}>✓ Distribusi dividen berhasil disimpan.</div>}
              </div>
            )}

            {/* History */}
            <div style={card}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, fontSize: 14 }}>History Dividen</div>
              {dividenList.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: '#444' }}>Belum ada distribusi dividen</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Periode', 'Grup', 'Pemegang Saham', 'Porsi', 'Laba Bersih Grup', 'Dividen', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dividenList.map((d: any) => (
                        <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '11px 14px', color: '#aaa', fontSize: 13 }}>{d.periode_label}</td>
                          <td style={{ padding: '11px 14px', color: 'white', fontWeight: 600 }}>{d.group_nama}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#f87171', fontWeight: 700 }}>
                                {d.user_nama?.[0]?.toUpperCase()}
                              </div>
                              <span style={{ color: '#ddd', fontSize: 13 }}>{d.user_nama}</span>
            </div>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#f87171', fontWeight: 700 }}>{parseFloat(d.porsi_saham).toFixed(2)}%</td>
                          <td style={{ padding: '11px 14px', color: d.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171', fontSize: 13 }}>{fmt(d.laba_bersih_grup)}</td>
                          <td style={{ padding: '11px 14px', color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{fmt(d.jumlah_dividen)}</td>
                          <td style={{ padding: '11px 14px' }}>
                            {d.status === 'dibayar'
                              ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>Dibayar</span>
                              : <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Pending</span>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {d.status !== 'dibayar' && (
                              <button
                                onClick={() => bayarMut.mutate({ id: d.id, tgl: todayStr() })}
                                style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              >Bayar</button>
                            )}
                            {d.status === 'dibayar' && <span style={{ color: '#444', fontSize: 11 }}>{fmtDate(d.tanggal_bayar)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit Pengeluaran */}
      {showPForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editPId ? 'Edit' : 'Tambah'} Pengeluaran</span>
              <button onClick={resetPForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {pError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{pError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>NAMA / DESKRIPSI *</label><input value={pForm.nama} onChange={e => setPForm({ ...pForm, nama: e.target.value })} placeholder="Gaji bulan Juli" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>JUMLAH (Rp) *</label>
                  <input type="number" value={pForm.jumlah} onChange={e => setPForm({ ...pForm, jumlah: e.target.value })} placeholder="5000000" style={inp} />
                </div>
                <div>
                  <label style={lbl}>TANGGAL *</label>
                  <input type="date" value={pForm.tanggal} onChange={e => setPForm({ ...pForm, tanggal: e.target.value })} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>KATEGORI</label>
                <select value={pForm.kategori} onChange={e => setPForm({ ...pForm, kategori: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {Object.entries(KATEGORI_LABELS).map(([v, label]) => (
                    <option key={v} value={v} style={{ background: '#1a1a1a' }}>{label}</option>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>CATATAN (opsional)</label><input value={pForm.catatan} onChange={e => setPForm({ ...pForm, catatan: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetPForm} style={btnGhost}>Batal</button>
              <button onClick={submitP} disabled={createP.isPending || updateP.isPending} style={btnPrimary}>
                {createP.isPending || updateP.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
