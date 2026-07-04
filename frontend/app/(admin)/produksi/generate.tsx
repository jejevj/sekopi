import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Zap, AlertTriangle, CheckCircle2,
  TrendingDown, TrendingUp, Package,
} from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

const KATEGORI_OPTIONS = [
  { value: 'human_error', label: 'Human Error (tumpah, salah takaran)' },
  { value: 'bahan',       label: 'Bahan (kualitas, kurang stok)' },
  { value: 'alat',        label: 'Alat (mesin error, rusak)' },
  { value: 'lainnya',     label: 'Lainnya' },
];

export default function GenerateUnitPage() {
  const { mo_id } = useLocalSearchParams<{ mo_id: string }>();
  const router    = useRouter();
  const qc        = useQueryClient();

  const [jumlah, setJumlah]                   = useState('');
  const [expiryDate, setExpiryDate]           = useState('');
  const [hargaModal, setHargaModal]           = useState('');
  const [alasanSelisih, setAlasanSelisih]     = useState('');
  const [kategoriSelisih, setKategoriSelisih] = useState('');
  const [result, setResult]                   = useState<any>(null);
  const [formError, setFormError]             = useState('');
  const [toast, setToast]                     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: mo, isLoading: loadingMO } = useQuery({
    queryKey: ['mo', mo_id],
    queryFn:  () => api.get(`/manufacturing-orders/${mo_id}`).then(r => r.data),
    enabled:  !!mo_id,
  });

  const targetQty  = mo?.target_qty ?? 0;
  const jumlahNum  = jumlah ? parseInt(jumlah) : 0;
  const selisih    = jumlahNum > 0 ? jumlahNum - targetQty : 0;
  const adaSelisih = jumlah !== '' && jumlahNum > 0 && selisih !== 0;

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/production-units/generate', payload).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['prod-ready'] });
      qc.invalidateQueries({ queryKey: ['mo', mo_id] });
      setResult(data);
    },
    onError: (e: any) => {
      showToast(e.response?.data?.detail ?? 'Terjadi kesalahan saat generate unit', 'err');
    },
  });

  const handleSubmit = () => {
    setFormError('');
    if (!jumlah || jumlahNum <= 0) {
      setFormError('Jumlah unit wajib diisi dan harus lebih dari 0.');
      return;
    }
    if (!expiryDate) {
      setFormError('Tanggal expiry wajib diisi.');
      return;
    }
    if (adaSelisih && !alasanSelisih.trim()) {
      setFormError(`Jumlah (${jumlah}) berbeda dari target (${targetQty}). Harap isi alasan selisih.`);
      return;
    }
    mutation.mutate({
      mo_id:            parseInt(mo_id!),
      jumlah:           jumlahNum,
      expiry_date:      expiryDate,
      harga_modal:      hargaModal ? parseFloat(hargaModal) : undefined,
      alasan_selisih:   adaSelisih ? alasanSelisih.trim() : undefined,
      kategori_selisih: adaSelisih && kategoriSelisih ? kategoriSelisih : undefined,
    });
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
    borderRadius: 14, padding: 24, marginBottom: 20,
  };

  // ---- loading ----
  if (loadingMO) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Generate Unit" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #f44444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#555', fontSize: 13 }}>Memuat data MO...</span>
      </div>
    </div>
  );

  // ---- hasil generate ----
  if (result) {
    const { batch, units } = result;
    const kurang  = batch?.selisih_qty < 0;
    const lebih   = batch?.selisih_qty > 0;
    const sesuai  = batch?.selisih_qty === 0;
    const accentColor = sesuai ? '#22c55e' : kurang ? '#ef4444' : '#eab308';
    const unitList    = Array.isArray(units) ? units : [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
        <Navbar title="Hasil Generate" />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Status card */}
          <div style={{ ...card, border: `1px solid ${accentColor}44`, background: `${accentColor}0d`, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              {sesuai  ? <CheckCircle2  size={20} color="#22c55e" /> :
               kurang  ? <TrendingDown  size={20} color="#ef4444" /> :
                         <TrendingUp    size={20} color="#eab308" />}
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                {sesuai ? 'Berhasil Sesuai Target' : `Selisih ${kurang ? 'Kurang' : 'Lebih'} ${Math.abs(batch?.selisih_qty ?? 0)} Unit`}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Target',  val: batch?.jumlah_target, color: '#888' },
                { label: 'Aktual',  val: batch?.jumlah_aktual, color: 'white' },
                { label: 'Selisih', val: batch?.selisih_qty > 0 ? `+${batch.selisih_qty}` : batch?.selisih_qty, color: accentColor },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 8px' }}>
                  <p style={{ color: '#555', fontSize: 11, margin: '0 0 4px', letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: 22, fontWeight: 700, margin: 0 }}>{s.val ?? '-'}</p>
                </div>
              ))}
            </div>

            {batch?.alasan_selisih && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                <p style={{ color: '#666', fontSize: 12, margin: '0 0 2px' }}>Alasan: <span style={{ color: '#888' }}>{batch.alasan_selisih}</span></p>
                {batch.kategori_selisih && <p style={{ color: '#666', fontSize: 12, margin: 0 }}>Kategori: <span style={{ color: '#888' }}>{batch.kategori_selisih}</span></p>}
              </div>
            )}

            {batch?.harga_jual && (
              <p style={{ color: '#22c55e', fontSize: 13, margin: '10px 0 0' }}>Harga jual: Rp {Number(batch.harga_jual).toLocaleString('id-ID')} / unit</p>
            )}
          </div>

          {/* List barcode */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Package size={14} color="#60a5fa" />
              <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: 0 }}>{unitList.length} Unit Dibuat</p>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unitList.map((u: any) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 12 }}>{u.barcode}</span>
                  <span style={{ color: '#444', fontSize: 12 }}>exp: {u.expiry_date}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => router.push(`/(admin)/mo/${mo_id}` as any)}
              style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#aaa', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Kembali ke MO
            </button>
            <button
              onClick={() => router.push('/(admin)/produksi' as any)}
              style={{ flex: 1, padding: 12, backgroundColor: '#f44444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Lihat Produksi
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ---- form ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Generate Unit Produksi" />

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

        {/* Inline form error */}
        {formError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '11px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
            {formError}
          </div>
        )}

        {/* Info MO */}
        {mo && (
          <div style={{ ...card, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)' }}>
            <p style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13, margin: '0 0 4px' }}>{mo.nomor_mo}</p>
            <p style={{ color: 'white', fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{mo.nama_produk}</p>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Target Produksi: <span style={{ color: '#aaa', fontWeight: 600 }}>{mo.target_qty} unit</span></p>
          </div>
        )}

        {/* Form */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Zap size={15} color="#f87171" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Detail Generate</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Jumlah aktual */}
            <div>
              <label style={lbl}>JUMLAH UNIT AKTUAL *</label>
              <input type="number" value={jumlah}
                onChange={e => { setJumlah((e.target as any).value); setFormError(''); }}
                placeholder={`Target: ${targetQty} unit`} style={inp} />
              {jumlah && jumlahNum > 0 && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selisih === 0
                    ? <><CheckCircle2 size={13} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 12 }}>Sesuai target ({targetQty} unit)</span></>
                    : selisih < 0
                      ? <><TrendingDown size={13} color="#ef4444" /><span style={{ color: '#ef4444', fontSize: 12 }}>Kurang {Math.abs(selisih)} unit dari target — wajib isi alasan</span></>
                      : <><TrendingUp size={13} color="#eab308" /><span style={{ color: '#eab308', fontSize: 12 }}>Lebih {selisih} unit dari target — wajib isi alasan</span></>}
                </div>
              )}
            </div>

            {/* Expiry */}
            <div>
              <label style={lbl}>TANGGAL EXPIRY *</label>
              <input type="date" value={expiryDate}
                onChange={e => setExpiryDate((e.target as any).value)}
                style={{ ...inp, colorScheme: 'dark' } as any} />
            </div>

            {/* Harga modal */}
            <div>
              <label style={lbl}>HARGA MODAL / UNIT (opsional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 13, pointerEvents: 'none' }}>Rp</span>
                <input type="number" value={hargaModal}
                  onChange={e => setHargaModal((e.target as any).value)}
                  placeholder="3000"
                  style={{ ...inp, paddingLeft: 36 }} />
              </div>
              {hargaModal && (
                <p style={{ color: '#22c55e', fontSize: 12, margin: '4px 0 0' }}>
                  = Rp {(parseFloat(hargaModal) || 0).toLocaleString('id-ID')} / unit
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Selisih section — muncul hanya jika ada selisih */}
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
                <textarea value={alasanSelisih}
                  onChange={e => setAlasanSelisih((e.target as any).value)}
                  placeholder={selisih < 0
                    ? 'Contoh: 2 cup tumpah saat filling, bahan baku habis lebih cepat dari perkiraan'
                    : 'Contoh: Takaran bahan lebih efisien dari resep, batch bahan lebih besar'
                  }
                  rows={3}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={lbl}>KATEGORI SELISIH (opsional)</label>
                <select value={kategoriSelisih}
                  onChange={e => setKategoriSelisih((e.target as any).value)}
                  style={{ ...inp, cursor: 'pointer' }}>
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
          style={{
            width: '100%', padding: 13,
            backgroundColor: mutation.isPending ? 'rgba(244,68,68,0.4)' : '#f44444',
            border: 'none', borderRadius: 12, color: 'white',
            fontWeight: 700, fontSize: 15,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {mutation.isPending ? 'Memproses...' : `Generate ${jumlahNum > 0 ? jumlahNum : '...'} Unit`}
        </button>

      </div>
    </div>
  );
}
