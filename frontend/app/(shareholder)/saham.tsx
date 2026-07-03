import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { useAuthStore } from '../../stores/authStore';
import { PieChart, TrendingUp, Users, Percent } from 'lucide-react-native';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  overflow: 'hidden',
};

export default function SahamPage() {
  const { user } = useAuthStore();

  const { data: rawPorsi, isLoading: loadPorsi } = useQuery({
    queryKey: ['porsi-saham'],
    queryFn: () => api.get('/dividen/groups/porsi').then(r => r.data),
  });
  const { data: rawDividen, isLoading: loadDiv } = useQuery({
    queryKey: ['dividen'],
    queryFn: () => api.get('/dividen/').then(r => r.data),
  });
  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });

  const porsiList: any[] = Array.isArray(rawPorsi) ? rawPorsi : [];
  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];

  // Grup yang dimiliki user ini
  const myGroups = grupList.filter((g: any) =>
    g.members?.some((m: any) => m.id === user?.id)
  );
  const myGroupIds = new Set(myGroups.map((g: any) => g.id));

  // Dividen milik saya
  const myDividen = dividenList.filter((d: any) => myGroupIds.has(d.group_id));
  const totalDividen = myDividen.reduce((s: number, d: any) => s + d.jumlah_dividen, 0);
  const totalDibayar = myDividen.filter((d: any) => d.status === 'dibayar').reduce((s: number, d: any) => s + d.jumlah_dividen, 0);
  const totalPending = totalDividen - totalDibayar;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Portofolio Saham" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Portofolio Saham Saya</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>Porsi kepemilikan & distribusi dividen</p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Dividen', value: fmt(totalDividen), color: '#fbbf24', icon: <TrendingUp size={18} color="#fbbf24" /> },
            { label: 'Sudah Dibayar', value: fmt(totalDibayar), color: '#22c55e', icon: <TrendingUp size={18} color="#22c55e" /> },
            { label: 'Pending', value: fmt(totalPending), color: '#f87171', icon: <TrendingUp size={18} color="#f87171" /> },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {k.icon}
              </div>
              <div>
                <div style={{ color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                <div style={{ color: k.color, fontWeight: 700, fontSize: 18, marginTop: 2 }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Grup & porsi */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Grup Saham Saya</div>
          {loadPorsi
            ? <div style={{ color: '#444', padding: 20, textAlign: 'center' }}>Memuat...</div>
            : myGroups.length === 0
            ? <div style={{ ...card, padding: 32, textAlign: 'center', color: '#444' }}>Anda belum terdaftar di grup manapun</div>
            : myGroups.map((grp: any) => {
                const porsiData = porsiList.find((p: any) => p.id === grp.id);
                const porsi = porsiData?.porsi_saham ?? 0;
                const totalGrup = porsiData?.total_semua_grup ?? 0;
                return (
                  <div key={grp.id} style={{ ...card, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={18} color="#f87171" />
                        </div>
                        <div>
                          <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{grp.nama}</div>
                          {grp.deskripsi && <div style={{ color: '#555', fontSize: 12 }}>{grp.deskripsi}</div>}
                          <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>{grp.members?.length ?? 0} anggota</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#f87171', fontWeight: 800, fontSize: 28 }}>{porsi.toFixed(2)}%</div>
                        <div style={{ color: '#444', fontSize: 11 }}>dari total {totalGrup.toFixed(2)}% teralokasi</div>
                      </div>
                    </div>
                    {/* Progress bar porsi */}
                    <div style={{ padding: '0 20px 16px' }}>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${porsi}%`, background: 'linear-gradient(90deg, #f87171, #fbbf24)', borderRadius: 99 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                        <span style={{ color: '#444', fontSize: 10 }}>0%</span>
                        <span style={{ color: '#f87171', fontSize: 10, fontWeight: 600 }}>{porsi.toFixed(2)}% porsi Anda</span>
                        <span style={{ color: '#444', fontSize: 10 }}>100%</span>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Semua porsi grup (context) */}
        {porsiList.length > 0 && (
          <div style={{ ...card }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Komposisi Seluruh Grup</div>
            <div style={{ padding: '12px 0' }}>
              {porsiList.map((p: any) => {
                const isMine = myGroupIds.has(p.id);
                return (
                  <div key={p.id} style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: isMine ? 'white' : '#555', fontSize: 13, fontWeight: isMine ? 700 : 400 }}>
                          {p.nama} {isMine && <span style={{ color: '#f87171', fontSize: 10 }}>• milik Anda</span>}
                        </span>
                        <span style={{ color: isMine ? '#f87171' : '#444', fontWeight: 700, fontSize: 13 }}>{p.porsi_saham.toFixed(2)}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.porsi_saham}%`, background: isMine ? '#f87171' : 'rgba(255,255,255,0.1)', borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555', fontSize: 12 }}>Sisa (kas perusahaan)</span>
                <span style={{ color: '#555', fontWeight: 700 }}>{(100 - (porsiList[0]?.total_semua_grup ?? 0)).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
