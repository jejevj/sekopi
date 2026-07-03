import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, XCircle, Sparkles } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
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
                { next: 'cancelled',   label: 'Batalkan', danger: true }],
  confirmed:   [{ next: 'in_progress', label: 'Mulai Produksi' },
                { next: 'cancelled',   label: 'Batalkan', danger: true }],
  in_progress: [{ next: 'done',        label: 'Tandai Selesai' },
                { next: 'cancelled',   label: 'Batalkan', danger: true }],
};

const STATUS_UNIT_COLOR: Record<string, string> = {
  ready: '#3b82f6', dispatched: '#eab308', delivered: '#9333ea',
  sold: '#22c55e', expired: '#ef4444', void: '#6b7280',
  returned_good: '#0d9488', returned_damaged: '#ef4444',
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function MODetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genJumlah, setGenJumlah] = useState('');
  const [genExpiry, setGenExpiry] = useState('');
  const [genModal, setGenModal] = useState('');
  const [estimasiLoading, setEstimasiLoading] = useState(false);
  const [estimasiDetail, setEstimasiDetail] = useState<any[] | null>(null);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mo', id] });
      qc.invalidateQueries({ queryKey: ['mo-list'] });
    },
    onError: (err: any) =>
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan'),
  });

  const generateMutation = useMutation({
    mutationFn: async () =>
      (await api.post('/production-units/generate', {
        mo_id: parseInt(id!),
        jumlah: parseInt(genJumlah),
        expiry_date: genExpiry,
        harga_modal: genModal ? parseFloat(genModal) : null,
      })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mo-units', id] });
      setShowGenerate(false);
      setGenJumlah(''); setGenExpiry(''); setGenModal('');
      setEstimasiDetail(null);
      Alert.alert('Berhasil', `${data.length} unit barcode berhasil di-generate`);
    },
    onError: (err: any) =>
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan'),
  });

  const hitungOtomatis = async () => {
    setEstimasiLoading(true);
    try {
      const res = await api.get(`/manufacturing-orders/${id}/estimasi-harga-modal`);
      const data = res.data;
      setEstimasiDetail(data.detail);
      if (data.estimasi_harga_modal_per_unit != null) {
        setGenModal(String(data.estimasi_harga_modal_per_unit));
        Alert.alert(
          'Estimasi Berhasil',
          `Harga modal per unit: ${formatRp(data.estimasi_harga_modal_per_unit)}\n\nSudah diisi otomatis ke form.`,
        );
      } else {
        Alert.alert(
          'Data Tidak Lengkap',
          'Beberapa bahan baku belum memiliki harga beli atau qty_per_unit. Cek detail BOM.',
        );
      }
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menghitung estimasi harga modal.');
    } finally {
      setEstimasiLoading(false);
    }
  };

  const confirmStatus = (next: string, label: string) =>
    Alert.alert('Konfirmasi', `Ubah status ke "${label}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya', onPress: () => statusMutation.mutate(next) },
    ]);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0a0a0a' }}>
      <ActivityIndicator size="large" color="#f44444" />
    </div>
  );

  if (error || !mo) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0a0a0a', gap: 12 }}>
      <XCircle size={40} color="#ef4444" />
      <span style={{ color: '#ef4444', fontSize: 15 }}>MO tidak ditemukan</span>
      <button onClick={() => router.back()} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 20px', color: '#888', cursor: 'pointer' }}>Kembali</button>
    </div>
  );

  const cfg = STATUS_CONFIG[mo.status] ?? STATUS_CONFIG.draft;
  const transitions = NEXT_STATUS[mo.status] ?? [];
  const totalUnits = units?.total ?? 0;
  const unitList = units?.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Detail Manufacturing Order" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Back + Header */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: 16, padding: 0, fontSize: 14 }}>
            <ArrowLeft size={16} color="#888" /> Kembali
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>{mo.nomor_mo}</h1>
              <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>{mo.nama_produk}</p>
            </div>
            <span style={{ backgroundColor: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={card}>
            <p style={cardLabel}>Target Qty</p>
            <p style={cardValue}>{mo.target_qty}</p>
            <p style={cardSub}>{mo.satuan}</p>
          </div>
          <div style={card}>
            <p style={cardLabel}>Unit Generated</p>
            <p style={{ ...cardValue, color: '#f44444' }}>{totalUnits}</p>
            <p style={cardSub}>dari {mo.target_qty} {mo.satuan}</p>
          </div>
          {mo.estimasi_harga_modal != null && (
            <div style={card}>
              <p style={cardLabel}>Est. Harga Modal/Cup</p>
              <p style={{ ...cardValue, color: '#22c55e', fontSize: 18 }}>{formatRp(mo.estimasi_harga_modal)}</p>
              <p style={cardSub}>dari BOM</p>
            </div>
          )}
        </div>

        {/* Detail */}
        <div style={{ ...glassCard, marginBottom: 20 }}>
          <p style={sectionTitle}>Detail MO</p>
          <DetailRow label="Tanggal Rencana" value={mo.tanggal_rencana ?? '-'} />
          <DetailRow label="Dibuat oleh"     value={mo.created_by_user?.full_name ?? '-'} />
          <DetailRow label="Disetujui oleh"  value={mo.approved_by_user?.full_name ?? '-'} />
          <DetailRow label="Inventori oleh"  value={mo.inventori_by_user?.full_name ?? '-'} />
          {mo.catatan && <DetailRow label="Catatan" value={mo.catatan} />}
        </div>

        {/* BOM */}
        <div style={{ ...glassCard, marginBottom: 20 }}>
          <p style={sectionTitle}>Bill of Materials</p>
          {!mo.bahan_baku_lines?.length
            ? <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Belum ada bahan baku</p>
            : mo.bahan_baku_lines.map((line: any) => (
                <div key={line.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'white', fontSize: 14 }}>{line.nama_bahan ?? '-'}</span>
                    <span style={{ color: '#888', fontSize: 13 }}>
                      {line.qty_rencana} {line.satuan}
                      {line.qty_aktual != null ? ` (aktual: ${line.qty_aktual})` : ''}
                    </span>
                  </div>
                  {/* Sub-baris: qty per unit + kontribusi harga */}
                  {(line.qty_per_unit != null || line.harga_beli_per_satuan != null) && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                      {line.qty_per_unit != null && (
                        <span style={{ color: '#555', fontSize: 12 }}>
                          {line.qty_per_unit} {line.satuan}/cup
                        </span>
                      )}
                      {line.qty_per_unit != null && line.harga_beli_per_satuan != null && (
                        <span style={{ color: '#3b82f6', fontSize: 12 }}>
                          +{formatRp(Math.round(line.qty_per_unit * line.harga_beli_per_satuan))}/cup
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
          }
          {mo.estimasi_harga_modal != null && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.10)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888', fontSize: 13 }}>Total estimasi harga modal</span>
              <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>{formatRp(mo.estimasi_harga_modal)}/cup</span>
            </div>
          )}
        </div>

        {/* Aksi Status */}
        {transitions.length > 0 && (
          <div style={{ ...glassCard, marginBottom: 20 }}>
            <p style={sectionTitle}>Aksi</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transitions.map((t) => (
                <button
                  key={t.next}
                  onClick={() => confirmStatus(t.next, t.label)}
                  disabled={statusMutation.isPending}
                  style={{
                    padding: '12px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    cursor: statusMutation.isPending ? 'not-allowed' : 'pointer',
                    border: t.danger ? '1px solid rgba(239,68,68,0.4)' : 'none',
                    backgroundColor: t.danger ? 'rgba(239,68,68,0.08)' : '#f44444',
                    color: t.danger ? '#ef4444' : 'white',
                    boxShadow: t.danger ? 'none' : '0 0 16px rgba(244,68,68,0.3)',
                    opacity: statusMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {statusMutation.isPending ? 'Memproses...' : t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate Unit — hanya jika DONE */}
        {mo.status === 'done' && (
          <div style={{ ...glassCard, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={sectionTitle}>Generate Barcode Unit</p>
              <button onClick={() => { setShowGenerate(!showGenerate); setEstimasiDetail(null); }}
                style={{ background: 'none', border: 'none', color: '#f44444', fontSize: 13, cursor: 'pointer' }}>
                {showGenerate ? 'Tutup' : 'Buka Form'}
              </button>
            </div>

            {showGenerate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <GlassInput label="Jumlah Unit *" value={genJumlah} onChange={setGenJumlah} placeholder="Contoh: 100" type="number" />
                <GlassInput label="Tanggal Expiry * (YYYY-MM-DD)" value={genExpiry} onChange={setGenExpiry} placeholder="2026-12-31" />

                {/* Harga Modal — manual atau otomatis */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ color: '#888', fontSize: 13 }}>Harga Modal per Unit (opsional)</label>
                    <button
                      onClick={hitungOtomatis}
                      disabled={estimasiLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid rgba(34,197,94,0.35)',
                        borderRadius: 6, padding: '3px 10px',
                        color: '#22c55e', fontSize: 12, cursor: estimasiLoading ? 'wait' : 'pointer',
                        opacity: estimasiLoading ? 0.6 : 1,
                      }}
                    >
                      <Sparkles size={12} color="#22c55e" />
                      {estimasiLoading ? 'Menghitung...' : 'Hitung Otomatis'}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={genModal}
                    onChange={(e: any) => setGenModal(e.target.value)}
                    placeholder="Atau isi manual, contoh: 4150"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: genModal ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, padding: '10px 14px',
                      color: 'white', fontSize: 14, outline: 'none',
                    }}
                  />
                  {genModal && (
                    <p style={{ color: '#22c55e', fontSize: 12, margin: '4px 0 0' }}>
                      = {formatRp(parseFloat(genModal) || 0)}/unit
                    </p>
                  )}
                </div>

                {/* Breakdown estimasi jika sudah dihitung */}
                {estimasiDetail && estimasiDetail.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
                    <p style={{ color: '#888', fontSize: 12, margin: '0 0 8px', fontWeight: 600 }}>BREAKDOWN BIAYA</p>
                    {estimasiDetail.map((d: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: '#aaa', fontSize: 12 }}>{d.nama_bahan}</span>
                        <span style={{ color: d.kontribusi_per_unit != null ? 'white' : '#ef4444', fontSize: 12 }}>
                          {d.kontribusi_per_unit != null ? formatRp(Math.round(d.kontribusi_per_unit)) : d.keterangan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={!genJumlah || !genExpiry || generateMutation.isPending}
                  style={{
                    padding: '12px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    backgroundColor: (!genJumlah || !genExpiry || generateMutation.isPending) ? '#333' : '#f44444',
                    color: 'white', border: 'none',
                    cursor: (!genJumlah || !genExpiry) ? 'not-allowed' : 'pointer',
                    boxShadow: (!genJumlah || !genExpiry) ? 'none' : '0 0 16px rgba(244,68,68,0.3)',
                  }}
                >
                  {generateMutation.isPending ? 'Generating...' : `Generate ${genJumlah || '0'} Unit`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Production Units */}
        {totalUnits > 0 && (
          <div style={{ ...glassCard, marginBottom: 20 }}>
            <p style={sectionTitle}>Production Units ({totalUnits})</p>
            {unitList.slice(0, 20).map((unit: any) => {
              const uColor = STATUS_UNIT_COLOR[unit.status] ?? '#888';
              return (
                <div key={unit.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
                    <p style={{ color: '#555', fontSize: 12, margin: '2px 0 0' }}>Expiry: {unit.expiry_date}</p>
                  </div>
                  <span style={{ backgroundColor: uColor + '22', color: uColor, border: `1px solid ${uColor}44`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
                    {unit.status}
                  </span>
                </div>
              );
            })}
            {totalUnits > 20 && (
              <p style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 10 }}>+{totalUnits - 20} unit lainnya</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const glassCard: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 20 };
const card: React.CSSProperties = { ...glassCard, flex: 1, minWidth: 140 };
const cardLabel: React.CSSProperties = { color: '#888', fontSize: 12, margin: '0 0 4px' };
const cardValue: React.CSSProperties = { color: 'white', fontSize: 26, fontWeight: 700, margin: 0 };
const cardSub:   React.CSSProperties = { color: '#555', fontSize: 12, margin: '2px 0 0' };
const sectionTitle: React.CSSProperties = { color: 'white', fontWeight: 600, fontSize: 15, margin: '0 0 14px' };

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: '#888', fontSize: 13 }}>{label}</span>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function GlassInput({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '10px 14px',
          color: 'white', fontSize: 14, outline: 'none',
        }}
      />
    </div>
  );
}
