import React from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { PackageCheck, TriangleAlert, ClipboardList, ChevronRight } from 'lucide-react-native';

export default function InventoriDashboardPage() {
  const router = useRouter();

  const { data: moList } = useQuery({
    queryKey: ['mo-confirmed'],
    queryFn: () => api.get('/manufacturing-orders').then(r => r.data),
    retry: false,
  });

  const { data: expiry } = useQuery({
    queryKey: ['expiry'],
    queryFn: () => api.get('/production-units/expiry-alerts?days=3').then(r => r.data),
    retry: false,
  });

  const allMO: any[] = Array.isArray(moList) ? moList : (moList?.items ?? []);
  const confirmed = allMO.filter((m: any) => m.status === 'confirmed');
  const expiryCount = expiry?.expiring_soon?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Inventori" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 180, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={16} color="#60a5fa" />
              </div>
              <span style={{ color: '#888', fontSize: 13 }}>MO Menunggu</span>
            </div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>{confirmed.length}</div>
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>Perlu keluarkan bahan</div>
          </div>

          <div style={{
            flex: 1, minWidth: 180, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TriangleAlert size={16} color="#eab308" />
              </div>
              <span style={{ color: '#888', fontSize: 13 }}>Expiry Alert</span>
            </div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>{expiryCount}</div>
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>Unit hampir expired</div>
          </div>
        </div>

        {/* MO yang butuh keluarkan bahan */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageCheck size={16} color="#60a5fa" />
              <span style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>MO Perlu Keluarkan Bahan</span>
            </div>
            <button
              onClick={() => router.push('/(admin)/mo' as any)}
              style={{ background: 'none', border: 'none', color: '#f44444', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Lihat semua <ChevronRight size={13} color="#f44444" />
            </button>
          </div>

          {confirmed.length === 0 ? (
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Tidak ada MO yang menunggu</p>
          ) : (
            confirmed.slice(0, 5).map((mo: any) => (
              <div
                key={mo.id}
                onClick={() => router.push(`/(admin)/mo/${mo.id}` as any)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>{mo.nomor_mo}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{mo.nama_produk} · {formatDate(mo.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusBadge status={mo.status} />
                  <ChevronRight size={14} color="#555" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Expiry Alert */}
        {expiryCount > 0 && (
          <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TriangleAlert size={16} color="#eab308" />
                <span style={{ color: '#eab308', fontWeight: 600, fontSize: 15 }}>Expiry Alert</span>
              </div>
              <button
                onClick={() => router.push('/(inventori)/stok' as any)}
                style={{ background: 'none', border: 'none', color: '#eab308', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Lihat stok <ChevronRight size={12} color="#eab308" />
              </button>
            </div>
            {expiry.expiring_soon.slice(0, 4).map((u: any) => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{u.barcode}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{u.nama_produk}</div>
                </div>
                <span style={{ color: '#eab308', fontSize: 12, fontWeight: 600 }}>{u.hari_tersisa}h lagi</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
