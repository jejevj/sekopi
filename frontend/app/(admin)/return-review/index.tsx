import {
  ClipboardCheck, Search, X, RefreshCw,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  AlertTriangle, RotateCcw,
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReturnItemResp {
  id: number;
  barcode: string;
  mo_id: number;
  nama_produk?: string;
  kategori: string;
  kondisi_konfirmasi: string; // pending | baik | rusak_konfirmasi
  catatan_driver?: string;
  catatan_reviewer?: string;
}
interface LoadingSnap { id: number; nomor_loading: string; }
interface ReturnOrder {
  id: number;
  nomor_return: string;
  driver_id: number;
  loading_order_id: number;
  loading_order: LoadingSnap | null;
  status: string; // draft | submitted | reviewed
  catatan_driver?: string;
  catatan_reviewer?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
  items: ReturnItemResp[];
  total_sisa: number;
  total_rusak: number;
}

// payload ke POST /return/{id}/review
interface ReviewItemInput {
  return_item_id: number;
  kondisi_konfirmasi: 'baik' | 'rusak_konfirmasi';
  catatan_reviewer?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, padding: 20,
};
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: '#141414', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14, padding: 28, width: 580, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  draft:     { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af' },
  submitted: { background: 'rgba(234,179,8,0.12)',   border: '1px solid rgba(234,179,8,0.3)',   color: '#fbbf24' },
  reviewed:  { background: 'rgba(34,197,94,0.12)',   border: '1px solid rgba(34,197,94,0.3)',   color: '#4ade80' },
};

const KONDISI_META: Record<string, { label: string; color: string; Icon: any }> = {
  pending:           { label: 'Pending',  color: '#9ca3af', Icon: Clock        },
  baik:              { label: 'Baik',     color: '#4ade80', Icon: CheckCircle  },
  rusak_konfirmasi:  { label: 'Rusak',    color: '#f87171', Icon: XCircle      },
};

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const colors: Record<string, string> = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  const c = colors[type] ?? '#3b82f6';
  React.useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#1a1a1a', border: `1px solid ${c}50`, borderRadius: 10, padding: '12px 18px', minWidth: 260, maxWidth: 420, display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ width: 3, borderRadius: 99, background: c, alignSelf: 'stretch', flexShrink: 0 }} />
      <p style={{ color: 'white', fontSize: 13, margin: 0, flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: 0 }}>×</button>
    </div>
  );
}

