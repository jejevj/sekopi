import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { ArrowLeft, ClipboardList, Package, BookOpen, Info, Plus, Trash2 } from 'lucide-react-native';

function fmtQty(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

interface MOLine {
  menuId: string;
  targetQty: string;
}

const emptyLine = (): MOLine => ({ menuId: '', targetQty: '' });

export default function BuatMOPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [lines, setLines] = useState<MOLine[]>([emptyLine()]);
  const [tanggalRencana, setTanggalRencana] = useState('');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu/').then(r => r.data),
  });
  const menuList: any[] = (Array.isArray(menuData) ? menuData : []).filter((m: any) => m.is_active);

  // Helpers
  const updateLine = (idx: number, patch: Partial<MOLine>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const getMenu = (id: string) => menuList.find(m => m.id.toString() === id) ?? null;
  const getResep = (menu: any) => menu?.resep_list?.find((r: any) => r.is_active) ?? null;

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/manufacturing-orders/', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mo'] });
      router.push('/(admin)/mo' as any);
    },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Gagal membuat MO'),
  });

  const handleSubmit = () => {
    setError('');
    if (!tanggalRencana) { setError('Tanggal rencana wajib diisi.'); return; }
    if (lines.length === 0) { setError('Tambahkan minimal 1 menu.'); return; }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const menu = getMenu(l.menuId);
      const resep = getResep(menu);
      if (!l.menuId) { setError(`Line ${i + 1}: Pilih menu terlebih dahulu.`); return; }
      if (!l.targetQty || parseFloat(l.targetQty) <= 0) { setError(`Line ${i + 1}: Target qty wajib diisi.`); return; }
      if (!resep) { setError(`Line ${i + 1}: Menu "${menu?.nama}" belum memiliki resep aktif.`); return; }
    }

    const mo_lines = lines.map(l => {
      const menu = getMenu(l.menuId)!;
      const resep = getResep(menu)!;
      const qty = parseFloat(l.targetQty);
      return {
        menu_id: parseInt(l.menuId),
        nama_produk: menu.nama,
        target_qty: qty,
        satuan: 'unit',
        bahan_baku_lines: resep.bahan_list.map((b: any) => ({
          bahan_baku_id: b.bahan_baku_id,
          qty_rencana: parseFloat((b.qty_per_unit * qty).toFixed(6)),
          qty_per_unit: b.qty_per_unit,
          satuan: b.satuan,
        })),
      };
    });

    mutation.mutate({
      tanggal_rencana: tanggalRencana,
      catatan: catatan.trim() || undefined,
      mo_lines,
    });
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 20 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Buat Manufacturing Order" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Header MO */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <ClipboardList size={16} color="#60a5fa" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Detail MO</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>TANGGAL RENCANA *</label>
              <input type="date" value={tanggalRencana} onChange={e => setTanggalRencana((e.target as any).value)} style={{ ...inp, colorScheme: 'dark' } as any} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>CATATAN (opsional)</label>
              <textarea value={catatan} onChange={e => setCatatan((e.target as any).value)} placeholder="Catatan tambahan..." rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Menu yang Diproduksi</span>
          </div>
          <button
            onClick={addLine}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.3)', borderRadius: 8, padding: '7px 14px', color: '#f87171', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            <Plus size={14} color="#f87171" /> Tambah Menu
          </button>
        </div>

        {lines.map((line, idx) => {
          const menu = getMenu(line.menuId);
          const resep = getResep(menu);
          const qty = parseFloat(line.targetQty);
          return (
            <div key={idx} style={{ ...card, borderColor: 'rgba(255,255,255,0.1)' }}>
              {/* Line header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 13 }}>Line {idx + 1}</span>
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(idx)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '5px 10px', color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                  >
                    <Trash2 size={12} color="#f87171" /> Hapus
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={lbl}>MENU PRODUK *</label>
                  <select value={line.menuId} onChange={e => updateLine(idx, { menuId: (e.target as any).value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Pilih menu...</option>
                    {menuList.map((m: any) => (
                      <option key={m.id} value={m.id} style={{ background: '#1a1a1a' }}>
                        {m.nama} — Rp {Number(m.harga_jual).toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <label style={lbl}>TARGET QTY *</label>
                  <input
                    type="number" value={line.targetQty}
                    onChange={e => updateLine(idx, { targetQty: (e.target as any).value })}
                    placeholder="100"
                    style={inp}
                  />
                </div>
              </div>

              {/* Resep info */}
              {menu && (
                <div style={{ marginTop: 12, background: resep ? 'rgba(96,165,250,0.06)' : 'rgba(234,179,8,0.06)', border: `1px solid ${resep ? 'rgba(96,165,250,0.2)' : 'rgba(234,179,8,0.2)'}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: resep ? 8 : 0 }}>
                    <Info size={12} color={resep ? '#60a5fa' : '#eab308'} />
                    <span style={{ color: resep ? '#60a5fa' : '#eab308', fontSize: 12, fontWeight: 600 }}>
                      {resep ? `Resep Aktif: ${resep.nama_versi}` : '⚠️ Belum ada resep aktif!'}
                    </span>
                  </div>
                  {resep && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {resep.bahan_list?.map((b: any) => (
                        <div key={b.bahan_baku_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#666', fontSize: 12 }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</span>
                          <span style={{ color: '#555', fontSize: 12 }}>{fmtQty(b.qty_per_unit)} {b.satuan} / unit</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4, paddingTop: 4 }}>
                        <span style={{ color: '#22c55e', fontSize: 12 }}>Harga Jual: Rp {Number(menu.harga_jual).toLocaleString('id-ID')} / unit</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview BOM per line */}
              {resep && !isNaN(qty) && qty > 0 && (
                <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Package size={12} color="#555" />
                    <span style={{ color: '#555', fontSize: 12, fontWeight: 600 }}>Preview BOM — {qty} unit</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: '#444', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 6, textTransform: 'uppercase' }}>Bahan</th>
                        <th style={{ textAlign: 'right', color: '#444', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 6, textTransform: 'uppercase' }}>Per Unit</th>
                        <th style={{ textAlign: 'right', color: '#444', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 6, textTransform: 'uppercase' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resep.bahan_list?.map((b: any) => (
                        <tr key={b.bahan_baku_id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ color: '#666', fontSize: 12, padding: '4px 0' }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</td>
                          <td style={{ color: '#555', fontSize: 12, textAlign: 'right', padding: '4px 0' }}>{fmtQty(b.qty_per_unit)} {b.satuan}</td>
                          <td style={{ color: '#aaa', fontSize: 12, textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>
                            {fmtQty(b.qty_per_unit * qty)} {b.satuan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary total lines */}
        {lines.length > 1 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: 13 }}>Total Line</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{lines.length} menu</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{
            width: '100%', padding: 13,
            backgroundColor: mutation.isPending ? 'rgba(244,68,68,0.3)' : '#f44444',
            border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            marginBottom: 40,
          }}
        >
          {mutation.isPending ? 'Menyimpan...' : `Buat MO (${lines.length} Menu)`}
        </button>

      </div>
    </div>
  );
}
