import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { formatDate } from '../../../lib/utils';

export default function MOListPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['mo'],
    queryFn: () => api.get('/manufacturing-orders').then(r => r.data),
  });

  return (
    <View className="flex-1 bg-background">
      <Navbar title="Manufacturing Order" />
      <View className="flex-1 p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-xl font-bold">Daftar MO</Text>
          <Button size="sm" onPress={() => router.push('/(admin)/mo/buat' as any)}>
            + Buat MO
          </Button>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <Text className="text-muted-foreground">Memuat...</Text>
          ) : !data?.items?.length ? (
            <Card><CardContent className="pt-6">
              <Text className="text-muted-foreground text-center">Belum ada Manufacturing Order</Text>
            </CardContent></Card>
          ) : (
            data.items.map((mo: any) => (
              <Pressable key={mo.id} onPress={() => router.push(`/(admin)/mo/${mo.id}` as any)}>
                <Card className="mb-3 hover:border-primary-500/40">
                  <CardContent className="pt-4 pb-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-white font-semibold">{mo.nomor_mo}</Text>
                        <Text className="text-muted-foreground text-sm">{mo.nama_produk}</Text>
                        <Text className="text-muted-foreground text-xs mt-1">{formatDate(mo.created_at)}</Text>
                      </View>
                      <View className="items-end gap-2">
                        <StatusBadge status={mo.status} />
                        <Text className="text-muted-foreground text-xs">Target: {mo.target_qty} unit</Text>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
