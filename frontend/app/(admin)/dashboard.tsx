import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';

function MetricCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
      </div>
      <div style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 2 }}>{value}</div>
      <div style={{ color: '#888', fontSize: 13 }}>{label}</div>
      {sub && <div style={{ color: '#f44444', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const { data: moList } = useQuery({
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
      const r = await api.get(`/laporan/shareholder?dari=${today}&sampai=${today}`);
      return r.data;
    },
    retry: false,
  });

  const moAktif = moList?.items?.filter((m: any) => m.status === 'in_progress').length ?? 0;
  const expiryCount = expiry?.expiring_soon?.length ?? 0;

  const formatRupiah = (n: number) =>
    n != null ? 'Rp ' + n.toLocaleString('id-ID') : '—';

  const formatDate = (s: string) =>
    s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '';

  const statusColor: Record<string, string> = {
    draft: '#888',
    in_progress: '#3b82f6',
    completed: '#22c55e',
    cancelled: '#ef4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Dashboard" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Metric Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <MetricCard
            icon="☕" label="Terjual Hari Ini" color="#22c55e"
            value={laporan?.total_unit_terjual != null ? String(laporan.total_unit_terjual) : '—'}
            sub={laporan ? formatRupiah(laporan.total_pendapatan) : undefined}
          />
          <MetricCard
            icon="🏭" label="MO Aktif" color="#3b82f6"
            value={moList ? String(moAktif) : '—'}
          />
          <MetricCard
            icon="⚠️" label="Hampir Expired" color="#eab308"
            value={expiry ? String(expiryCount) : '—'}
            sub="dalam 3 hari"
          />
          <MetricCard
            icon="💸" label="Est. Kerugian" color="#ef4444"
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
          {!moList?.items?.length ? (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Belum ada Manufacturing Order</p>
          ) : (
            moList.items.map((mo: any) => (
              <div key={mo.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>{mo.nomor_mo}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{mo.nama_produk} · {formatDate(mo.created_at)}</div>
                </div>
                <span style={{
                  backgroundColor: statusColor[mo.status] + '22',
                  color: statusColor[mo.status] ?? '#888',
                  border: `1px solid ${statusColor[mo.status] ?? '#888'}44`,
                  borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500,
                }}>
                  {mo.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Expiry Alert */}
        {expiryCount > 0 && (
          <div style={{
            backgroundColor: 'rgba(234,179,8,0.07)',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ color: '#eab308', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>🔴 Expiry Alert</div>
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

        {/* Empty state kalau semua data kosong */}
        {!moList?.items?.length && !expiryCount && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
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
