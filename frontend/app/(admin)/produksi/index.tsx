import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  Package, Search, X, RefreshCw,
  Warehouse, Truck, ShoppingBag, AlertTriangle,
  ChevronDown, ChevronUp,
  CheckCircle, RotateCcw, HeartCrack, Clock, Ban, MapPin,
} from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modalBox: React.CSSProperties = { background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' };

// ── Status config: flat icon + warna tanpa emoji ──────────────────────────
const UNIT_STATUS: Record<string, {
  label: string; color: string; bg: string; border: string; desc: string;
  Icon: any;
}> = {
  ready:            { label: 'Di Gudang',     color: '#a3e635', bg: 'rgba(163,230,53,0.1)',  border: 'rgba(163,230,53,0.25)',  desc: 'Tersedia di gudang — terhitung sebagai stok',                              Icon: Warehouse    },
  on_gerobak:       { label: 'Di Gerobak',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  desc: 'Sedang dibawa driver — tidak mengurangi stok gudang, belum terjual',      Icon: MapPin       },
  dispatched:       { label: 'Dispatched',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  desc: 'Legacy — sama dengan On Gerobak',                                          Icon: Truck        },
  delivered:        { label: 'Delivered',     color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', desc: 'Sudah diterima driver, siap dijual',                                       Icon: Package      },
  sold:             { label: 'Terjual',       color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', desc: 'Sudah terjual — keluar dari stok permanen',                                Icon: CheckCircle  },
  returned_good:    { label: 'Kembali Baik',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', desc: 'Dikembalikan kondisi baik — kembali ke stok (READY)',                       Icon: RotateCcw    },
  returned_damaged: { label: 'Kembali Rusak', color: '#f87171', bg: 'rgba(248,113,113,0.1)',border: 'rgba(248,113,113,0.25)',desc: 'Dikembalikan rusak — keluar dari stok permanen',                            Icon: HeartCrack   },
  expired:          { label: 'Kadaluarsa',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.25)',desc: 'Kadaluarsa — keluar dari stok',                                            Icon: Clock        },
  void:             { label: 'Void',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  desc: 'Di-void manual — keluar dari stok',                                        Icon: Ban          },
};

// Label dropdown — teks saja, tanpa emoji
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',              label: 'Semua Status'   },
  { value: 'ready',            label: 'Di Gudang (READY)' },
  { value: 'on_gerobak',       label: 'Di Gerobak'     },
  { value: 'dispatched',       label: 'Dispatched'     },
  { value: 'delivered',        label: 'Delivered'      },
  { value: 'sold',             label: 'Terjual'        },
  { value: 'returned_good',    label: 'Kembali Baik'   },
  { value: 'returned_damaged', label: 'Kembali Rusak'  },
  { value: 'expired',          label: 'Kadaluarsa'     },
  { value: 'void',             label: 'Void'           },
];

interface ProductionUnit {
  id: number; barcode: string;
  nama_produk: string; expiry_date: string;
  harga_modal: number | null; harga_jual: number | null;
  status: string; mo_id: number;
  loading_order_id: number | null;
  current_gerobak_id: number | null;
  current_driver_id: number | null;
  dispatched_at: string | null;
  sold_at: string | null;
  returned_at: string | null;
}

function UnitStatusBadge({ status }: { status: string }) {
  const s = UNIT_STATUS[status] ?? { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', desc: '', Icon: Package };
  const { Icon } = s;
  return (
    <span title={s.desc} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`, cursor: 'help',
    }}>
      <Icon size={10} color={s.color} strokeWidth={2.5} />
      {s.label}
    </span>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: '#555', fontSize: 11, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function StokPage() {
  useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedMO, setExpandedMO] = useState<Set<number>>(new Set());
  const [detailUnit, setDetailUnit] = useState<ProductionUnit | null>(null);

  // Handle both array and PaginatedUnitResponse { items: [] }
  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['production-units'],
    queryFn: () => api.get('/production-units/?page=1&per_page=500').then(r => r.data),
  });

  const units: ProductionUnit[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (Array.isArray(rawData.items)) return rawData.items;
    return [];
  }, [rawData]);

  const stokGudang = units.filter(u => u.status === 'ready').length;
  const onGerobak  = units.filter(u => ['on_gerobak', 'dispatched', 'delivered'].includes(u.status)).length;
  const terjual    = units.filter(u => u.status === 'sold').length;
  const rusak      = units.filter(u => ['returned_damaged', 'void'].includes(u.status)).length;

  const filtered = useMemo(() => {
    let list = units;
    if (filterStatus !== 'all') list = list.filter(u => u.status === filterStatus);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u => u.barcode.toLowerCase().includes(q) || u.nama_produk.toLowerCase().includes(q));
    }
    return list;
  }, [units, filterStatus, search]);

  const groupedByMO = useMemo(() => {
    const map = new Map<number, { mo_id: number; units: ProductionUnit[] }>();
    for (const u of filtered) {
      if (!map.has(u.mo_id)) map.set(u.mo_id, { mo_id: u.mo_id, units: [] });
      map.get(u.mo_id)!.units.push(u);
    }
    return Array.from(map.values()).sort((a, b) => b.mo_id - a.mo_id);
  }, [filtered]);

  const toggleMO = (moId: number) => setExpandedMO(prev => {
    const next = new Set(prev);
    next.has(moId) ? next.delete(moId) : next.add(moId);
    return next;
  });

  const isOnGerobak = (s: string) => ['on_gerobak', 'dispatched', 'delivered'].includes(s);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Stok Produksi" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Stok Produksi</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{units.length} unit total</p>
          </div>
          <button onClick={() => refetch()} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color="#aaa" /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard icon={<Warehouse   size={14} color="#a3e635" />} label="Stok Gudang" value={stokGudang} color="#a3e635" sub="Status: READY" />
          <StatCard icon={<Truck       size={14} color="#f59e0b" />} label="Di Gerobak"  value={onGerobak}  color="#f59e0b" sub="Belum terjual" />
          <StatCard icon={<ShoppingBag size={14} color="#4ade80" />} label="Terjual"     value={terjual}    color="#4ade80" sub="Keluar stok" />
          <StatCard icon={<HeartCrack  size={14} color="#f87171" />} label="Rusak/Void"  value={rusak}      color="#f87171" sub="Keluar stok" />
        </div>

        {/* Info banner — ikon flat, tanpa emoji */}
        <div style={{ background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a3e635', fontSize: 12 }}>
            <Warehouse size={12} color="#a3e635" />
            <strong>Stok Gudang</strong> = hanya unit berstatus READY
          </span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b', fontSize: 12 }}>
            <MapPin size={12} color="#f59e0b" />
            Unit <strong>On Gerobak</strong> = sudah dibawa, belum terjual — tidak berkurang dari stok gudang
          </span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#60a5fa', fontSize: 12 }}>
            <RotateCcw size={12} color="#60a5fa" />
            Return baik = kembali ke stok
          </span>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari barcode atau produk..." style={{ ...inp, paddingLeft: 30 }} />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inp, width: 'auto', cursor: 'pointer', flex: 'none' }}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>
            ))}
          </select>
          {(search || filterStatus !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterStatus('all'); }} style={btnGhost}>Reset Filter</button>
          )}
        </div>

        {/* List grouped by MO */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>Memuat...</div>
        ) : groupedByMO.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Package size={36} color="#2a2a2a" style={{ marginBottom: 12 }} />
            <p style={{ color: '#3a3a3a', fontSize: 14 }}>Tidak ada unit ditemukan</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedByMO.map(({ mo_id, units: moUnits }) => {
              const isOpen   = expandedMO.has(mo_id);
              const ready    = moUnits.filter(u => u.status === 'ready').length;
              const onGero   = moUnits.filter(u => isOnGerobak(u.status)).length;
              const sold_cnt = moUnits.filter(u => u.status === 'sold').length;
              const damaged  = moUnits.filter(u => ['returned_damaged', 'void', 'expired'].includes(u.status)).length;
              return (
                <div key={mo_id} style={card}>
                  <button
                    onClick={() => toggleMO(mo_id)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Package size={15} color="#f87171" />
                      <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>MO #{mo_id}</span>
                      <span style={{ color: '#555', fontSize: 12 }}>{moUnits[0]?.nama_produk}</span>
                      <span style={{ color: '#666', fontSize: 12 }}>{moUnits.length} unit</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {ready    > 0 && <Pill color="#a3e635">{ready} gudang</Pill>}
                      {onGero   > 0 && <Pill color="#f59e0b">{onGero} gerobak</Pill>}
                      {sold_cnt > 0 && <Pill color="#4ade80">{sold_cnt} terjual</Pill>}
                      {damaged  > 0 && <Pill color="#f87171">{damaged} rusak/void</Pill>}
                      {isOpen ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {moUnits.map(unit => (
                        <div
                          key={unit.id}
                          onClick={() => setDetailUnit(unit)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#aaa' }}>{unit.barcode}</span>
                            <UnitStatusBadge status={unit.status} />
                          </div>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {isOnGerobak(unit.status) && unit.loading_order_id && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f59e0b' }}>
                                <Truck size={10} color="#f59e0b" /> #{unit.loading_order_id}
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: '#555' }}>Rp {Number(unit.harga_jual ?? 0).toLocaleString('id')}</span>
                            <span style={{ fontSize: 11, color: '#444' }}>{new Date(unit.expiry_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Detail Unit ───────────────────────────────────────────────── */}
      {detailUnit && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>{detailUnit.barcode}</span>
              <button onClick={() => setDetailUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={17} color="#555" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <UnitStatusBadge status={detailUnit.status} />
              {isOnGerobak(detailUnit.status) && detailUnit.loading_order_id && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                  <Truck size={10} color="#f59e0b" /> Loading #{detailUnit.loading_order_id}
                </span>
              )}
            </div>

            {isOnGerobak(detailUnit.status) && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8 }}>
                <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ color: '#f59e0b', fontSize: 12, margin: 0, fontWeight: 600 }}>Unit sedang di gerobak</p>
                  <p style={{ color: '#78716c', fontSize: 12, margin: '4px 0 0' }}>Belum terjual. Stok gudang tidak berkurang. Akan kembali ke READY jika return baik, atau menjadi RUSAK jika return rusak.</p>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {([
                ['Produk',     detailUnit.nama_produk],
                ['MO',         `#${detailUnit.mo_id}`],
                ['Harga Modal','Rp ' + Number(detailUnit.harga_modal ?? 0).toLocaleString('id')],
                ['Harga Jual', 'Rp ' + Number(detailUnit.harga_jual  ?? 0).toLocaleString('id')],
                ['Expired',    new Date(detailUnit.expiry_date).toLocaleDateString('id-ID')],
                ['Dispatched', detailUnit.dispatched_at ? new Date(detailUnit.dispatched_at).toLocaleDateString('id-ID') : '—'],
                ['Terjual',    detailUnit.sold_at      ? new Date(detailUnit.sold_at).toLocaleDateString('id-ID')       : '—'],
                ['Returned',   detailUnit.returned_at  ? new Date(detailUnit.returned_at).toLocaleDateString('id-ID')   : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ color: '#555', fontSize: 11, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</p>
                  <p style={{ color: 'white', fontSize: 13, margin: 0, fontWeight: 500 }}>{v}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetailUnit(null)} style={btnGhost}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11, color,
      background: color + '1a',
      border: `1px solid ${color}33`,
      borderRadius: 20, padding: '1px 8px',
    }}>
      {children}
    </span>
  );
}
