import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Package, Search, X, RefreshCw, Warehouse, Truck, ShoppingBag, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';

// ── Styles ──────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modalBox: React.CSSProperties = { background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' };

// Status unit dengan warna & label yang mencerminkan lokasi barang
const UNIT_STATUS: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
  ready:            { label: '📦 Di Gudang',    color: '#a3e635', bg: 'rgba(163,230,53,0.1)',  border: 'rgba(163,230,53,0.25)',  desc: 'Tersedia di gudang — terhitung sebagai stok' },
  on_gerobak:       { label: '🛒 Di Gerobak',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  desc: 'Sedang dibawa driver — tidak mengurangi stok gudang, belum terjual' },
  sold:             { label: '✅ Terjual',       color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', desc: 'Sudah terjual — keluar dari stok permanen' },
  returned_good:    { label: '↩ Kembali Baik',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', desc: 'Dikembalikan kondisi baik — kembali ke stok (READY)' },
  returned_damaged: { label: '💔 Kembali Rusak',color: '#f87171', bg: 'rgba(248,113,113,0.1)',border: 'rgba(248,113,113,0.25)',desc: 'Dikembalikan rusak — keluar dari stok permanen' },
  expired:          { label: '⏰ Kadaluarsa',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.25)',desc: 'Kadaluarsa — keluar dari stok' },
  void:             { label: '🚫 Void',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  desc: 'Di-void manual — keluar dari stok' },
  dispatched:       { label: '🚚 Dispatched',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)',  desc: 'Legacy — sama dengan On Gerobak' },
};

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
interface MOHeader {
  id: number; nomor_mo: string; nama_produk?: string;
  units: ProductionUnit[];
}

function UnitStatusBadge({ status }: { status: string }) {
  const s = UNIT_STATUS[status] ?? { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', desc: '' };
  return (
    <span title={s.desc} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg, border: `1px solid ${s.border}`, cursor: 'help' }}>
      {s.label}
    </span>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{icon}<span style={{ color: '#666', fontSize: 12 }}>{label}</span></div>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: '#555', fontSize: 11, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function StokPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedMO, setExpandedMO] = useState<Set<number>>(new Set());
  const [detailUnit, setDetailUnit] = useState<ProductionUnit | null>(null);

  const { data: rawUnits = [], isLoading, refetch } = useQuery<ProductionUnit[]>({
    queryKey: ['production-units'],
    queryFn: () => api.get('/production-units/').then(r => r.data),
  });

  const units: ProductionUnit[] = Array.isArray(rawUnits) ? rawUnits : [];

  // ── Statistik
  const stokGudang     = units.filter(u => u.status === 'ready').length;
  const onGerobak      = units.filter(u => u.status === 'on_gerobak' || u.status === 'dispatched').length;
  const terjual        = units.filter(u => u.status === 'sold').length;
  const rusak          = units.filter(u => u.status === 'returned_damaged' || u.status === 'void').length;

  // ── Filter & search
  const filtered = useMemo(() => {
    let list = units;
    if (filterStatus !== 'all') list = list.filter(u => u.status === filterStatus);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u => u.barcode.toLowerCase().includes(q) || u.nama_produk.toLowerCase().includes(q));
    }
    return list;
  }, [units, filterStatus, search]);

  // ── Group by MO
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Stok Produksi" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

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
          <StatCard icon={<Warehouse size={14} color="#a3e635" />} label="Stok Gudang"   value={stokGudang} color="#a3e635" sub="Status: READY" />
          <StatCard icon={<Truck size={14} color="#f59e0b" />}     label="Di Gerobak"   value={onGerobak}  color="#f59e0b" sub="Belum terjual" />
          <StatCard icon={<ShoppingBag size={14} color="#4ade80" />} label="Terjual"    value={terjual}    color="#4ade80" sub="Keluar stok" />
          <StatCard icon={<AlertTriangle size={14} color="#f87171" />} label="Rusak/Void" value={rusak}    color="#f87171" sub="Keluar stok" />
        </div>

        {/* Info stok */}
        <div style={{ background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: '#a3e635', fontSize: 12 }}>📦 <strong>Stok Gudang</strong> = hanya unit berstatus READY</span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>·</span>
          <span style={{ color: '#f59e0b', fontSize: 12 }}>🛒 Unit <strong>On Gerobak</strong> = sudah dibawa, tapi belum terjual, tidak berkurang dari stok gudang</span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>·</span>
          <span style={{ color: '#4ade80', fontSize: 12 }}>↩ Return baik = kembali ke stok</span>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari barcode atau produk..." style={{ ...inp, paddingLeft: 30 }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer', flex: 'none' }}>
            <option value="all" style={{ background: '#1a1a1a' }}>Semua Status</option>
            <option value="ready" style={{ background: '#1a1a1a' }}>📦 Di Gudang (READY)</option>
            <option value="on_gerobak" style={{ background: '#1a1a1a' }}>🛒 Di Gerobak</option>
            <option value="sold" style={{ background: '#1a1a1a' }}>✅ Terjual</option>
            <option value="returned_good" style={{ background: '#1a1a1a' }}>↩ Kembali Baik</option>
            <option value="returned_damaged" style={{ background: '#1a1a1a' }}>💔 Kembali Rusak</option>
            <option value="expired" style={{ background: '#1a1a1a' }}>⏰ Kadaluarsa</option>
            <option value="void" style={{ background: '#1a1a1a' }}>🚫 Void</option>
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
              const isOpen = expandedMO.has(mo_id);
              const ready    = moUnits.filter(u => u.status === 'ready').length;
              const onGero   = moUnits.filter(u => u.status === 'on_gerobak' || u.status === 'dispatched').length;
              const sold_cnt = moUnits.filter(u => u.status === 'sold').length;
              const damaged  = moUnits.filter(u => ['returned_damaged','void','expired'].includes(u.status)).length;
              return (
                <div key={mo_id} style={card}>
                  {/* MO header row */}
                  <button onClick={() => toggleMO(mo_id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Package size={15} color="#f87171" />
                      <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>MO #{mo_id}</span>
                      <span style={{ color: '#555', fontSize: 12 }}>{moUnits[0]?.nama_produk}</span>
                      <span style={{ color: '#666', fontSize: 12 }}>{moUnits.length} unit</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {ready    > 0 && <span style={{ fontSize: 11, color: '#a3e635', background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 20, padding: '1px 8px' }}>{ready} gudang</span>}
                      {onGero   > 0 && <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '1px 8px' }}>{onGero} gerobak</span>}
                      {sold_cnt > 0 && <span style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '1px 8px' }}>{sold_cnt} terjual</span>}
                      {damaged  > 0 && <span style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 20, padding: '1px 8px' }}>{damaged} rusak/void</span>}
                      {isOpen ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                    </div>
                  </button>

                  {/* Unit list (collapsible) */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {moUnits.map(unit => (
                        <div key={unit.id}
                          onClick={() => setDetailUnit(unit)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#aaa' }}>{unit.barcode}</span>
                            <UnitStatusBadge status={unit.status} />
                          </div>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {unit.status === 'on_gerobak' && unit.loading_order_id && (
                              <span style={{ fontSize: 11, color: '#f59e0b' }}>Loading #{unit.loading_order_id}</span>
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
              <button onClick={() => setDetailUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <UnitStatusBadge status={detailUnit.status} />
              {detailUnit.status === 'on_gerobak' && (
                <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                  Loading #{detailUnit.loading_order_id}
                </span>
              )}
            </div>

            {detailUnit.status === 'on_gerobak' && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <p style={{ color: '#f59e0b', fontSize: 12, margin: 0, fontWeight: 600 }}>⚠ Unit sedang di gerobak</p>
                <p style={{ color: '#78716c', fontSize: 12, margin: '4px 0 0' }}>Belum terjual. Stok gudang tidak berkurang. Akan kembali ke READY jika return baik, atau menjadi RUSAK jika return rusak.</p>
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
