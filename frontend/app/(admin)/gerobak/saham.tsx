import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Users, Plus, X, Pencil, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };

const emptyGrup = { nama: '', deskripsi: '' };

export default function GrupSahamPage() {
  const qc = useQueryClient();
  const [expandedGrp, setExpandedGrp] = useState<number | null>(null);

  // Grup form
  const [showGrupForm, setShowGrupForm] = useState(false);
  const [editGrupId, setEditGrupId] = useState<number | null>(null);
  const [grupForm, setGrupForm] = useState({ ...emptyGrup });
  const [grupError, setGrupError] = useState('');

  // Porsi inline edit — key: "groupId|userId"
  const [editPorsiKey, setEditPorsiKey] = useState<string | null>(null);
  const [porsiInput, setPorsiInput] = useState('');

  // Queries
  const { data: rawGrup, isLoading } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: rawUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then(r => r.data),
  });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const allUsers: any[] = Array.isArray(rawUsers) ? rawUsers : [];
  // Backend UserRole enum: "shareholder" (lowercase)
  const shareholderUsers = allUsers.filter((u: any) =>
    u.role === 'shareholder' || u.role === 'SHAREHOLDER'
  );

  // Mutations
  const createGrup = useMutation({
    mutationFn: (p: any) => api.post('/gerobak/groups', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGrup = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/groups/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); resetForm(); },
    onError: (e: any) => setGrupError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const addMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.post(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholder-groups'] }),
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal menambah anggota'),
  });
  const removeMember = useMutation({
    mutationFn: ({ gid, uid }: any) => api.delete(`/gerobak/groups/${gid}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholder-groups'] }),
  });
  const setPorsiMember = useMutation({
    mutationFn: ({ gid, uid, porsi }: any) =>
      api.patch(`/gerobak/groups/${gid}/members/${uid}/porsi`, { porsi_saham: parseFloat(porsi) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shareholder-groups'] }); setEditPorsiKey(null); },
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal set porsi'),
  });

  const resetForm = () => { setShowGrupForm(false); setEditGrupId(null); setGrupForm({ ...emptyGrup }); setGrupError(''); };

  const avgAlokasi = grupList.length === 0 ? 0
    : grupList.reduce((acc: number, g: any) => acc + (g.total_porsi ?? 0), 0) / grupList.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Grup & Saham" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <a href="/gerobak" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <ArrowLeft size={14} /> Gerobak
              </a>
            </div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Grup & Saham</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>
              {grupList.length} grup · {shareholderUsers.length} shareholder terdaftar
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowGrupForm(true); }} style={btnPrimary}>
            <Plus size={14} color="white" /> Tambah Grup
          </button>
        </div>

        {/* Summary bar */}
        <div style={{ ...card, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rata-rata Alokasi Porsi</span>
            <span style={{ color: avgAlokasi >= 100 ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>{avgAlokasi.toFixed(1)}% / 100%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(avgAlokasi, 100)}%`, background: avgAlokasi >= 100 ? '#22c55e' : '#f87171', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
          <div style={{ color: '#555', fontSize: 11, marginTop: 6 }}>Porsi saham diatur per anggota. Total dalam 1 grup harus ≤ 100%.</div>
        </div>

        {/* Loading */}
        {isLoading && <div style={{ padding: 60, textAlign: 'center', color: '#555' }}>Memuat data grup...</div>}

        {/* Empty state */}
        {!isLoading && grupList.length === 0 && (
          <div style={{ ...card, padding: 60, textAlign: 'center' }}>
            <Users size={36} color="#333" style={{ marginBottom: 12 }} />
            <div style={{ color: '#444', marginBottom: 16 }}>Belum ada grup saham</div>
            <button onClick={() => { resetForm(); setShowGrupForm(true); }} style={btnPrimary}>
              <Plus size={14} color="white" /> Buat Grup Pertama
            </button>
          </div>
        )}

        {/* Grup list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupList.map(grp => {
            const open = expandedGrp === grp.id;
            const totalPorsi: number = grp.total_porsi ?? 0;
            const sisa = Math.max(0, 100 - totalPorsi);
            const memberships: any[] = grp.memberships ?? [];
            // User shareholder yang belum ada di grup ini
            const available = shareholderUsers.filter(
              (u: any) => !memberships.some((m: any) => m.user_id === u.id)
            );

            return (
              <div key={grp.id} style={card}>
                {/* Header kartu */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => setExpandedGrp(open ? null : grp.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} color="#f87171" />
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{grp.nama}</div>
                      <div style={{ color: '#555', fontSize: 12 }}>
                        {memberships.length} anggota · {grp.gerobaks?.length ?? 0} gerobak · alokasi {totalPorsi.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Mini progress */}
                    <div style={{ width: 80 }}>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(totalPorsi, 100)}%`, background: totalPorsi >= 100 ? '#22c55e' : '#f87171', borderRadius: 99 }} />
                      </div>
                      <div style={{ color: totalPorsi >= 100 ? '#22c55e' : '#fbbf24', fontSize: 10, textAlign: 'right', marginTop: 2 }}>{totalPorsi.toFixed(1)}%</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setGrupForm({ nama: grp.nama, deskripsi: grp.deskripsi ?? '' }); setEditGrupId(grp.id); setGrupError(''); setShowGrupForm(true); }}
                        style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                      >
                        <Pencil size={12} color="#666" />
                      </button>
                    </div>
                    {open ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                  </div>
                </div>

                {/* Expanded */}
                {open && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px' }}>

                    {/* Anggota & Porsi */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Anggota & Porsi Saham</span>
                        <span style={{ color: sisa > 0 ? '#fbbf24' : '#22c55e', fontSize: 12, fontWeight: 600 }}>
                          {sisa > 0 ? `Sisa ${sisa.toFixed(1)}% belum dialokasikan` : '✓ 100% teralokasi'}
                        </span>
                      </div>

                      {/* Progress bar total porsi */}
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ height: '100%', width: `${Math.min(totalPorsi, 100)}%`, background: totalPorsi >= 100 ? '#22c55e' : '#f87171', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>

                      {/* Daftar anggota */}
                      {memberships.length === 0 && (
                        <div style={{ color: '#444', fontSize: 13, padding: '8px 0', marginBottom: 8 }}>Belum ada anggota. Tambahkan dari dropdown di bawah.</div>
                      )}

                      {memberships.map((m: any) => {
                        const key = `${grp.id}|${m.user_id}`;
                        const isEditing = editPorsiKey === key;
                        return (
                          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                            {/* Avatar + nama */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>
                                {m.full_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{m.full_name}</div>
                                <div style={{ color: '#555', fontSize: 11 }}>Shareholder</div>
                              </div>
                            </div>

                            {/* Porsi + aksi */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isEditing ? (
                                <>
                                  <input
                                    type="number" min="0" max="100" step="0.01"
                                    value={porsiInput}
                                    onChange={e => setPorsiInput(e.target.value)}
                                    style={{ ...inp, width: 80, textAlign: 'right', padding: '5px 8px', fontSize: 13 }}
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') setPorsiMember.mutate({ gid: grp.id, uid: m.user_id, porsi: porsiInput });
                                      if (e.key === 'Escape') setEditPorsiKey(null);
                                    }}
                                  />
                                  <span style={{ color: '#888', fontSize: 13 }}>%</span>
                                  <button
                                    onClick={() => setPorsiMember.mutate({ gid: grp.id, uid: m.user_id, porsi: porsiInput })}
                                    disabled={setPorsiMember.isPending}
                                    style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12 }}
                                  >
                                    {setPorsiMember.isPending ? '...' : 'Simpan'}
                                  </button>
                                  <button onClick={() => setEditPorsiKey(null)} style={{ ...btnGhost, padding: '5px 8px' }}>
                                    <X size={12} color="#aaa" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#f87171', fontWeight: 700, fontSize: 15, minWidth: 52, textAlign: 'right' }}>
                                    {parseFloat(m.porsi_saham).toFixed(2)}%
                                  </span>
                                  <button
                                    title="Edit porsi"
                                    onClick={() => { setEditPorsiKey(key); setPorsiInput(m.porsi_saham.toString()); }}
                                    style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                  >
                                    <Pencil size={11} color="#666" />
                                  </button>
                                  <button
                                    title="Hapus anggota"
                                    onClick={() => { if (confirm(`Hapus ${m.full_name} dari grup ini?`)) removeMember.mutate({ gid: grp.id, uid: m.user_id }); }}
                                    style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}
                                  >
                                    <X size={11} color="#f87171" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Dropdown tambah anggota */}
                      <div style={{ marginTop: 10 }}>
                        {available.length > 0 ? (
                          <>
                            <label style={{ ...lbl, marginBottom: 6 }}>TAMBAH ANGGOTA</label>
                            <select
                              defaultValue=""
                              onChange={e => {
                                if (e.target.value) {
                                  addMember.mutate({ gid: grp.id, uid: parseInt(e.target.value) });
                                  e.target.value = '';
                                }
                              }}
                              style={{ ...inp, width: 260, fontSize: 13, padding: '8px 10px', cursor: 'pointer' }}
                            >
                              <option value="">— Pilih shareholder... —</option>
                              {available.map((u: any) => (
                                <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>
                                  {u.full_name} ({u.email})
                                </option>
                              ))}
                            </select>
                          </>
                        ) : shareholderUsers.length === 0 ? (
                          <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 12px', color: '#d97706', fontSize: 12 }}>
                            ⚠️ Belum ada user dengan role <strong>shareholder</strong>. Buat dulu di menu Admin → Users.
                          </div>
                        ) : (
                          <div style={{ color: '#555', fontSize: 12 }}>Semua shareholder sudah menjadi anggota grup ini.</div>
                        )}
                      </div>
                    </div>

                    {/* Gerobak dalam grup */}
                    {grp.gerobaks?.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 4 }}>
                        <div style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Gerobak dalam Grup</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {grp.gerobaks.map((g: any) => (
                            <span key={g.id} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '3px 10px', color: '#60a5fa', fontSize: 12 }}>
                              {g.nama} <span style={{ opacity: 0.5 }}>#{g.kode}</span>
                            </span>
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
      </div>

      {/* Modal tambah/edit grup */}
      {showGrupForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 440, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editGrupId ? 'Edit' : 'Tambah'} Grup Saham</span>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {grupError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>
                {grupError}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>NAMA GRUP *</label>
                <input
                  value={grupForm.nama}
                  onChange={e => setGrupForm({ ...grupForm, nama: e.target.value })}
                  placeholder="Grup A"
                  style={inp}
                  autoFocus
                />
              </div>
              <div>
                <label style={lbl}>DESKRIPSI</label>
                <input
                  value={grupForm.deskripsi}
                  onChange={e => setGrupForm({ ...grupForm, deskripsi: e.target.value })}
                  placeholder="Keterangan opsional..."
                  style={inp}
                />
              </div>
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '10px 12px', color: '#d97706', fontSize: 12 }}>
                💡 Setelah menyimpan, klik kartu grup untuk menambahkan anggota dan mengatur porsi saham.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={btnGhost}>Batal</button>
              <button
                onClick={() => {
                  const p = { nama: grupForm.nama, deskripsi: grupForm.deskripsi || null };
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
