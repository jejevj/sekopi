import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft, Zap, AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

const KATEGORI_OPTIONS = [
  { value: 'human_error', label: 'Human Error (tumpah, salah takaran)' },
  { value: 'bahan', label: 'Bahan (kualitas, kurang stok)' },
  { value: 'alat', label: 'Alat (mesin error, rusak)' },
  { value: 'lainnya', label: 'Lainnya' },
];

export default function GenerateUnitPage() {
  const { mo_id } = useLocalSearchParams<{ mo_id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [jumlah, setJumlah] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [hargaModal, setHargaModal] = useState('');
  const [alasanSelisih, setAlasanSelisih] = useState('');
  const [kategoriSelisih, setKategoriSelisih] = useState('');
  const [result, setResult] = useState<any>(null);

  const { data: mo, isLoading: loadingMO } = useQuery({
    queryKey: ['mo', mo_id],
    queryFn: () => api.get(`/manufacturing-orders/${mo_id}`).then(r => r.data),
    enabled: !!mo_id,
  });

  const targetQty = mo?.target_qty ?? 0;
  const selisih = jumlah ? parseInt(jumlah) - targetQty : 0;
  const adaSelisih = jumlah !== '' && selisih !== 0;

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/production-units/generate', payload).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['prod-ready'] });
      qc.invalidateQueries({ queryKey: ['mo', mo_id] });
      setResult(data);
    },
    onError: (e: any) => Alert.alert('Gagal', e.response?.data?.detail ?? 'Terjadi kesalahan'),
  });

  const handleSubmit = () => {
    if (!jumlah || parseInt(jumlah) <= 0) { Alert.alert('Error', 'Jumlah unit wajib diisi'); return; }
    if (!expiryDate) { Alert.alert('Error', 'Tanggal expiry wajib diisi'); return; }
    if (adaSelisih && !alasanSelisih.trim()) {
      Alert.alert('Alasan Wajib', `Jumlah (${jumlah}) berbeda dari target (${targetQty}). Harap isi alasan selisih.`);
      return;
    }
    mutation.mutate({
      mo_id: parseInt(mo_id!),
      jumlah: parseInt(jumlah),
      expiry_date: expiryDate,
      harga_modal: hargaModal ? parseFloat(hargaModal) : undefined,
      alasan_selisih: adaSelisih ? alasanSelisih.trim() : undefined,
      kategori_selisih: adaSelisih && kategoriSelisih ? kategoriSelisih : undefined,
    });
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none' };
  const lbl: React.CSSProperties = { color: '#aaa', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', letterSpacing: 0.5 };
  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 20 };

  if (loadingMO) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Generate Unit" />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <ActivityIndicator size="large" color="#f44444" />
      </div>
    </div>
  );

  // Tampilan hasil generate
  if (result) {
    const { batch, units, peringatan_selisih } = result;
    const kurang = batch.selisih_qty < 0;
    const lebih = batch.selisih_qty > 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
        <Navbar title="Hasil Generate" />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 680, margin: '0 auto', width: '100%' }}>

          {/* Status */}
          <div style={{
            ...card,
            border: `1px solid ${batch.selisih_qty === 0 ? 'rgba(34,197,94,0.3)' : kurang ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
            background: batch.selisih_qty === 0 ? 'rgba(34,197,94,0.05)' : kurang ? 'rgba(239,68,68,0.05)' : 'rgba(234,179,8,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {batch.selisih_qty === 0
                ? <CheckCircle size={20} color="#22c55e" />
                : kurang ? <TrendingDown size={20} color="#ef4444" /> : <TrendingUp size={20} color="#eab308" />}
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                {batch.selisih_qty === 0 ? 'Generate Berhasil Sesuai Target' : peringatan_selisih}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[{ label: 'Target', val: batch.jumlah_target, color: '#aaa' },
                { label: 'Aktual', val: batch.jumlah_aktual, color: 'white' },
                { label: 'Selisih', val: batch.selisih_qty > 0 ? `+${batch.selisih_qty}` : batch.selisih_qty, color: batch.selisih_qty === 0 ? '#22c55e' : kurang ? '#ef4444' : '#eab308' }
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ color: '#555', fontSize: 12, margin: '0 0 4px' }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 22, fontWeight: 700, margin: 0 }}>{s.val}</p>
                </div>
              ))}
            </div>
            {batch.alasan_selisih && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#555', fontSize: 12, margin: '0 0 4px' }}>Alasan: <span style={{ color: '#777' }}>{batch.alasan_selisih}</span></p>
                {batch.kategori_selisih && <p style={{ color: '#555', fontSize: 12, margin: 0 }}>Kategori: <span style={{ color: '#777' }}>{batch.kategori_selisih}</span></p>}
              </div>
            )}
            {batch.harga_jual && (
              <div style={{ marginTop: 10 }}>
                <p style={{ color: '#22c55e', fontSize: 13, margin: 0 }}>Harga jual: Rp {Number(batch.harga_jual).toLocaleString('id-ID')} / unit</p>
              </div>
            )}
          </div>

          {/* List barcode */}
          <div style={card}>
            <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: '0 0 12px' }}>{units.length} Unit Dibuat</p>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {units.map((u: any) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 13 }}>{u.barcode}</span>
                  <span style={{ color: '#444', fontSize: 12 }}>exp: {u.expiry_date}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push('/(admin)/produksi' as any)}
            style={{ width: '100%', padding: 13, backgroundColor: '#f44444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Kembali ke Produksi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Generate Unit Produksi" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {/* Info MO */}
        {mo && (
          <div style={{ ...card, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)', marginBottom: 20 }}>
            <p style={{ color: '#60a5fa', fontWeight: 600, fontSize: 14, margin: '0 0 6px' }}>{mo.nomor_mo}</p>
            <p style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{mo.nama_produk}</p>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Target: <span style={{ color: '#aaa' }}>{mo.target_qty} unit</span></p>
          </div>
        )}

        {/* Form generate */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Zap size={16} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Generate Unit</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>JUMLAH UNIT AKTUAL *</label>
              <input
                type="number" value={jumlah}
                onChange={e => setJumlah((e.target as any).value)}
                placeholder={`Target: ${targetQty}`}
                style={inp}
              />
              {/* Indikator selisih real-time */}
              {jumlah && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selisih === 0
                    ? <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Sesuai target ({targetQty} unit)</span>
                    : selisih < 0
                      ? <span style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TrendingDown size={12} color="#ef4444" />
                          Kurang {Math.abs(selisih)} unit dari target — wajib isi alasan
                        </span>
                      : <span style={{ color: '#eab308', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TrendingUp size={12} color="#eab308" />
                          Lebih {selisih} unit dari target — wajib isi alasan
                        </span>}
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>TANGGAL EXPIRY *</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate((e.target as any).value)} style={{ ...inp, colorScheme: 'dark' }} />
            </div>

            <div>
              <label style={lbl}>HARGA MODAL / UNIT (opsional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 14 }}>Rp</span>
                <input type="number" value={hargaModal} onChange={e => setHargaModal((e.target as any).value)} placeholder="3000" style={{ ...inp, paddingLeft: 34 }} />
              </div>
              {mo?.menu?.harga_jual && (
                <p style={{ color: '#444', fontSize: 12, marginTop: 4 }}>
                  Harga jual dari menu: Rp {Number(mo.menu.harga_jual).toLocaleString('id-ID')} (otomatis tersimpan di unit)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form selisih — muncul hanya jika ada selisih */}
        {adaSelisih && (
          <div style={{ ...card, border: `1px solid ${selisih < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`, background: selisih < 0 ? 'rgba(239,68,68,0.05)' : 'rgba(234,179,8,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={15} color={selisih < 0 ? '#ef4444' : '#eab308'} />
              <span style={{ color: selisih < 0 ? '#ef4444' : '#eab308', fontWeight: 700, fontSize: 14 }}>
                {selisih < 0 ? `Produksi Kurang ${Math.abs(selisih)} Unit` : `Produksi Lebih ${selisih} Unit`}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>ALASAN SELISIH *</label>
                <textarea
                  value={alasanSelisih}
                  onChange={e => setAlasanSelisih((e.target as any).value)}
                  placeholder={selisih < 0
                    ? 'Contoh: 2 cup tumpah saat filling, bahan baku habis lebih cepat'
                    : 'Contoh: Takaran bahan lebih efisien dari resep, batch bahan lebih besar'
                  }
                  rows={3}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={lbl}>KATEGORI SELISIH</label>
                <select
                  value={kategoriSelisih}
                  onChange={e => setKategoriSelisih((e.target as any).value)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  <option value="">Pilih kategori...</option>
                  {KATEGORI_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{ width: '100%', padding: 13, backgroundColor: mutation.isPending ? 'rgba(244,68,68,0.5)' : '#f44444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: mutation.isPending ? 'not-allowed' : 'pointer' }}
        >
          {mutation.isPending ? 'Memproses...' : `Generate ${jumlah || '...'} Unit`}
        </button>
      </div>
    </div>
  );
}
