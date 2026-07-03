import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { Users, Plus, X, Pencil, Trash2, KeyRound, UserCheck, UserX, ShieldCheck } from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };

const ROLES = ['ADMIN', 'PRODUKSI', 'INVENTORI', 'KASIR', 'DRIVER', 'SHAREHOLDER'];

const ROLE_COLOR: Record<string, string> = {
  ADMIN:       '#f87171',
  PRODUKSI:    '#60a5fa',
  INVENTORI:   '#a78bfa',
  KASIR:       '#34d399',
  DRIVER:      '#fbbf24',
  SHAREHOLDER: '#fb923c',
};

const emptyForm = { email: '', full_name: '', role: 'KASIR', password: '' };

export default function UsersAdminPage() {
  const qc = useQueryClient();

  // Modal state
  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState<number | null>(null);
  const [form, setForm]                 = useState({ ...emptyForm });
  const [formError, setFormError]       = useState('');

  // Reset password modal
  const [resetUserId, setResetUserId]   = useState<number | null>(null);
  const [resetName, setResetName]       = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [resetError, setResetError]     = useState('');

  // Filter
  const [search, setSearch]             = useState('');
  const [filterRole, setFilterRole]     = useState('semua');

  const { data: rawList = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then(r => r.data),
  });

  const users: any[] = Array.isArray(rawList) ? rawList : [];
  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === 'semua' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const createM = useMutation({
    mutationFn: (p: any) => api.post('/users/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/users/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal menghapus'),
  });
  const toggleActiveM = useMutation({
    mutationFn: ({ id, is_active }: any) => api.patch(`/users/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal mengubah status'),
  });
  const resetPassM = useMutation({
    mutationFn: ({ id, pwd }: any) => api.post(`/users/${id}/reset-password`, { new_password: pwd }).then(r => r.data),
    onSuccess: () => { setResetUserId(null); setNewPassword(''); setResetError(''); },
    onError: (e: any) => setResetError(e.response?.data?.detail ?? 'Gagal reset password'),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); setFormError(''); };
  const openEdit = (u: any) => {
    setForm({ email: u.email, full_name: u.full_name, role: u.role, password: '' });
    setEditId(u.id); setFormError(''); setShowForm(true);
  };
  const submit = () => {
    if (!form.full_name || !form.email) { setFormError('Nama dan email wajib diisi'); return; }
    if (!editId && !form.password) { setFormError('Password wajib diisi untuk pengguna baru'); return; }
    if (editId) {
      updateM.mutate({ id: editId, p: { full_name: form.full_name, role: form.role } });
    } else {
      createM.mutate({ email: form.email, full_name: form.full_name, role: form.role, password: form.password });
    }
  };

  // Stats
  const activeCount   = users.filter(u => u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Users" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ShieldCheck size={20} color="#f87171" />
              <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Manajemen Pengguna</h1>
            </div>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{users.length} pengguna terdaftar · {activeCount} aktif · {inactiveCount} nonaktif</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
            <Plus size={14} color="white" /> Tambah Pengguna
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Pengguna', value: users.length,    color: 'white' },
            { label: 'Aktif',          value: activeCount,     color: '#22c55e' },
            { label: 'Nonaktif',       value: inactiveCount,   color: '#f87171' },
            { label: 'Role',           value: new Set(users.map((u: any) => u.role)).size, color: '#a78bfa' },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{k.label}</div>
              <div style={{ color: k.color, fontWeight: 700, fontSize: 22 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            style={{ ...inp, width: 260 }}
          />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...inp, width: 160, cursor: 'pointer' }}>
            <option value="semua" style={{ background: '#1a1a1a' }}>Semua Role</option>
            {ROLES.map(r => <option key={r} value={r} style={{ background: '#1a1a1a' }}>{r}</option>)}
          </select>
        </div>

        {/* Tabel */}
        <div style={card}>
          {isLoading
            ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
            : filtered.length === 0
              ? <div style={{ padding: 48, textAlign: 'center', color: '#444' }}>Tidak ada pengguna ditemukan</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Pengguna', 'Email', 'Role', 'Status', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u: any) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                        {/* Nama */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ROLE_COLOR[u.role] ?? '#666'}18`, border: `1px solid ${ROLE_COLOR[u.role] ?? '#666'}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: ROLE_COLOR[u.role] ?? '#666', fontWeight: 700, flexShrink: 0 }}>
                              {u.full_name?.[0]?.toUpperCase()}
                            </div>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{u.full_name}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>{u.email}</td>

                        {/* Role */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${ROLE_COLOR[u.role] ?? '#666'}18`, color: ROLE_COLOR[u.role] ?? '#aaa', border: `1px solid ${ROLE_COLOR[u.role] ?? '#666'}40` }}>
                            {u.role}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          {u.is_active
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12 }}><UserCheck size={13} color="#22c55e" /> Aktif</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f87171', fontSize: 12 }}><UserX size={13} color="#f87171" /> Nonaktif</span>
                          }
                        </td>

                        {/* Aksi */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {/* Edit */}
                            <button onClick={() => openEdit(u)} title="Edit" style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                              <Pencil size={12} color="#888" />
                            </button>
                            {/* Reset Password */}
                            <button onClick={() => { setResetUserId(u.id); setResetName(u.full_name); setNewPassword(''); setResetError(''); }} title="Reset Password" style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', cursor: 'pointer' }}>
                              <KeyRound size={12} color="#60a5fa" />
                            </button>
                            {/* Toggle aktif */}
                            <button
                              onClick={() => toggleActiveM.mutate({ id: u.id, is_active: !u.is_active })}
                              title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              style={{ padding: '5px 8px', borderRadius: 7, background: u.is_active ? 'rgba(251,191,36,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${u.is_active ? 'rgba(251,191,36,0.2)' : 'rgba(34,197,94,0.2)'}`, cursor: 'pointer' }}
                            >
                              {u.is_active ? <UserX size={12} color="#fbbf24" /> : <UserCheck size={12} color="#22c55e" />}
                            </button>
                            {/* Hapus */}
                            <button onClick={() => { if (confirm(`Hapus pengguna "${u.full_name}"? Tindakan ini tidak bisa dibatalkan.`)) deleteM.mutate(u.id); }} title="Hapus" style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
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

      {/* Modal Tambah / Edit */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</span>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {formError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{formError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>NAMA LENGKAP *</label><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" style={inp} /></div>
              <div><label style={lbl}>EMAIL *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@sekopi.id" style={inp} disabled={!!editId} /></div>
              <div>
                <label style={lbl}>ROLE *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r} style={{ background: '#1a1a1a' }}>{r}</option>)}
                </select>
              </div>
              {!editId && (
                <div><label style={lbl}>PASSWORD *</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 karakter" style={inp} /></div>
              )}
              {editId && <div style={{ color: '#555', fontSize: 12 }}>Untuk mengubah password, gunakan tombol reset password di tabel.</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={btnGhost}>Batal</button>
              <button onClick={submit} disabled={createM.isPending || updateM.isPending} style={btnPrimary}>
                {createM.isPending || updateM.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetUserId !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 400, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={16} color="#60a5fa" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Reset Password</span>
              </div>
              <button onClick={() => { setResetUserId(null); setResetError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Reset password untuk <strong style={{ color: 'white' }}>{resetName}</strong></p>
            {resetError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{resetError}</div>}
            <div><label style={lbl}>PASSWORD BARU *</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 karakter" style={inp} /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setResetUserId(null); setResetError(''); }} style={btnGhost}>Batal</button>
              <button
                onClick={() => resetPassM.mutate({ id: resetUserId, pwd: newPassword })}
                disabled={resetPassM.isPending}
                style={{ ...btnPrimary, backgroundColor: '#2563eb' }}
              >
                <KeyRound size={13} color="white" />
                {resetPassM.isPending ? 'Menyimpan...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
