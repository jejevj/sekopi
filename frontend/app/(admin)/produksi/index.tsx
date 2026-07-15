import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  Package, Search, X, RefreshCw,
  Warehouse, Truck, ShoppingBag, AlertTriangle,
  ChevronDown, ChevronUp,
  CheckCircle, RotateCcw, HeartCrack, Clock, Ban, MapPin, Download,
} from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modalBox: React.CSSProperties = { background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' };

// ─── Code128 barcode generator ───────────────────────────────────────────────
// Pure SVG, no external dependency.
const CODE128B_MAP: Record<string, number> = {};
const CODE128B_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
CODE128B_CHARS.split('').forEach((c, i) => { CODE128B_MAP[c] = i + 32; });

const CODE128_PATTERNS: Record<number, string> = {
  0:'11011001100',1:'11001101100',2:'11001100110',3:'10010011000',4:'10010001100',
  5:'10001001100',6:'10011001000',7:'10011000100',8:'10001100100',9:'11001001000',
  10:'11001000100',11:'11000100100',12:'10110011100',13:'10011011100',14:'10011001110',
  15:'10111001100',16:'10011101100',17:'10011100110',18:'11001110010',19:'11001011100',
  20:'11001001110',21:'11011100100',22:'11001110100',23:'11101101110',24:'11101001100',
  25:'11100101100',26:'11100100110',27:'11101100100',28:'11100110100',29:'11100110010',
  30:'11011011000',31:'11011000110',32:'11000110110',33:'10100011000',34:'10001011000',
  35:'10001000110',36:'10110001000',37:'10001101000',38:'10001100010',39:'11010001000',
  40:'11000101000',41:'11000100010',42:'10110111000',43:'10110001110',44:'10001101110',
  45:'10111011000',46:'10111000110',47:'10001110110',48:'11101110110',49:'11010001110',
  50:'11000101110',51:'11011101000',52:'11011100010',53:'11011101110',54:'11101011000',
  55:'11101000110',56:'11100010110',57:'11101101000',58:'11101100010',59:'11100011010',
  60:'11101111010',61:'11001000010',62:'11110001010',63:'10100110000',64:'10100001100',
  65:'10010110000',66:'10010000110',67:'10000101100',68:'10000100110',69:'10110010000',
  70:'10110000100',71:'10011010000',72:'10011000010',73:'10000110100',74:'10000110010',
  75:'11000010010',76:'11001010000',77:'11110111010',78:'11000010100',79:'10001111010',
  80:'10100111100',81:'10010111100',82:'10010011110',83:'10111100100',84:'10011110100',
  85:'10011110010',86:'11110100100',87:'11110010100',88:'11110010010',89:'11011011110',
  90:'11011110110',91:'11110110110',92:'10101111000',93:'10100011110',94:'10001011110',
  95:'10111101000',96:'10111100010',97:'10011101110',98:'10011110111',99:'11110100010',
  100:'11110010001',101:'11100100011',102:'11111011010',
  // Start B = 104, Stop = 106
  104:'11010010000', 106:'1100011101011',
};

function encodeCode128(text: string): string {
  // Start Code B
  let bits = CODE128_PATTERNS[104];
  let checksum = 104;
  text.split('').forEach((char, i) => {
    const code = CODE128B_MAP[char] ?? 0;
    bits += CODE128_PATTERNS[code] ?? '11011001100';
    checksum += (i + 1) * code;
  });
  const check = checksum % 103;
  bits += CODE128_PATTERNS[check] ?? '11011001100';
  bits += CODE128_PATTERNS[106]; // Stop
  return bits;
}

function BarcodeSVG({ value, height = 64 }: { value: string; height?: number }) {
  const bits = encodeCode128(value);
  const barW = 2;
  const totalW = bits.length * barW;
  const rects: React.ReactElement[] = [];
  let x = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      // Merge consecutive bars
      let w = barW;
      while (i + 1 < bits.length && bits[i + 1] === '1') { i++; w += barW; }
      rects.push(<rect key={x} x={x} y={0} width={w} height={height} fill="white" />);
    }
    x += barW;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={totalW}
      height={height}
      viewBox={`0 0 ${totalW} ${height}`}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      <rect width={totalW} height={height} fill="#0a0a0a" />
      {rects}
    </svg>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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

function formatHarga(unit: ProductionUnit): string {
  const harga = unit.harga_jual ?? unit.harga_modal;
  if (harga == null) return '—';
  return 'Rp ' + Number(harga).toLocaleString('id-ID');
}

function labelHarga(unit: ProductionUnit): string {
  if (unit.harga_jual != null) return 'Jual';
  if (unit.harga_modal != null) return 'Modal';
  return '';
}

function downloadBarcodeSVG(barcode: string) {
  const bits = encodeCode128(barcode);
  const barW = 2;
  const totalW = bits.length * barW;
  const height = 80;
  let rectsSVG = '';
  let x = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      let w = barW;
      while (i + 1 < bits.length && bits[i + 1] === '1') { i++; w += barW; }
      rectsSVG += `<rect x="${x}" y="8" width="${w}" height="${height}" fill="black"/>`;
    }
    x += barW;
  }
  const labelY = height + 22;
  const svgStr = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${labelY}" viewBox="0 0 ${totalW} ${labelY}">
  <rect width="${totalW}" height="${labelY}" fill="white"/>
  ${rectsSVG}
  <text x="${totalW / 2}" y="${labelY - 4}" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${barcode}</text>
