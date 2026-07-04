import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  TrendingUp, ShoppingBag, Banknote, BarChart2,
  Calendar, RefreshCw, Search, X, ChevronDown,
  Truck, Package, Store, Users,
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
interface PenjualanItem {
  id: number;
  production_unit_id: number;
  barcode: string;
  nama_produk: string;
  harga: number;
  catatan: string | null;
  sold_at: string;
  kasir_id: number;
  kasir_nama: string | null;
  gerobak_id: number | null;
  gerobak_nama: string | null;
  gerobak_kode: string | null;
  gerobak_lokasi: string | null;
  grup_id: number | null;
  grup_nama: string | null;
}

interface PenjualanResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  items: PenjualanItem[];
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

// ─── Fetch semua transaksi penjualan via auto-paginate ───────────────────────
async function fetchAllPenjualan(dateFrom: string, dateTo: string): Promise<PenjualanItem[]> {
  const PER_PAGE = 500;
  let page = 1;
  const collected: PenjualanItem[] = [];

  while (true) {
    const params: Record<string, string> = { page: String(page), per_page: String(PER_PAGE) };
    if (dateFrom) params.dari = dateFrom;
    if (dateTo)   params.sampai = dateTo;

    const res = await api.get('/penjualan/', { params });
    const data: PenjualanResponse = res.data;
    collected.push(...data.items);
    if (page >= data.total_pages || data.items.length < PER_PAGE) break;
    page++;
  }

  return collected;
}

