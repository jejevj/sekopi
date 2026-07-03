import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Plus, X, Pencil, Trash2, ShoppingCart } from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };

const emptyGerobak = { nama: '', kode: '', lokasi: '', driver_id: '', shareholder_group_id: '', is_active: true };

export default function GerobakPage() {
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyGerobak });
  const [formError, setFormError] = useState('');

  const { data: rawGerobak, isLoading } = useQuery({
    queryKey: ['gerobak'],
    queryFn: () => api.get('/gerobak').then(r => r.data),
  });
  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: rawUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then(r => r.data),
  });

  const gerobakList: any[] = Array.isArray(rawGerobak) ? rawGerobak : [];
  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const allUsers: any[] = Array.isArray(rawUsers) ? rawUsers : [];
  const driverUsers = allUsers.filter((u: any) => u.role === 'driver' || u.role === 'DRIVER');

  const createGerobak = useMutation({
    mutationFn: (p: any) => api.post('/gerobak', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateGerobak = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/gerobak/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gerobak'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const deleteGerobak = useMutation({
    mutationFn: (id: number) => api.delete(`/gerobak/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gerobak'] }),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyGerobak }); setFormError(''); };

  const openEdit = (g: any) => {
    setForm({
      nama: g.nama ?? '',
      kode: g.kode ?? '',
      lokasi: g.lokasi ?? '',
      driver_id: g.driver?.id?.toString() ?? '',
      shareholder_group_id: g.shareholder_group?.id?.toString() ?? '',
      is_active: g.is_active ?? true,
    });
    setEditId(g.id);
    setFormError('');
    setShowForm(true);
  };

  const submit = () => {
    if (!form.nama || !form.kode) { setFormError('Nama dan kode wajib diisi'); return; }
    const payload: any = {
      nama: form.nama,
      kode: form.kode,
      lokasi: form.lokasi || null,
      driver_id: form.driver_id ? parseInt(form.driver_id) : null,
      shareholder_group_id: form.shareholder_group_id ? parseInt(form.shareholder_group_id) : null,
      is_active: form.is_active,
    };
    editId ? updateGerobak.mutate({ id: editId, p: payload }) : createGerobak.mutate(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Gerobak" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Gerobak</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{gerobakList.length} gerobak terdaftar</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
            <Plus size={14} color="white" /> Tambah Gerobak
          </button>
        </div>

        <div style={card}>
          {isLoading
            ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
            : gerobakList.length === 0
              ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <ShoppingCart size={36} color="#333" style={{ marginBottom: 12 }} />
                  <div style={{ color: '#444', marginBottom: 16 }}>Belum ada gerobak</div>
                  <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
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
                            <button onClick={() => openEdit(g)} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
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
      </div>

      {/* Modal Tambah/Edit Gerobak */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit' : 'Tambah'} Gerobak</span>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {formError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>NAMA GEROBAK *</label><input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Gerobak Selatan" style={inp} /></div>
                <div><label style={lbl}>KODE *</label><input value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} placeholder="GRB-001" style={{ ...inp, fontFamily: 'monospace' }} /></div>
              </div>
              <div><label style={lbl}>LOKASI</label><input value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} placeholder="Jl. Sudirman No.1" style={inp} /></div>
              <div>
                <label style={lbl}>DRIVER</label>
                <select value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Tanpa driver —</option>
                  {driverUsers.map((u: any) => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>GRUP SAHAM</label>
                <select value={form.shareholder_group_id} onChange={e => setForm({ ...form, shareholder_group_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>— Tanpa grup —</option>
                  {grupList.map((g: any) => <option key={g.id} value={g.id} style={{ background: '#1a1a1a' }}>{g.nama}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#f44444' }} />
                <label htmlFor="is_active" style={{ ...lbl, marginBottom: 0, cursor: 'pointer' }}>Gerobak Aktif</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={btnGhost}>Batal</button>
              <button onClick={submit} disabled={createGerobak.isPending || updateGerobak.isPending} style={btnPrimary}>
                {createGerobak.isPending || updateGerobak.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
