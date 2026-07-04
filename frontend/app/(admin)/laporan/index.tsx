import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  TrendingUp, ShoppingBag, Banknote, BarChart2,
  Calendar, RefreshCw, Search, X, ChevronDown,
  Truck, Package,
} from 'lucide-react-native';

// ─── Styles ──────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'white', fontSize: 13, outline: 'none',
};
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, padding: '16px 20px',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#aaa', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface SoldUnit {
  id: number;
  barcode: string;
  nama_produk: string;
  harga_modal: number | null;
  harga_jual: number | null;
  sold_at: string | null;
  loading_order_id: number | null;
  current_gerobak_id: number | null;
  mo_id: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function rp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function toDateStr(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toTimeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

// ─── Preset tanggal ───────────────────────────────────────────────────────────
const today = new Date();
const PRESETS = [
  { label: 'Hari Ini',   from: isoDate(today),                                              to: isoDate(today) },
  { label: '7 Hari',    from: isoDate(new Date(today.getTime() - 6 * 86400000)),            to: isoDate(today) },
  { label: '30 Hari',   from: isoDate(new Date(today.getTime() - 29 * 86400000)),           to: isoDate(today) },
  { label: 'Semua',     from: '',                                                            to: '' },
];

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{ ...card, minWidth: 160, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: '#555', fontSize: 11, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LaporanPenjualanPage() {
  const [dateFrom, setDateFrom] = useState(isoDate(today));
  const [dateTo,   setDateTo]   = useState(isoDate(today));
  const [search,   setSearch]   = useState('');
  const [activePreset, setActivePreset] = useState('Hari Ini');

  const applyPreset = (p: typeof PRESETS[0]) => {
    setActivePreset(p.label);
    setDateFrom(p.from);
    setDateTo(p.to);
  };

  // Fetch semua unit, filter SOLD di client
  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['production-units-laporan'],
    queryFn: () => api.get('/production-units/?page=1&per_page=2000').then(r => r.data),
    staleTime: 30_000,
  });

  const allUnits: SoldUnit[] = useMemo(() => {
    if (!rawData) return [];
    const list = Array.isArray(rawData) ? rawData : (rawData.items ?? []);
    return list.filter((u: any) => u.status === 'sold');
  }, [rawData]);

  const filtered = useMemo(() => {
    let list = allUnits;

    if (dateFrom) {
      list = list.filter(u => u.sold_at && u.sold_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      list = list.filter(u => u.sold_at && u.sold_at.slice(0, 10) <= dateTo);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        u.barcode.toLowerCase().includes(q) ||
        u.nama_produk.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) =>
      new Date(b.sold_at ?? 0).getTime() - new Date(a.sold_at ?? 0).getTime()
    );
  }, [allUnits, dateFrom, dateTo, search]);

  // ── Statistik ──
  const totalUnit   = filtered.length;
  const totalOmzet  = filtered.reduce((s, u) => s + (u.harga_jual  ?? 0), 0);
  const totalModal  = filtered.reduce((s, u) => s + (u.harga_modal ?? 0), 0);
  const totalProfit = totalOmzet - totalModal;
  const avgJual     = totalUnit > 0 ? totalOmzet / totalUnit : 0;

  // ── Group by produk ──
  const byProduk = useMemo(() => {
    const map = new Map<string, { nama: string; qty: number; omzet: number; modal: number }>();
    for (const u of filtered) {
      const e = map.get(u.nama_produk) ?? { nama: u.nama_produk, qty: 0, omzet: 0, modal: 0 };
      e.qty++;
      e.omzet  += u.harga_jual  ?? 0;
      e.modal  += u.harga_modal ?? 0;
      map.set(u.nama_produk, e);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filtered]);

  const hasFilter = search || dateFrom !== isoDate(today) || dateTo !== isoDate(today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Laporan Penjualan" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Laporan Penjualan</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>
              {totalUnit} unit terjual
              {dateFrom && dateTo ? ` · ${dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`}` : ''}
            </p>
          </div>
          <button onClick={() => refetch()} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color="#aaa" /> Refresh
          </button>
        </div>

        {/* ── Preset + Filter tanggal ── */}
        <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  background: activePreset === p.label ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: activePreset === p.label ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)',
                  color: activePreset === p.label ? '#f87171' : '#aaa',
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={13} color="#555" />
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
              style={{ ...inp, width: 140, colorScheme: 'dark' }}
            />
            <span style={{ color: '#444', fontSize: 13 }}>—</span>
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
              style={{ ...inp, width: 140, colorScheme: 'dark' }}
            />
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari barcode / produk..."
              style={{ ...inp, paddingLeft: 30 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={12} color="#555" />
              </button>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard
            icon={<ShoppingBag size={14} color="#4ade80" />}
            label="Unit Terjual" value={totalUnit.toString()} color="#4ade80"
            sub="unit dengan status SOLD"
          />
          <StatCard
            icon={<TrendingUp size={14} color="#60a5fa" />}
            label="Total Omzet" value={rp(totalOmzet)} color="#60a5fa"
            sub={`Rata-rata ${rp(Math.round(avgJual))} / unit`}
          />
          <StatCard
            icon={<Banknote size={14} color="#a3e635" />}
            label="Laba Kotor" value={rp(totalProfit)} color={totalProfit >= 0 ? '#a3e635' : '#f87171'}
            sub={`Modal: ${rp(totalModal)}`}
          />
          <StatCard
            icon={<BarChart2 size={14} color="#f59e0b" />}
            label="Margin" value={totalOmzet > 0 ? ((totalProfit / totalOmzet) * 100).toFixed(1) + '%' : '—'} color="#f59e0b"
            sub="Laba / Omzet"
          />
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Memuat data...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

            {/* ── Ringkasan per Produk ── */}
            <div style={card}>
              <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Per Produk</p>
              {byProduk.length === 0 ? (
                <p style={{ color: '#444', fontSize: 13 }}>Tidak ada data</p>
              ) : byProduk.map(p => (
                <div key={p.nama} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: 13, margin: 0, fontWeight: 500 }}>{p.nama}</p>
                    <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0' }}>{p.qty} unit · modal {rp(p.modal)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#60a5fa', fontSize: 13, margin: 0, fontWeight: 600 }}>{rp(p.omzet)}</p>
                    <p style={{ color: p.omzet - p.modal >= 0 ? '#a3e635' : '#f87171', fontSize: 11, margin: '2px 0 0' }}>
                      laba {rp(p.omzet - p.modal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Export hint ── */}
            <div style={card}>
              <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Export Data</p>
              <CsvExportBlock units={filtered} dateFrom={dateFrom} dateTo={dateTo} />
            </div>
          </div>
        )}

        {/* ── Tabel transaksi ── */}
        {!isLoading && (
          <div style={card}>
            <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>
              Detail Transaksi ({filtered.length})
            </p>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Package size={32} color="#2a2a2a" style={{ marginBottom: 10 }} />
                <p style={{ color: '#3a3a3a', fontSize: 13 }}>Tidak ada penjualan pada periode ini</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Waktu Jual', 'Barcode', 'Produk', 'Harga Modal', 'Harga Jual', 'Profit', 'Loading'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#555', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => {
                      const profit = (u.harga_jual ?? 0) - (u.harga_modal ?? 0);
                      return (
                        <tr
                          key={u.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                        >
                          <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                            <p style={{ color: 'white', margin: 0, fontSize: 12 }}>{u.sold_at ? toDateStr(u.sold_at) : '—'}</p>
                            <p style={{ color: '#555', margin: 0, fontSize: 11 }}>{u.sold_at ? toTimeStr(u.sold_at) : ''}</p>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#aaa', fontSize: 12 }}>{u.barcode}</span>
                          </td>
                          <td style={{ padding: '9px 10px', color: 'white' }}>{u.nama_produk}</td>
                          <td style={{ padding: '9px 10px', color: '#666' }}>{rp(u.harga_modal ?? 0)}</td>
                          <td style={{ padding: '9px 10px', color: '#60a5fa', fontWeight: 600 }}>{rp(u.harga_jual ?? 0)}</td>
                          <td style={{ padding: '9px 10px', color: profit >= 0 ? '#a3e635' : '#f87171', fontWeight: 600 }}>{rp(profit)}</td>
                          <td style={{ padding: '9px 10px' }}>
                            {u.loading_order_id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f59e0b' }}>
                                <Truck size={10} color="#f59e0b" /> #{u.loading_order_id}
                              </span>
                            ) : <span style={{ color: '#333' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <td colSpan={3} style={{ padding: '10px 10px', color: '#888', fontWeight: 700, fontSize: 12 }}>TOTAL ({totalUnit} unit)</td>
                      <td style={{ padding: '10px 10px', color: '#666', fontWeight: 700 }}>{rp(totalModal)}</td>
                      <td style={{ padding: '10px 10px', color: '#60a5fa', fontWeight: 700 }}>{rp(totalOmzet)}</td>
                      <td style={{ padding: '10px 10px', color: totalProfit >= 0 ? '#a3e635' : '#f87171', fontWeight: 700 }}>{rp(totalProfit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CSV Export Block ─────────────────────────────────────────────────────────
function CsvExportBlock({ units, dateFrom, dateTo }: { units: SoldUnit[]; dateFrom: string; dateTo: string }) {
  const handleExport = () => {
    const header = ['Tanggal Jual', 'Waktu', 'Barcode', 'Produk', 'Harga Modal', 'Harga Jual', 'Profit', 'Loading Order ID'].join(',');
    const rows = units.map(u => {
      const sold = u.sold_at ? new Date(u.sold_at) : null;
      const profit = (u.harga_jual ?? 0) - (u.harga_modal ?? 0);
      return [
        sold ? sold.toLocaleDateString('id-ID') : '',
        sold ? sold.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
        u.barcode,
        `"${u.nama_produk}"`,
        u.harga_modal ?? 0,
        u.harga_jual ?? 0,
        profit,
        u.loading_order_id ?? '',
      ].join(',');
    });
    const csv   = [header, ...rows].join('\n');
    const blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `laporan-penjualan${dateFrom ? `-${dateFrom}` : ''}${dateTo && dateTo !== dateFrom ? `-sd-${dateTo}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>
        Download data penjualan sebagai file CSV. Bisa dibuka di Excel atau Google Sheets.
      </p>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <p style={{ color: '#888', fontSize: 12, margin: '0 0 6px' }}>Isi file CSV:</p>
        {['Tanggal & waktu terjual', 'Barcode unit', 'Nama produk', 'Harga modal & harga jual', 'Profit per unit', 'ID loading order'].map(item => (
          <p key={item} style={{ color: '#555', fontSize: 12, margin: '3px 0', paddingLeft: 10 }}>· {item}</p>
        ))}
      </div>
      <button
        onClick={handleExport}
        disabled={units.length === 0}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: units.length === 0 ? 'not-allowed' : 'pointer',
          border: '1px solid',
          background: units.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(96,165,250,0.15)',
          borderColor: units.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(96,165,250,0.4)',
          color: units.length === 0 ? '#444' : '#60a5fa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <ChevronDown size={14} color={units.length === 0 ? '#444' : '#60a5fa'} />
        Export CSV ({units.length} baris)
      </button>
    </div>
  );
}
