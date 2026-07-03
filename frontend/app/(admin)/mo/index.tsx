import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { formatDate } from '../../../lib/utils';
import {
  ClipboardList, Plus, Clock, CheckCircle, XCircle, PlayCircle, Search,
} from 'lucide-react-native';

const STATUS_ORDER = ['draft', 'confirmed', 'in_progress', 'done', 'cancelled'];

export default function MOListPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mo'],
    queryFn: () => api.get('/manufacturing-orders').then(r => r.data),
  });

  const moList: any[] = Array.isArray(data) ? data : (data?.items ?? []);

  const filtered = moList
    .filter(mo => filter === 'all' || mo.status === filter)
    .filter(mo =>
      !search ||
      mo.nomor_mo.toLowerCase().includes(search.toLowerCase()) ||
      mo.nama_produk.toLowerCase().includes(search.toLowerCase())
    );

  const counts = moList.reduce((acc: any, mo: any) => {
    acc[mo.status] = (acc[mo.status] || 0) + 1;
    return acc;
  }, {});

  const tabs = [
    { key: 'all', label: 'Semua', count: moList.length },
    { key: 'draft', label: 'Draft', count: counts.draft || 0 },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed || 0 },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress || 0 },
    { key: 'done', label: 'Done', count: counts.done || 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Manufacturing Order" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Manufacturing Order</h1>
            <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>{moList.length} total MO</p>
          </div>
          <button
            onClick={() => router.push('/(admin)/mo/buat' as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: '#f44444', border: 'none', borderRadius: 10,
              padding: '10px 20px', color: 'white', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            <Plus size={16} color="white" />
            Buat MO
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color="#666" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor MO atau produk..."
            style={{
              width: '100%', padding: '10px 14px 10px 40px', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, color: 'white', fontSize: 14, outline: 'none',
            }}
          />
        </div>

        {/* Tabs filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', border: '1px solid',
                backgroundColor: filter === tab.key ? 'rgba(244,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: filter === tab.key ? 'rgba(244,68,68,0.4)' : 'rgba(255,255,255,0.1)',
                color: filter === tab.key ? '#f87171' : '#888',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: 6, backgroundColor: filter === tab.key ? 'rgba(244,68,68,0.3)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11,
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Memuat...</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 40, textAlign: 'center', color: '#555',
          }}>
            <ClipboardList size={32} color="#444" style={{ margin: '0 auto 12px' }} />
            <div>{search ? 'Tidak ada hasil' : 'Belum ada Manufacturing Order'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((mo: any) => (
              <div
                key={mo.id}
                onClick={() => router.push(`/(admin)/mo/${mo.id}` as any)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(244,68,68,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ClipboardList size={18} color="#f87171" />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{mo.nomor_mo}</div>
                    <div style={{ color: '#888', fontSize: 13 }}>{mo.nama_produk}</div>
                    <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                      Target: {mo.target_qty} {mo.satuan} · {formatDate(mo.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge status={mo.status} />
                  {mo.approved_by && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11 }}>
                      <CheckCircle size={11} color="#22c55e" />
                      Disetujui
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
