import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { Coffee, Factory, TriangleAlert, TrendingDown, type LucideIcon } from 'lucide-react-native';

function MetricCard({ Icon, label, value, sub, color, iconBg }: {
  Icon: LucideIcon; label: string; value: string; sub?: string; color: string; iconBg: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
      </div>
      <div style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 2 }}>{value}</div>
      <div style={{ color: '#888', fontSize: 13 }}>{label}</div>
      {sub && <div style={{ color: '#f44444', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/** Normalise response: bisa array langsung atau {items:[]} */
function toList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

/** Ambil nama produk dari mo.lines[] */
function getNama(mo: any): string {
  const lines: any[] = mo.lines ?? [];
  if (lines.length === 0) return mo.nama_produk ?? '-';
  if (lines.length === 1) return lines[0].nama_produk;
  return `${lines[0].nama_produk} +${lines.length - 1} lainnya`;
}

export default function DashboardPage() {
  const router = useRouter();

  const { data: moData } = useQuery({
    queryKey: ['mo', 'recent'],
    queryFn: () => api.get('/manufacturing-orders?per_page=5').then(r => r.data),
    retry: false,
  });

  const { data: expiry } = useQuery({
    queryKey: ['expiry', 'soon'],
    queryFn: () => api.get('/production-units/expiry-alerts?days=3').then(r => r.data),
    retry: false,
  });

  const { data: laporan } = useQuery({
    queryKey: ['laporan', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return api.get(`/laporan/shareholder?dari=${today}&sampai=${today}`).then(r => r.data);
    },
    retry: false,
  });

  // Normalise: API bisa return array langsung ATAU {items:[]}
  const moItems: any[] = toList(moData);
  const moAktif    = moItems.filter((m: any) => m.status === 'in_progress').length;
  const expiryCount = expiry?.expiring_soon?.length ?? 0;

  const formatRupiah = (n: number) =>
    n != null ? 'Rp ' + n.toLocaleString('id-ID') : '—';

  const formatDate = (s: string) =>
    s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '';

  const statusColor: Record<string, string> = {
    draft:       '#6b7280',
    confirmed:   '#3b82f6',
    in_progress: '#eab308',
    done:        '#22c55e',
    cancelled:   '#ef4444',
  };

  const statusLabel: Record<string, string> = {
    draft:       'Draft',
    confirmed:   'Dikonfirmasi',
    in_progress: 'Produksi',
    done:        'Selesai',
    cancelled:   'Dibatalkan',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Dashboard" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Metric Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <MetricCard
            Icon={Coffee} label="Terjual Hari Ini" color="#22c55e" iconBg="rgba(34,197,94,0.15)"
            value={laporan?.total_unit_terjual != null ? String(laporan.total_unit_terjual) : '—'}
            sub={laporan ? formatRupiah(laporan.total_pendapatan) : undefined}
          />
          <MetricCard
            Icon={Factory} label="MO Aktif" color="#3b82f6" iconBg="rgba(59,130,246,0.15)"
            value={moData != null ? String(moAktif) : '—'}
          />
          <MetricCard
            Icon={TriangleAlert} label="Hampir Expired" color="#eab308" iconBg="rgba(234,179,8,0.15)"
            value={expiry ? String(expiryCount) : '—'}
            sub="dalam 3 hari"
          />
          <MetricCard
            Icon={TrendingDown} label="Est. Kerugian" color="#ef4444" iconBg="rgba(239,68,68,0.15)"
            value={laporan ? formatRupiah(laporan.estimasi_kerugian) : '—'}
          />
        </div>

        {/* Recent MO */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Manufacturing Order Terbaru</span>
            <button
              onClick={() => router.push('/(admin)/mo' as any)}
              style={{ background: 'none', border: 'none', color: '#f44444', fontSize: 13, cursor: 'pointer' }}
            >
              Lihat semua →
            </button>
          </div>

          {moItems.length === 0 ? (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Belum ada Manufacturing Order</p>
          ) : (
            moItems.slice(0, 5).map((mo: any) => {
              const col = statusColor[mo.status] ?? '#888';
              return (
                <div
                  key={mo.id}
                  onClick={() => router.push(`/(admin)/mo/${mo.id}` as any)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>{mo.nomor_mo}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {getNama(mo)} · Rencana: {formatDate(mo.tanggal_rencana)}
                    </div>
                  </div>
                  <span style={{
                    backgroundColor: col + '22',
                    color: col,
                    border: `1px solid ${col}44`,
                    borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500,
                  }}>
                    {statusLabel[mo.status] ?? mo.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Expiry Alert */}
        {expiryCount > 0 && (
          <div style={{
            backgroundColor: 'rgba(234,179,8,0.07)',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eab308', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              <TriangleAlert size={16} color="#eab308" />
              Expiry Alert
            </div>
            {expiry.expiring_soon.slice(0, 5).map((u: any) => (
              <div key={u.id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{u.barcode}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{u.nama_produk}</div>
                </div>
                <span style={{ color: '#eab308', fontSize: 12, fontWeight: 600 }}>{u.hari_tersisa}h lagi</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — hanya jika benar-benar kosong */}
        {moItems.length === 0 && expiryCount === 0 && moData != null && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Coffee size={40} color="#555" />
            </div>
            <div style={{ fontSize: 14 }}>Belum ada data. Mulai buat Manufacturing Order pertama!</div>
            <button
              onClick={() => router.push('/(admin)/mo/buat' as any)}
              style={{
                marginTop: 16, backgroundColor: '#f44444', border: 'none',
                borderRadius: 8, padding: '10px 24px', color: 'white',
                fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}
            >
              + Buat MO Pertama
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