// ─── Preset tanggal ───────────────────────────────────────────────────────────
const today = new Date();
const PRESETS = [
  { label: 'Hari Ini', from: isoDate(today),                                       to: isoDate(today) },
  { label: '7 Hari',   from: isoDate(new Date(today.getTime() - 6 * 86400000)),   to: isoDate(today) },
  { label: '30 Hari',  from: isoDate(new Date(today.getTime() - 29 * 86400000)),  to: isoDate(today) },
  { label: 'Semua',    from: '',                                                   to: '' },
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

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px', borderRadius: 6,
      background: color + '22', border: `1px solid ${color}44`,
      color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LaporanPenjualanPage() {
  const [dateFrom,     setDateFrom]     = useState(isoDate(today));
  const [dateTo,       setDateTo]       = useState(isoDate(today));
  const [search,       setSearch]       = useState('');
  const [filterGerobak, setFilterGerobak] = useState('');
  const [filterGrup,    setFilterGrup]    = useState('');
  const [activePreset, setActivePreset] = useState('Hari Ini');

  const applyPreset = (p: typeof PRESETS[0]) => {
    setActivePreset(p.label);
    setDateFrom(p.from);
    setDateTo(p.to);
  };

  const { data: allItems = [], isLoading, refetch } = useQuery<PenjualanItem[]>({
    queryKey: ['penjualan-list', dateFrom, dateTo],
    queryFn: () => fetchAllPenjualan(dateFrom, dateTo),
    staleTime: 30_000,
  });

  // Ambil unique gerobak & grup untuk filter dropdown
  const gerobakOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allItems) {
      if (u.gerobak_id) map.set(String(u.gerobak_id), u.gerobak_nama ?? String(u.gerobak_id));
    }
    return Array.from(map.entries()); // [id, nama]
  }, [allItems]);

  const grupOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allItems) {
      if (u.grup_id) map.set(String(u.grup_id), u.grup_nama ?? String(u.grup_id));
    }
    return Array.from(map.entries());
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u =>
        u.barcode.toLowerCase().includes(q) ||
        u.nama_produk.toLowerCase().includes(q) ||
        (u.kasir_nama ?? '').toLowerCase().includes(q) ||
        (u.gerobak_nama ?? '').toLowerCase().includes(q)
      );
    }
    if (filterGerobak) list = list.filter(u => String(u.gerobak_id) === filterGerobak);
    if (filterGrup)    list = list.filter(u => String(u.grup_id) === filterGrup);
    return list.sort((a, b) =>
      new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
    );
  }, [allItems, search, filterGerobak, filterGrup]);

  // ── Statistik ──
  const totalUnit   = filtered.length;
  const totalOmzet  = filtered.reduce((s, u) => s + u.harga, 0);

  // ── Group by gerobak ──
  const byGerobak = useMemo(() => {
    const map = new Map<string, { nama: string; kode: string; grup: string; qty: number; omzet: number }>();
    for (const u of filtered) {
      const key = String(u.gerobak_id ?? 'tanpa-gerobak');
      const e = map.get(key) ?? {
        nama: u.gerobak_nama ?? 'Tanpa Gerobak',
        kode: u.gerobak_kode ?? '-',
        grup: u.grup_nama ?? '-',
        qty: 0, omzet: 0,
      };
      e.qty++;
      e.omzet += u.harga;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.omzet - a.omzet);
  }, [filtered]);

  // ── Group by produk ──
  const byProduk = useMemo(() => {
    const map = new Map<string, { nama: string; qty: number; omzet: number }>();
    for (const u of filtered) {
      const e = map.get(u.nama_produk) ?? { nama: u.nama_produk, qty: 0, omzet: 0 };
      e.qty++;
      e.omzet += u.harga;
      map.set(u.nama_produk, e);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filtered]);

  const selectStyle: React.CSSProperties = { ...inp, width: 'auto', minWidth: 140 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Laporan Penjualan" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Laporan Penjualan</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>
              {isLoading ? 'Memuat...' : `${totalUnit} transaksi`}
              {!isLoading && dateFrom && dateTo
                ? ` · ${dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`}`
                : ''}
            </p>
          </div>
          <button onClick={() => refetch()} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color="#aaa" /> Refresh
          </button>
        </div>

        {/* ── Filter bar ── */}
        <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Preset */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: activePreset === p.label ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: activePreset === p.label ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)',
                color: activePreset === p.label ? '#f87171' : '#aaa',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={13} color="#555" />
            <input type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
              style={{ ...inp, width: 140, colorScheme: 'dark' }}
            />
            <span style={{ color: '#444', fontSize: 13 }}>—</span>
            <input type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
              style={{ ...inp, width: 140, colorScheme: 'dark' }}
            />
          </div>

          {/* Filter gerobak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Store size={13} color="#555" />
            <select value={filterGerobak} onChange={e => setFilterGerobak(e.target.value)} style={selectStyle}>
              <option value="">Semua Gerobak</option>
              {gerobakOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
            </select>
          </div>

          {/* Filter grup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={13} color="#555" />
            <select value={filterGrup} onChange={e => setFilterGrup(e.target.value)} style={selectStyle}>
              <option value="">Semua Grup Saham</option>
              {grupOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
            </select>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
            <Search size={13} color="#555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari barcode / produk / driver..."
              style={{ ...inp, paddingLeft: 30 }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={12} color="#555" />
              </button>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard icon={<ShoppingBag size={14} color="#4ade80" />} label="Transaksi"
            value={isLoading ? '...' : totalUnit.toString()} color="#4ade80" sub="unit terjual" />
          <StatCard icon={<TrendingUp size={14} color="#60a5fa" />} label="Total Omzet"
            value={isLoading ? '...' : rp(totalOmzet)} color="#60a5fa"
            sub={isLoading ? '' : totalUnit > 0 ? `Rata-rata ${rp(Math.round(totalOmzet / totalUnit))} / unit` : ''} />
          <StatCard icon={<Store size={14} color="#f59e0b" />} label="Gerobak Aktif"
            value={isLoading ? '...' : String(byGerobak.filter(g => g.nama !== 'Tanpa Gerobak').length)}
            color="#f59e0b" sub="gerobak yang berjualan" />
          <StatCard icon={<BarChart2 size={14} color="#a78bfa" />} label="Produk Terjual"
            value={isLoading ? '...' : String(byProduk.length)}
            color="#a78bfa" sub="jenis produk" />
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <RefreshCw size={20} color="#333" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Memuat data penjualan...</p>
          </div>
        ) : (
          <>
            {/* ── Grid: per gerobak + per produk ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

              {/* Per Gerobak */}
              <div style={card}>
                <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Per Gerobak</p>
                {byGerobak.length === 0 ? (
                  <p style={{ color: '#444', fontSize: 13 }}>Tidak ada data</p>
                ) : byGerobak.map(g => (
                  <div key={g.kode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: 13, margin: 0, fontWeight: 500 }}>{g.nama}</p>
                      <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0' }}>
                        {g.kode !== '-' ? `[${g.kode}] · ` : ''}
                        <span style={{ color: '#7c3aed' }}>{g.grup}</span>
                        {' · '}{g.qty} unit
                      </p>
                    </div>
                    <p style={{ color: '#60a5fa', fontSize: 13, margin: 0, fontWeight: 600 }}>{rp(g.omzet)}</p>
                  </div>
                ))}
              </div>

              {/* Per Produk */}
              <div style={card}>
                <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Per Produk</p>
                {byProduk.length === 0 ? (
                  <p style={{ color: '#444', fontSize: 13 }}>Tidak ada data</p>
                ) : byProduk.map(p => (
                  <div key={p.nama} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: 13, margin: 0, fontWeight: 500 }}>{p.nama}</p>
                      <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0' }}>{p.qty} unit</p>
                    </div>
                    <p style={{ color: '#60a5fa', fontSize: 13, margin: 0, fontWeight: 600 }}>{rp(p.omzet)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Export CSV ── */}
            <div style={{ ...card, marginBottom: 20 }}>
              <p style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Export Data</p>
              <CsvExportBlock items={filtered} dateFrom={dateFrom} dateTo={dateTo} />
            </div>

            {/* ── Tabel transaksi ── */}
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
                        {['Waktu Jual', 'Barcode', 'Produk', 'Harga Jual', 'Gerobak', 'Driver / Kasir', 'Grup Saham'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#555', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u, i) => (
                        <tr key={u.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                        >
                          <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                            <p style={{ color: 'white', margin: 0, fontSize: 12 }}>{toDateStr(u.sold_at)}</p>
                            <p style={{ color: '#555', margin: 0, fontSize: 11 }}>{toTimeStr(u.sold_at)}</p>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#aaa', fontSize: 12 }}>{u.barcode}</span>
                          </td>
                          <td style={{ padding: '9px 10px', color: 'white' }}>{u.nama_produk}</td>
                          <td style={{ padding: '9px 10px', color: '#60a5fa', fontWeight: 600 }}>{rp(u.harga)}</td>
                          <td style={{ padding: '9px 10px' }}>
                            {u.gerobak_nama ? (
                              <div>
                                <p style={{ color: 'white', margin: 0, fontSize: 12, fontWeight: 500 }}>{u.gerobak_nama}</p>
                                <p style={{ color: '#555', margin: 0, fontSize: 11 }}>[{u.gerobak_kode}]{u.gerobak_lokasi ? ` · ${u.gerobak_lokasi}` : ''}</p>
                              </div>
                            ) : <span style={{ color: '#333' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            {u.kasir_nama
                              ? <Badge text={u.kasir_nama} color="#f59e0b" />
                              : <span style={{ color: '#333' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            {u.grup_nama
                              ? <Badge text={u.grup_nama} color="#a78bfa" />
                              : <span style={{ color: '#333' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <td colSpan={3} style={{ padding: '10px 10px', color: '#888', fontWeight: 700, fontSize: 12 }}>TOTAL ({totalUnit} transaksi)</td>
                        <td style={{ padding: '10px 10px', color: '#60a5fa', fontWeight: 700 }}>{rp(totalOmzet)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function CsvExportBlock({ items, dateFrom, dateTo }: { items: PenjualanItem[]; dateFrom: string; dateTo: string }) {
  const handleExport = () => {
    const header = ['Tanggal', 'Waktu', 'Barcode', 'Produk', 'Harga Jual', 'Gerobak', 'Kode Gerobak', 'Lokasi', 'Driver/Kasir', 'Grup Saham'].join(',');
    const rows = items.map(u => {
      const sold = new Date(u.sold_at);
      return [
        sold.toLocaleDateString('id-ID'),
        sold.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        u.barcode,
        `"${u.nama_produk}"`,
        u.harga,
        `"${u.gerobak_nama ?? ''}"`  ,
        u.gerobak_kode ?? '',
        `"${u.gerobak_lokasi ?? ''}"`,
        `"${u.kasir_nama ?? ''}"`,
        `"${u.grup_nama ?? ''}"`,
      ].join(',');
    });
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `laporan-penjualan${dateFrom ? `-${dateFrom}` : ''}${dateTo && dateTo !== dateFrom ? `-sd-${dateTo}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <p style={{ color: '#555', fontSize: 12, margin: 0 }}>Kolom: Tanggal, Waktu, Barcode, Produk, Harga, Gerobak, Kode, Lokasi, Driver, Grup Saham</p>
      </div>
      <button
        onClick={handleExport}
        disabled={items.length === 0}
        style={{
          padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: items.length === 0 ? 'not-allowed' : 'pointer',
          border: '1px solid',
          background:  items.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(96,165,250,0.15)',
          borderColor: items.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(96,165,250,0.4)',
          color:       items.length === 0 ? '#444' : '#60a5fa',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <ChevronDown size={14} color={items.length === 0 ? '#444' : '#60a5fa'} />
        Export CSV ({items.length} baris)
      </button>
    </div>
  );
}
