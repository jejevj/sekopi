import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Menu & Resep" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Menu & Resep</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '4px 0 0' }}>{menuList.length} menu terdaftar</p>
          </div>
          <button
            onClick={() => router.push('/(admin)/menu/buat' as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: '#f44444', border: 'none',
              borderRadius: 10, padding: '9px 18px',
              color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
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
          borderRadius: 10, padding: '9px 14px', marginBottom: 20,
        }}>
          <Search size={14} color="#444" />
          <input
            value={search}
            onChange={e => setSearch((e.target as any).value)}
            placeholder="Cari nama menu..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: 13, minWidth: 0 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <X size={14} color="#444" />
            </button>
          )}
        </div>

        {/* Tabel */}
        {isLoading ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Memuat...</div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
            <BookOpen size={36} color="#2a2a2a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
            <p style={{ color: '#3a3a3a', fontSize: 14, margin: 0 }}>
              {search ? `Tidak ada menu "${search}"` : 'Belum ada menu. Tambahkan menu pertama.'}
            </p>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Menu', 'Harga Jual', 'Resep Aktif', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((menu: any) => {
                  const resepAktif = menu.resep_list?.find((r: any) => r.is_active);
                  return (
                    <tr
                      key={menu.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: menu.is_active ? 1 : 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Nama */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(244,68,68,0.1)', border: '1px solid rgba(244,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BookOpen size={14} color="#f87171" />
                          </div>
                          <span style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{menu.nama}</span>
                        </div>
                      </td>
                      {/* Harga */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Tag size={11} color="#22c55e" />
                          Rp {Number(menu.harga_jual).toLocaleString('id-ID')}
                        </span>
                      </td>
                      {/* Resep */}
                      <td style={{ padding: '14px 16px' }}>
                        {resepAktif ? (
                          <span style={{ color: '#60a5fa', fontSize: 13 }}>
                            {resepAktif.nama_versi} &middot; {resepAktif.bahan_list?.length ?? 0} bahan
                          </span>
                        ) : (
                          <span style={{ color: '#444', fontSize: 12 }}>Belum ada resep</span>
                        )}
                      </td>
                      {/* Status toggle */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={() => toggleMutation.mutate({ id: menu.id, is_active: !menu.is_active })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
                        >
                          {menu.is_active
                            ? <><ToggleRight size={20} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 12 }}>Aktif</span></>
                            : <><ToggleLeft size={20} color="#444" /><span style={{ color: '#444', fontSize: 12 }}>Nonaktif</span></>}
                        </button>
                      </td>
                      {/* Aksi */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={() => router.push(`/(admin)/menu/${menu.id}` as any)}
                          style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                        >
                          <ChevronRight size={13} color="#aaa" /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