export default function ReturnReviewPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'reviewed'>('submitted');
  const [reviewModal, setReviewModal] = useState<ReturnOrder | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message: msg, type });

  // per-item review state: map itemId → kondisi
  const [itemDecisions, setItemDecisions] = useState<Record<number, ReviewItemInput>>({});
  const [catatanReviewer, setCatatanReviewer] = useState('');
  const [expandedItems, setExpandedItems] = useState(false);

  const { data: returnList = [], isLoading, refetch } = useQuery<ReturnOrder[]>({
    queryKey: ['return-review-list'],
    queryFn: () => api.get('/return/').then(r => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      api.post(`/return/${id}/review`, payload).then(r => r.data),
    onSuccess: (data: ReturnOrder) => {
      showToast(`${data.nomor_return} berhasil direview → REVIEWED`, 'success');
      setReviewModal(null);
      qc.invalidateQueries({ queryKey: ['return-review-list'] });
      qc.invalidateQueries({ queryKey: ['stok-unit-all'] });
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Gagal mereview return', 'error'),
  });

  const openReview = (ro: ReturnOrder) => {
    // Inisialisasi semua item default ke 'baik'
    const init: Record<number, ReviewItemInput> = {};
    for (const item of ro.items) {
      if (item.kondisi_konfirmasi === 'pending') {
        init[item.id] = {
          return_item_id: item.id,
          kondisi_konfirmasi: item.kategori === 'rusak' ? 'rusak_konfirmasi' : 'baik',
        };
      }
    }
    setItemDecisions(init);
    setCatatanReviewer('');
    setExpandedItems(true);
    setReviewModal(ro);
  };

  const submitReview = () => {
    if (!reviewModal) return;
    const pendingItems = reviewModal.items.filter(i => i.kondisi_konfirmasi === 'pending');
    const payload = {
      catatan_reviewer: catatanReviewer || null,
      items: pendingItems.map(i => itemDecisions[i.id] ?? { return_item_id: i.id, kondisi_konfirmasi: 'baik' }),
    };
    reviewMutation.mutate({ id: reviewModal.id, payload });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returnList.filter(r => {
      const matchQ = !q || r.nomor_return.toLowerCase().includes(q) || (r.loading_order?.nomor_loading ?? '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchQ && matchStatus;
    });
  }, [returnList, search, filterStatus]);

  const countSubmitted = returnList.filter(r => r.status === 'submitted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Navbar title="Review Return" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Review Return Gerobak</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>Konfirmasi kondisi unit yang dikembalikan driver — ubah status unit di stok</p>
        </div>

        {/* Alert badge jika ada yang menunggu */}
        {countSubmitted > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 20 }}>
            <AlertTriangle size={15} color="#fbbf24" />
            <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>{countSubmitted} return order menunggu review</span>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['all', 'submitted', 'reviewed'] as const).map(s => {
            const count = s === 'all' ? returnList.length : returnList.filter(r => r.status === s).length;
            const colors: Record<string, string> = { all: '#a855f7', submitted: '#fbbf24', reviewed: '#4ade80' };
            const labels: Record<string, string> = { all: 'Total', submitted: 'Menunggu Review', reviewed: 'Sudah Reviewed' };
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{
                  background: filterStatus === s ? colors[s] + '15' : 'rgba(255,255,255,0.04)',
                  border: filterStatus === s ? `1px solid ${colors[s]}40` : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '12px 18px', minWidth: 130, cursor: 'pointer', textAlign: 'left',
                }}>
                <p style={{ color: '#555', fontSize: 12, margin: '0 0 4px' }}>{labels[s]}</p>
                <p style={{ color: colors[s], fontSize: 24, fontWeight: 700, margin: 0 }}>{count}</p>
              </button>
            );
          })}
        </div>

        {/* Search + Refresh */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nomor return atau loading..." style={{ ...inp, paddingLeft: 30 }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={12} color="#555" />
              </button>
            )}
          </div>
          <button onClick={() => { setSearch(''); refetch(); }} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color="#aaa" /> Refresh
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <ClipboardCheck size={32} color="#2a2a2a" style={{ marginBottom: 12 }} />
            <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}
            >{filterStatus === 'submitted' ? 'Tidak ada return yang menunggu review' : 'Tidak ada data'}</p>
          </div>
        ) : (
          <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Nomor Return', 'Loading Trip', 'Status', 'Sisa', 'Rusak', 'Item Pending', 'Tanggal', ''].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ro => {
                  const ss = STATUS_BADGE[ro.status] ?? STATUS_BADGE.draft;
                  const pendingCount = ro.items.filter(i => i.kondisi_konfirmasi === 'pending').length;
                  return (
                    <tr key={ro.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', color: 'white', fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{ro.nomor_return}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {ro.loading_order
                          ? <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{ro.loading_order.nomor_loading}</span>
                          : <span style={{ color: '#444' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...ss, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{ro.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#60a5fa', fontWeight: 700 }}>{ro.total_sisa}</td>
                      <td style={{ padding: '12px 16px', color: '#f87171', fontWeight: 700 }}>{ro.total_rusak}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {pendingCount > 0
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}><Clock size={10} color="#fbbf24" />{pendingCount}</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#4ade80', fontSize: 12 }}><CheckCircle size={12} color="#4ade80" /> Done</span>
                        }
                      </td>
                      <td style={{ padding: '12px 16px', color: '#555', fontSize: 12 }}>
                        {new Date(ro.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {ro.status === 'submitted' ? (
                          <button onClick={() => openReview(ro)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <ClipboardCheck size={12} color="#c084fc" /> Review
                          </button>
                        ) : ro.status === 'reviewed' ? (
                          <button onClick={() => openReview(ro)}
                            style={{ ...btnGhost, fontSize: 11 }}>Detail</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Review ──────────────────────────────────────────────────── */}
      {reviewModal && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setReviewModal(null); }}>
          <div style={modalBox}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 17, margin: 0 }}>{reviewModal.nomor_return}</p>
                {reviewModal.loading_order && (
                  <p style={{ color: '#60a5fa', fontSize: 12, margin: '3px 0 0', fontFamily: 'monospace' }}>Loading: {reviewModal.loading_order.nomor_loading}</p>
                )}
              </div>
              <button onClick={() => setReviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={17} color="#555" /></button>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ ...(STATUS_BADGE[reviewModal.status] ?? STATUS_BADGE.draft), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{reviewModal.status}</span>
              <span style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{reviewModal.total_sisa} sisa</span>
              <span style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{reviewModal.total_rusak} rusak</span>
            </div>

            {/* Items section */}
            <button onClick={() => setExpandedItems(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', color: '#888', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {expandedItems ? <ChevronUp size={13} color="#555" /> : <ChevronDown size={13} color="#555" />}
              Item ({reviewModal.items.length})
            </button>

            {expandedItems && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 18 }}>
                {reviewModal.items.map(item => {
                  const isPending = item.kondisi_konfirmasi === 'pending';
                  const decision = itemDecisions[item.id];
                  const currentKondisi = isPending ? (decision?.kondisi_konfirmasi ?? 'baik') : item.kondisi_konfirmasi;
                  const meta = KONDISI_META[currentKondisi] ?? KONDISI_META.pending;
                  const { Icon: KIcon } = meta;

                  return (
                    <div key={item.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'white', fontSize: 12, fontFamily: 'monospace', margin: 0 }}>{item.barcode}</p>
                        {item.nama_produk && <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0' }}>{item.nama_produk}</p>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                            background: item.kategori === 'sisa' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                            color: item.kategori === 'sisa' ? '#60a5fa' : '#f87171',
                            border: `1px solid ${item.kategori === 'sisa' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}>{item.kategori.toUpperCase()}</span>
                          {item.catatan_driver && (
                            <span style={{ color: '#444', fontSize: 11 }}>Driver: {item.catatan_driver}</span>
                          )}
                        </div>
                      </div>

                      {/* Kondisi selector atau badge final */}
                      {isPending ? (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => setItemDecisions(prev => ({ ...prev, [item.id]: { return_item_id: item.id, kondisi_konfirmasi: 'baik' } }))}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              background: decision?.kondisi_konfirmasi === 'baik' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                              border: decision?.kondisi_konfirmasi === 'baik' ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.1)',
                              color: decision?.kondisi_konfirmasi === 'baik' ? '#4ade80' : '#555',
                            }}>
                            <CheckCircle size={11} color={decision?.kondisi_konfirmasi === 'baik' ? '#4ade80' : '#555'} /> Baik
                          </button>
                          <button
                            onClick={() => setItemDecisions(prev => ({ ...prev, [item.id]: { return_item_id: item.id, kondisi_konfirmasi: 'rusak_konfirmasi' } }))}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              background: decision?.kondisi_konfirmasi === 'rusak_konfirmasi' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)',
                              border: decision?.kondisi_konfirmasi === 'rusak_konfirmasi' ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(255,255,255,0.1)',
                              color: decision?.kondisi_konfirmasi === 'rusak_konfirmasi' ? '#f87171' : '#555',
                            }}>
                            <XCircle size={11} color={decision?.kondisi_konfirmasi === 'rusak_konfirmasi' ? '#f87171' : '#555'} /> Rusak
                          </button>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: meta.color + '18', border: `1px solid ${meta.color}33`, color: meta.color }}>
                          <KIcon size={10} color={meta.color} />{meta.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catatan reviewer */}
            {reviewModal.status === 'submitted' && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>CATATAN REVIEWER (OPSIONAL)</label>
                <textarea
                  value={catatanReviewer}
                  onChange={e => setCatatanReviewer(e.target.value)}
                  placeholder="Catatan hasil review..."
                  rows={2}
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
            )}

            {reviewModal.status === 'reviewed' && reviewModal.catatan_reviewer && (
              <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
                <p style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Catatan Reviewer</p>
                <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>{reviewModal.catatan_reviewer}</p>
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setReviewModal(null)} style={btnGhost}>Tutup</button>
              {reviewModal.status === 'submitted' && (
                <button
                  onClick={submitReview}
                  disabled={reviewMutation.isPending}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 10,
                    background: reviewMutation.isPending ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.8)',
                    border: '1px solid rgba(168,85,247,0.5)',
                    color: 'white', fontWeight: 600, fontSize: 13, cursor: reviewMutation.isPending ? 'wait' : 'pointer',
                  }}>
                  <RotateCcw size={13} color="white" />
                  {reviewMutation.isPending ? 'Menyimpan...' : `Konfirmasi Review (${reviewModal.items.filter(i => i.kondisi_konfirmasi === 'pending').length} item)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
