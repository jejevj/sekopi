import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Package, Plus, Pencil, Trash2, FlaskConical, TriangleAlert, X, Check } from 'lucide-react-native';

const SATUAN_PRESETS = ['kg', 'liter', 'pcs', 'gram', 'ml', 'lusin', 'karton'];

const emptyForm = { nama: '', satuan: 'kg', satuan_display: '', konversi_factor: '', stok_minimum: '0', deskripsi: '' };

export default function BahanBakuPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showStok, setShowStok] = useState<number | null>(null);
  const [stokForm, setStokForm] = useState({ tipe: 'masuk', jumlah: '', keterangan: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bahan-baku'],
    queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data),
  });

  const { data: histori } = useQuery({
    queryKey: ['stok-histori', showStok],
    queryFn: () => api.get(`/inventori/stok/${showStok}/histori`).then(r => r.data),
    enabled: !!showStok,
  });

  const bahanList: any[] = Array.isArray(data) ? data : [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventori/bahan-baku', payload).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bahan-baku'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: any) => api.patch(`/inventori/bahan-baku/${id}`, payload).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bahan-baku'] }); resetForm(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/inventori/bahan-baku/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bahan-baku'] }); setDeleteConfirm(null); },
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal menghapus'),
  });

  const stokMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventori/stok', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bahan-baku'] });
      queryClient.invalidateQueries({ queryKey: ['stok-histori', showStok] });
      setStokForm({ tipe: 'masuk', jumlah: '', keterangan: '' });
    },
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); setFormError(''); };

  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      nama: b.nama, satuan: b.satuan,
      satuan_display: b.satuan_display ?? '',
      konversi_factor: b.konversi_factor?.toString() ?? '',
      stok_minimum: b.stok_minimum?.toString() ?? '0',
      deskripsi: b.deskripsi ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    setFormError('');
    if (!form.nama || !form.satuan) { setFormError('Nama dan satuan wajib diisi'); return; }
    const payload: any = {
      nama: form.nama, satuan: form.satuan,
      stok_minimum: parseFloat(form.stok_minimum) || 0,
      deskripsi: form.deskripsi || null,
      satuan_display: form.satuan_display || null,
      konversi_factor: form.konversi_factor ? parseFloat(form.konversi_factor) : null,
    };
    if (editId) updateMutation.mutate({ id: editId, payload });
    else createMutation.mutate(payload);
  };

  const handleTambahStok = () => {
    if (!stokForm.jumlah || !showStok) return;
    stokMutation.mutate({
      bahan_baku_id: showStok,
      tipe: stokForm.tipe,
      jumlah: parseFloat(stokForm.jumlah),
      keterangan: stokForm.keterangan || null,
    });
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };

  const selectedBahan = bahanList.find(b => b.id === showStok);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Bahan Baku" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Master Bahan Baku</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{bahanList.length} bahan terdaftar</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <Plus size={15} color="white" /> Tambah Bahan
          </button>
        </div>

        {/* Stok rendah warning */}
        {bahanList.some((b: any) => b.saldo <= b.stok_minimum && b.stok_minimum > 0) && (
          <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TriangleAlert size={15} color="#eab308" />
            <span style={{ color: '#eab308', fontSize: 13 }}>
              {bahanList.filter((b: any) => b.saldo <= b.stok_minimum && b.stok_minimum > 0).length} bahan di bawah stok minimum
            </span>
          </div>
        )}

        {/* Tabel */}
        {isLoading ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Memuat...</div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nama Bahan', 'Satuan', 'Saldo Stok', 'Stok Min', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bahanList.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#444' }}>Belum ada bahan baku</td></tr>
                ) : bahanList.map((b: any) => {
                  const lowStock = b.stok_minimum > 0 && b.saldo <= b.stok_minimum;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Package size={14} color="#f87171" />
                          </div>
                          <div>
                            <div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{b.nama}</div>
                            {b.deskripsi && <div style={{ color: '#555', fontSize: 12 }}>{b.deskripsi}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ color: '#aaa', fontSize: 13 }}>{b.satuan}</span>
                        {b.satuan_display && b.konversi_factor && (
                          <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>(1 {b.satuan} = {b.konversi_factor} {b.satuan_display})</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: lowStock ? '#ef4444' : '#22c55e', fontWeight: 600, fontSize: 15 }}>
                            {b.saldo % 1 === 0 ? b.saldo : b.saldo.toFixed(3)}
                          </span>
                          <span style={{ color: '#555', fontSize: 12 }}>{b.satuan}</span>
                          {lowStock && <TriangleAlert size={13} color="#ef4444" />}
                        </div>
                        {b.satuan_display && b.konversi_factor && (
                          <div style={{ color: '#555', fontSize: 11 }}>
                            = {(b.saldo * b.konversi_factor).toFixed(0)} {b.satuan_display}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#666', fontSize: 13 }}>
                        {b.stok_minimum} {b.satuan}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setShowStok(b.id === showStok ? null : b.id)}
                            style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer', fontSize: 12 }}>
                            <FlaskConical size={13} color="#60a5fa" />
                          </button>
                          <button onClick={() => openEdit(b)}
                            style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer' }}>
                            <Pencil size={13} color="#aaa" />
                          </button>
                          <button onClick={() => setDeleteConfirm(b.id)}
                            style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', cursor: 'pointer' }}>
                            <Trash2 size={13} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Inline stok panel */}
            {showStok && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: 20, background: 'rgba(59,130,246,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: 14 }}>Stok: {selectedBahan?.nama}</span>
                  <button onClick={() => setShowStok(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={15} color="#555" /></button>
                </div>
                {/* Form tambah/kurangi stok */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <select value={stokForm.tipe} onChange={e => setStokForm({ ...stokForm, tipe: e.target.value })}
                    style={{ ...inp, width: 120, cursor: 'pointer' }}>
                    <option value="masuk" style={{ background: '#1a1a1a' }}>Masuk</option>
                    <option value="keluar" style={{ background: '#1a1a1a' }}>Keluar</option>
                  </select>
                  <input type="number" placeholder={`Jumlah (${selectedBahan?.satuan})`} value={stokForm.jumlah}
                    onChange={e => setStokForm({ ...stokForm, jumlah: e.target.value })}
                    style={{ ...inp, width: 140 }} />
                  {selectedBahan?.satuan_display && selectedBahan?.konversi_factor && stokForm.jumlah && (
                    <span style={{ color: '#555', fontSize: 12, alignSelf: 'center' }}>
                      = {(parseFloat(stokForm.jumlah) * selectedBahan.konversi_factor).toFixed(0)} {selectedBahan.satuan_display}
                    </span>
                  )}
                  <input placeholder="Keterangan (opsional)" value={stokForm.keterangan}
                    onChange={e => setStokForm({ ...stokForm, keterangan: e.target.value })}
                    style={{ ...inp, flex: 1, minWidth: 160 }} />
                  <button onClick={handleTambahStok} disabled={!stokForm.jumlah || stokMutation.isPending}
                    style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    <Check size={14} color="#22c55e" />
                  </button>
                </div>
                {/* Histori */}
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {histori?.map((h: any) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: h.tipe === 'masuk' ? '#22c55e' : '#f87171', fontWeight: 600 }}>{h.tipe === 'masuk' ? '+' : '-'}{h.jumlah} {selectedBahan?.satuan}</span>
                        <span style={{ color: '#555' }}>{h.keterangan ?? '-'}</span>
                      </div>
                      <span style={{ color: '#444' }}>{h.created_at ? new Date(h.created_at).toLocaleDateString('id-ID') : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Form Tambah/Edit */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 460, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#f87171" />
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit' : 'Tambah'} Bahan Baku</span>
              </div>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} color="#555" /></button>
            </div>

            {formError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>NAMA BAHAN BAKU</label>
                <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Susu Full Cream" style={inp} />
              </div>
              <div>
                <label style={lbl}>SATUAN REFERENSI</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {SATUAN_PRESETS.map(s => (
                    <button key={s} onClick={() => setForm({ ...form, satuan: s })}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', backgroundColor: form.satuan === s ? 'rgba(244,68,68,0.15)' : 'rgba(255,255,255,0.04)', borderColor: form.satuan === s ? 'rgba(244,68,68,0.4)' : 'rgba(255,255,255,0.1)', color: form.satuan === s ? '#f87171' : '#888' }}>
                      {s}
                    </button>
                  ))}
                </div>
                <input value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} placeholder="atau ketik sendiri" style={inp} />
              </div>
              <div>
                <label style={lbl}>STOK MINIMUM</label>
                <input type="number" value={form.stok_minimum} onChange={e => setForm({ ...form, stok_minimum: e.target.value })} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={lbl}>SATUAN DISPLAY (opsional)</label>
                <input value={form.satuan_display} onChange={e => setForm({ ...form, satuan_display: e.target.value })} placeholder="ml, gram..." style={inp} />
              </div>
              <div>
                <label style={lbl}>FAKTOR KONVERSI (opsional)</label>
                <input type="number" value={form.konversi_factor} onChange={e => setForm({ ...form, konversi_factor: e.target.value })} placeholder="1000" style={inp} />
                {form.satuan && form.satuan_display && form.konversi_factor && (
                  <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>1 {form.satuan} = {form.konversi_factor} {form.satuan_display}</div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>DESKRIPSI (opsional)</label>
                <textarea value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} placeholder="Keterangan tambahan..." rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                style={{ padding: '9px 20px', borderRadius: 8, background: '#f44444', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Bahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 380, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Trash2 size={18} color="#ef4444" />
              <span style={{ color: 'white', fontWeight: 700 }}>Hapus bahan baku?</span>
            </div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Bahan yang sudah dipakai di MO tidak bisa dihapus.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
