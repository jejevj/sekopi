import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  Users, Plus, X, Pencil, Trash2, ShoppingCart,
  TrendingUp, ChevronDown, ChevronUp,
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

const emptyGerobak = { nama: '', kode: '', lokasi: '', driver_id: '', shareholder_group_id: '', is_active: true };
const emptyGrup = { nama: '', deskripsi: '' };

export default function GerobakPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'gerobak' | 'grup' | 'dividen'>('gerobak');
  const [expandedGrp, setExpandedGrp] = useState<number | null>(null);
  const [expandedPreviewGrp, setExpandedPreviewGrp] = useState<number | null>(null);

  // ── Gerobak form
  const [showGerobakForm, setShowGerobakForm] = useState(false);
  const [editGerobakId, setEditGerobakId] = useState<number | null>(null);
  const [gerobakForm, setGerobakForm] = useState({ ...emptyGerobak });
  const [gerobakError, setGerobakError] = useState('');

  // ── Grup form
  const [showGrupForm, setShowGrupForm] = useState(false);
  const [editGrupId, setEditGrupId] = useState<number | null>(null);
  const [grupForm, setGrupForm] = useState({ ...emptyGrup });
  const [grupError, setGrupError] = useState('');

  // ── Porsi per-member inline edit — key: "groupId|userId"
  const [editPorsiKey, setEditPorsiKey] = useState<string | null>(null);
  const [porsiInput, setPorsiInput] = useState('');

  // ── Dividen
  const [divForm, setDivForm] = useState({ periode_label: '', periode_dari: firstOfMonth(), periode_sampai: todayStr(), total_gaji: '', catatan: '' });
  const [preview, setPreview] = useState<any>(null);
  const [divError, setDivError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // ── Queries
  const { data: rawGrup } = useQuery({ queryKey: ['shareholder-groups'], queryFn: () => api.get('/gerobak/groups').then(r => r.data) });
  const { data: rawGerobak, isLoading: loadingGerobak } = useQuery({ queryKey: ['gerobak'], queryFn: () => api.get('/gerobak').then(r => r.data) });
  const { data: rawDividen } = useQuery({ queryKey: ['dividen'], queryFn: () => api.get('/dividen/').then(r => r.data) });
  const { data: rawUsers } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const gerobakList: any[] = Array.isArray(rawGerobak) ? rawGerobak : [];
  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const allUsers: any[] = Array.isArray(rawUsers) ? rawUsers : [];
  const shareholderUsers = allUsers.filter((u: any) => u.role === 'SHAREHOLDER');
  const driverUsers = allUsers.filter((u: any) => u.role === 'DRIVER');

  // Derived: total porsi seluruh sistem = max porsi dalam satu grup (tiap grup independent 0-100)
  // Untuk summary bar: ambil rata-rata % alokasi per grup
  const avgAlokasi = grupList.length === 0 ? 0 :
    grupList.reduce((acc: number, g: any) => acc + (g.total_porsi ?? 0), 0) / grupList.length;

  // ── Mutations: Gerobak
  const createGerobak = useMutation({
    mutationFn: (p: any) => api.post('/gerobak', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetGerobakForm(); },
    onError: (e: any) => setGerobakError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGerobak = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetGerobakForm(); },
    onError: (e: any) => setGerobakError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const deleteGerobak = useMutation({
    mutationFn: (id: number) => api.delete(`/gerobak/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gerobak'] }),
  });

  // ── Mutations: Grup
  const createGrup = useMutation({
    mutationFn: (p: any) => api.post('/gerobak/groups', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetGrupForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGrup = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/groups/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetGrupForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });

  // Porsi per member — endpoint baru
  const setPorsiMember = useMutation({
    mutationFn: ({ gid, uid, porsi }: any) =>
      api.patch(`/gerobak/groups/${gid}/members/${uid}/porsi`, { porsi_saham: parseFloat(porsi) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); setEditPorsiKey(null); },
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

  // ── Mutations: Dividen
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

  const resetGerobakForm = () => { setShowGerobakForm(false); setEditGerobakId(null); setGerobakForm({ ...emptyGerobak }); setGerobakError(''); };
  const resetGrupForm = () => { setShowGrupForm(false); setEditGrupId(null); setGrupForm({ ...emptyGrup }); setGrupError(''); };

  const openEditGerobak = (g: any) => {
    setGerobakForm({
      nama: g.nama ?? '',
      kode: g.kode ?? '',
      lokasi: g.lokasi ?? '',
      driver_id: g.driver?.id?.toString() ?? '',
      shareholder_group_id: g.shareholder_group?.id?.toString() ?? '',
      is_active: g.is_active ?? true,
    });
    setEditGerobakId(g.id);
    setGerobakError('');
    setShowGerobakForm(true);
  };

  const submitGerobak = () => {
    if (!gerobakForm.nama || !gerobakForm.kode) { setGerobakError('Nama dan kode wajib diisi'); return; }
    const payload: any = {
      nama: gerobakForm.nama,
      kode: gerobakForm.kode,
      lokasi: gerobakForm.lokasi || null,
      driver_id: gerobakForm.driver_id ? parseInt(gerobakForm.driver_id) : null,
      shareholder_group_id: gerobakForm.shareholder_group_id ? parseInt(gerobakForm.shareholder_group_id) : null,
      is_active: gerobakForm.is_active,
    };
    editGerobakId ? updateGerobak.mutate({ id: editGerobakId, p: payload }) : createGerobak.mutate(payload);
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Gerobak & Saham" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Gerobak & Manajemen Saham</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{gerobakList.length} gerobak · {grupList.length} grup</p>
        </div>

        {/* Tabs + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {(['gerobak', 'grup', 'dividen'] as const).map(t => {
              const labels = { gerobak: '🛒 Gerobak', grup: '👥 Grup & Saham', dividen: '💰 Dividen' };
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
          {tab === 'gerobak' && (
            <button onClick={() => { resetGerobakForm(); setShowGerobakForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Tambah Gerobak
            </button>
          )}
          {tab === 'grup' && (
            <button onClick={() => { resetGrupForm(); setShowGrupForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Tambah Grup
            </button>
          )}
        </div>

        {/* ─── TAB: GEROBAK ─── */}
        {tab === 'gerobak' && (
          <div style={card}>
            {loadingGerobak
              ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
              : gerobakList.length === 0
                ? (
                  <div style={{ padding: 60, textAlign: 'center' }}>
                    <ShoppingCart size={36} color="#333" style={{ marginBottom: 12 }} />
                    <div style={{ color: '#444', marginBottom: 16 }}>Belum ada gerobak</div>
                    <button onClick={() => { resetGerobakForm(); setShowGerobakForm(true); }} style={btnPrimary}>
                      <Plus size={14} color="white" /> Tambah Gerobak Pertama
                    </button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Nama', 'Kode', 'Lokasi', 'Driver', 'Grup Saham', 'Status', ''].map(h => (
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
                            {g.shareholder_group
                              ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(244,68,68,0.1)', color: '#f87171', border: '1px solid rgba(244,68,68,0.2)' }}>{g.shareholder_group.nama}</span>
                              : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: g.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)', color: g.is_active ? '#22c55e' : '#6b7280', border: `1px solid ${g.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.25)'}` }}>
                              {g.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openEditGerobak(g)} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                <Pencil size={12} color="#888" />
                              </button>
                              <button onClick={() => { if (confirm(`Hapus gerobak ${g.nama}?`)) deleteGerobak.mutate(g.id); }} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
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
        )}

        {/* ─── TAB: GRUP & SAHAM ─── */}
        {tab === 'grup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary bar: rata-rata alokasi semua grup */}
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rata-rata Alokasi Porsi per Grup</span>
                <span style={{ color: avgAlokasi >= 100 ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>{avgAlokasi.toFixed(1)}% / 100%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(avgAlokasi, 100)}%`, background: avgAlokasi >= 100 ? '#22c55e' : '#f87171', borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
              <div style={{ color: '#555', fontSize: 11, marginTop: 6 }}>Porsi saham diatur per anggota dalam masing-masing grup. Total dalam 1 grup harus ≤ 100%.</div>
            </div>

            {grupList.map(grp => {
              const open = expandedGrp === grp.id;
              const totalPorsiGrup: number = grp.total_porsi ?? 0;
              const sisaGrup = Math.max(0, 100 - totalPorsiGrup);
              const memberships: any[] = grp.memberships ?? [];
              const availShareholders = shareholderUsers.filter((u: any) => !memberships.some((m: any) => m.user_id === u.id));

              return (
                <div key={grp.id} style={card}>
                  {/* Grup header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                    onClick={() => setExpandedGrp(open ? null : grp.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} color="#f87171" />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{grp.nama}</div>
                        <div style={{ color: '#555', fontSize: 12 }}>{memberships.length} anggota · {grp.gerobaks?.length ?? 0} gerobak · alokasi {totalPorsiGrup.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Progress porsi dalam grup */}
                      <div style={{ width: 80 }}>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(totalPorsiGrup, 100)}%`, background: totalPorsiGrup >= 100 ? '#22c55e' : '#f87171', borderRadius: 99 }} />
                        </div>
                        <div style={{ color: totalPorsiGrup >= 100 ? '#22c55e' : '#fbbf24', fontSize: 10, textAlign: 'right', marginTop: 2 }}>{totalPorsiGrup.toFixed(1)}%</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setGrupForm({ nama: grp.nama, deskripsi: grp.deskripsi ?? '' }); setEditGrupId(grp.id); setGrupError(''); setShowGrupForm(true); }}
                          style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                          <Pencil size={12} color="#666" />
                        </button>
                      </div>
                      {open ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {open && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>

                      {/* Anggota + porsi per member */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Anggota & Porsi Saham</span>
                          <span style={{ color: sisaGrup > 0 ? '#fbbf24' : '#22c55e', fontSize: 11 }}>
                            {sisaGrup > 0 ? `Sisa ${sisaGrup.toFixed(1)}% belum dialokasikan` : '✓ 100% teralokasi'}
                          </span>
                        </div>

                        {/* Progress bar total porsi */}
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                          <div style={{ height: '100%', width: `${Math.min(totalPorsiGrup, 100)}%`, background: totalPorsiGrup >= 100 ? '#22c55e' : '#f87171', borderRadius: 99, transition: 'width 0.4s' }} />
                        </div>

                        {memberships.length === 0 && (
                          <div style={{ color: '#444', fontSize: 12, marginBottom: 8 }}>Belum ada anggota</div>
                        )}

                        {memberships.map((m: any) => {
                          const key = `${grp.id}|${m.user_id}`;
                          const isEditing = editPorsiKey === key;
                          return (
                            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f87171', fontWeight: 700 }}>
                                  {m.full_name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <span style={{ color: '#ddd', fontSize: 13 }}>{m.full_name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isEditing ? (
                                  <>
                                    <input
                                      type="number" min="0" max="100" step="0.01"
                                      value={porsiInput}
                                      onChange={e => setPorsiInput(e.target.value)}
                                      style={{ ...inp, width: 72, textAlign: 'right', padding: '5px 8px', fontSize: 13 }}
                                      autoFocus
                                    />
                                    <span style={{ color: '#888', fontSize: 12 }}>%</span>
                                    <button
                                      onClick={() => setPorsiMember.mutate({ gid: grp.id, uid: m.user_id, porsi: porsiInput })}
                                      disabled={setPorsiMember.isPending}
                                      style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12 }}>Simpan</button>
                                    <button onClick={() => setEditPorsiKey(null)} style={{ ...btnGhost, padding: '5px 8px' }}><X size={12} color="#aaa" /></button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>{parseFloat(m.porsi_saham).toFixed(2)}%</span>
                                    <button
                                      onClick={() => { setEditPorsiKey(key); setPorsiInput(m.porsi_saham.toString()); }}
                                      style={{ padding: '4px 7px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                      <Pencil size={11} color="#666" />
                                    </button>
                                    <button onClick={() => removeMember.mutate({ gid: grp.id, uid: m.user_id })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                      <X size={12} color="#f87171" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Tambah anggota */}
                        {availShareholders.length > 0 && (
                          <select defaultValue=""
                            onChange={e => { if (e.target.value) addMember.mutate({ gid: grp.id, uid: parseInt(e.target.value) }); e.target.value = ''; }}
                            style={{ ...inp, width: 200, fontSize: 12, padding: '6px 10px', cursor: 'pointer', marginTop: 8 }}>
                            <option value="">+ Tambah anggota...</option>
                            {availShareholders.map((u: any) => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name}</option>)}
                          </select>
                        )}
                      </div>

                      {/* Gerobak dalam grup */}
                      {grp.gerobaks?.length > 0 && (
                        <div>
                          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Gerobak dalam Grup</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {grp.gerobaks.map((g: any) => (
                              <span key={g.id} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '3px 10px', color: '#60a5fa', fontSize: 12 }}>{g.nama} <span style={{ color: '#3b82f6', opacity: 0.5 }}>#{g.kode}</span></span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {grupList.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <Users size={36} color="#333" style={{ marginBottom: 12 }} />
                <div style={{ color: '#444', marginBottom: 16 }}>Belum ada grup saham</div>
                <button onClick={() => { resetGrupForm(); setShowGrupForm(true); }} style={btnPrimary}><Plus size={14} color="white" /> Buat Grup Pertama</button>
              </div>
            )}
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
                  <input value={divForm.periode_label} onChange={e => setDivForm({ ...divForm, periode_label: e.target.value })} placeholder="Juli 2026" style={inp} />
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
                    <div style={{ color: '#555', fontSize: 11, marginTop: 3 }}>÷ {grupList.length} grup = {fmt(parseFloat(divForm.total_gaji) / grupList.length)} / grup</div>
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

            {/* Preview result */}
            {preview && (
              <div style={card}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>Preview: {preview.periode_label}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>{preview.jumlah_grup} grup · {fmt(preview.total_gaji)} gaji total</span>
                </div>

                {/* Summary angka keseluruhan */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: 'Total Penjualan', value: fmt(preview.total_penjualan), color: '#22c55e' },
                    { label: 'Total Pembelian', value: fmt(preview.total_pembelian), color: '#f87171' },
                    { label: 'Total Gaji', value: fmt(preview.total_gaji), color: '#fbbf24' },
                    { label: 'Beban / Grup', value: fmt(preview.beban_gaji_per_grup), color: '#fbbf24' },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '12px 18px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                      <div style={{ color: k.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per grup + per member breakdown */}
                {preview.per_grup.map((g: any) => (
                  <div key={g.group_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Grup row */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => setExpandedPreviewGrp(expandedPreviewGrp === g.group_id ? null : g.group_id)}>
                      <div>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{g.group_nama}</span>
                        <span style={{ color: '#555', fontSize: 12, marginLeft: 10 }}>{g.per_member.length} pemegang saham</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Penjualan grup</div>
                          <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 13 }}>{fmt(g.total_penjualan)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Laba bersih</div>
                          <div style={{ color: g.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171', fontWeight: 700, fontSize: 14 }}>{fmt(g.laba_bersih_grup)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#888', fontSize: 11 }}>Sisa porsi</div>
                          <div style={{ color: g.sisa_porsi > 0 ? '#fbbf24' : '#22c55e', fontWeight: 600, fontSize: 12 }}>{g.sisa_porsi.toFixed(1)}%</div>
                        </div>
                        {expandedPreviewGrp === g.group_id ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                      </div>
                    </div>

                    {/* Member breakdown */}
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
                      onClick={() => konfirmasiMut.mutate({ ...divForm, total_gaji: parseFloat(divForm.total_gaji), catatan: divForm.catatan || null })}
                      disabled={konfirmasiMut.isPending}
                      style={{ ...btnPrimary, backgroundColor: '#16a34a' }}>
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
                              <button onClick={() => bayarMut.mutate({ id: d.id, tgl: todayStr() })}
                                style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Bayar</button>
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

      {/* ─── MODAL: Tambah/Edit Gerobak ─── */}
      {showGerobakForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGerobakId ? 'Edit' : 'Tambah'} Gerobak</span>
              <button onClick={resetGerobakForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {gerobakError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{gerobakError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>NAMA GEROBAK *</label><input value={gerobakForm.nama} onChange={e => setGerobakForm({ ...gerobakForm, nama: e.target.value })} placeholder="Gerobak Selatan" style={inp} /></div>
                <div><label style={lbl}>KODE *</label><input value={gerobakForm.kode} onChange={e => setGerobakForm({ ...gerobakForm, kode: e.target.value })} placeholder="GRB-001" style={{ ...inp, fontFamily: 'monospace' }} /></div>
              </div>
              <div><label style={lbl}>LOKASI</label><input value={gerobakForm.lokasi} onChange={e => setGerobakForm({ ...gerobakForm, lokasi: e.target.value })} placeholder="Jl. Sudirman No.1" style={inp} /></div>
              <div>
                <label style={lbl}>DRIVER</label>
                <select value={gerobakForm.driver_id} onChange={e => setGerobakForm({ ...gerobakForm, driver_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Tanpa driver —</option>
                  {driverUsers.map((u: any) => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>GRUP SAHAM</label>
                <select value={gerobakForm.shareholder_group_id} onChange={e => setGerobakForm({ ...gerobakForm, shareholder_group_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Tanpa grup —</option>
                  {grupList.map((g: any) => <option key={g.id} value={g.id} style={{ background: '#1a1a1a' }}>{g.nama}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="is_active" checked={gerobakForm.is_active} onChange={e => setGerobakForm({ ...gerobakForm, is_active: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f44444' }} />
                <label htmlFor="is_active" style={{ ...lbl, marginBottom: 0, cursor: 'pointer' }}>Gerobak Aktif</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetGerobakForm} style={btnGhost}>Batal</button>
              <button onClick={submitGerobak} disabled={createGerobak.isPending || updateGerobak.isPending} style={btnPrimary}>
                {createGerobak.isPending || updateGerobak.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Tambah/Edit Grup ─── */}
      {showGrupForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 420, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGrupId ? 'Edit' : 'Tambah'} Grup Saham</span>
              <button onClick={resetGrupForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {grupError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{grupError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>NAMA GRUP *</label><input value={grupForm.nama} onChange={e => setGrupForm({ ...grupForm, nama: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>DESKRIPSI</label><input value={grupForm.deskripsi} onChange={e => setGrupForm({ ...grupForm, deskripsi: e.target.value })} style={inp} /></div>
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 12px', color: '#d97706', fontSize: 12 }}>
                💡 Porsi saham tiap anggota dapat diatur langsung pada kartu grup setelah menyimpan.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={resetGrupForm} style={btnGhost}>Batal</button>
              <button
                onClick={() => {
                  const p = { nama: grupForm.nama, deskripsi: grupForm.deskripsi || null };
                  editGrupId ? updateGrup.mutate({ id: editGrupId, p }) : createGrup.mutate(p);
                }}
                disabled={!grupForm.nama || createGrup.isPending || updateGrup.isPending}
                style={btnPrimary}>
                {createGrup.isPending || updateGrup.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
