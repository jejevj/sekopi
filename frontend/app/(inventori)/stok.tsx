import {
  FlaskConical, Package, Search, X, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Clock,
  Truck, ShoppingBag, HeartCrack, Warehouse,
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

const UNIT_STATUS_META: Record<string, { color: string; label: string; desc: string }> = {
  ready:            { color: '#a3e635', label: '📦 Di Gudang',     desc: 'Tersedia di gudang — terhitung sebagai stok' },
  on_gerobak:       { color: '#f59e0b', label: '🛒 Di Gerobak',    desc: 'Sedang dibawa driver — belum terjual, tidak mengurangi stok gudang' },
  dispatched:       { color: '#f59e0b', label: '🚚 Dispatched',    desc: 'Legacy — setara On Gerobak' },
  delivered:        { color: '#818cf8', label: '📬 Delivered',     desc: 'Sudah diterima driver, siap dijual' },
  sold:             { color: '#22c55e', label: '✅ Terjual',        desc: 'Sudah terjual — keluar dari stok permanen' },
  returned_good:    { color: '#0d9488', label: '↩ Kembali Baik',   desc: 'Dikembalikan kondisi baik — kembali ke stok (READY)' },
  returned_damaged: { color: '#ef4444', label: '💔 Kembali Rusak', desc: 'Dikembalikan rusak — keluar dari stok permanen' },
  expired:          { color: '#6b7280', label: '⏰ Kadaluarsa',    desc: 'Kadaluarsa — keluar dari stok' },
  void:             { color: '#374151', label: '🚫 Void',           desc: 'Di-void manual — keluar dari stok' },
};

const UNIT_STATUSES = Object.keys(UNIT_STATUS_META);

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

function UnitStatusBadge({ status }: { status: string }) {
  const m = UNIT_STATUS_META[status] ?? { color: '#9ca3af', label: status, desc: '' };
  return (
    <span title={m.desc} style={{
      backgroundColor: m.color + '18', color: m.color,
      border: `1px solid ${m.color}33`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11,
      fontWeight: 600, whiteSpace: 'nowrap', cursor: 'help',
    }}>
      {m.label}
    </span>
  );
}

export default function StokPage() {
  const [tab, setTab] = useState<Tab>('bahan');
  const [searchBahan, setSearchBahan] = useState('');
  const [searchUnit, setSearchUnit]   = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedBahan, setExpandedBahan] = useState<number | null>(null);

  const { data: bahanList, isLoading: loadingBahan, refetch: refetchBahan } = useQuery({
    queryKey: ['stok-bahan'],
    queryFn: async () => (await api.get('/inventori/bahan-baku')).data,
    enabled: tab === 'bahan',
  });

  const { data: historiData } = useQuery({
    queryKey: ['stok-histori', expandedBahan],
    queryFn: async () => (await api.get(`/inventori/stok/${expandedBahan}/histori`)).data,
    enabled: expandedBahan !== null,
  });

  // GET /production-units/?page=1&per_page=500 → PaginatedUnitResponse { total, items }
  const { data: allUnitData, isLoading: loadingUnit, refetch: refetchUnit } = useQuery({
    queryKey: ['stok-unit-all'],
    queryFn: async () => (await api.get('/production-units/?page=1&per_page=500')).data,
    enabled: tab === 'unit',
  });

  const { data: expiryData, isLoading: loadingExpiry, refetch: refetchExpiry } = useQuery({
    queryKey: ['stok-expiry'],
    queryFn: async () => (await api.get('/production-units/expiry-alerts?days=7')).data,
    enabled: tab === 'unit',
  });

  const bahanItems: any[] = Array.isArray(bahanList) ? bahanList : [];

  const filteredBahan = useMemo(() => {
    const q = searchBahan.trim().toLowerCase();
    if (!q) return bahanItems;
    return bahanItems.filter((b: any) => b.nama?.toLowerCase().includes(q));
  }, [bahanItems, searchBahan]);

  const unitItems: any[] = useMemo(() => {
    if (!allUnitData) return [];
    if (Array.isArray(allUnitData)) return allUnitData;
    if (Array.isArray(allUnitData.items)) return allUnitData.items;
    return [];
  }, [allUnitData]);

  const expiringSoon: any[] = expiryData?.units_expiring_soon ?? [];
  const expiredItems: any[] = expiryData?.units_expired ?? [];

  const unitStats = useMemo(() =>
    UNIT_STATUSES.reduce((acc, s) => {
      acc[s] = unitItems.filter((u: any) => u.status === s).length;
      return acc;
    }, {} as Record<string, number>)
  , [unitItems]);

  const stokGudang = unitStats['ready'] ?? 0;
  const diGerobak  = (unitStats['on_gerobak'] ?? 0) + (unitStats['dispatched'] ?? 0) + (unitStats['delivered'] ?? 0);
  const terjual    = unitStats['sold'] ?? 0;
  const rusakVoid  = (unitStats['returned_damaged'] ?? 0) + (unitStats['void'] ?? 0);

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

  const stockLevel = (saldo: number, stok_minimum: number) => {
    if (saldo <= 0) return { label: 'Habis', color: '#ef4444', Icon: XCircle };
    if (stok_minimum > 0 && saldo <= stok_minimum)
      return { label: 'Hampir Habis', color: '#eab308', Icon: AlertTriangle };
    return { label: 'Aman', color: '#22c55e', Icon: CheckCircle };
  };

  const unitTableRow = (unit: any) => (
    <div key={unit.id} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div>
        <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>{unit.barcode}</p>
        <p style={{ color: '#555', fontSize: 12, margin: '2px 0 0' }}>{unit.nama_produk}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#333', fontSize: 12 }}>Expiry: {unit.expiry_date}</span>
          {unit.is_expired && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>EXPIRED</span>}
          {unit.is_expiring_soon && !unit.is_expired && (
            <span style={{ color: '#eab308', fontSize: 11, fontWeight: 600 }}>
              {unit.hari_tersisa != null ? `${unit.hari_tersisa}h lagi` : 'Segera expired'}
            </span>
          )}
          {(unit.status === 'on_gerobak' || unit.status === 'dispatched' || unit.status === 'delivered') && unit.loading_order_id && (
            <span style={{ color: '#f59e0b', fontSize: 11, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: '1px 7px' }}>
              Loading #{unit.loading_order_id}
            </span>
          )}
        </div>
      </div>
      <UnitStatusBadge status={unit.status} />
    </div>
  );

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

        {/* ── TAB BAHAN BAKU ────────────────────────────────────── */}
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
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
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
                                <span style={{ color: '#333', fontSize: 12 }}>Min: {bahan.stok_minimum.toLocaleString('id-ID')} {bahan.satuan}</span>
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
                                    <span style={{ color: '#888', fontSize: 12, textTransform: 'capitalize' }}>{h.tipe?.replace(/_/g, ' ')}</span>
                                    {h.keterangan && <span style={{ color: '#444', fontSize: 11, marginLeft: 8 }}>{h.keterangan}</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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

        {/* ── TAB UNIT PRODUKSI ─────────────────────────────────── */}
        {tab === 'unit' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatCard
                Icon={<Warehouse size={14} color="#a3e635" />}
                label="Stok Gudang"
                value={stokGudang}
                color="#a3e635"
                sub="Status: READY"
              />
              <StatCard
                Icon={<Truck size={14} color="#f59e0b" />}
                label="Di Gerobak"
                value={diGerobak}
                color="#f59e0b"
                sub="Dispatched / On Gerobak"
              />
              <StatCard
                Icon={<ShoppingBag size={14} color="#22c55e" />}
                label="Terjual"
                value={terjual}
                color="#22c55e"
                sub="Keluar stok"
              />
              <StatCard
                Icon={<HeartCrack size={14} color="#ef4444" />}
                label="Rusak / Void"
                value={rusakVoid}
                color="#ef4444"
                sub="Keluar stok"
              />
            </div>

            <div style={{ background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.15)', borderRadius: 10, padding: '9px 16px', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#a3e635', fontSize: 12 }}>📦 <strong>Stok Gudang</strong> = hanya unit READY</span>
              <span style={{ color: '#444' }}>·</span>
              <span style={{ color: '#f59e0b', fontSize: 12 }}>🛒 Unit <strong>Di Gerobak</strong> = dibawa driver, belum terjual — tidak mengurangi stok gudang</span>
              <span style={{ color: '#444' }}>·</span>
              <span style={{ color: '#0d9488', fontSize: 12 }}>↩ Return baik = kembali ke stok</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <RefreshButton onClick={() => { setSearchUnit(''); setFilterStatus('all'); refetchUnit(); refetchExpiry(); }} />
            </div>

            {loadingUnit ? <LoadingSpinner color="#a855f7" /> : (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                  <div style={glassCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={15} color="#a855f7" />
                        <p style={{ ...sectionTitle, color: '#a855f7' }}>Semua Unit</p>
                      </div>
                      <span style={{ color: '#444', fontSize: 12 }}>{filteredUnit.length} / {unitItems.length}</span>
                    </div>

                    <SearchBar value={searchUnit} onChange={setSearchUnit} placeholder="Cari barcode atau produk..." />

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      <button
                        onClick={() => setFilterStatus('all')}
                        style={{
                          padding: '3px 10px', borderRadius: 99, fontSize: 11,
                          fontWeight: filterStatus === 'all' ? 600 : 400,
                          backgroundColor: filterStatus === 'all' ? 'rgba(107,114,128,0.2)' : 'transparent',
                          border: filterStatus === 'all' ? '1px solid rgba(107,114,128,0.5)' : '1px solid rgba(255,255,255,0.08)',
                          color: filterStatus === 'all' ? '#9ca3af' : '#555', cursor: 'pointer',
                        }}
                      >
                        Semua ({unitItems.length})
                      </button>
                      {UNIT_STATUSES.filter(s => (unitStats[s] ?? 0) > 0).map(s => {
                        const m = UNIT_STATUS_META[s];
                        const active = filterStatus === s;
                        return (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            style={{
                              padding: '3px 10px', borderRadius: 99, fontSize: 11,
                              fontWeight: active ? 600 : 400,
                              backgroundColor: active ? m.color + '20' : 'transparent',
                              border: active ? `1px solid ${m.color}50` : '1px solid rgba(255,255,255,0.08)',
                              color: active ? m.color : '#555', cursor: 'pointer',
                            }}
                            title={m.desc}
                          >
                            {m.label} ({unitStats[s]})
                          </button>
                        );
                      })}
                    </div>

                    {filteredUnit.length === 0 ? (
                      <EmptyState Icon={Package} message="Tidak ada unit yang cocok" />
                    ) : (
                      filteredUnit.map((u: any) => unitTableRow(u))
                    )}
                  </div>
                </div>

                <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                  {loadingExpiry ? <LoadingSpinner color="#eab308" /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ ...glassCard, borderColor: 'rgba(234,179,8,0.25)', backgroundColor: 'rgba(234,179,8,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <Clock size={15} color="#eab308" />
                          <p style={{ ...sectionTitle, color: '#eab308' }}>Akan Expired (7 hari)</p>
                          <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                            {expiringSoon.length}
                          </span>
                        </div>
                        {expiringSoon.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#22c55e', fontSize: 13 }}>
                            <CheckCircle size={14} color="#22c55e" /> Tidak ada unit yang akan expired
                          </div>
                        ) : (
                          expiringSoon.map((u: any) => unitTableRow(u))
                        )}
                      </div>

                      {expiredItems.length > 0 && (
                        <div style={{ ...glassCard, borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <XCircle size={15} color="#ef4444" />
                            <p style={{ ...sectionTitle, color: '#ef4444' }}>Sudah Expired</p>
                            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                              {expiredItems.length}
                            </span>
                          </div>
                          {expiredItems.map((u: any) => unitTableRow(u))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ Icon, label, value, color, sub }: { Icon?: React.ReactNode; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon}
        <p style={{ color: '#555', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>{label}</p>
      </div>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ color: '#444', fontSize: 11, margin: '3px 0 0' }}>{sub}</p>}
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
      <Icon size={28} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 10 }} />
      <p style={{ color: '#3a3a3a', fontSize: 13, margin: 0 }}>{message}</p>
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
