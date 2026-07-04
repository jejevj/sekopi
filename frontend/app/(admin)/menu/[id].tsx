import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, Tag, Plus, Trash2,
  CheckCircle2, Package, Edit3,
} from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

export default function MenuDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [editHarga, setEditHarga]           = useState(false);
  const [hargaJual, setHargaJual]           = useState('');
  const [showTambahResep, setShowTambahResep] = useState(false);
  const [namaVersi, setNamaVersi]           = useState('');
  const [bahanLines, setBahanLines]         = useState([{ bahan_baku_id: '', qty_per_unit: '', satuan: '' }]);
  const [formError, setFormError]           = useState('');
  const [toast, setToast]                   = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', id],
    queryFn:  () => api.get(`/menu/${id}`).then(r => r.data),
    enabled:  !!id,
  });

  const { data: bahanData } = useQuery({
    queryKey: ['bahan-baku'],
    queryFn:  () => api.get('/inventori/bahan-baku').then(r => r.data),
  });
  const bahanList: any[] = Array.isArray(bahanData) ? bahanData : [];

  const updateHargaMutation = useMutation({
    mutationFn: (harga: number) => api.patch(`/menu/${id}`, { harga_jual: harga }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', id] });
      qc.invalidateQueries({ queryKey: ['menu'] });
      setEditHarga(false);
      showToast('Harga jual berhasil diupdate');
    },
    onError: (e: any) => showToast(e.response?.data?.detail ?? 'Gagal update harga', 'err'),
  });

  const aktifkanResepMutation = useMutation({
    mutationFn: (resepId: number) => api.post(`/menu/${id}/resep/${resepId}/aktifkan`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', id] });
      showToast('Resep berhasil diaktifkan');
    },
    onError: (e: any) => showToast(e.response?.data?.detail ?? 'Gagal aktifkan resep', 'err'),
  });

  const tambahResepMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/menu/${id}/resep`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', id] });
      setShowTambahResep(false);
      setNamaVersi('');
      setBahanLines([{ bahan_baku_id: '', qty_per_unit: '', satuan: '' }]);
      setFormError('');
      showToast('Versi resep berhasil ditambahkan');
    },
    onError: (e: any) => showToast(e.response?.data?.detail ?? 'Gagal tambah resep', 'err'),
  });

  const handleTambahResep = () => {
    setFormError('');
    const validLines = bahanLines.filter(l => l.bahan_baku_id && l.qty_per_unit);
    if (!namaVersi.trim()) {
      setFormError('Nama versi resep wajib diisi.');
      return;
    }
    if (validLines.length === 0) {
      setFormError('Minimal 1 bahan baku wajib diisi lengkap.');
      return;
    }
    tambahResepMutation.mutate({
      nama_versi: namaVersi.trim(),
      bahan_list: validLines.map(l => ({
        bahan_baku_id: parseInt(l.bahan_baku_id),
        qty_per_unit:  parseFloat(l.qty_per_unit),
        satuan:        l.satuan,
      })),
    });
  };

  const updateLine = (i: number, field: string, val: string) => {
    const next = [...bahanLines];
    if (field === 'bahan_baku_id') {
      const found = bahanList.find(b => b.id.toString() === val);
      next[i] = { ...next[i], bahan_baku_id: val, satuan: found?.satuan ?? '' };
    } else {
      next[i] = { ...next[i], [field]: val };
    }
    setBahanLines(next);
  };

  // ---- styles ----
  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    color: '#888', fontSize: 11, fontWeight: 600,
    marginBottom: 4, display: 'block', letterSpacing: 0.5,
  };
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 24, marginBottom: 16,
  };

  // ---- loading ----
  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Detail Menu" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #f44444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#555', fontSize: 13 }}>Memuat menu...</span>
      </div>
    </div>
  );

  if (!menu) return null;

  const resepList: any[] = menu.resep_list ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title={menu.nama} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 100,
          background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: 10, padding: '12px 20px',
          color: toast.type === 'ok' ? '#22c55e' : '#f87171',
          fontSize: 13, fontWeight: 500, maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <button onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {/* Info utama */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} color="#f87171" />
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 18, margin: 0 }}>{menu.nama}</p>
              {menu.deskripsi && <p style={{ color: '#555', fontSize: 13, margin: '2px 0 0' }}>{menu.deskripsi}</p>}
              <span style={{ display: 'inline-block', marginTop: 4, background: menu.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)', color: menu.is_active ? '#22c55e' : '#6b7280', border: `1px solid ${menu.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`, borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                {menu.is_active ? 'AKTIF' : 'NONAKTIF'}
              </span>
            </div>
          </div>

          {/* Harga Jual inline edit */}
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editHarga ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={14} color="#22c55e" />
                <span style={{ color: '#888', fontSize: 13 }}>Harga Jual per Unit</span>
              </div>
              {!editHarga && (
                <button onClick={() => { setEditHarga(true); setHargaJual(menu.harga_jual.toString()); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#555', fontSize: 12 }}>
                  <Edit3 size={12} color="#555" /> Edit
                </button>
              )}
            </div>
            {editHarga ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 13, pointerEvents: 'none' }}>Rp</span>
                  <input type="number" value={hargaJual} onChange={e => setHargaJual((e.target as any).value)} style={{ ...inp, paddingLeft: 36 }} />
                </div>
                <button onClick={() => updateHargaMutation.mutate(parseFloat(hargaJual))} disabled={updateHargaMutation.isPending}
                  style={{ padding: '9px 16px', backgroundColor: '#22c55e', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {updateHargaMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={() => setEditHarga(false)}
                  style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
                  Batal
                </button>
              </div>
            ) : (
              <p style={{ color: '#22c55e', fontSize: 26, fontWeight: 700, margin: '6px 0 0' }}>
                Rp {Number(menu.harga_jual).toLocaleString('id-ID')}
              </p>
            )}
          </div>
        </div>

        {/* Resep */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={15} color="#60a5fa" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Versi Resep ({resepList.length})</span>
            </div>
            <button onClick={() => { setShowTambahResep(!showTambahResep); setFormError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '6px 12px', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>
              <Plus size={13} color="#60a5fa" /> {showTambahResep ? 'Tutup' : 'Tambah Versi'}
            </button>
          </div>

          {/* Form tambah resep */}
          {showTambahResep && (
            <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '9px 14px', color: '#f87171', fontSize: 12, marginBottom: 12 }}>
                  {formError}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>NAMA VERSI *</label>
                <input value={namaVersi} onChange={e => setNamaVersi((e.target as any).value)}
                  placeholder="v2, less-sugar, original, dll" style={inp} />
              </div>

              <label style={{ ...lbl, marginBottom: 8 }}>BAHAN BAKU *</label>
              {bahanLines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 36px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <select value={line.bahan_baku_id} onChange={e => updateLine(i, 'bahan_baku_id', (e.target as any).value)}
                    style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Pilih bahan...</option>
                    {bahanList.map((b: any) => (
                      <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>{b.nama} ({b.satuan})</option>
                    ))}
                  </select>
                  <input type="number" value={line.qty_per_unit} onChange={e => updateLine(i, 'qty_per_unit', (e.target as any).value)}
                    placeholder="qty/unit" style={inp} />
                  <input value={line.satuan} readOnly placeholder="satuan" style={{ ...inp, color: '#555', cursor: 'default' }} />
                  <button onClick={() => setBahanLines(bahanLines.filter((_, idx) => idx !== i))} disabled={bahanLines.length === 1}
                    style={{ padding: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: bahanLines.length === 1 ? 'not-allowed' : 'pointer', opacity: bahanLines.length === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={13} color="#f87171" />
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setBahanLines([...bahanLines, { bahan_baku_id: '', qty_per_unit: '', satuan: '' }])}
                  style={{ flex: 1, padding: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12 }}>
                  + Tambah Bahan
                </button>
                <button onClick={handleTambahResep} disabled={tambahResepMutation.isPending}
                  style={{ flex: 2, padding: 9, backgroundColor: '#60a5fa', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, fontSize: 13, cursor: tambahResepMutation.isPending ? 'not-allowed' : 'pointer', opacity: tambahResepMutation.isPending ? 0.6 : 1 }}>
                  {tambahResepMutation.isPending ? 'Menyimpan...' : 'Simpan Versi Resep'}
                </button>
              </div>
            </div>
          )}

          {/* Daftar versi resep */}
          {resepList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#333', fontSize: 13 }}>
              Belum ada resep. Klik "Tambah Versi" untuk membuat resep pertama.
            </div>
          ) : (
            resepList.map((resep: any) => (
              <div key={resep.id} style={{
                border: `1px solid ${resep.is_active ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                background: resep.is_active ? 'rgba(96,165,250,0.05)' : 'rgba(255,255,255,0.02)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: resep.bahan_list?.length ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {resep.is_active && <CheckCircle2 size={14} color="#60a5fa" />}
                    <span style={{ color: resep.is_active ? '#60a5fa' : '#aaa', fontWeight: 600, fontSize: 14 }}>
                      {resep.nama_versi}
                    </span>
                    {resep.is_active && (
                      <span style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>AKTIF</span>
                    )}
                  </div>
                  {!resep.is_active && (
                    <button onClick={() => aktifkanResepMutation.mutate(resep.id)} disabled={aktifkanResepMutation.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 7, padding: '5px 10px', color: '#60a5fa', fontSize: 12, cursor: 'pointer' }}>
                      <CheckCircle2 size={12} color="#60a5fa" /> Jadikan Aktif
                    </button>
                  )}
                </div>

                {(resep.bahan_list ?? []).length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {resep.bahan_list.map((b: any) => (
                        <tr key={b.id ?? b.bahan_baku_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '5px 0', color: '#666', fontSize: 12 }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</td>
                          <td style={{ padding: '5px 0', color: '#555', fontSize: 12, textAlign: 'right' }}>{b.qty_per_unit} {b.satuan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
