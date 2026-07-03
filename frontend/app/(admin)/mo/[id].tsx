import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { formatDate, formatDateTime } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/authStore';
import {
  ArrowLeft, CheckCircle, XCircle, PlayCircle, PackageCheck,
  User, Calendar, Package, ClipboardList, Info, ChevronRight,
} from 'lucide-react-native';

const FLOW_STEPS = [
  { status: 'draft',       label: 'Draft',       desc: 'MO dibuat' },
  { status: 'confirmed',   label: 'Disetujui',   desc: 'Admin menyetujui' },
  { status: 'in_progress', label: 'Bahan Keluar', desc: 'Inventori mengeluarkan bahan' },
  { status: 'done',        label: 'Selesai',      desc: 'Produksi selesai' },
];

const STATUS_RANK: Record<string, number> = {
  draft: 0, confirmed: 1, in_progress: 2, done: 3, cancelled: -1,
};

export default function MODetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  const [catatanCancel, setCatatanCancel] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [catatanDone, setCatatanDone] = useState('');
  const [showDoneModal, setShowDoneModal] = useState(false);

  const { data: mo, isLoading } = useQuery({
    queryKey: ['mo', id],
    queryFn: () => api.get(`/manufacturing-orders/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: stokCheck } = useQuery({
    queryKey: ['mo-stok', id],
    queryFn: () => api.get(`/manufacturing-orders/${id}/cek-stok`).then(r => r.data),
    enabled: !!id && mo?.status === 'draft',
  });

  const mutation = useMutation({
    mutationFn: (payload: { status: string; catatan?: string }) =>
      api.post(`/manufacturing-orders/${id}/status`, payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mo'] });
      queryClient.invalidateQueries({ queryKey: ['mo', id] });
      setShowCancelModal(false);
      setShowDoneModal(false);
    },
  });

  if (isLoading || !mo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
        <Navbar title="Detail MO" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Memuat...
        </div>
      </div>
    );
  }

  const rank = STATUS_RANK[mo.status] ?? 0;
  const isCancelled = mo.status === 'cancelled';

  // Tombol aksi berdasarkan role + status
  const canApprove   = role === 'admin' && mo.status === 'draft';
  const canKeluarkan = (role === 'inventori' || role === 'admin') && mo.status === 'confirmed';
  const canDone      = (role === 'produksi' || role === 'admin') && mo.status === 'in_progress';
  const canCancel    = role === 'admin' && ['draft','confirmed','in_progress'].includes(mo.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Detail MO" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 860, margin: '0 auto', width: '100%' }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#888', fontSize: 14, cursor: 'pointer', marginBottom: 20, padding: 0 }}
        >
          <ArrowLeft size={16} color="#888" /> Kembali
        </button>

        {/* Header card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: 24, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={18} color="#f87171" />
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{mo.nomor_mo}</div>
                  <div style={{ color: '#888', fontSize: 14 }}>{mo.nama_produk}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Package size={13} color="#666" /> Target: {mo.target_qty} {mo.satuan}
                </span>
                <span style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} color="#666" /> Rencana: {formatDate(mo.tanggal_rencana)}
                </span>
                <span style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={13} color="#666" /> Dibuat oleh user #{mo.created_by}
                </span>
              </div>
            </div>
            <StatusBadge status={mo.status} />
          </div>
        </div>

        {/* Progress Steps */}
        {!isCancelled && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '20px 24px', marginBottom: 20,
          }}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>Progress</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {FLOW_STEPS.map((step, i) => {
                const stepRank = STATUS_RANK[step.status];
                const done = rank >= stepRank && !isCancelled;
                const active = rank === stepRank;
                return (
                  <React.Fragment key={step.status}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: done ? (active ? '#f44444' : 'rgba(34,197,94,0.2)') : 'rgba(255,255,255,0.06)',
                        border: `2px solid ${done ? (active ? '#f44444' : '#22c55e') : 'rgba(255,255,255,0.15)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {done && !active ? <CheckCircle size={16} color="#22c55e" /> : null}
                        {active ? <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'white' }} /> : null}
                        {!done ? <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} /> : null}
                      </div>
                      <div style={{ color: done ? (active ? 'white' : '#22c55e') : '#555', fontSize: 11, marginTop: 6, textAlign: 'center', fontWeight: active ? 600 : 400 }}>
                        {step.label}
                      </div>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: rank > i ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: 18 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(canApprove || canKeluarkan || canDone || canCancel) && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 20, marginBottom: 20,
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ color: '#aaa', fontSize: 13, fontWeight: 500 }}>Aksi:</span>

            {canApprove && (
              <button
                onClick={() => mutation.mutate({ status: 'confirmed' })}
                disabled={mutation.isPending || stokCheck?.all_available === false}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: stokCheck?.all_available === false ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.15)',
                  border: `1px solid ${stokCheck?.all_available === false ? 'rgba(255,255,255,0.1)' : 'rgba(34,197,94,0.35)'}`,
                  borderRadius: 10, padding: '9px 18px', color: stokCheck?.all_available === false ? '#555' : '#22c55e',
                  fontWeight: 600, fontSize: 13, cursor: stokCheck?.all_available === false ? 'not-allowed' : 'pointer',
                }}
              >
                <CheckCircle size={15} color={stokCheck?.all_available === false ? '#555' : '#22c55e'} />
                Setujui MO
              </button>
            )}

            {canKeluarkan && (
              <button
                onClick={() => mutation.mutate({ status: 'in_progress' })}
                disabled={mutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                  borderRadius: 10, padding: '9px 18px', color: '#60a5fa',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                <PackageCheck size={15} color="#60a5fa" />
                Keluarkan Bahan
              </button>
            )}

            {canDone && (
              <button
                onClick={() => setShowDoneModal(true)}
                disabled={mutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(244,68,68,0.15)', border: '1px solid rgba(244,68,68,0.35)',
                  borderRadius: 10, padding: '9px 18px', color: '#f87171',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                <PlayCircle size={15} color="#f87171" />
                Selesaikan Produksi
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
                  backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: '9px 18px', color: '#f87171',
                  fontWeight: 500, fontSize: 13, cursor: 'pointer',
                }}
              >
                <XCircle size={15} color="#f87171" /> Batalkan MO
              </button>
            )}
          </div>
        )}

        {/* Stok warning jika tidak cukup */}
        {stokCheck && !stokCheck.all_available && mo.status === 'draft' && (
          <div style={{
            background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 10,
          }}>
            <Info size={16} color="#eab308" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: '#eab308', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Stok tidak mencukupi</div>
              {stokCheck.detail.filter((d: any) => !d.cukup).map((d: any) => (
                <div key={d.bahan_baku_id} style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>
                  {d.nama}: tersedia {d.stok_tersedia}, butuh {d.qty_rencana}
                  <span style={{ color: '#ef4444', marginLeft: 8 }}>kekurangan {d.kekurangan}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval & Inventori info */}
        {(mo.approved_by || mo.inventori_by) && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 20, marginBottom: 20,
            display: 'flex', gap: 20, flexWrap: 'wrap',
          }}>
            {mo.approved_by && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={15} color="#22c55e" />
                <div>
                  <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>Disetujui</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{mo.approved_at ? formatDateTime(mo.approved_at) : '-'}</div>
                </div>
              </div>
            )}
            {mo.inventori_by && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PackageCheck size={15} color="#60a5fa" />
                <div>
                  <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>Bahan Dikeluarkan</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{mo.inventori_at ? formatDateTime(mo.inventori_at) : '-'}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bahan Baku Lines */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>Bahan Baku</div>
          {mo.bahan_baku_lines?.length === 0 ? (
            <p style={{ color: '#555', fontSize: 13 }}>Belum ada bahan baku</p>
          ) : (
            mo.bahan_baku_lines?.map((line: any, i: number) => {
              const stokDetail = stokCheck?.detail?.find((d: any) => d.bahan_baku_id === line.bahan_baku_id);
              return (
                <div key={line.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i < mo.bahan_baku_lines.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Package size={15} color="#666" />
                    <div>
                      <div style={{ color: 'white', fontSize: 14 }}>{stokDetail?.nama ?? `Bahan #${line.bahan_baku_id}`}</div>
                      <div style={{ color: '#666', fontSize: 12 }}>Rencana: {line.qty_rencana} {line.satuan}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {line.qty_aktual != null && (
                      <div style={{ color: '#22c55e', fontSize: 13 }}>Aktual: {line.qty_aktual} {line.satuan}</div>
                    )}
                    {stokDetail && (
                      <div style={{ fontSize: 12, color: stokDetail.cukup ? '#22c55e' : '#ef4444' }}>
                        {stokDetail.cukup ? `✓ Stok cukup (${stokDetail.stok_tersedia})` : `✗ Kurang ${stokDetail.kekurangan}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Catatan */}
        {mo.catatan && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 20, marginTop: 16,
          }}>
            <div style={{ color: '#aaa', fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Catatan</div>
            <p style={{ color: '#ccc', fontSize: 14, margin: 0 }}>{mo.catatan}</p>
          </div>
        )}
      </div>

      {/* Modal: Cancel */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: '#141414', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <XCircle size={20} color="#ef4444" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Batalkan MO?</span>
            </div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Tindakan ini tidak dapat dibatalkan. Bahan baku yang sudah dikeluarkan akan dikembalikan ke stok.</p>
            <textarea
              value={catatanCancel}
              onChange={e => setCatatanCancel(e.target.value)}
              placeholder="Alasan pembatalan (opsional)"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'white', fontSize: 13, resize: 'none', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button
                onClick={() => mutation.mutate({ status: 'cancelled', catatan: catatanCancel || undefined })}
                disabled={mutation.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >Ya, Batalkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Done */}
      {showDoneModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: '#141414', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14, padding: 28, width: 420, maxWidth: '90vw',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <PlayCircle size={20} color="#f87171" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Selesaikan Produksi?</span>
            </div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Konfirmasi bahwa proses produksi sudah selesai. Selanjutnya bisa generate barcode unit.</p>
            <textarea
              value={catatanDone}
              onChange={e => setCatatanDone(e.target.value)}
              placeholder="Catatan hasil produksi (opsional)"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'white', fontSize: 13, resize: 'none', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDoneModal(false)} style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button
                onClick={() => mutation.mutate({ status: 'done', catatan: catatanDone || undefined })}
                disabled={mutation.isPending}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(244,68,68,0.2)', border: '1px solid rgba(244,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >Ya, Selesaikan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
