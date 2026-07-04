import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import {
  BookOpen, Plus, ChevronRight, Tag, ToggleLeft,
  ToggleRight, Search, X,
} from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

export default function MenuListPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu/').then(r => r.data),
  });
  const menuList: any[] = Array.isArray(data) ? data : [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/menu/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const filtered = menuList.filter(m =>
    m.nama.toLowerCase().includes(search.toLowerCase())
  );

  const inp: React.CSSProperties = {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'white', fontSize: 14, minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Menu & Resep" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 840, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Menu & Resep</h1>
            <p style={{ color: '#555', fontSize: 14, margin: '4px 0 0' }}>Kelola produk, harga jual, dan resep bahan baku</p>
          </div>
          <button
            onClick={() => router.push('/(admin)/menu/buat' as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: '#f44444', border: 'none',
              borderRadius: 10, padding: '10px 18px',
              color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            <Plus size={15} color="white" /> Tambah Menu
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 20,
        }}>
          <Search size={14} color="#444" />
          <input
            value={search} onChange={e => setSearch((e.target as any).value)}
            placeholder="Cari nama menu..."
            style={inp}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <X size={14} color="#444" />
            </button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <ActivityIndicator size="large" color="#f44444" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
            <BookOpen size={36} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
            <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>
              {search ? `Tidak ada menu "${search}"` : 'Belum ada menu. Tambahkan menu pertama.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((menu: any) => {
              const resepAktif = menu.resep_list?.find((r: any) => r.is_active);
              return (
                <div
                  key={menu.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${menu.is_active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                    borderRadius: 12, padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    opacity: menu.is_active ? 1 : 0.5,
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: 'rgba(244,68,68,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <BookOpen size={18} color="#f87171" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ color: 'white', fontWeight: 600, fontSize: 15, margin: 0 }}>{menu.nama}</p>
                      {!menu.is_active && (
                        <span style={{ color: '#555', fontSize: 11, border: '1px solid #222', borderRadius: 4, padding: '1px 6px' }}>NONAKTIF</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag size={11} color="#22c55e" />
                        Rp {Number(menu.harga_jual).toLocaleString('id-ID')}
                      </span>
                      <span style={{ color: resepAktif ? '#60a5fa' : '#444', fontSize: 12 }}>
                        {resepAktif
                          ? `Resep: ${resepAktif.nama_versi} (${resepAktif.bahan_list?.length ?? 0} bahan)`
                          : 'Belum ada resep aktif'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle aktif */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleMutation.mutate({ id: menu.id, is_active: !menu.is_active }); }}
                    title={menu.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                  >
                    {menu.is_active
                      ? <ToggleRight size={22} color="#22c55e" />
                      : <ToggleLeft size={22} color="#444" />}
                  </button>

                  {/* Detail */}
                  <button
                    onClick={() => router.push(`/(admin)/menu/${menu.id}` as any)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                  >
                    <ChevronRight size={18} color="#444" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
