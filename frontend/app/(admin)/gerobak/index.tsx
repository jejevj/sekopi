import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  ShoppingCart, Users, Plus, Pencil, Trash2, X, Check,
  MapPin, Truck, ChevronDown, ChevronUp, UserPlus, UserMinus,
} from 'lucide-react-native';

// ── Types ────────────────────────────────────────────────────────────
interface Driver { id: number; full_name: string; email: string; }
interface Group { id: number; nama: string; deskripsi?: string; }
interface Member { id: number; full_name: string; email: string; role: string; }
interface Gerobak {
  id: number; nama: string; kode: string; lokasi?: string; is_active: boolean;
  driver?: Driver; shareholder_group?: Group;
}
interface ShareholderGroup { id: number; nama: string; deskripsi?: string; members: Member[]; }

// ── Style helpers ───────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const lbl: React.CSSProperties = {
  color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4,
  display: 'block', letterSpacing: 0.5,
};
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, overflow: 'hidden',
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  backgroundColor: '#f44444', border: 'none', borderRadius: 10,
  padding: '9px 16px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#aaa', cursor: 'pointer', fontSize: 12,
};

export default function GerobakPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'gerobak' | 'grup'>('gerobak');

  // — Gerobak state
  const [showGerobakForm, setShowGerobakForm] = useState(false);
  const [editGerobak, setEditGerobak] = useState<Gerobak | null>(null);
  const [gForm, setGForm] = useState({ nama: '', kode: '', lokasi: '', driver_id: '', shareholder_group_id: '', is_active: true });
  const [gError, setGError] = useState('');
  const [deleteGerobak, setDeleteGerobak] = useState<number | null>(null);

  // — Grup state
  const [showGrupForm, setShowGrupForm] = useState(false);
  const [editGrup, setEditGrup] = useState<ShareholderGroup | null>(null);
  const [grForm, setGrForm] = useState({ nama: '', deskripsi: '' });
  const [grError, setGrError] = useState('');
  const [expandedGrup, setExpandedGrup] = useState<number | null>(null);
  const [addMemberGrupId, setAddMemberGrupId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // ── Queries
  const { data: gerobakData, isLoading: loadingGerobak } = useQuery({
    queryKey: ['gerobak'],
    queryFn: () => api.get('/gerobak').then(r => r.data),
  });
  const { data: grupData, isLoading: loadingGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  });

  const gerobakList: Gerobak[] = Array.isArray(gerobakData) ? gerobakData : [];
  const grupList: ShareholderGroup[] = Array.isArray(grupData) ? grupData : [];
  const userList: any[] = Array.isArray(usersData) ? usersData : [];
  const driverList = userList.filter(u => u.role === 'driver');
  const shareholderList = userList.filter(u => u.role === 'shareholder');

  // ── Gerobak mutations
  const createGerobak = useMutation({
    mutationFn: (p: any) => api.post('/gerobak', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetGForm(); },
    onError: (e: any) => setGError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGerobak = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetGForm(); },
    onError: (e: any) => setGError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const delGerobak = useMutation({
    mutationFn: (id: number) => api.delete(`/gerobak/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); setDeleteGerobak(null); },
  });

  // ── Grup mutations
  const createGrup = useMutation({
    mutationFn: (p: any) => api.post('/gerobak/groups', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetGrForm(); },
    onError: (e: any) => setGrError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGrup = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/groups/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetGrForm(); },
    onError: (e: any) => setGrError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const addMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.post(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); setSelectedMemberId(''); setAddMemberGrupId(null); },
  });
  const removeMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.delete(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholder-groups'] }),
  });

  // ── Helpers
  const resetGForm = () => { setShowGerobakForm(false); setEditGerobak(null); setGForm({ nama: '', kode: '', lokasi: '', driver_id: '', shareholder_group_id: '', is_active: true }); setGError(''); };
  const resetGrForm = () => { setShowGrupForm(false); setEditGrup(null); setGrForm({ nama: '', deskripsi: '' }); setGrError(''); };

  const openEditGerobak = (g: Gerobak) => {
    setEditGerobak(g);
    setGForm({ nama: g.nama, kode: g.kode, lokasi: g.lokasi ?? '', driver_id: g.driver?.id.toString() ?? '', shareholder_group_id: g.shareholder_group?.id.toString() ?? '', is_active: g.is_active });
    setShowGerobakForm(true);
  };
  const openEditGrup = (gr: ShareholderGroup) => {
    setEditGrup(gr);
    setGrForm({ nama: gr.nama, deskripsi: gr.deskripsi ?? '' });
    setShowGrupForm(true);
  };

  const submitGerobak = () => {
    setGError('');
    if (!gForm.nama || !gForm.kode) { setGError('Nama dan kode wajib diisi'); return; }
    const payload: any = {
      nama: gForm.nama, kode: gForm.kode.toUpperCase(),
      lokasi: gForm.lokasi || null,
      driver_id: gForm.driver_id ? parseInt(gForm.driver_id) : null,
      shareholder_group_id: gForm.shareholder_group_id ? parseInt(gForm.shareholder_group_id) : null,
      is_active: gForm.is_active,
    };
    if (editGerobak) updateGerobak.mutate({ id: editGerobak.id, p: payload });
    else createGerobak.mutate(payload);
  };

  const submitGrup = () => {
    setGrError('');
    if (!grForm.nama) { setGrError('Nama grup wajib diisi'); return; }
    const payload = { nama: grForm.nama, deskripsi: grForm.deskripsi || null };
    if (editGrup) updateGrup.mutate({ id: editGrup.id, p: payload });
    else createGrup.mutate(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Gerobak & Grup Shareholder" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header + Tab */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {(['gerobak', 'grup'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: tab === t ? 'rgba(244,68,68,0.2)' : 'transparent',
                  color: tab === t ? '#f87171' : '#666',
                  outline: tab === t ? '1px solid rgba(244,68,68,0.3)' : 'none',
                }}>
                {t === 'gerobak' ? '🛒 Gerobak' : '👥 Grup Shareholder'}
              </button>
            ))}
          </div>
          <button onClick={() => tab === 'gerobak' ? (resetGForm(), setShowGerobakForm(true)) : (resetGrForm(), setShowGrupForm(true))} style={btnPrimary}>
            <Plus size={14} color="white" />
            {tab === 'gerobak' ? 'Tambah Gerobak' : 'Tambah Grup'}
          </button>
        </div>

        {/* ─── TAB: GEROBAK ─── */}
        {tab === 'gerobak' && (
          <div style={card}>
            {loadingGerobak ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
            ) : gerobakList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>Belum ada gerobak</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Gerobak', 'Driver', 'Grup Shareholder', 'Lokasi', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gerobakList.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCart size={16} color="#f87171" />
                          </div>
                          <div>
                            <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{g.nama}</div>
                            <div style={{ color: '#555', fontSize: 12, fontFamily: 'monospace' }}>{g.kode}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {g.driver ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Truck size={13} color="#60a5fa" />
                            <span style={{ color: '#93c5fd', fontSize: 13 }}>{g.driver.full_name}</span>
                          </div>
                        ) : <span style={{ color: '#444', fontSize: 12 }}>— Belum ada</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {g.shareholder_group ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={13} color="#a78bfa" />
                            <span style={{ color: '#c4b5fd', fontSize: 13 }}>{g.shareholder_group.nama}</span>
                          </div>
                        ) : <span style={{ color: '#444', fontSize: 12 }}>— Belum ada</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {g.lokasi ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <MapPin size={12} color="#6b7280" />
                            <span style={{ color: '#888', fontSize: 13 }}>{g.lokasi}</span>
                          </div>
                        ) : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: g.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                          color: g.is_active ? '#22c55e' : '#6b7280',
                          border: `1px solid ${g.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.25)'}`,
                        }}>
                          {g.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => openEditGerobak(g)} style={btnGhost}><Pencil size={13} color="#aaa" /></button>
                          <button onClick={() => setDeleteGerobak(g.id)}
                            style={{ ...btnGhost, background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            <Trash2 size={13} color="#f87171" />
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

        {/* ─── TAB: GRUP SHAREHOLDER ─── */}
        {tab === 'grup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loadingGrup ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
            ) : grupList.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: '#444' }}>Belum ada grup shareholder</div>
            ) : grupList.map(gr => {
              const isExpanded = expandedGrup === gr.id;
              const gerobakInGrup = gerobakList.filter(g => g.shareholder_group?.id === gr.id);
              return (
                <div key={gr.id} style={card}>
                  {/* Grup header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
                    onClick={() => setExpandedGrup(isExpanded ? null : gr.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={17} color="#a78bfa" />
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{gr.nama}</div>
                        <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                          {gr.members.length} shareholder · {gerobakInGrup.length} gerobak
                          {gr.deskripsi && ` · ${gr.deskripsi}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); openEditGrup(gr); }} style={btnGhost}>
                        <Pencil size={13} color="#aaa" />
                      </button>
                      {isExpanded ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* Gerobak di grup */}
                        <div>
                          <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>Gerobak</div>
                          {gerobakInGrup.length === 0 ? (
                            <div style={{ color: '#444', fontSize: 13 }}>Belum ada gerobak di grup ini</div>
                          ) : gerobakInGrup.map(g => (
                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <ShoppingCart size={13} color="#f87171" />
                              <span style={{ color: '#ddd', fontSize: 13 }}>{g.nama}</span>
                              <span style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>{g.kode}</span>
                            </div>
                          ))}
                        </div>

                        {/* Members */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Anggota Shareholder</div>
                            <button
                              onClick={() => setAddMemberGrupId(addMemberGrupId === gr.id ? null : gr.id)}
                              style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                              <UserPlus size={12} color="#aaa" /> Tambah
                            </button>
                          </div>

                          {/* Form tambah member */}
                          {addMemberGrupId === gr.id && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                              <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
                                style={{ ...inp, flex: 1 }}>
                                <option value="">Pilih shareholder...</option>
                                {shareholderList
                                  .filter(u => !gr.members.find(m => m.id === u.id))
                                  .map(u => (
                                    <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>
                                      {u.full_name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => selectedMemberId && addMember.mutate({ gid: gr.id, uid: parseInt(selectedMemberId) })}
                                disabled={!selectedMemberId || addMember.isPending}
                                style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer' }}>
                                <Check size={13} color="#22c55e" />
                              </button>
                            </div>
                          )}

                          {gr.members.length === 0 ? (
                            <div style={{ color: '#444', fontSize: 13 }}>Belum ada anggota</div>
                          ) : gr.members.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700 }}>{m.full_name[0].toUpperCase()}</span>
                                </div>
                                <div>
                                  <div style={{ color: '#ddd', fontSize: 13 }}>{m.full_name}</div>
                                  <div style={{ color: '#555', fontSize: 11 }}>{m.email}</div>
                                </div>
                              </div>
                              <button onClick={() => removeMember.mutate({ gid: gr.id, uid: m.id })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                <UserMinus size={13} color="#6b7280" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Form Gerobak */}
      {showGerobakForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ShoppingCart size={17} color="#f87171" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGerobak ? 'Edit' : 'Tambah'} Gerobak</span>
              </div>
              <button onClick={resetGForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>

            {gError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{gError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>NAMA GEROBAK</label>
                <input value={gForm.nama} onChange={e => setGForm({ ...gForm, nama: e.target.value })} placeholder="Gerobak A" style={inp} />
              </div>
              <div>
                <label style={lbl}>KODE</label>
                <input value={gForm.kode} onChange={e => setGForm({ ...gForm, kode: e.target.value.toUpperCase() })} placeholder="GRB-001" style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>LOKASI (opsional)</label>
                <input value={gForm.lokasi} onChange={e => setGForm({ ...gForm, lokasi: e.target.value })} placeholder="Jl. Sudirman No. 10" style={inp} />
              </div>
              <div>
                <label style={lbl}>DRIVER</label>
                <select value={gForm.driver_id} onChange={e => setGForm({ ...gForm, driver_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">— Belum ada driver</option>
                  {driverList.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1a1a' }}>{d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>GRUP SHAREHOLDER</label>
                <select value={gForm.shareholder_group_id} onChange={e => setGForm({ ...gForm, shareholder_group_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">— Belum ada grup</option>
                  {grupList.map(gr => <option key={gr.id} value={gr.id} style={{ background: '#1a1a1a' }}>{gr.nama}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="is_active" checked={gForm.is_active} onChange={e => setGForm({ ...gForm, is_active: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f44444' }} />
                <label htmlFor="is_active" style={{ ...lbl, margin: 0, cursor: 'pointer' }}>GEROBAK AKTIF</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={resetGForm} style={btnGhost}>Batal</button>
              <button onClick={submitGerobak} disabled={createGerobak.isPending || updateGerobak.isPending} style={btnPrimary}>
                {createGerobak.isPending || updateGerobak.isPending ? 'Menyimpan...' : editGerobak ? 'Simpan' : 'Tambah Gerobak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Form Grup */}
      {showGrupForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 400, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Users size={17} color="#a78bfa" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGrup ? 'Edit' : 'Tambah'} Grup Shareholder</span>
              </div>
              <button onClick={resetGrForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>

            {grError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{grError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>NAMA GRUP</label>
                <input value={grForm.nama} onChange={e => setGrForm({ ...grForm, nama: e.target.value })} placeholder="Grup A / Grup Pak Budi" style={inp} />
              </div>
              <div>
                <label style={lbl}>DESKRIPSI (opsional)</label>
                <textarea value={grForm.deskripsi} onChange={e => setGrForm({ ...grForm, deskripsi: e.target.value })} placeholder="Keterangan tambahan..." rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={resetGrForm} style={btnGhost}>Batal</button>
              <button onClick={submitGrup} disabled={createGrup.isPending || updateGrup.isPending}
                style={{ ...btnPrimary, backgroundColor: '#7c3aed' }}>
                {createGrup.isPending || updateGrup.isPending ? 'Menyimpan...' : editGrup ? 'Simpan' : 'Tambah Grup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Gerobak Confirm */}
      {deleteGerobak && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 360, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <Trash2 size={17} color="#ef4444" />
              <span style={{ color: 'white', fontWeight: 700 }}>Hapus gerobak?</span>
            </div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Tindakan ini tidak bisa dibatalkan.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteGerobak(null)} style={btnGhost}>Batal</button>
              <button onClick={() => delGerobak.mutate(deleteGerobak)} disabled={delGerobak.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
