import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatRupiah, formatDate } from '../../lib/utils';

function MetricCard({
  icon, label, value, sub, color
}: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="pt-6">
        <View className="flex-row items-start justify-between mb-3">
          <Text className="text-3xl">{icon}</Text>
          <View className={`w-2 h-2 rounded-full mt-1 ${color ?? 'bg-primary-500'}`} />
        </View>
        <Text className="text-2xl font-bold text-white mb-0.5">{value}</Text>
        <Text className="text-sm text-muted-foreground">{label}</Text>
        {sub && <Text className="text-xs text-primary-400 mt-1">{sub}</Text>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: moList } = useQuery({
    queryKey: ['mo', 'recent'],
    queryFn: () => api.get('/manufacturing-orders?per_page=5').then(r => r.data),
  });

  const { data: expiry } = useQuery({
    queryKey: ['expiry', 'soon'],
    queryFn: () => api.get('/production-units/expiry-alerts?days=3').then(r => r.data),
  });

  const { data: laporan } = useQuery({
    queryKey: ['laporan', 'today'],
    queryFn: () => {
      const today = new Date().toISOString().split('T')[0];
      return api.get(`/laporan/shareholder?dari=${today}&sampai=${today}`).then(r => r.data);
    },
  });

  return (
    <View className="flex-1 bg-background">
      <Navbar title="Dashboard" />
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

        {/* Metric Cards */}
        <View className="flex-row flex-wrap gap-4 mb-6">
          <MetricCard
            icon="☕"
            label="Terjual Hari Ini"
            value={String(laporan?.total_unit_terjual ?? '—')}
            sub={laporan ? formatRupiah(laporan.total_pendapatan) : undefined}
            color="bg-green-500"
          />
          <MetricCard
            icon="🏭"
            label="MO Aktif"
            value={String(moList?.items?.filter((m: any) => m.status === 'in_progress').length ?? '—')}
            color="bg-blue-500"
          />
          <MetricCard
            icon="⚠️"
            label="Hampir Expired"
            value={String(expiry?.expiring_soon?.length ?? '—')}
            sub="dalam 3 hari"
            color="bg-yellow-500"
          />
          <MetricCard
            icon="💸"
            label="Est. Kerugian"
            value={laporan ? formatRupiah(laporan.estimasi_kerugian) : '—'}
            color="bg-red-500"
          />
        </View>

        {/* Recent MO */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manufacturing Order Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {!moList?.items?.length ? (
              <Text className="text-muted-foreground text-sm">Belum ada MO</Text>
            ) : (
              moList.items.map((mo: any) => (
                <View key={mo.id} className="flex-row items-center justify-between py-3 border-b border-white/10 last:border-0">
                  <View>
                    <Text className="text-white text-sm font-medium">{mo.nomor_mo}</Text>
                    <Text className="text-muted-foreground text-xs">{mo.nama_produk} · {formatDate(mo.created_at)}</Text>
                  </View>
                  <StatusBadge status={mo.status} />
                </View>
              ))
            )}
          </CardContent>
        </Card>

        {/* Expiry Alerts */}
        {!!expiry?.expiring_soon?.length && (
          <Card>
            <CardHeader>
              <CardTitle>🔴 Expiry Alert</CardTitle>
            </CardHeader>
            <CardContent>
              {expiry.expiring_soon.slice(0, 5).map((u: any) => (
                <View key={u.id} className="flex-row items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <View>
                    <Text className="text-white text-sm font-medium">{u.barcode}</Text>
                    <Text className="text-muted-foreground text-xs">{u.nama_produk}</Text>
                  </View>
                  <Text className="text-yellow-400 text-xs font-semibold">{u.hari_tersisa}h lagi</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
