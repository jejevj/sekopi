import {
  FlaskConical, Package, Search, X, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';

type Tab = 'bahan' | 'unit';

const TABS: { key: Tab; label: string; Icon: any; activeColor: string }[] = [
  { key: 'bahan', label: 'Bahan Baku',    Icon: FlaskConical, activeColor: '#3b82f6' },
  { key: 'unit',  label: 'Unit Produksi', Icon: Package,      activeColor: '#a855f7' },
];

const UNIT_STATUS_COLOR: Record<string, string> = {
  ready:            '#3b82f6',
  dispatched:       '#eab308',
  delivered:        '#9333ea',
  sold:             '#22c55e',
  expired:          '#ef4444',
  void:             '#6b7280',
  returned_good:    '#0d9488',
  returned_damaged: '#ef4444',
};

const UNIT_STATUSES = Object.keys(UNIT_STATUS_COLOR);

function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 8, padding: '7px 12px', marginBottom: 14,
    }}>
      <Search size={13} color="#444" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input type="text" value={value} onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Cari...'}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 13, minWidth: 0 }}
      />
      {value.length > 0 && (
        <button onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
          <X size={13} color="#444" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default function StokPage() {
  const [tab, setTab] = useState<Tab>('bahan');
  const [searchBahan, setSearchBahan] = useState('');
  const [searchUnit, setSearchUnit]   = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedBahan, setExpandedBahan] = useState<number | null>(null);

  // GET /inventori/bahan-baku → list[BahanBakuResponse]
  // BahanBakuResponse: { id, nama, satuan, stok_minimum, saldo, ... }
  const { data: bahanList, isLoading: loadingBahan, refetch: refetchBahan } = useQuery({
    queryKey: ['stok-bahan'],
    queryFn: async () => (await api.get('/inventori/bahan-baku')).data,
    enabled: tab === 'bahan',
  });

  // GET /inventori/stok/{id}/histori → list[StokHistoriResponse]
  // StokHistoriResponse: { id, bahan_baku_id, tipe, jumlah, keterangan, created_at }
  const { data: historiData } = useQuery({
    queryKey: ['stok-histori', expandedBahan],
    queryFn: async () => (await api.get(`/inventori/stok/${expandedBahan}/histori`)).data,
    enabled: expandedBahan !== null,
  });

  // GET /production-units/ready-fefo → PaginatedUnitResponse
  // PaginatedUnitResponse: { total, page, per_page, total_pages, items: ProductionUnitResponse[] }
  // ProductionUnitResponse: { id, barcode, nama_produk, expiry_date, status, hari_tersisa, is_expired, is_expiring_soon, ... }
  const { data: unitData, isLoading: loadingUnit, refetch: refetchUnit } = useQuery({
    queryKey: ['stok-unit'],
    queryFn: async () => (await api.get('/production-units/ready-fefo?page=1&per_page=200')).data,
    enabled: tab === 'unit',
  });

  const bahanItems: any[] = Array.isArray(bahanList) ? bahanList : [];

  const filteredBahan = useMemo(() => {
    const q = searchBahan.trim().toLowerCase();
    if (!q) return bahanItems;
    return bahanItems.filter((b: any) => b.nama?.toLowerCase().includes(q));
  }, [bahanItems, searchBahan]);

  // unit: PaginatedUnitResponse.items
  const unitItems: any[] = unitData?.items ?? [];

  const filteredUnit = useMemo(() => {
    const q = searchUnit.trim().toLowerCase();
    return unitItems.filter((u: any) => {
      const matchQ = !q
        || u.barcode?.toLowerCase().includes(q)
        || u.nama_produk?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || u.status === filterStatus;
      return matchQ && matchStatus;
    });
  }, [unitItems, searchUnit, filterStatus]);

  const unitStats = useMemo(() =>
    UNIT_STATUSES.reduce((acc, s) => {
      acc[s] = unitItems.filter((u: any) => u.status === s).length;
      return acc;
    }, {} as Record<string, number>)
  , [unitItems]);

  // stok_minimum (bukan min_stok) sesuai BahanBakuResponse
  const stockLevel = (saldo: number, stok_minimum: number) => {
    if (saldo <= 0) return { label: 'Habis', color: '#ef4444', Icon: XCircle };
    if (stok_minimum > 0 && saldo <= stok_minimum)
      return { label: 'Hampir Habis', color: '#eab308', Icon: AlertTriangle };
    return { label: 'Aman', color: '#22c55e', Icon: CheckCircle };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Stok" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Stok Inventori</h1>
          <p style={{ color: '#555', fontSize: 14, margin: '4px 0 0' }}>Monitor stok bahan baku dan unit produksi secara real-time</p>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setSearchBahan(''); setSearchUnit('');
                  setFilterStatus('all'); setExpandedBahan(null);
                }}
                style={{
                  padding: '10px 20px', background: 'none', border: 'none',
                  borderBottom: active ? `2px solid ${t.activeColor}` : '2px solid transparent',
                  color: active ? t.activeColor : '#555',
                  fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <t.Icon size={14} color={active ? t.activeColor : '#555'} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB BAHAN BAKU ── */}
        {tab === 'bahan' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Bahan"  value={bahanItems.length} color="#3b82f6" />
              <StatCard label="Hampir Habis" value={bahanItems.filter((b: any) => b.saldo > 0 && b.stok_minimum > 0 && b.saldo <= b.stok_minimum).length} color="#eab308" />
              <StatCard label="Habis"        value={bahanItems.filter((b: any) => (b.saldo ?? 0) <= 0).length} color="#ef4444" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <RefreshButton onClick={() => { setSearchBahan(''); refetchBahan(); }} />
            </div>

            {loadingBahan ? <LoadingSpinner color="#3b82f6" /> : bahanItems.length === 0 ? (
              <EmptyState Icon={FlaskConical} message="Belum ada bahan baku" />
            ) : (
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={sectionTitle}>Semua Bahan Baku</p>
                  <span style={{ color: '#444', fontSize: 12 }}>Klik baris untuk lihat histori</span>
                </div>
                <SearchBar value={searchBahan} onChange={setSearchBahan} placeholder="Cari nama bahan baku..." />
                {searchBahan.trim() && (
                  <p style={{ color: '#444', fontSize: 12, margin: '0 0 10px' }}>{filteredBahan.length} hasil dari {bahanItems.length} bahan</p>
                )}
                {filteredBahan.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
                    Tidak ada bahan yang cocok dengan "{searchBahan}"
                  </div>
                ) : (
                  filteredBahan.map((bahan: any) => {
                    const level = stockLevel(bahan.saldo ?? 0, bahan.stok_minimum ?? 0);
                    const isExpanded = expandedBahan === bahan.id;
                    const histori: any[] = isExpanded ? (historiData ?? []) : [];
                    return (
                      <div key={bahan.id}>
                        <div
                          onClick={() => setExpandedBahan(isExpanded ? null : bahan.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <p style={{ color: 'white', fontSize: 13, fontWeight: 500, margin: 0 }}>{bahan.nama}</p>
                              <span style={{ backgroundColor: level.color + '18', color: level.color, border: `1px solid ${level.color}33`, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 500 }}>
                                {level.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 3, alignItems: 'center' }}>
                              <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
                                {(bahan.saldo ?? 0).toLocaleString('id-ID')} {bahan.satuan}
                              </span>
                              {bahan.stok_minimum > 0 && (
                                <span style={{ color: '#333', fontSize: 12 }}>
                                  Min: {bahan.stok_minimum.toLocaleString('id-ID')} {bahan.satuan}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <level.Icon size={14} color={level.color} strokeWidth={2} />
                            {isExpanded ? <ChevronUp size={14} color="#444" /> : <ChevronDown size={14} color="#444" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px', margin: '4px 0 8px', borderLeft: '2px solid rgba(59,130,246,0.3)' }}>
                            <p style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>Histori 50 Transaksi Terakhir</p>
                            {histori.length === 0 ? (
                              <p style={{ color: '#333', fontSize: 12, margin: 0 }}>Belum ada transaksi</p>
                            ) : (
                              histori.map((h: any, i: number) => (
                                <div key={h.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div>
                                    {/* StokHistoriResponse: tipe, keterangan */}
                                    <span style={{ color: '#888', fontSize: 12, textTransform: 'capitalize' }}>{h.tipe?.replace(/_/g, ' ')}</span>
                                    {h.keterangan && (
                                      <span style={{ color: '#444', fontSize: 11, marginLeft: 8 }}>{h.keterangan}</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    {/* StokHistoriResponse: jumlah (positif = masuk, negatif = keluar) */}
                                    <span style={{ color: h.jumlah > 0 ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                      {h.jumlah > 0 ? '+' : ''}{Number(h.jumlah).toLocaleString('id-ID')} {bahan.satuan}
                                    </span>
                                    {h.created_at && (
                                      <span style={{ color: '#333', fontSize: 11 }}>
                                        {new Date(h.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB UNIT PRODUKSI ── */}
        {tab === 'unit' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {UNIT_STATUSES.filter(s => unitStats[s] > 0).map(s => (
                <StatCard key={s} label={s.replace(/_/g, ' ')} value={unitStats[s]} color={UNIT_STATUS_COLOR[s]} />
              ))}
              {unitData != null && unitItems.length === 0 && (
                <StatCard label="Total" value={0} color="#555" />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <RefreshButton onClick={() => { setSearchUnit(''); setFilterStatus('all'); refetchUnit(); }} />
            </div>

            {loadingUnit ? <LoadingSpinner color="#a855f7" /> : unitItems.length === 0 ? (
              <EmptyState Icon={Package} message="Belum ada unit produksi dengan status ready" />
            ) : (
              <div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={sectionTitle}>Unit Produksi</p>
                  <span style={{ color: '#444', fontSize: 12 }}>{filteredUnit.length} / {unitItems.length} unit</span>
                </div>

                <SearchBar value={searchUnit} onChange={setSearchUnit} placeholder="Cari barcode atau nama produk..." />

                {/* Filter status pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {['all', ...UNIT_STATUSES.filter(s => unitStats[s] > 0)].map(s => {
                    const active = filterStatus === s;
                    const color = s === 'all' ? '#6b7280' : UNIT_STATUS_COLOR[s];
                    return (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        style={{
                          padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: active ? 600 : 400,
                          backgroundColor: active ? color + '20' : 'transparent',
                          border: active ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
                          color: active ? color : '#555', cursor: 'pointer', textTransform: 'capitalize',
                        }}
                      >
                        {s === 'all' ? 'Semua' : s.replace(/_/g, ' ')}
                        {s !== 'all' && ` (${unitStats[s]})`}
                      </button>
                    );
                  })}
                </div>

                {filteredUnit.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
                    Tidak ada unit yang cocok
                  </div>
                ) : (
                  filteredUnit.map((unit: any) => {
                    const uColor = UNIT_STATUS_COLOR[unit.status] ?? '#888';
                    return (
                      <div key={unit.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <div>
                          <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
                          <p style={{ color: '#555', fontSize: 12, margin: '2px 0 0' }}>{unit.nama_produk}</p>
                          <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* expiry_date: date string dari ProductionUnitResponse */}
                            <span style={{ color: '#333', fontSize: 12 }}>
                              Expiry: {unit.expiry_date}
                            </span>
                            {unit.is_expired && (
                              <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>EXPIRED</span>
                            )}
                            {unit.is_expiring_soon && !unit.is_expired && (
                              <span style={{ color: '#eab308', fontSize: 11, fontWeight: 600 }}>
                                {unit.hari_tersisa != null ? `${unit.hari_tersisa}h lagi` : 'Segera expired'}
                              </span>
                            )}
                          </div>
                        </div>
                        <span style={{
                          backgroundColor: uColor + '18', color: uColor,
                          border: `1px solid ${uColor}33`,
                          borderRadius: 5, padding: '2px 10px', fontSize: 11,
                          fontWeight: 500, whiteSpace: 'nowrap', textTransform: 'capitalize',
                        }}>
                          {unit.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 18px', minWidth: 120 }}>
      <p style={{ color: '#555', fontSize: 11, margin: '0 0 4px', textTransform: 'capitalize' }}>{label}</p>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 12px', color: '#555', fontSize: 12, cursor: 'pointer' }}
    >
      <RefreshCw size={12} color="#555" strokeWidth={2} /> Refresh
    </button>
  );
}

function LoadingSpinner({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${color}30`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function EmptyState({ Icon, message }: { Icon: any; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <Icon size={32} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, padding: 20,
};
const sectionTitle: React.CSSProperties = {
  color: 'white', fontWeight: 600, fontSize: 14, margin: 0,
};
