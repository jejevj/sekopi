import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, XCircle, Sparkles, ChevronDown, ChevronUp,
  Package, ClipboardList, AlertTriangle, CheckCircle2,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Draft',        color: '#6b7280' },
  confirmed:   { label: 'Dikonfirmasi', color: '#3b82f6' },
  in_progress: { label: 'Produksi',     color: '#eab308' },
  done:        { label: 'Selesai',      color: '#22c55e' },
  cancelled:   { label: 'Dibatalkan',   color: '#ef4444' },
};

const NEXT_STATUS: Record<string, { next: string; label: string; danger?: boolean }[]> = {
  draft:       [{ next: 'confirmed',   label: 'Setujui MO' },
                { next: 'cancelled',   label: 'Batalkan MO', danger: true }],
  confirmed:   [{ next: 'in_progress', label: 'Mulai Produksi' },
                { next: 'cancelled',   label: 'Batalkan MO', danger: true }],
  in_progress: [{ next: 'done',        label: 'Tandai Selesai (DONE)' },
                { next: 'cancelled',   label: 'Batalkan MO', danger: true }],
};

const STATUS_UNIT_COLOR: Record<string, string> = {
  ready:            '#3b82f6',
  dispatched:       '#eab308',
  delivered:        '#9333ea',
  sold:             '#22c55e',
  expired:          '#ef4444',
  void:             '#6b7280',
  returned_good:    '#0d9488',
  returned_damaged: '#ef4444',
};

const KATEGORI_SELISIH = [
  { value: 'human_error', label: 'Human Error' },
  { value: 'bahan',       label: 'Kualitas Bahan' },
  { value: 'alat',        label: 'Masalah Alat' },
  { value: 'lainnya',     label: 'Lainnya' },
];

