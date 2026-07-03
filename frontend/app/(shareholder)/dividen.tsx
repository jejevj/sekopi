import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { useAuthStore } from '../../stores/authStore';
import { Banknote, CheckCircle, Clock, Filter } from 'lucide-react-native';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  overflow: 'hidden',
};

export default function ShareholderDividenPage() {
  const { user } = useAuthStore();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'dibayar'>('all');

  const { data: rawDividen, isLoading } = useQuery({
    queryKey: ['dividen'],
    queryFn: () => api.get('/dividen/').then(r => r.data),
  });
  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });

  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];

  const myGroupIds = new Set(
    grupList
      .filter((g: any) => g.members?.some((m: any) => m.id === user?.id))
      .map((g: any) => g.id)
  );

  const myDividen = dividenList.filter((d: any) => myGroupIds.has(d.group_id));
  const filtered = filterStatus === 'all' ? myDividen : myDividen.filter((d: any) => d.status === filterStatus);

  const totalAll    = myDividen.reduce((s: number, d: any) => s + d.jumlah_dividen, 0);
  const totalBayar  = myDividen.filter((d: any) => d.status === 'dibayar').reduce((s: number, d: any) => s + d.jumlah_dividen, 0);
  const totalPend   = totalAll - totalBayar;
  const jumlahPeriode = new Set(myDividen.map((d: any) => d.periode_label)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Dividen Saya" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Riwayat Dividen</h1>
          <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{jumlahPeriode} periode tercatat</p>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Dividen', value: fmt(totalAll),   color: '#fbbf24', sub: `${myDividen.length} distribusi` },
            { label: 'Sudah Dibayar', value: fmt(totalBayar), color: '#22c55e', sub: `${myDividen.filter((d:any)=>d.status==='dibayar').length} selesai` },
            { label: 'Belum Dibayar', value: fmt(totalPend),  color: '#f87171', sub: `${myDividen.filter((d:any)=>d.status==='pending').length} pending` },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ color: k.color, fontWeight: 800, fontSize: 22, margin: '6px 0 2px' }}>{k.value}</div>
              <div style={{ color: '#444', fontSize: 11 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['all', 'pending', 'dibayar'] as const).map(s => {
            const labels = { all: 'Semua', pending: 'Pending', dibayar: 'Dibayar' };
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filterStatus === s ? 'rgba(244,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                color: filterStatus === s ? '#f87171' : '#555',
                outline: filterStatus === s ? '1px solid rgba(244,68,68,0.3)' : '1px solid rgba(255,255,255,0.07)',
              }}>{labels[s]}</button>
            );
          })}
        </div>

        {/* List */}
        {isLoading
          ? <div style={{ textAlign: 'center', color: '#444', padding: 40 }}>Memuat...</div>
          : filtered.length === 0
          ? <div style={{ ...card, padding: 40, textAlign: 'center', color: '#444' }}>Belum ada data dividen</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((d: any) => (
                <div key={d.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: d.status === 'dibayar' ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
                        border: `1px solid ${d.status === 'dibayar' ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {d.status === 'dibayar'
                          ? <CheckCircle size={18} color="#22c55e" />
                          : <Clock size={18} color="#fbbf24" />}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{d.periode_label}</div>
                        <div style={{ color: '#555', fontSize: 12 }}>{d.group_nama}</div>
                        <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
                          {fmtDate(d.periode_dari)} — {fmtDate(d.periode_sampai)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 20 }}>{fmt(d.jumlah_dividen)}</div>
                      <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
                        {d.porsi_saham}% dari laba {fmt(d.laba_bersih_grup)}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {d.status === 'dibayar'
                          ? <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>Dibayar {fmtDate(d.tanggal_bayar)}</span>
                          : <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>Menunggu Pembayaran</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Rincian breakdown */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                    {[
                      { label: 'Penjualan', value: fmt(d.total_penjualan), color: '#22c55e' },
                      { label: 'Pembelian', value: fmt(d.total_pembelian), color: '#f87171' },
                      { label: 'Beban Gaji', value: fmt(d.total_gaji_grup), color: '#fbbf24' },
                    ].map(k => (
                      <div key={k.label} style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: 12, paddingLeft: 12 }}>
                        <div style={{ color: '#444', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                        <div style={{ color: k.color, fontWeight: 600, fontSize: 13, marginTop: 2 }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
