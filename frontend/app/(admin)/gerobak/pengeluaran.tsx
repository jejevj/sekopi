import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Plus, X, Pencil, Trash2, Receipt, Info, Wallet } from 'lucide-react-native';

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
  gaji: 'Gaji',
  operasional: 'Operasional',
  bahan_baku: 'Bahan Baku',
  utilitas: 'Utilitas',
  lainnya: 'Lainnya',
};
const KATEGORI_COLOR: Record<string, string> = {
  gaji: '#f87171', operasional: '#fbbf24', bahan_baku: '#60a5fa', utilitas: '#a78bfa', lainnya: '#6b7280',
};
const emptyForm = { nama: '', jumlah: '', kategori: 'gaji', tanggal: todayStr(), catatan: '' };

export default function PengeluaranAdminPage() {
  const qc = useQueryClient();
  const [filterDari, setFilterDari] = useState(firstOfMonth());
  const [filterSampai, setFilterSampai] = useState(todayStr());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');

  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: rawList, isLoading } = useQuery({
    queryKey: ['pengeluaran', filterDari, filterSampai],
    queryFn: () => api.get('/pengeluaran/', { params: { dari: filterDari, sampai: filterSampai } }).then(r => r.data),
  });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const list: any[] = Array.isArray(rawList) ? rawList : [];
  const total = list.reduce((s: number, p: any) => s + Number(p.jumlah), 0);

  const createM = useMutation({
    mutationFn: (p: any) => api.post('/pengeluaran/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pengeluaran'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/pengeluaran/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pengeluaran'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/pengeluaran/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pengeluaran'] }),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); setFormError(''); };
  const openEdit = (p: any) => {
    setForm({ nama: p.nama, jumlah: String(p.jumlah), kategori: p.kategori, tanggal: p.tanggal, catatan: p.catatan ?? '' });
    setEditId(p.id); setFormError(''); setShowForm(true);
  };
  const submit = () => {
    if (!form.nama || !form.jumlah) { setFormError('Nama dan jumlah wajib diisi'); return; }
    const payload = { nama: form.nama, jumlah: parseFloat(form.jumlah), kategori: form.kategori, tanggal: form.tanggal, catatan: form.catatan || null };
    editId ? updateM.mutate({ id: editId, p: payload }) : createM.mutate(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Pengeluaran" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Wallet size={20} color="#f87171" />
              <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Pengeluaran Operasional</h1>
            </div>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Pengeluaran yang dikurangi dari laba sebelum kalkulasi dividen</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
            <Plus size={14} color="white" /> Tambah Pengeluaran
          </button>
        </div>

        {/* Filter tanggal */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <div><label style={lbl}>DARI</label><input type="date" value={filterDari} onChange={e => setFilterDari(e.target.value)} style={{ ...inp, width: 160 }} /></div>
          <div><label style={lbl}>SAMPAI</label><input type="date" value={filterSampai} onChange={e => setFilterSampai(e.target.value)} style={{ ...inp, width: 160 }} /></div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Pengeluaran Manual', value: fmt(total), color: '#f87171' },
            { label: 'Jumlah Item', value: String(list.length), color: 'white' },
            { label: 'Beban / Grup', value: grupList.length > 0 ? fmt(total / grupList.length) : '—', color: '#fbbf24' },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{k.label}</div>
              <div style={{ color: k.color, fontWeight: 700, fontSize: 18 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={14} color="#60a5fa" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ color: '#60a5fa', fontSize: 12 }}>
            <strong>Catatan:</strong> Pembelian bahan baku (Purchase Order status "Diterima") dihitung <em>otomatis</em> dari data PO — tidak perlu diinput ulang di sini.
            Halaman ini hanya untuk pengeluaran lain seperti gaji, operasional, utilitas, dll.
          </span>
        </div>

        {/* Tabel */}
        <div style={card}>
          {isLoading
            ? <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Memuat...</div>
            : list.length === 0
              ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Receipt size={32} color="#333" style={{ marginBottom: 10 }} />
                  <div style={{ color: '#444', marginBottom: 14 }}>Belum ada pengeluaran di periode ini</div>
                  <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
                    <Plus size={14} color="white" /> Tambah Pengeluaran
                  </button>
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
                    {list.map((p: any) => (
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
                            <button onClick={() => openEdit(p)} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                              <Pencil size={12} color="#888" />
                            </button>
                            <button onClick={() => { if (confirm(`Hapus "${p.nama}"?`)) deleteM.mutate(p.id); }} style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
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

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit' : 'Tambah'} Pengeluaran</span>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {formError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{formError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>NAMA / DESKRIPSI *</label><input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Gaji bulan Juli" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>JUMLAH (Rp) *</label><input type="number" value={form.jumlah} onChange={e => setForm({ ...form, jumlah: e.target.value })} placeholder="5000000" style={inp} /></div>
                <div><label style={lbl}>TANGGAL *</label><input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} style={inp} /></div>
              </div>
              <div>
                <label style={lbl}>KATEGORI</label>
                <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {Object.entries(KATEGORI_LABELS).map(([v, label]) => (
                    <option key={v} value={v} style={{ background: '#1a1a1a' }}>{label}</option>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>CATATAN (opsional)</label><input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} style={inp} /></div>
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
    </div>
  );
}
