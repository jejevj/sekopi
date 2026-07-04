import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert } from 'react-native';
import {
  ArrowLeft, BookOpen, Tag, Plus, Trash2,
  CheckCircle, Package, Edit3,
} from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

export default function MenuDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editHarga, setEditHarga] = useState(false);
  const [hargaJual, setHargaJual] = useState('');
  const [showTambahResep, setShowTambahResep] = useState(false);
  const [namaVersi, setNamaVersi] = useState('');
  const [bahanLines, setBahanLines] = useState([{ bahan_baku_id: '', qty_per_unit: '', satuan: '' }]);

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', id],
    queryFn: () => api.get(`/menu/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: bahanData } = useQuery({
    queryKey: ['bahan-baku'],
    queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data),
  });
  const bahanList: any[] = Array.isArray(bahanData) ? bahanData : [];

  const updateHargaMutation = useMutation({
    mutationFn: (harga: number) => api.patch(`/menu/${id}`, { harga_jual: harga }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu', id] }); setEditHarga(false); },
    onError: (e: any) => Alert.alert('Gagal', e.response?.data?.detail ?? 'Gagal update harga'),
  });

  const aktifkanResepMutation = useMutation({
    mutationFn: (resepId: number) => api.post(`/menu/${id}/resep/${resepId}/aktifkan`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu', id] }),
    onError: (e: any) => Alert.alert('Gagal', e.response?.data?.detail ?? 'Gagal aktifkan resep'),
  });

  const tambahResepMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/menu/${id}/resep`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', id] });
      setShowTambahResep(false);
      setNamaVersi('');
      setBahanLines([{ bahan_baku_id: '', qty_per_unit: '', satuan: '' }]);
    },
    onError: (e: any) => Alert.alert('Gagal', e.response?.data?.detail ?? 'Gagal tambah resep'),
  });

  const handleTambahResep = () => {
    const validLines = bahanLines.filter(l => l.bahan_baku_id && l.qty_per_unit);
    if (!namaVersi.trim() || validLines.length === 0) {
      Alert.alert('Error', 'Nama versi dan minimal 1 bahan wajib diisi');
      return;
    }
    tambahResepMutation.mutate({
      nama_versi: namaVersi.trim(),
      bahan_list: validLines.map(l => ({
        bahan_baku_id: parseInt(l.bahan_baku_id),
        qty_per_unit: parseFloat(l.qty_per_unit),
        satuan: l.satuan,
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

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, color: 'white', fontSize: 14, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    color: '#aaa', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block',
  };
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 24, marginBottom: 16,
  };

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Detail Menu" />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <ActivityIndicator size="large" color="#f44444" />
      </div>
    </div>
  );

  if (!menu) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title={menu.nama} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 760, margin: '0 auto', width: '100%' }}>

        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {/* Info utama */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="#f87171" />
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 18, margin: 0 }}>{menu.nama}</p>
              {menu.deskripsi && <p style={{ color: '#555', fontSize: 13, margin: '2px 0 0' }}>{menu.deskripsi}</p>}
            </div>
          </div>

          {/* Harga Jual */}
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={14} color="#22c55e" />
                <span style={{ color: '#aaa', fontSize: 13 }}>Harga Jual per Unit</span>
              </div>
              <button
                onClick={() => { setEditHarga(!editHarga); setHargaJual(menu.harga_jual.toString()); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#555', fontSize: 12 }}
              >
                <Edit3 size={12} color="#555" /> Edit
              </button>
            </div>
            {editHarga ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 14 }}>Rp</span>
                  <input
                    type="number" value={hargaJual}
                    onChange={e => setHargaJual((e.target as any).value)}
                    style={{ ...inp, paddingLeft: 34 }}
                  />
                </div>
                <button
                  onClick={() => updateHargaMutation.mutate(parseFloat(hargaJual))}
                  disabled={updateHargaMutation.isPending}
                  style={{ padding: '10px 16px', backgroundColor: '#22c55e', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Simpan
                </button>
                <button
                  onClick={() => setEditHarga(false)}
                  style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            ) : (
              <p style={{ color: '#22c55e', fontSize: 24, fontWeight: 700, margin: '8px 0 0' }}>
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
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Versi Resep</span>
            </div>
            <button
              onClick={() => setShowTambahResep(!showTambahResep)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '6px 12px', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}
            >
              <Plus size={13} color="#60a5fa" /> Tambah Versi
            </button>
          </div>

          {/* Form tambah resep */}
          {showTambahResep && (
            <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>NAMA VERSI</label>
                <input value={namaVersi} onChange={e => setNamaVersi((e.target as any).value)} placeholder="v2, less-sugar, dll" style={inp} />
              </div>
              {bahanLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    value={line.bahan_baku_id}
                    onChange={e => updateLine(i, 'bahan_baku_id', (e.target as any).value)}
                    style={{ ...inp, flex: 2, cursor: 'pointer' }}
                  >
                    <option value="">Pilih bahan...</option>
                    {bahanList.map((b: any) => (
                      <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>{b.nama} ({b.satuan})</option>
                    ))}
                  </select>
                  <input
                    type="number" value={line.qty_per_unit}
                    onChange={e => updateLine(i, 'qty_per_unit', (e.target as any).value)}
                    placeholder="qty/unit" style={{ ...inp, width: 100 }}
                  />
                  <input value={line.satuan} readOnly style={{ ...inp, width: 70, color: '#555' }} />
                  <button
                    onClick={() => setBahanLines(bahanLines.filter((_, idx) => idx !== i))}
                    disabled={bahanLines.length === 1}
                    style={{ padding: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <Trash2 size={13} color="#f87171" />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setBahanLines([...bahanLines, { bahan_baku_id: '', qty_per_unit: '', satuan: '' }])}
                  style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 13 }}
                >
                  + Tambah Bahan
                </button>
                <button
                  onClick={handleTambahResep}
                  disabled={tambahResepMutation.isPending}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#60a5fa', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  {tambahResepMutation.isPending ? 'Menyimpan...' : 'Simpan Resep'}
                </button>
              </div>
            </div>
          )}

          {/* Daftar resep */}
          {(menu.resep_list ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
              Belum ada resep. Tambahkan versi resep pertama.
            </div>
          ) : (
            (menu.resep_list ?? []).map((resep: any) => (
              <div
                key={resep.id}
                style={{
                  border: `1px solid ${resep.is_active ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                  background: resep.is_active ? 'rgba(96,165,250,0.05)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: resep.is_active ? '#60a5fa' : '#aaa', fontWeight: 600, fontSize: 14 }}>
                      {resep.nama_versi}
                    </span>
                    {resep.is_active && (
                      <span style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>AKTIF</span>
                    )}
                  </div>
                  {!resep.is_active && (
                    <button
                      onClick={() => aktifkanResepMutation.mutate(resep.id)}
                      disabled={aktifkanResepMutation.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 7, padding: '5px 10px', color: '#60a5fa', fontSize: 12, cursor: 'pointer' }}
                    >
                      <CheckCircle size={12} color="#60a5fa" /> Jadikan Aktif
                    </button>
                  )}
                </div>
                {(resep.bahan_list ?? []).map((b: any) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: '#666', fontSize: 13 }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</span>
                    <span style={{ color: '#555', fontSize: 13 }}>{b.qty_per_unit} {b.satuan}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
