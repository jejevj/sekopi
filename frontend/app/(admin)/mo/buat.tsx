import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { ArrowLeft, Plus, Trash2, ClipboardList, Package } from 'lucide-react-native';

interface BahanLine {
  bahan_baku_id: string;
  qty_rencana: string;
  satuan: string;
  _nama?: string;
  _satuan_ref?: string;
  _satuan_display?: string;
  _konversi?: number | null;
}

export default function BuatMOPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ nama_produk: '', target_qty: '', satuan: 'unit', tanggal_rencana: '', catatan: '' });
  const [lines, setLines] = useState<BahanLine[]>([{ bahan_baku_id: '', qty_rencana: '', satuan: '' }]);
  const [error, setError] = useState('');

  const { data: bahanData } = useQuery({
    queryKey: ['bahan-baku'],
    queryFn: () => api.get('/inventori/bahan-baku').then(r => r.data),
  });
  const bahanList: any[] = Array.isArray(bahanData) ? bahanData : [];

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/manufacturing-orders', payload).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mo'] }); router.push('/(admin)/mo' as any); },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Gagal membuat MO'),
  });

  const addLine = () => setLines([...lines, { bahan_baku_id: '', qty_rencana: '', satuan: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof BahanLine, val: string) => {
    const next = [...lines];
    if (field === 'bahan_baku_id') {
      const found = bahanList.find(b => b.id.toString() === val);
      next[i] = {
        ...next[i],
        bahan_baku_id: val,
        satuan: found?.satuan ?? '',
        _nama: found?.nama,
        _satuan_ref: found?.satuan,
        _satuan_display: found?.satuan_display,
        _konversi: found?.konversi_factor ?? null,
      };
    } else {
      next[i] = { ...next[i], [field]: val };
    }
    setLines(next);
  };

  const handleSubmit = () => {
    setError('');
    if (!form.nama_produk || !form.target_qty || !form.tanggal_rencana) { setError('Nama produk, target qty, dan tanggal rencana wajib diisi.'); return; }
    const validLines = lines.filter(l => l.bahan_baku_id && l.qty_rencana);
    mutation.mutate({
      ...form,
      target_qty: parseFloat(form.target_qty),
      bahan_baku_lines: validLines.map(l => ({
        bahan_baku_id: parseInt(l.bahan_baku_id),
        qty_rencana: parseFloat(l.qty_rencana),
        satuan: l.satuan,
      })),
    });
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' };
  const lbl: React.CSSProperties = { color: '#aaa', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', letterSpacing: 0.5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Buat Manufacturing Order" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 20 }}>{error}</div>}

        {/* Info MO */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <ClipboardList size={16} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Informasi MO</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>NAMA PRODUK</label>
              <input value={form.nama_produk} onChange={e => setForm({ ...form, nama_produk: e.target.value })} placeholder="Kopi Susu Gula Aren" style={inp} />
            </div>
            <div>
              <label style={lbl}>TARGET QTY</label>
              <input type="number" value={form.target_qty} onChange={e => setForm({ ...form, target_qty: e.target.value })} placeholder="100" style={inp} />
            </div>
            <div>
              <label style={lbl}>SATUAN</label>
              <input value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} placeholder="unit" style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>TANGGAL RENCANA</label>
              <input type="date" value={form.tanggal_rencana} onChange={e => setForm({ ...form, tanggal_rencana: e.target.value })} style={{ ...inp, colorScheme: 'dark' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>CATATAN (opsional)</label>
              <textarea value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan tambahan..." rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {/* Bahan Baku */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={16} color="#60a5fa" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Bahan Baku</span>
            </div>
            <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>
              <Plus size={13} color="#aaa" /> Tambah
            </button>
          </div>

          {lines.map((line, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                {/* Pilih bahan */}
                <div style={{ flex: 2 }}>
                  {i === 0 && <label style={lbl}>BAHAN BAKU</label>}
                  <select value={line.bahan_baku_id} onChange={e => updateLine(i, 'bahan_baku_id', e.target.value)}
                    style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Pilih bahan baku...</option>
                    {bahanList.map((b: any) => (
                      <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>
                        {b.nama} ({b.satuan}){b.saldo !== undefined ? ` — stok: ${b.saldo}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Qty */}
                <div style={{ flex: 1 }}>
                  {i === 0 && <label style={lbl}>QTY ({line._satuan_ref || 'satuan'})</label>}
                  <input type="number" value={line.qty_rencana}
                    onChange={e => updateLine(i, 'qty_rencana', e.target.value)}
                    placeholder="0" style={inp} />
                </div>
                {/* Satuan (readonly, dari master) */}
                <div style={{ width: 80 }}>
                  {i === 0 && <label style={lbl}>SATUAN</label>}
                  <input value={line.satuan} readOnly
                    style={{ ...inp, color: '#666', cursor: 'default', backgroundColor: 'rgba(255,255,255,0.03)' }} />
                </div>
                <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                  style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: lines.length === 1 ? 'not-allowed' : 'pointer', opacity: lines.length === 1 ? 0.4 : 1 }}>
                  <Trash2 size={15} color="#f87171" />
                </button>
              </div>
              {/* Helper konversi */}
              {line._konversi && line.qty_rencana && (
                <div style={{ color: '#555', fontSize: 11, marginTop: 4, paddingLeft: 2 }}>
                  = {(parseFloat(line.qty_rencana) * line._konversi).toFixed(0)} {line._satuan_display}
                </div>
              )}
              {/* Warning stok */}
              {line.bahan_baku_id && line.qty_rencana && (() => {
                const b = bahanList.find(b => b.id.toString() === line.bahan_baku_id);
                if (!b) return null;
                const kurang = parseFloat(line.qty_rencana) > b.saldo;
                return kurang ? (
                  <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 4, paddingLeft: 2 }}>
                    ⚠️ Stok tersedia: {b.saldo} {b.satuan} (kurang {(parseFloat(line.qty_rencana) - b.saldo).toFixed(3)})
                  </div>
                ) : (
                  <div style={{ color: '#22c55e', fontSize: 11, marginTop: 4, paddingLeft: 2 }}>
                    ✓ Stok cukup ({b.saldo} {b.satuan})
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={mutation.isPending}
          style={{ width: '100%', padding: '13px', backgroundColor: mutation.isPending ? 'rgba(244,68,68,0.5)' : '#f44444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: mutation.isPending ? 'not-allowed' : 'pointer' }}>
          {mutation.isPending ? 'Menyimpan...' : 'Buat Manufacturing Order'}
        </button>
      </div>
    </div>
  );
}