function formatRp(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export default function MODetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showGenerate, setShowGenerate]       = useState(false);
  const [selectedLineId, setSelectedLineId]   = useState<number | null>(null);
  const [genJumlah, setGenJumlah]             = useState('');
  const [genExpiry, setGenExpiry]             = useState('');
  const [genModal, setGenModal]               = useState('');
  const [genAlasan, setGenAlasan]             = useState('');
  const [genKategori, setGenKategori]         = useState('');
  const [estimasiLoading, setEstimasiLoading] = useState(false);
  const [estimasiDetail, setEstimasiDetail]   = useState<any[] | null>(null);

  const [pendingStatus, setPendingStatus]     = useState<{ next: string; label: string } | null>(null);
  const [toast, setToast]                     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [generateResult, setGenerateResult]   = useState<any[] | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: mo, isLoading, error } = useQuery({
    queryKey: ['mo', id],
    queryFn: async () => (await api.get(`/manufacturing-orders/${id}`)).data,
    enabled: !!id,
  });

  const { data: units } = useQuery({
    queryKey: ['mo-units', id],
    queryFn: async () => (await api.get(`/production-units/mo/${id}?page=1&per_page=100`)).data,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) =>
      (await api.post(`/manufacturing-orders/${id}/status`, { status: newStatus })).data,
    onSuccess: (_, newStatus) => {
      qc.invalidateQueries({ queryKey: ['mo', id] });
      qc.invalidateQueries({ queryKey: ['mo'] });
      setPendingStatus(null);
      showToast(`Status berhasil diubah ke ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
    },
    onError: (err: any) => {
      setPendingStatus(null);
      showToast(err?.response?.data?.detail || 'Gagal mengubah status', 'err');
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const targetLine = moLines.find(l => l.id === selectedLineId);
      const payload: any = {
        mo_id: parseInt(id!),
        mo_line_id: selectedLineId,
        jumlah: parseInt(genJumlah),
        expiry_date: genExpiry,
        harga_modal: genModal ? parseFloat(genModal) : null,
      };
      const selisih = parseInt(genJumlah) - (targetLine?.target_qty ?? 0);
      if (selisih !== 0) {
        payload.alasan_selisih   = genAlasan;
        payload.kategori_selisih = genKategori || null;
      }
      return (await api.post('/production-units/generate', payload)).data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mo-units', id] });
      const u = data?.units ?? data;
      setGenerateResult(Array.isArray(u) ? u : []);
      setShowGenerate(false);
      setGenJumlah(''); setGenExpiry(''); setGenModal('');
      setGenAlasan(''); setGenKategori(''); setEstimasiDetail(null);
      showToast(`${Array.isArray(u) ? u.length : '?'} unit berhasil di-generate ✅`);
    },
    onError: (err: any) =>
      showToast(err?.response?.data?.detail || 'Gagal generate unit', 'err'),
  });

  const hitungOtomatis = async () => {
    setEstimasiLoading(true);
    try {
      const res  = await api.get(`/manufacturing-orders/${id}/estimasi-harga-modal`);
      const data = res.data;
      // Cari estimasi untuk line yang dipilih
      const lineEst = data.lines?.find((l: any) => l.mo_line_id === selectedLineId);
      const val = lineEst?.estimasi_per_unit ?? data.estimasi_harga_modal_per_unit;
      setEstimasiDetail(lineEst?.bahan ?? data.detail ?? []);
      if (val != null) {
        setGenModal(String(val));
        showToast(`Estimasi harga modal: ${formatRp(val)}/unit`);
      } else {
        showToast('Beberapa bahan belum ada harga beli — isi manual', 'err');
      }
    } catch {
      showToast('Gagal menghitung estimasi harga modal', 'err');
    } finally {
      setEstimasiLoading(false);
    }
  };

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0a0a0a', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #f44444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: '#555', fontSize: 14 }}>Memuat MO...</span>
    </div>
  );

  if (error || !mo) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0a0a0a', gap: 12 }}>
      <XCircle size={40} color="#ef4444" />
      <span style={{ color: '#ef4444', fontSize: 15 }}>MO tidak ditemukan</span>
      <button onClick={() => router.back()} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 20px', color: '#888', cursor: 'pointer' }}>Kembali</button>
    </div>
  );

  const cfg         = STATUS_CONFIG[mo.status] ?? STATUS_CONFIG.draft;
  const transitions = NEXT_STATUS[mo.status] ?? [];
  const totalUnits  = units?.total ?? 0;
  const unitList    = units?.items ?? [];
  const moLines: any[] = mo.lines ?? [];

  // Kalkulasi gabungan dari semua lines
  const totalTargetQty = moLines.reduce((s: number, l: any) => s + (l.target_qty ?? 0), 0);
  const namaProdukHeader = moLines.length === 1
    ? moLines[0].nama_produk
    : moLines.length > 1 ? `${moLines[0].nama_produk} +${moLines.length - 1} lainnya` : '-';

  // Generate: line yang dipilih
  const selectedLine   = moLines.find(l => l.id === selectedLineId) ?? moLines[0] ?? null;
  const genJumlahNum   = parseInt(genJumlah) || 0;
  const selisih        = selectedLine ? genJumlahNum - (selectedLine.target_qty ?? 0) : 0;
  const adaSelisih     = genJumlahNum > 0 && selisih !== 0;
  const canGenerate    = !!genJumlah && !!genExpiry && (!adaSelisih || (!!genAlasan && !!genKategori));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Detail Manufacturing Order" />

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

      {pendingStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 360, maxWidth: '90vw' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: '0 0 10px' }}>Konfirmasi</p>
            <p style={{ color: '#888', fontSize: 14, margin: '0 0 24px' }}>
              Ubah status MO ke <strong style={{ color: 'white' }}>"{pendingStatus.label}"</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingStatus(null)}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>
                Batal
              </button>
              <button
                onClick={() => statusMutation.mutate(pendingStatus.next)}
                disabled={statusMutation.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, background: '#f44444', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: statusMutation.isPending ? 0.6 : 1 }}>
                {statusMutation.isPending ? 'Memproses...' : 'Ya, Ubah'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Back + Header */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: 16, padding: 0, fontSize: 14 }}>
            <ArrowLeft size={16} color="#888" /> Kembali
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>{mo.nomor_mo}</h1>
              <p style={{ color: '#555', fontSize: 14, margin: '4px 0 0' }}>{namaProdukHeader}</p>
            </div>
            <span style={{ backgroundColor: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Target Qty', value: totalTargetQty, sub: `${moLines.length} produk`, color: 'white' },
            { label: 'Unit Generated',   value: totalUnits, sub: `dari ${totalTargetQty} target`, color: totalUnits >= totalTargetQty ? '#22c55e' : '#f44444' },
            ...(mo.estimasi_harga_modal_total != null
              ? [{ label: 'Est. Modal Total', value: formatRp(mo.estimasi_harga_modal_total), sub: 'dari BOM', color: '#22c55e' }]
              : []),
          ].map((c, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <p style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 0 6px' }}>{c.label}</p>
              <p style={{ color: c.color, fontSize: 24, fontWeight: 700, margin: 0 }}>{c.value}</p>
              <p style={{ color: '#444', fontSize: 12, margin: '2px 0 0' }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Detail MO */}
        <div style={glassCard}>
          <p style={sectionTitle}><ClipboardList size={14} color="#f87171" style={{ marginRight: 8 }} />Detail MO</p>
          <DetailRow label="Tanggal Rencana" value={mo.tanggal_rencana ?? '-'} />
          <DetailRow label="Dibuat oleh"     value={mo.created_by_user?.full_name ?? '-'} />
          <DetailRow label="Disetujui oleh"  value={mo.approved_by_user?.full_name ?? '-'} />
          <DetailRow label="Inventori oleh"  value={mo.inventori_by_user?.full_name ?? '-'} />
          {mo.catatan && <DetailRow label="Catatan" value={mo.catatan} />}
        </div>

        {/* Lines + BOM per line */}
        {moLines.map((line: any, lineIdx: number) => (
          <div key={line.id} style={{ ...glassCard, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ ...sectionTitle, margin: 0 }}>
                <Package size={14} color="#60a5fa" style={{ marginRight: 8 }} />
                Line {lineIdx + 1} — {line.nama_produk}
              </p>
              <span style={{ color: '#888', fontSize: 12 }}>Target: {line.target_qty} {line.satuan}</span>
            </div>

            {/* BOM table */}
            {!line.bahan_baku_lines?.length
              ? <p style={{ color: '#444', fontSize: 13, margin: 0 }}>Belum ada bahan baku</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Bahan', 'Qty Rencana', 'Qty Aktual', 'Per Unit', 'Est. Biaya/Cup'].map(h => (
                        <th key={h} style={{ textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {line.bahan_baku_lines.map((b: any) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 0', color: 'white', fontSize: 13 }}>{b.nama_bahan ?? '-'}</td>
                        <td style={{ padding: '10px 0', color: '#888', fontSize: 13 }}>{b.qty_rencana} {b.satuan}</td>
                        <td style={{ padding: '10px 0', color: b.qty_aktual != null ? '#22c55e' : '#444', fontSize: 13 }}>
                          {b.qty_aktual != null ? `${b.qty_aktual} ${b.satuan}` : '-'}
                        </td>
                        <td style={{ padding: '10px 0', color: '#555', fontSize: 12 }}>{b.qty_per_unit ?? '-'} {b.satuan}</td>
                        <td style={{ padding: '10px 0', color: '#3b82f6', fontSize: 12 }}>
                          {b.qty_per_unit != null && b.harga_beli_per_satuan != null
                            ? formatRp(b.qty_per_unit * b.harga_beli_per_satuan)
                            : <span style={{ color: '#333' }}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
            {line.estimasi_harga_modal != null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888', fontSize: 13 }}>Est. harga modal/unit line ini</span>
                <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>{formatRp(line.estimasi_harga_modal)}/cup</span>
              </div>
            )}
          </div>
        ))}

        {/* Aksi Status */}
        {transitions.length > 0 && (
          <div style={{ ...glassCard, marginTop: 16 }}>
            <p style={sectionTitle}>Ubah Status</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {transitions.map((t) => (
                <button
                  key={t.next}
                  onClick={() => setPendingStatus(t)}
                  style={{
                    flex: 1, minWidth: 160, padding: '11px 0', borderRadius: 10,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    border: t.danger ? '1px solid rgba(239,68,68,0.35)' : 'none',
                    backgroundColor: t.danger ? 'rgba(239,68,68,0.08)' : '#f44444',
                    color: t.danger ? '#ef4444' : 'white',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate Unit — hanya jika DONE */}
        {mo.status === 'done' && (
          <div style={{ ...glassCard, marginTop: 16 }}>
            <button
              onClick={() => { setShowGenerate(!showGenerate); setGenerateResult(null); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <p style={{ ...sectionTitle, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} color="#f87171" /> Generate Barcode Unit
              </p>
              {showGenerate ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
            </button>

            {showGenerate && (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Pilih line jika ada lebih dari 1 */}
                {moLines.length > 1 && (
                  <div>
                    <label style={lbl}>PILIH PRODUK / LINE *</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {moLines.map((l: any) => (
                        <button key={l.id} onClick={() => { setSelectedLineId(l.id); setGenJumlah(''); }}
                          style={{
                            padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                            backgroundColor: selectedLineId === l.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                            borderColor: selectedLineId === l.id ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)',
                            color: selectedLineId === l.id ? '#60a5fa' : '#666',
                          }}
                        >
                          {l.nama_produk} ({l.target_qty} unit)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jumlah Aktual */}
                <div>
                  <label style={lbl}>JUMLAH AKTUAL *</label>
                  <input type="number" value={genJumlah} onChange={e => setGenJumlah((e.target as any).value)}
                    placeholder={`Target: ${selectedLine?.target_qty ?? moLines[0]?.target_qty ?? 0} unit`} style={inp} />
                  {genJumlahNum > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selisih === 0
                        ? <><CheckCircle2 size={13} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 12 }}>Sesuai target</span></>
                        : <><AlertTriangle size={13} color={selisih < 0 ? '#ef4444' : '#eab308'} />
                            <span style={{ color: selisih < 0 ? '#ef4444' : '#eab308', fontSize: 12 }}>
                              Selisih {selisih > 0 ? '+' : ''}{selisih} unit dari target {selectedLine?.target_qty}
                            </span>
                          </>
                      }
                    </div>
                  )}
                </div>

                {adaSelisih && (
                  <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ color: '#f87171', fontSize: 12, fontWeight: 600, margin: 0, letterSpacing: 0.5 }}>WAJIB ISI — ADA SELISIH PRODUKSI</p>
                    <div>
                      <label style={lbl}>ALASAN SELISIH *</label>
                      <textarea value={genAlasan} onChange={e => setGenAlasan((e.target as any).value)}
                        placeholder="Jelaskan penyebab selisih produksi..."
                        rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={lbl}>KATEGORI SELISIH *</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {KATEGORI_SELISIH.map(k => (
                          <button key={k.value} onClick={() => setGenKategori(k.value)}
                            style={{
                              padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                              backgroundColor: genKategori === k.value ? 'rgba(244,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                              borderColor: genKategori === k.value ? 'rgba(244,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                              color: genKategori === k.value ? '#f87171' : '#666',
                            }}
                          >{k.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label style={lbl}>TANGGAL EXPIRY *</label>
                  <input type="date" value={genExpiry} onChange={e => setGenExpiry((e.target as any).value)}
                    style={{ ...inp, colorScheme: 'dark' } as any} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={lbl}>HARGA MODAL / UNIT (opsional)</label>
                    <button onClick={hitungOtomatis} disabled={estimasiLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '3px 10px', color: '#22c55e', fontSize: 11, cursor: estimasiLoading ? 'wait' : 'pointer', opacity: estimasiLoading ? 0.6 : 1 }}>
                      <Sparkles size={11} color="#22c55e" />
                      {estimasiLoading ? 'Menghitung...' : 'Hitung Otomatis'}
                    </button>
                  </div>
                  <input type="number" value={genModal} onChange={e => setGenModal((e.target as any).value)}
                    placeholder="Atau isi manual, contoh: 4150" style={inp} />
                  {genModal && (
                    <p style={{ color: '#22c55e', fontSize: 12, margin: '4px 0 0' }}>
                      = {formatRp(parseFloat(genModal) || 0)}/unit
                    </p>
                  )}
                </div>

                {estimasiDetail && estimasiDetail.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
                    <p style={{ color: '#555', fontSize: 11, fontWeight: 600, margin: '0 0 8px', letterSpacing: 0.5, textTransform: 'uppercase' }}>Breakdown Biaya</p>
                    {estimasiDetail.map((d: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: '#777', fontSize: 12 }}>{d.nama_bahan}</span>
                        <span style={{ color: d.kontribusi_per_unit != null ? 'white' : '#ef4444', fontSize: 12 }}>
                          {d.kontribusi_per_unit != null ? formatRp(d.kontribusi_per_unit) : d.keterangan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={!canGenerate || generateMutation.isPending || (moLines.length > 1 && !selectedLineId)}
                  style={{
                    padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    backgroundColor: (!canGenerate || generateMutation.isPending) ? 'rgba(244,68,68,0.25)' : '#f44444',
                    color: 'white', border: 'none',
                    cursor: (!canGenerate || generateMutation.isPending) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generateMutation.isPending ? 'Generating...' : `Generate ${genJumlahNum > 0 ? genJumlahNum : ''} Unit`}
                </button>

                {adaSelisih && !genAlasan && (
                  <p style={{ color: '#ef4444', fontSize: 12, margin: '-8px 0 0', textAlign: 'center' }}>
                    Isi alasan & kategori selisih terlebih dahulu
                  </p>
                )}
              </div>
            )}

            {generateResult && generateResult.length > 0 && (
              <div style={{ marginTop: 20, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 16 }}>
                <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 13, margin: '0 0 10px' }}>
                  ✅ {generateResult.length} unit berhasil di-generate
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {generateResult.slice(0, 20).map((u: any) => (
                    <span key={u.barcode} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 8px', color: '#aaa', fontFamily: 'monospace', fontSize: 11 }}>
                      {u.barcode}
                    </span>
                  ))}
                  {generateResult.length > 20 && <span style={{ color: '#444', fontSize: 11 }}>+{generateResult.length - 20} lainnya</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Production Units */}
        {totalUnits > 0 && (
          <div style={{ ...glassCard, marginTop: 16, marginBottom: 8 }}>
            <p style={sectionTitle}>Production Units ({totalUnits})</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Barcode', 'Produk', 'Expiry', 'Sisa Hari', 'Harga Modal', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', paddingBottom: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unitList.slice(0, 50).map((unit: any) => {
                  const uColor     = STATUS_UNIT_COLOR[unit.status] ?? '#888';
                  const isExpiring = unit.is_expiring_soon && !unit.is_expired;
                  const isExpired  = unit.is_expired;
                  const hariColor  = isExpired ? '#ef4444' : isExpiring ? '#eab308' : '#22c55e';
                  // Nama produk dari line
                  const lineName   = moLines.find(l => l.id === unit.mo_line_id)?.nama_produk ?? '-';
                  return (
                    <tr key={unit.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 0', color: '#aaa', fontFamily: 'monospace', fontSize: 12 }}>{unit.barcode}</td>
                      <td style={{ padding: '9px 0', color: '#888', fontSize: 12 }}>{lineName}</td>
                      <td style={{ padding: '9px 0', color: '#666', fontSize: 12 }}>{unit.expiry_date}</td>
                      <td style={{ padding: '9px 0' }}>
                        <span style={{ color: hariColor, fontSize: 12, fontWeight: 600 }}>
                          {unit.hari_tersisa != null ? `${unit.hari_tersisa}h` : '-'}
                          {isExpired && ' ⚠️'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 0', color: '#555', fontSize: 12 }}>
                        {unit.harga_modal != null ? formatRp(unit.harga_modal) : '-'}
                      </td>
                      <td style={{ padding: '9px 0' }}>
                        <span style={{ backgroundColor: uColor + '22', color: uColor, border: `1px solid ${uColor}44`, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>
                          {unit.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalUnits > 50 && (
              <p style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 12 }}>+{totalUnits - 50} unit lainnya</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, padding: 20,
};
const sectionTitle: React.CSSProperties = {
  color: 'white', fontWeight: 600, fontSize: 14,
  margin: '0 0 14px', display: 'flex', alignItems: 'center',
};
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const lbl: React.CSSProperties = {
  color: '#888', fontSize: 11, fontWeight: 600,
  marginBottom: 4, display: 'block', letterSpacing: 0.5,
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#666', fontSize: 13 }}>{label}</span>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
