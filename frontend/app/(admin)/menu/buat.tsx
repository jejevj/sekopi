import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus, Trash2, Package } from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

interface BahanLine {
  bahan_baku_id: string;
  qty_per_unit: string;
  satuan: string;
  _nama?: string;
}

export default function BuatMenuPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [namaVersi, setNamaVersi] = useState('v1');
  const [catatanResep, setCatatanResep] = useState('');
  const [bahanLines, setBahanLines] = useState<BahanLine[]>([{ bahan_baku_id: '', qty_per_unit: '', satuan: '' }]);
  const [error, setError] = useState('');

  const { data: bahanData } = useQuery({
    queryKey: ['bahan-baku'],
    queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data),
  });
  const bahanList: any[] = Array.isArray(bahanData) ? bahanData : [];

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/menu/', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      router.push('/(admin)/menu' as any);
    },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Gagal membuat menu'),
  });

  const updateLine = (i: number, field: keyof BahanLine, val: string) => {
    const next = [...bahanLines];
    if (field === 'bahan_baku_id') {
      const found = bahanList.find(b => b.id.toString() === val);
      next[i] = { ...next[i], bahan_baku_id: val, satuan: found?.satuan ?? '', _nama: found?.nama };
    } else {
      next[i] = { ...next[i], [field]: val };
    }
    setBahanLines(next);
  };

  const handleSubmit = () => {
    setError('');
    if (!nama.trim()) { setError('Nama menu wajib diisi.'); return; }
    if (!hargaJual || parseFloat(hargaJual) <= 0) { setError('Harga jual wajib diisi dan lebih dari 0.'); return; }
    const validLines = bahanLines.filter(l => l.bahan_baku_id && l.qty_per_unit);
    mutation.mutate({
      nama: nama.trim(),
      deskripsi: deskripsi.trim() || undefined,
      harga_jual: parseFloat(hargaJual),
      resep: validLines.length > 0 ? {
        nama_versi: namaVersi.trim() || 'v1',
        catatan: catatanResep.trim() || undefined,
        bahan_list: validLines.map(l => ({
          bahan_baku_id: parseInt(l.bahan_baku_id),
          qty_per_unit: parseFloat(l.qty_per_unit),
          satuan: l.satuan,
        })),
      } : undefined,
    });
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, color: 'white', fontSize: 14, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    color: '#aaa', fontSize: 12, fontWeight: 600,
    marginBottom: 6, display: 'block', letterSpacing: 0.5,
  };
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 24, marginBottom: 20,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Tambah Menu Baru" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Info Menu */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <BookOpen size={16} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Informasi Menu</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>NAMA MENU *</label>
              <input value={nama} onChange={e => setNama((e.target as any).value)} placeholder="Kopi Susu Gula Aren" style={inp} />
            </div>
            <div>
              <label style={lbl}>HARGA JUAL PER UNIT *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 14 }}>Rp</span>
                <input
                  type="number" value={hargaJual}
                  onChange={e => setHargaJual((e.target as any).value)}
                  placeholder="8000"
                  style={{ ...inp, paddingLeft: 36 }}
                />
              </div>
            </div>
            <div>
              <label style={lbl}>DESKRIPSI (opsional)</label>
              <textarea value={deskripsi} onChange={e => setDeskripsi((e.target as any).value)}
                placeholder="Kopi susu dengan gula aren asli..." rows={2}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>

        {/* Resep */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={16} color="#60a5fa" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Resep Pertama</span>
              <span style={{ color: '#444', fontSize: 12 }}>(opsional, bisa ditambah nanti)</span>
            </div>
            <button
              onClick={() => setBahanLines([...bahanLines, { bahan_baku_id: '', qty_per_unit: '', satuan: '' }])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', color: '#aaa', cursor: 'pointer', fontSize: 13 }}
            >
              <Plus size={13} color="#aaa" /> Tambah Bahan
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>NAMA VERSI RESEP</label>
              <input value={namaVersi} onChange={e => setNamaVersi((e.target as any).value)} placeholder="v1" style={inp} />
            </div>
            <div>
              <label style={lbl}>CATATAN RESEP</label>
              <input value={catatanResep} onChange={e => setCatatanResep((e.target as any).value)} placeholder="Opsional..." style={inp} />
            </div>
          </div>

          {bahanLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                {i === 0 && <label style={lbl}>BAHAN BAKU</label>}
                <select
                  value={line.bahan_baku_id}
                  onChange={e => updateLine(i, 'bahan_baku_id', (e.target as any).value)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="">Pilih bahan baku...</option>
                  {bahanList.map((b: any) => (
                    <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>
                      {b.nama} ({b.satuan})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <label style={lbl}>QTY / UNIT</label>}
                <input
                  type="number" value={line.qty_per_unit}
                  onChange={e => updateLine(i, 'qty_per_unit', (e.target as any).value)}
                  placeholder="0" style={inp}
                />
              </div>
              <div style={{ width: 80 }}>
                {i === 0 && <label style={lbl}>SATUAN</label>}
                <input value={line.satuan} readOnly
                  style={{ ...inp, color: '#666', cursor: 'default', backgroundColor: 'rgba(255,255,255,0.03)' }} />
              </div>
              <button
                onClick={() => setBahanLines(bahanLines.filter((_, idx) => idx !== i))}
                disabled={bahanLines.length === 1}
                style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: bahanLines.length === 1 ? 'not-allowed' : 'pointer', opacity: bahanLines.length === 1 ? 0.4 : 1 }}
              >
                <Trash2 size={15} color="#f87171" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{ width: '100%', padding: 13, backgroundColor: mutation.isPending ? 'rgba(244,68,68,0.5)' : '#f44444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: mutation.isPending ? 'not-allowed' : 'pointer' }}
        >
          {mutation.isPending ? 'Menyimpan...' : 'Simpan Menu'}
        </button>
      </div>
    </div>
  );
}
