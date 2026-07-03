import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  Users, Plus, X, Pencil, Trash2, ShoppingCart,
  TrendingUp, Percent, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function GerobakPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'gerobak' | 'grup' | 'dividen'>('grup');
  const [expandedGrp, setExpandedGrp] = useState<number | null>(null);

  // ── Grup form
  const [showGrupForm, setShowGrupForm] = useState(false);
  const [editGrupId, setEditGrupId] = useState<number | null>(null);
  const emptyGrup = { nama: '', deskripsi: '', porsi_saham: '' };
  const [grupForm, setGrupForm] = useState({ ...emptyGrup });
  const [grupError, setGrupError] = useState('');

  // ── Porsi inline edit
  const [editPorsiId, setEditPorsiId] = useState<number | null>(null);
  const [porsiInput, setPorsiInput] = useState('');

  // ── Dividen kalkulasi
  const [divForm, setDivForm] = useState({ periode_label: '', periode_dari: firstOfMonth(), periode_sampai: todayStr(), total_gaji: '', catatan: '' });
  const [preview, setPreview] = useState<any>(null);
  const [divError, setDivError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // ── Queries
  const { data: rawGrup } = useQuery({ queryKey: ['shareholder-groups'], queryFn: () => api.get('/gerobak/groups').then(r => r.data) });
  const { data: rawPorsi, refetch: refetchPorsi } = useQuery({ queryKey: ['porsi-saham'], queryFn: () => api.get('/dividen/groups/porsi').then(r => r.data) });
  const { data: rawGerobak, isLoading: loadingGerobak } = useQuery({ queryKey: ['gerobak'], queryFn: () => api.get('/gerobak').then(r => r.data) });
  const { data: rawDividen } = useQuery({ queryKey: ['dividen'], queryFn: () => api.get('/dividen/').then(r => r.data) });
  const { data: rawUsers } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const porsiList: any[] = Array.isArray(rawPorsi) ? rawPorsi : [];
  const gerobakList: any[] = Array.isArray(rawGerobak) ? rawGerobak : [];
  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const shareholderUsers: any[] = Array.isArray(rawUsers) ? rawUsers.filter((u: any) => u.role === 'SHAREHOLDER') : [];

  const totalPorsi = porsiList.length > 0 ? porsiList[0]?.total_semua_grup ?? 0 : 0;
  const sisaPorsi  = 100 - totalPorsi;

  // ── Mutations
  const createGrup = useMutation({
    mutationFn: (p: any) => api.post('/gerobak/groups', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); qc.invalidateQueries({ queryKey: ['porsi-saham'] }); resetGrupForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGrup = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/groups/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); qc.invalidateQueries({ queryKey: ['porsi-saham'] }); resetGrupForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const setPorsi = useMutation({
    mutationFn: ({ id, porsi }: any) => api.patch(`/dividen/groups/${id}/porsi`, { porsi_saham: parseFloat(porsi) }).then(r => r.data),
    onSuccess: () => { refetchPorsi(); qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); setEditPorsiId(null); },
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal set porsi'),
  });
  const addMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.post(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholder-groups'] }),
  });
  const removeMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.delete(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholder-groups'] }),
  });
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

  const resetGrupForm = () => { setShowGrupForm(false); setEditGrupId(null); setGrupForm({ ...emptyGrup }); setGrupError(''); };

  const submitPreview = () => {
    setDivError('');
    if (!divForm.periode_label || !divForm.total_gaji) { setDivError('Periode label dan total gaji wajib diisi'); return; }
    previewMut.mutate({
      periode_label: divForm.periode_label,
      periode_dari: divForm.periode_dari,
      periode_sampai: divForm.periode_sampai,
      total_gaji: parseFloat(divForm.total_gaji),
      catatan: divForm.catatan || null,
    });
  };

  // ── Render
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Gerobak & Saham" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Gerobak & Manajemen Saham</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{gerobakList.length} gerobak · {grupList.length} grup · total porsi {totalPorsi.toFixed(2)}%</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {(['grup', 'gerobak', 'dividen'] as const).map(t => {
              const labels = { grup: '👥 Grup & Saham', gerobak: '🛒 Gerobak', dividen: '💰 Dividen' };
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'rgba(244,68,68,0.15)' : 'transparent',
                  color: tab === t ? '#f87171' : '#666',
                  outline: tab === t ? '1px solid rgba(244,68,68,0.3)' : 'none',
                }}>{labels[t]}</button>
              );
            })}
          </div>
          {tab === 'grup' && (
            <button onClick={() => { resetGrupForm(); setShowGrupForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Tambah Grup
            </button>
          )}
        </div>

        {/* ─── TAB: GRUP & SAHAM ─── */}
        {tab === 'grup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Porsi total bar */}
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Porsi Saham</span>
                <span style={{ color: totalPorsi === 100 ? '#22c55e' : totalPorsi > 100 ? '#ef4444' : '#fbbf24', fontWeight: 700 }}>{totalPorsi.toFixed(2)}% / 100%</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(totalPorsi, 100)}%`, background: totalPorsi === 100 ? '#22c55e' : totalPorsi > 100 ? '#ef4444' : '#f87171', borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
              {sisaPorsi > 0 && <div style={{ color: '#555', fontSize: 11, marginTop: 6 }}>{sisaPorsi.toFixed(2)}% belum dialokasikan (kas perusahaan)</div>}
              {totalPorsi === 100 && <div style={{ color: '#22c55e', fontSize: 11, marginTop: 6 }}>✓ Seluruh 100% saham sudah teralokasi</div>}
            </div>

            {grupList.map(grp => {
              const porsiData = porsiList.find((p: any) => p.id === grp.id);
              const porsi = porsiData?.porsi_saham ?? 0;
              const open = expandedGrp === grp.id;
              const availShareholders = shareholderUsers.filter(u => !grp.members?.some((m: any) => m.id === u.id));
              return (
                <div key={grp.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                    onClick={() => setExpandedGrp(open ? null : grp.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} color="#f87171" />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{grp.nama}</div>
                        <div style={{ color: '#555', fontSize: 12 }}>{grp.members?.length ?? 0} anggota · {grp.gerobaks?.length ?? 0} gerobak</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Porsi inline edit */}
                      {editPorsiId === grp.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="number" min="0" max="100" step="0.01" value={porsiInput}
                            onChange={e => setPorsiInput(e.target.value)}
                            style={{ ...inp, width: 80, textAlign: 'right' }}
                            autoFocus
                          />
                          <span style={{ color: '#888', fontSize: 13 }}>%</span>
                          <button onClick={() => setPorsi.mutate({ id: grp.id, porsi: porsiInput })} style={{ ...btnPrimary, padding: '6px 12px' }}>Simpan</button>
                          <button onClick={() => setEditPorsiId(null)} style={{ ...btnGhost, padding: '6px 10px' }}><X size={13} color="#aaa" /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16 }}>{porsi.toFixed(2)}%</div>
                            <div style={{ color: '#444', fontSize: 10 }}>porsi saham</div>
                          </div>
                          <button onClick={() => { setEditPorsiId(grp.id); setPorsiInput(porsi.toString()); }}
                            style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                            <Percent size={12} color="#888" />
                          </button>
                        </div>
                      )}
                      {open ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                    </div>
                  </div>

                  {open && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
                      {/* Members */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Anggota</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {grp.members?.map((m: any) => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px' }}>
                              <span style={{ color: '#ddd', fontSize: 12 }}>{m.full_name}</span>
                              <button onClick={() => removeMember.mutate({ gid: grp.id, uid: m.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}><X size={11} color="#f87171" /></button>
                            </div>
                          ))}
                          {availShareholders.length > 0 && (
                            <select
                              defaultValue=""
                              onChange={e => { if (e.target.value) addMember.mutate({ gid: grp.id, uid: parseInt(e.target.value) }); e.target.value = ''; }}
                              style={{ ...inp, width: 160, fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}>
                              <option value="">+ Tambah anggota</option>
                              {availShareholders.map((u: any) => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                      {/* Gerobak list */}
                      {grp.gerobaks?.length > 0 && (
                        <div>
                          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Gerobak</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {grp.gerobaks.map((g: any) => (
                              <span key={g.id} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '3px 10px', color: '#60a5fa', fontSize: 12 }}>{g.nama}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── TAB: GEROBAK ─── */}
        {tab === 'gerobak' && (
          <div style={card}>
            {loadingGerobak
              ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
              : gerobakList.length === 0
                ? <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>Belum ada gerobak</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Nama', 'Kode', 'Lokasi', 'Driver', 'Grup Saham', 'Status'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gerobakList.map((g: any) => (
                        <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(244,68,68,0.08)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ShoppingCart size={13} color="#f87171" />
                              </div>
                              <span style={{ color: 'white', fontWeight: 600 }}>{g.nama}</span>
                            </div>
                          </td>
                          <td style={{ padding: '13px 16px', color: '#888', fontFamily: 'monospace', fontSize: 13 }}>{g.kode}</td>
                          <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{g.lokasi ?? '—'}</td>
                          <td style={{ padding: '13px 16px', color: '#888', fontSize: 13 }}>{g.driver?.full_name ?? '—'}</td>
                          <td style={{ padding: '13px 16px' }}>
                            {g.shareholder_group ? (
                              <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(244,68,68,0.1)', color: '#f87171', border: '1px solid rgba(244,68,68,0.2)' }}>{g.shareholder_group.nama}</span>
                            ) : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: g.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)', color: g.is_active ? '#22c55e' : '#6b7280', border: `1px solid ${g.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.25)'}` }}>
                              {g.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            }
          </div>
        )}

        {/* ─── TAB: DIVIDEN ─── */}
        {tab === 'dividen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Form kalkulasi */}
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Kalkulasi Dividen</div>
              {divError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{divError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: '1 / 3' }}>
                  <label style={lbl}>LABEL PERIODE</label>
                  <input value={divForm.periode_label} onChange={e => setDivForm({ ...divForm, periode_label: e.target.value })} placeholder="Juni 2026" style={inp} />
                </div>
                <div>
                  <label style={lbl}>DARI</label>
                  <input type="date" value={divForm.periode_dari} onChange={e => setDivForm({ ...divForm, periode_dari: e.target.value })} style={inp} />
                </div>
                <div>
                  <label style={lbl}>SAMPAI</label>
                  <input type="date" value={divForm.periode_sampai} onChange={e => setDivForm({ ...divForm, periode_sampai: e.target.value })} style={inp} />
                </div>
                <div style={{ gridColumn: '1 / 3' }}>
                  <label style={lbl}>TOTAL GAJI KARYAWAN (Rp)</label>
                  <input type="number" value={divForm.total_gaji} onChange={e => setDivForm({ ...divForm, total_gaji: e.target.value })} placeholder="15000000" style={inp} />
                  {divForm.total_gaji && grupList.length > 0 && (
                    <div style={{ color: '#555', fontSize: 11, marginTop: 3 }}>
                      ÷ {grupList.length} grup = {fmt(parseFloat(divForm.total_gaji) / grupList.length)} / grup
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '3 / 5' }}>
                  <label style={lbl}>CATATAN (opsional)</label>
                  <input value={divForm.catatan} onChange={e => setDivForm({ ...divForm, catatan: e.target.value })} style={inp} />
                </div>
              </div>
              <button onClick={submitPreview} disabled={previewMut.isPending} style={btnPrimary}>
                <TrendingUp size={14} color="white" /> {previewMut.isPending ? 'Menghitung...' : 'Hitung Preview'}
              </button>
            </div>

            {/* Preview hasil kalkulasi */}
            {preview && (
              <div style={card}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>Preview: {preview.periode_label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#888', fontSize: 11 }}>Total Porsi</div>
                      <div style={{ color: preview.total_porsi_saham === 100 ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>{preview.total_porsi_saham}%</div>
                    </div>
                  </div>
                </div>
                {/* Summary row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: 'Total Penjualan', value: fmt(preview.total_penjualan), color: '#22c55e' },
                    { label: 'Total Pembelian', value: fmt(preview.total_pembelian), color: '#f87171' },
                    { label: 'Total Gaji', value: fmt(preview.total_gaji), color: '#fbbf24' },
                    { label: 'Beban/Grup', value: fmt(preview.beban_gaji_per_grup), color: '#fbbf24' },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '12px 18px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                      <div style={{ color: k.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {/* Per grup */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Grup', 'Porsi', 'Laba Bersih', 'Dividen'].map(h => (
                        <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.per_grup.map((g: any) => (
                      <tr key={g.group_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 18px', color: 'white', fontWeight: 600 }}>{g.group_nama}</td>
                        <td style={{ padding: '12px 18px', color: '#f87171', fontWeight: 700 }}>{g.porsi_saham}%</td>
                        <td style={{ padding: '12px 18px', color: g.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171' }}>{fmt(g.laba_bersih_grup)}</td>
                        <td style={{ padding: '12px 18px', color: '#fbbf24', fontWeight: 700, fontSize: 15 }}>{fmt(g.jumlah_dividen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.sisa_porsi > 0 && (
                  <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#555', fontSize: 12 }}>
                    ⚡ {preview.sisa_porsi}% porsi belum dialokasikan = kas perusahaan
                  </div>
                )}
                {!confirmed && (
                  <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setPreview(null)} style={btnGhost}>Batal</button>
                    <button
                      onClick={() => konfirmasiMut.mutate({
                        periode_label: divForm.periode_label, periode_dari: divForm.periode_dari,
                        periode_sampai: divForm.periode_sampai, total_gaji: parseFloat(divForm.total_gaji),
                        catatan: divForm.catatan || null,
                      })}
                      disabled={konfirmasiMut.isPending}
                      style={{ ...btnPrimary, backgroundColor: '#16a34a' }}
                    >
                      {konfirmasiMut.isPending ? 'Menyimpan...' : '✓ Konfirmasi & Simpan'}
                    </button>
                  </div>
                )}
                {confirmed && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', color: '#22c55e', fontSize: 13 }}>✓ Distribusi dividen berhasil disimpan.</div>
                )}
              </div>
            )}

            {/* History dividen */}
            <div style={card}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, fontSize: 14 }}>History Dividen</div>
              {dividenList.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: '#444' }}>Belum ada distribusi dividen</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Periode', 'Grup', 'Porsi', 'Laba Bersih', 'Dividen', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dividenList.map((d: any) => (
                        <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '11px 16px', color: '#aaa', fontSize: 13 }}>{d.periode_label}</td>
                          <td style={{ padding: '11px 16px', color: 'white', fontWeight: 600 }}>{d.group_nama}</td>
                          <td style={{ padding: '11px 16px', color: '#f87171', fontWeight: 700 }}>{d.porsi_saham}%</td>
                          <td style={{ padding: '11px 16px', color: d.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171' }}>{fmt(d.laba_bersih_grup)}</td>
                          <td style={{ padding: '11px 16px', color: '#fbbf24', fontWeight: 700 }}>{fmt(d.jumlah_dividen)}</td>
                          <td style={{ padding: '11px 16px' }}>
                            {d.status === 'dibayar'
                              ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>Dibayar</span>
                              : <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Pending</span>
                            }
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            {d.status !== 'dibayar' && (
                              <button
                                onClick={() => bayarMut.mutate({ id: d.id, tgl: todayStr() })}
                                style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                Bayar
                              </button>
                            )}
                            {d.status === 'dibayar' && <span style={{ color: '#444', fontSize: 11 }}>{fmtDate(d.tanggal_bayar)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )}
      </div>

      {/* Modal: Tambah/Edit Grup */}
      {showGrupForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 420, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGrupId ? 'Edit' : 'Tambah'} Grup</span>
              <button onClick={resetGrupForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {grupError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{grupError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>NAMA GRUP</label><input value={grupForm.nama} onChange={e => setGrupForm({ ...grupForm, nama: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>DESKRIPSI</label><input value={grupForm.deskripsi} onChange={e => setGrupForm({ ...grupForm, deskripsi: e.target.value })} style={inp} /></div>
              <div>
                <label style={lbl}>PORSI SAHAM AWAL (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={grupForm.porsi_saham} onChange={e => setGrupForm({ ...grupForm, porsi_saham: e.target.value })} placeholder="25.00" style={inp} />
                <div style={{ color: '#444', fontSize: 11, marginTop: 3 }}>Bisa diubah nanti. Sisa tersedia: {sisaPorsi.toFixed(2)}%</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={resetGrupForm} style={btnGhost}>Batal</button>
              <button
                onClick={() => {
                  const p = { nama: grupForm.nama, deskripsi: grupForm.deskripsi || null, porsi_saham: parseFloat(grupForm.porsi_saham || '0') };
                  editGrupId ? updateGrup.mutate({ id: editGrupId, p }) : createGrup.mutate(p);
                }}
                disabled={!grupForm.nama || createGrup.isPending || updateGrup.isPending}
                style={btnPrimary}
              >
                {createGrup.isPending || updateGrup.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