</svg>`;
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${barcode}.svg`; a.click();
  URL.revokeObjectURL(url);
}

export default function StokPage() {
  useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedMO, setExpandedMO] = useState<Set<number>>(new Set());
  const [detailUnit, setDetailUnit] = useState<ProductionUnit | null>(null);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['production-units'],
    queryFn: () => api.get('/production-units?page=1&per_page=500').then(r => r.data),
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Stok Produksi</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{units.length} unit total</p>
          </div>
          <button onClick={() => refetch()} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color="#aaa" /> Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard icon={<Warehouse   size={14} color="#a3e635" />} label="Stok Gudang" value={stokGudang} color="#a3e635" sub="Status: READY" />
          <StatCard icon={<Truck       size={14} color="#f59e0b" />} label="Di Gerobak"  value={onGerobak}  color="#f59e0b" sub="Belum terjual" />
          <StatCard icon={<ShoppingBag size={14} color="#4ade80" />} label="Terjual"     value={terjual}    color="#4ade80" sub="Keluar stok" />
          <StatCard icon={<HeartCrack  size={14} color="#f87171" />} label="Rusak/Void"  value={rusak}      color="#f87171" sub="Keluar stok" />
        </div>

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
                            <span style={{ fontSize: 12, color: '#555' }}>
                              <span style={{ fontSize: 10, color: '#444', marginRight: 3 }}>{labelHarga(unit)}</span>
                              {formatHarga(unit)}
                            </span>
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

      {/* ── Modal: Detail Unit ── */}
      {detailUnit && (
        <div style={overlay} onClick={() => setDetailUnit(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>
                {detailUnit.barcode}
              </span>
              <button onClick={() => setDetailUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={17} color="#555" />
              </button>
            </div>

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <UnitStatusBadge status={detailUnit.status} />
              {isOnGerobak(detailUnit.status) && detailUnit.loading_order_id && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                  <Truck size={10} color="#f59e0b" /> Loading #{detailUnit.loading_order_id}
                </span>
              )}
            </div>

            {/* Barcode SVG */}
            <div style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '16px 12px 10px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}>
              <BarcodeSVG value={detailUnit.barcode} height={64} />
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666', letterSpacing: 1.5 }}>
                {detailUnit.barcode}
              </span>
              <button
                onClick={() => downloadBarcodeSVG(detailUnit.barcode)}
                style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 11 }}
              >
                <Download size={11} color="#aaa" /> Download SVG
              </button>
            </div>

            {/* On-gerobak warning */}
            {isOnGerobak(detailUnit.status) && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8 }}>
                <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ color: '#f59e0b', fontSize: 12, margin: 0, fontWeight: 600 }}>Unit sedang di gerobak</p>
                  <p style={{ color: '#78716c', fontSize: 12, margin: '4px 0 0' }}>Belum terjual. Stok gudang tidak berkurang. Akan kembali ke READY jika return baik, atau menjadi RUSAK jika return rusak.</p>
                </div>
              </div>
            )}

            {/* Detail grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {([
                ['Produk',      detailUnit.nama_produk],
                ['MO',          `#${detailUnit.mo_id}`],
                ['Harga Modal', detailUnit.harga_modal != null ? 'Rp ' + Number(detailUnit.harga_modal).toLocaleString('id-ID') : '—'],
                ['Harga Jual',  detailUnit.harga_jual  != null ? 'Rp ' + Number(detailUnit.harga_jual).toLocaleString('id-ID')  : '—'],
                ['Expired',     new Date(detailUnit.expiry_date).toLocaleDateString('id-ID')],
                ['Dispatched',  detailUnit.dispatched_at ? new Date(detailUnit.dispatched_at).toLocaleDateString('id-ID') : '—'],
                ['Terjual',     detailUnit.sold_at      ? new Date(detailUnit.sold_at).toLocaleDateString('id-ID')       : '—'],
                ['Returned',    detailUnit.returned_at  ? new Date(detailUnit.returned_at).toLocaleDateString('id-ID')   : '—'],
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
