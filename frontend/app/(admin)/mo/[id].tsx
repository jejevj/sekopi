import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',       color: '#6b7280', bg: '#f3f4f6' },
  confirmed:   { label: 'Dikonfirmasi', color: '#2563eb', bg: '#dbeafe' },
  in_progress: { label: 'Produksi',    color: '#d97706', bg: '#fef3c7' },
  done:        { label: 'Selesai',     color: '#16a34a', bg: '#dcfce7' },
  cancelled:   { label: 'Dibatalkan',  color: '#dc2626', bg: '#fee2e2' },
};

const NEXT_STATUS: Record<string, { next: string; label: string; role: string[] }[]> = {
  draft:       [{ next: 'confirmed',   label: 'Setujui MO',         role: ['admin'] },
                { next: 'cancelled',   label: 'Batalkan',           role: ['admin', 'produksi'] }],
  confirmed:   [{ next: 'in_progress', label: 'Mulai Produksi',     role: ['admin', 'inventori'] },
                { next: 'cancelled',   label: 'Batalkan',           role: ['admin'] }],
  in_progress: [{ next: 'done',        label: 'Tandai Selesai',     role: ['admin', 'produksi'] },
                { next: 'cancelled',   label: 'Batalkan',           role: ['admin'] }],
};

export default function MODetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genJumlah, setGenJumlah] = useState('');
  const [genExpiry, setGenExpiry] = useState('');
  const [genModal, setGenModal] = useState('');

  const { data: mo, isLoading, error } = useQuery({
    queryKey: ['mo', id],
    queryFn: async () => {
      const res = await api.get(`/manufacturing-orders/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: units } = useQuery({
    queryKey: ['mo-units', id],
    queryFn: async () => {
      const res = await api.get(`/production-units/mo/${id}?page=1&per_page=100`);
      return res.data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await api.post(`/manufacturing-orders/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mo', id] });
      qc.invalidateQueries({ queryKey: ['mo-list'] });
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan');
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/production-units/generate', {
        mo_id: parseInt(id!),
        jumlah: parseInt(genJumlah),
        expiry_date: genExpiry,
        harga_modal: genModal ? parseFloat(genModal) : null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mo-units', id] });
      setShowGenerate(false);
      setGenJumlah(''); setGenExpiry(''); setGenModal('');
      Alert.alert('Berhasil', `${data.length} unit barcode berhasil di-generate`);
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.detail || 'Terjadi kesalahan');
    },
  });

  const confirmStatus = (next: string, label: string) => {
    Alert.alert('Konfirmasi', `Ubah status ke "${label}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya', onPress: () => statusMutation.mutate(next) },
    ]);
  };

  if (isLoading) return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#7c3aed" />
    </View>
  );

  if (error || !mo) return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-red-500">MO tidak ditemukan</Text>
    </View>
  );

  const cfg = STATUS_CONFIG[mo.status] ?? STATUS_CONFIG.draft;
  const transitions = NEXT_STATUS[mo.status] ?? [];
  const totalUnits = units?.total ?? 0;
  const unitList = units?.data ?? [];

  const STATUS_UNIT_COLOR: Record<string, string> = {
    ready: '#2563eb', dispatched: '#d97706', delivered: '#9333ea',
    sold: '#16a34a', expired: '#dc2626', void: '#6b7280',
    returned_good: '#0d9488', returned_damaged: '#dc2626',
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-6 pb-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-3">
          <ArrowLeft size={20} color="#6b7280" />
          <Text className="ml-2 text-gray-600">Kembali</Text>
        </TouchableOpacity>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">{mo.nomor_mo}</Text>
            <Text className="text-gray-600 mt-1">{mo.nama_produk}</Text>
          </View>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: cfg.bg }}>
            <Text className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      <View className="p-4 gap-4">
        {/* Info Cards */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white rounded-xl p-4 border border-gray-200">
            <Text className="text-xs text-gray-500 mb-1">Target Qty</Text>
            <Text className="text-2xl font-bold text-gray-900">{mo.target_qty}</Text>
            <Text className="text-xs text-gray-400">{mo.satuan}</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 border border-gray-200">
            <Text className="text-xs text-gray-500 mb-1">Unit Generated</Text>
            <Text className="text-2xl font-bold text-purple-600">{totalUnits}</Text>
            <Text className="text-xs text-gray-400">dari {mo.target_qty} {mo.satuan}</Text>
          </View>
        </View>

        {/* Detail */}
        <View className="bg-white rounded-xl p-4 border border-gray-200 gap-3">
          <Text className="font-semibold text-gray-800">Detail MO</Text>
          <DetailRow label="Tanggal Rencana" value={mo.tanggal_rencana} />
          <DetailRow label="Dibuat oleh" value={mo.created_by_user?.full_name ?? '-'} />
          <DetailRow label="Disetujui oleh" value={mo.approved_by_user?.full_name ?? '-'} />
          <DetailRow label="Inventori oleh" value={mo.inventori_by_user?.full_name ?? '-'} />
          {mo.catatan ? <DetailRow label="Catatan" value={mo.catatan} /> : null}
        </View>

        {/* BOM */}
        <View className="bg-white rounded-xl p-4 border border-gray-200">
          <Text className="font-semibold text-gray-800 mb-3">Bill of Materials</Text>
          {mo.bahan_baku_lines?.length === 0 && (
            <Text className="text-gray-400 text-sm">Belum ada bahan baku</Text>
          )}
          {mo.bahan_baku_lines?.map((line: any) => (
            <View key={line.id} className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-gray-800 flex-1">{line.bahan_baku?.nama ?? '-'}</Text>
              <Text className="text-gray-500 text-sm">
                {line.qty_rencana} {line.satuan}
                {line.qty_aktual != null ? ` (aktual: ${line.qty_aktual})` : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Aksi Status */}
        {transitions.length > 0 && (
          <View className="bg-white rounded-xl p-4 border border-gray-200 gap-2">
            <Text className="font-semibold text-gray-800 mb-1">Aksi</Text>
            {transitions.map((t) => (
              <TouchableOpacity
                key={t.next}
                onPress={() => confirmStatus(t.next, t.label)}
                disabled={statusMutation.isPending}
                className={`py-3 rounded-lg items-center ${
                  t.next === 'cancelled' ? 'bg-red-50 border border-red-200' : 'bg-purple-600'
                }`}
              >
                <Text className={`font-semibold ${
                  t.next === 'cancelled' ? 'text-red-600' : 'text-white'
                }`}>
                  {statusMutation.isPending ? 'Memproses...' : t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Generate Unit — hanya jika DONE */}
        {mo.status === 'done' && (
          <View className="bg-white rounded-xl p-4 border border-gray-200">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-semibold text-gray-800">Generate Barcode Unit</Text>
              <TouchableOpacity onPress={() => setShowGenerate(!showGenerate)}>
                <Text className="text-purple-600 text-sm">{showGenerate ? 'Tutup' : 'Buka Form'}</Text>
              </TouchableOpacity>
            </View>
            {showGenerate && (
              <View className="gap-3">
                <FormInput label="Jumlah Unit *" value={genJumlah} onChangeText={setGenJumlah} placeholder="Contoh: 100" keyboardType="numeric" />
                <FormInput label="Tanggal Expiry * (YYYY-MM-DD)" value={genExpiry} onChangeText={setGenExpiry} placeholder="Contoh: 2026-07-05" />
                <FormInput label="Harga Modal per Unit (opsional)" value={genModal} onChangeText={setGenModal} placeholder="Contoh: 3500" keyboardType="numeric" />
                <TouchableOpacity
                  onPress={() => generateMutation.mutate()}
                  disabled={!genJumlah || !genExpiry || generateMutation.isPending}
                  className="bg-purple-600 py-3 rounded-lg items-center"
                >
                  <Text className="text-white font-semibold">
                    {generateMutation.isPending ? 'Generating...' : `Generate ${genJumlah || '0'} Unit`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* List Production Units */}
        {totalUnits > 0 && (
          <View className="bg-white rounded-xl p-4 border border-gray-200">
            <Text className="font-semibold text-gray-800 mb-3">Production Units ({totalUnits})</Text>
            {unitList.slice(0, 20).map((unit: any) => (
              <View key={unit.id} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="text-sm font-mono text-gray-800">{unit.barcode}</Text>
                  <Text className="text-xs text-gray-400">Expiry: {unit.expiry_date}</Text>
                </View>
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_UNIT_COLOR[unit.status] + '20' }}>
                  <Text className="text-xs font-medium" style={{ color: STATUS_UNIT_COLOR[unit.status] }}>
                    {unit.status}
                  </Text>
                </View>
              </View>
            ))}
            {totalUnits > 20 && (
              <Text className="text-xs text-gray-400 mt-2 text-center">+{totalUnits - 20} unit lainnya</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-gray-800 text-sm font-medium text-right flex-1 ml-4">{value}</Text>
    </View>
  );
}

function FormInput({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View>
      <Text className="text-sm text-gray-600 mb-1">{label}</Text>
      <View className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
        <Text className="text-gray-800">{value || <Text className="text-gray-400">{placeholder}</Text>}</Text>
      </View>
    </View>
  );
}
