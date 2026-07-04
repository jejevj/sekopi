import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { ArrowLeft, ClipboardList, Package, BookOpen, Info } from 'lucide-react-native';

export default function BuatMOPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [menuId, setMenuId] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [tanggalRencana, setTanggalRencana] = useState('');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');

  const { data: menuData } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu/').then(r => r.data),
  });
  const menuList: any[] = (Array.isArray(menuData) ? menuData : []).filter((m: any) => m.is_active);

  const menuDipilih = menuList.find(m => m.id.toString() === menuId) ?? null;
  const resepAktif = menuDipilih?.resep_list?.find((r: any) => r.is_active) ?? null;

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
    if (!menuId) { setError('Pilih menu terlebih dahulu.'); return; }
    if (!targetQty || parseFloat(targetQty) <= 0) { setError('Target qty wajib diisi.'); return; }
    if (!tanggalRencana) { setError('Tanggal rencana wajib diisi.'); return; }
    if (!resepAktif) { setError('Menu yang dipilih belum memiliki resep aktif. Tambahkan resep di halaman Menu dulu.'); return; }

    const bahanLines = resepAktif.bahan_list.map((b: any) => ({
      bahan_baku_id: b.bahan_baku_id,
      qty_rencana: parseFloat((b.qty_per_unit * parseFloat(targetQty)).toFixed(6)),
      qty_per_unit: b.qty_per_unit,
      satuan: b.satuan,
    }));

    mutation.mutate({
      menu_id: parseInt(menuId),
      nama_produk: menuDipilih.nama,
      target_qty: parseFloat(targetQty),
      satuan: 'unit',
      tanggal_rencana: tanggalRencana,
      catatan: catatan.trim() || undefined,
      bahan_baku_lines: bahanLines,
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

        {/* Pilih Menu */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <BookOpen size={16} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Pilih Menu</span>
          </div>
          <div>
            <label style={lbl}>MENU PRODUK *</label>
            <select value={menuId} onChange={e => setMenuId((e.target as any).value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">Pilih menu...</option>
              {menuList.map((m: any) => (
                <option key={m.id} value={m.id} style={{ background: '#1a1a1a' }}>
                  {m.nama} — Rp {Number(m.harga_jual).toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>

          {menuDipilih && (
            <div style={{ marginTop: 14, background: resepAktif ? 'rgba(96,165,250,0.06)' : 'rgba(234,179,8,0.06)', border: `1px solid ${resepAktif ? 'rgba(96,165,250,0.2)' : 'rgba(234,179,8,0.2)'}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Info size={13} color={resepAktif ? '#60a5fa' : '#eab308'} />
                <span style={{ color: resepAktif ? '#60a5fa' : '#eab308', fontSize: 13, fontWeight: 600 }}>
                  {resepAktif ? `Resep Aktif: ${resepAktif.nama_versi}` : '⚠️ Belum ada resep aktif!'}
                </span>
              </div>
              {resepAktif && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {resepAktif.bahan_list?.map((b: any) => (
                    <div key={b.bahan_baku_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666', fontSize: 13 }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</span>
                      <span style={{ color: '#555', fontSize: 13 }}>{b.qty_per_unit} {b.satuan} / unit</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6 }}>
                    <span style={{ color: '#22c55e', fontSize: 13 }}>Harga Jual: Rp {Number(menuDipilih.harga_jual).toLocaleString('id-ID')} / unit</span>
                  </div>
                </div>
              )}
              {!resepAktif && (
                <button
                  onClick={() => router.push(`/(admin)/menu/${menuDipilih.id}` as any)}
                  style={{ marginTop: 6, background: 'none', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 7, padding: '6px 12px', color: '#eab308', fontSize: 12, cursor: 'pointer' }}
                >
                  Tambah Resep di Halaman Menu →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Detail MO */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <ClipboardList size={16} color="#60a5fa" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Detail Produksi</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>TARGET QTY *</label>
              <input type="number" value={targetQty} onChange={e => setTargetQty((e.target as any).value)} placeholder="100" style={inp} />
            </div>
            <div>
              <label style={lbl}>SATUAN</label>
              <input value="unit" readOnly style={{ ...inp, color: '#555', cursor: 'default', backgroundColor: 'rgba(255,255,255,0.02)' }} />
            </div>
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

        {/* Preview BOM */}
        {resepAktif && targetQty && parseFloat(targetQty) > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Package size={14} color="#555" />
              <span style={{ color: '#555', fontSize: 13, fontWeight: 600 }}>Preview BOM untuk {targetQty} unit</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 8, textTransform: 'uppercase' }}>Bahan</th>
                  <th style={{ textAlign: 'right', color: '#444', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 8, textTransform: 'uppercase' }}>Per Unit</th>
                  <th style={{ textAlign: 'right', color: '#444', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, paddingBottom: 8, textTransform: 'uppercase' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resepAktif.bahan_list?.map((b: any) => (
                  <tr key={b.bahan_baku_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ color: '#666', fontSize: 13, padding: '6px 0' }}>{b.nama_bahan ?? `Bahan ID-${b.bahan_baku_id}`}</td>
                    <td style={{ color: '#555', fontSize: 13, textAlign: 'right', padding: '6px 0' }}>{b.qty_per_unit} {b.satuan}</td>
                    <td style={{ color: '#aaa', fontSize: 13, textAlign: 'right', padding: '6px 0', fontWeight: 600 }}>
                      {(b.qty_per_unit * parseFloat(targetQty)).toFixed(3)} {b.satuan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || !menuId || !resepAktif}
          style={{
            width: '100%', padding: 13,
            backgroundColor: (mutation.isPending || !menuId || !resepAktif) ? 'rgba(244,68,68,0.3)' : '#f44444',
            border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15,
            cursor: (mutation.isPending || !menuId || !resepAktif) ? 'not-allowed' : 'pointer',
          }}
        >
          {mutation.isPending ? 'Menyimpan...' : 'Buat Manufacturing Order'}
        </button>

      </div>
    </div>
  );
}
