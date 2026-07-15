import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
  StatusBar, Image, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { getTanggalWIB, getJamWIB, getLabelTanggalWIB } from '../../lib/dateUtils';

const { width: SW } = Dimensions.get('window');

type Step            = 'idle' | 'camera' | 'submitting' | 'done';
type TabMode         = 'masuk' | 'pulang' | 'non-hadir';
type StatusNonHadir  = 'izin' | 'sakit' | 'alpha';

const NON_HADIR_STATUS: StatusNonHadir[] = ['izin', 'sakit', 'alpha'];

const NON_HADIR_OPTIONS: { value: StatusNonHadir; label: string; icon: string; color: string; desc: string }[] = [
  { value: 'izin',  label: 'Izin',  icon: 'calendar-outline',    color: '#60a5fa', desc: 'Tidak hadir dengan izin resmi' },
  { value: 'sakit', label: 'Sakit', icon: 'medkit-outline',       color: '#fbbf24', desc: 'Tidak hadir karena sakit' },
  { value: 'alpha', label: 'Alpha', icon: 'close-circle-outline', color: '#f87171', desc: 'Tidak hadir tanpa keterangan' },
];

const MAX_PHOTO_BYTES   = 1 * 1024 * 1024;
const QUALITY_STEPS     = [0.3, 0.2, 0.15, 0.1];
const CAMERA_WARMUP_MS  = 600;

interface AbsensiHariIni {
  id: number;
  jam_masuk: string | null;
  jam_keluar: string | null;
  status: string;
  dalam_radius: boolean | null;
  jarak_meter: number | null;
  tanggal: string;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseError(e: any): string {
  if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout'))
    return 'Koneksi timeout. Coba lagi dengan koneksi internet yang lebih stabil.';
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error')
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join(', ');
  if (detail) return JSON.stringify(detail);
  const status = e?.response?.status;
  if (status === 409) return 'Absensi hari ini sudah tercatat sebelumnya.';
  if (status === 403) return 'Tidak punya akses untuk melakukan aksi ini.';
  if (status === 422) return 'Data tidak valid. Coba ulangi dari awal.';
  if (status >= 500) return `Server error (${status}). Hubungi admin.`;
  return e?.message ?? 'Terjadi kesalahan. Coba lagi.';
}

export default function AbsensiScreen() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab]                       = useState<TabMode>('masuk');
  const [step, setStep]                     = useState<Step>('idle');
  const [photoUri, setPhotoUri]             = useState<string | null>(null);
  const [isTaking, setIsTaking]             = useState(false);
  const [cameraReady, setCameraReady]       = useState(false);
  const [location, setLocation]             = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading]         = useState(false);
  const [errorMsg, setErrorMsg]             = useState('');
  const [successData, setSuccessData]       = useState<any>(null);
  const [facing, setFacing]                 = useState<'front' | 'back'>('front');
  const [uploadProgress, setUploadProgress] = useState('');
  const [absensiHariIni, setAbsensiHariIni] = useState<AbsensiHariIni | null>(null);
  const [loadingStatus, setLoadingStatus]   = useState(true);
  const [captureStatus, setCaptureStatus]   = useState('');

  const [selectedNonHadir, setSelectedNonHadir]     = useState<StatusNonHadir>('izin');
  const [keteranganNonHadir, setKeteranganNonHadir] = useState('');

  const captureQualityRef = useRef<number>(QUALITY_STEPS[0]);
  const isRetryingRef     = useRef<boolean>(false);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef                 = useRef<CameraView>(null);

  useEffect(() => {
    fetchLocation();
    fetchAbsensiHariIni();
  }, []);

  const fetchAbsensiHariIni = useCallback(async () => {
    if (!user) return;
    setLoadingStatus(true);
    try {
      const tanggal = getTanggalWIB();
      const res = await api.get(`/absensi/hari-ini?user_id=${user.id}&tanggal=${tanggal}`);
      const data: AbsensiHariIni | null = res.data ?? null;
      setAbsensiHariIni(data);
      // Arahkan ke tab yang relevan:
      // - sudah hadir masuk tapi belum pulang → tab pulang
      // - sudah izin/sakit/alpha → tab non-hadir (read-only)
      if (data) {
        const isNH = NON_HADIR_STATUS.includes(data.status as StatusNonHadir);
        if (isNH) {
          setTab('non-hadir');
        } else if (data.jam_masuk && !data.jam_keluar) {
          setTab('pulang');
        }
      }
    } catch {
      setAbsensiHariIni(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [user]);

  const fetchLocation = async () => {
    setLocLoading(true);
    setErrorMsg('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Izin lokasi ditolak. Aktifkan di pengaturan.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setErrorMsg('Gagal mendapatkan lokasi. Coba lagi.');
    } finally {
      setLocLoading(false);
    }
  };

  const openCamera = async () => {
    if (!camPerm?.granted) {
      const res = await requestCamPerm();
      if (!res.granted) {
        Alert.alert('Izin Kamera', 'Izin kamera dibutuhkan untuk absensi.');
        return;
      }
    }
    captureQualityRef.current = QUALITY_STEPS[0];
    isRetryingRef.current     = false;
    setCameraReady(false);
    setCaptureStatus('');
    setPhotoUri(null);
    setStep('camera');
  };

  const doCapture = async (quality: number): Promise<void> => {
    if (!cameraRef.current) throw new Error('Kamera tidak siap');
    setCaptureStatus(
      quality < QUALITY_STEPS[0]
        ? `Mengoptimalkan foto (quality ${Math.round(quality * 100)}%)...`
        : 'Mengambil foto...'
    );
    await sleep(CAMERA_WARMUP_MS);
    const photo = await cameraRef.current.takePictureAsync({
      quality, base64: false, exif: false, skipProcessing: false,
    });
    if (!photo?.uri) throw new Error('Kamera mengembalikan URI kosong. Coba lagi.');
    const info = await FileSystem.getInfoAsync(photo.uri, { size: true });
    const fileSize: number = (info as any).size ?? 0;
    if (fileSize > MAX_PHOTO_BYTES) {
      const currentIdx = QUALITY_STEPS.indexOf(quality);
      const nextIdx    = currentIdx + 1;
      if (nextIdx < QUALITY_STEPS.length) {
        captureQualityRef.current = QUALITY_STEPS[nextIdx];
        isRetryingRef.current     = true;
        await doCapture(QUALITY_STEPS[nextIdx]);
        return;
      }
    }
    setPhotoUri(photo.uri);
    setCaptureStatus('');
    setStep('idle');
  };

  const takePhoto = async () => {
    if (isTaking) return;
    if (!cameraReady) {
      Alert.alert('Kamera belum siap', 'Tunggu sebentar, kamera sedang menyala.');
      return;
    }
    setIsTaking(true);
    isRetryingRef.current = false;
    try {
      await doCapture(captureQualityRef.current);
    } catch (err: any) {
      const msg = err?.message ?? 'Tidak dapat mengambil foto.';
      Alert.alert('Gagal', `${msg}\n\nPastikan kamera tidak diblokir aplikasi lain, lalu coba lagi.`);
      setCaptureStatus('');
    } finally {
      if (!isRetryingRef.current) setIsTaking(false);
      isRetryingRef.current = false;
    }
  };

  const preparePhotoBase64 = async (
    uri: string,
    onProgress: (msg: string) => void
  ): Promise<string> => {
    onProgress('Memeriksa ukuran foto...');
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const sizeMB = ((info as any).size ?? 0) / 1024 / 1024;
    onProgress(`Menyiapkan foto (${sizeMB.toFixed(1)} MB)...`);
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  };

  const handleSubmitMasuk = async () => {
    if (!user || !location || !photoUri) {
      setErrorMsg('Pastikan lokasi dan foto sudah tersedia.');
      return;
    }
    setStep('submitting'); setErrorMsg(''); setUploadProgress('Menyiapkan foto...');
    try {
      const tanggal   = getTanggalWIB();
      const jam_masuk = getJamWIB();
      const b64       = await preparePhotoBase64(photoUri, setUploadProgress);
      const foto_url  = `data:image/jpeg;base64,${b64}`;
      setUploadProgress('Mengirim data absensi...');
      const res = await api.post('/absensi/', {
        user_id: user.id, tanggal, jam_masuk,
        status: 'hadir',
        latitude: location.lat, longitude: location.lng,
        foto_url,
      });
      setSuccessData({ ...res.data, mode: 'masuk' });
      setAbsensiHariIni(res.data);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(parseError(e)); setStep('idle');
    } finally {
      setUploadProgress('');
    }
  };

  const handleSubmitPulang = async () => {
    if (!user || !location || !photoUri) {
      setErrorMsg('Pastikan lokasi dan foto sudah tersedia.');
      return;
    }
    if (!absensiHariIni?.id) {
      setErrorMsg('Data absensi masuk tidak ditemukan.');
      return;
    }
    setStep('submitting'); setErrorMsg(''); setUploadProgress('Menyiapkan foto...');
    try {
      const jam_keluar      = getJamWIB();
      const b64             = await preparePhotoBase64(photoUri, setUploadProgress);
      const foto_keluar_url = `data:image/jpeg;base64,${b64}`;
      setUploadProgress('Mengirim data pulang...');
      const res = await api.patch(`/absensi/${absensiHariIni.id}/pulang`, {
        jam_keluar,
        latitude: location.lat,
        longitude: location.lng,
        foto_keluar_url,
      });
      setSuccessData({ ...res.data, mode: 'pulang' });
      setAbsensiHariIni(res.data);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(parseError(e)); setStep('idle');
    } finally {
      setUploadProgress('');
    }
  };

  const handleSubmitNonHadir = async () => {
    if (!user) return;
    if (selectedNonHadir !== 'alpha' && !keteranganNonHadir.trim()) {
      setErrorMsg('Keterangan wajib diisi untuk izin atau sakit.');
      return;
    }
    setStep('submitting'); setErrorMsg(''); setUploadProgress('Mengirim data...');
    try {
      const tanggal = getTanggalWIB();
      const res = await api.post('/absensi/', {
        user_id: user.id,
        tanggal,
        status: selectedNonHadir,
        keterangan: keteranganNonHadir.trim() || null,
      });
      setSuccessData({ ...res.data, mode: 'non-hadir' });
      setAbsensiHariIni(res.data);
      setStep('done');
    } catch (e: any) {
      setErrorMsg(parseError(e)); setStep('idle');
    } finally {
      setUploadProgress('');
    }
  };

  // ── KAMERA
  if (step === 'camera') {
    if (!camPerm?.granted) {
      return (
        <View style={styles.cameraContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={52} color="rgba(255,255,255,0.35)" />
            <Text style={styles.permissionText}>Izin kamera diperlukan</Text>
            <TouchableOpacity onPress={requestCamPerm} style={styles.permissionBtn}>
              <Text style={styles.permissionBtnText}>Berikan Izin</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.camTopBar}>
          <TouchableOpacity onPress={() => { setCameraReady(false); setStep('idle'); }} style={styles.camIconBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.camLocBadge}>
            <Ionicons name="location" size={11} color={location ? '#4ade80' : '#f44444'} />
            <Text style={styles.camLocText} numberOfLines={1}>
              {location
                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : 'Lokasi tidak tersedia'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setCameraReady(false); setFacing((f) => (f === 'front' ? 'back' : 'front')); }}
            style={styles.camIconBtn}
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        {(isTaking || !cameraReady) && (
          <View style={styles.captureStatusBar}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.captureStatusText}>
              {!cameraReady ? 'Menghidupkan kamera...' : captureStatus || 'Mengambil foto...'}
            </Text>
          </View>
        )}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            onPress={takePhoto}
            style={[styles.btnCapture, (isTaking || !cameraReady) && { opacity: 0.35 }]}
            disabled={isTaking || !cameraReady}
            activeOpacity={0.8}
          >
            {isTaking
              ? <ActivityIndicator color="#fff" size="large" />
              : <View style={[styles.btnCaptureInner, !cameraReady && { backgroundColor: 'rgba(255,255,255,0.4)' }]} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SUKSES
  if (step === 'done' && successData) {
    const isPulang    = successData.mode === 'pulang';
    const isNonHadir  = successData.mode === 'non-hadir';
    const statusLabel = NON_HADIR_OPTIONS.find(o => o.value === successData.status)?.label ?? successData.status;
    const statusColor = NON_HADIR_OPTIONS.find(o => o.value === successData.status)?.color ?? '#fbbf24';
    return (
      <LinearGradient
        colors={['#0f1117', '#13151e', '#0f1117']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <BlurView intensity={20} tint="dark" style={{
          borderRadius: 24, overflow: 'hidden', padding: 32,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          alignItems: 'center', width: '100%',
        }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: isNonHadir ? `${statusColor}26` : isPulang ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)',
            borderWidth: 1.5,
            borderColor: isNonHadir ? `${statusColor}66` : isPulang ? 'rgba(99,102,241,0.4)' : 'rgba(34,197,94,0.4)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons
              name={isNonHadir ? 'document-text-outline' : isPulang ? 'exit-outline' : 'checkmark-circle'}
              size={36}
              color={isNonHadir ? statusColor : isPulang ? '#6366f1' : '#22c55e'}
            />
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
            {isNonHadir ? `${statusLabel} Tercatat` : isPulang ? 'Jam Pulang Tercatat' : 'Absensi Berhasil'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>
            {successData.tanggal}
          </Text>
          {isNonHadir && successData.keterangan && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              {successData.keterangan}
            </Text>
          )}
          {!isNonHadir && isPulang && successData.jam_masuk && (
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 4 }}>
              Masuk: {successData.jam_masuk?.slice(0, 5)} · Pulang: {successData.jam_keluar?.slice(0, 5)}
            </Text>
          )}
          {!isNonHadir && successData.dalam_radius !== null && (
            <View style={{
              marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: successData.dalam_radius ? 'rgba(34,197,94,0.12)' : 'rgba(244,68,68,0.12)',
              borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
            }}>
              <Ionicons
                name={successData.dalam_radius ? 'location' : 'location-outline'}
                size={14}
                color={successData.dalam_radius ? '#22c55e' : '#f44444'}
              />
              <Text style={{ color: successData.dalam_radius ? '#22c55e' : '#f44444', fontSize: 12 }}>
                {successData.dalam_radius
                  ? 'Dalam radius lokasi'
                  : `Di luar radius (${Math.round(successData.jarak_meter ?? 0)} m)`}
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={() => router.replace('/(main)/dashboard')} style={{ marginTop: 24, width: '100%' }}>
            <LinearGradient
              colors={isNonHadir ? [statusColor, statusColor] : isPulang ? ['#6366f1', '#4f46e5'] : ['#f44444', '#d92b2b']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 2, fontSize: 12 }}>KEMBALI</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </LinearGradient>
    );
  }

  // ── MAP HTML
  const mapHtml = location ? `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%;background:#0f1117}</style>
    </head><body><div id="map"></div>
    <script>
      var map = L.map('map',{zoomControl:false,attributionControl:false})
        .setView([${location.lat},${location.lng}],16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      L.circleMarker([${location.lat},${location.lng}],{
        radius:10,color:'#f44444',fillColor:'#f44444',fillOpacity:0.9,weight:3
      }).addTo(map);
      L.circle([${location.lat},${location.lng}],{
        radius:100,color:'#f44444',fillColor:'#f44444',
        fillOpacity:0.08,weight:1.5,dashArray:'4'
      }).addTo(map);
    </script></body></html>
  ` : '';

  const sudahMasuk       = !!absensiHariIni?.jam_masuk;
  const sudahPulang      = !!absensiHariIni?.jam_keluar;
  const sudahAbsen       = !!absensiHariIni;
  // Sudah tercatat izin/sakit/alpha — tab masuk & pulang TIDAK aktif
  const isNonHadirStatus = sudahAbsen && NON_HADIR_STATUS.includes(absensiHariIni!.status as StatusNonHadir);
  const nonHadirMeta     = isNonHadirStatus
    ? NON_HADIR_OPTIONS.find(o => o.value === absensiHariIni!.status) ?? null
    : null;

  const isPulangTab   = tab === 'pulang';
  const isNonHadirTab = tab === 'non-hadir';
  const accentColor   = isNonHadirTab
    ? (nonHadirMeta?.color ?? NON_HADIR_OPTIONS.find(o => o.value === selectedNonHadir)?.color ?? '#fbbf24')
    : isPulangTab ? '#6366f1' : '#f44444';

  const canSubmit = step !== 'submitting' && (
    isNonHadirTab
      ? !sudahAbsen
      : isPulangTab
        ? !!location && !!photoUri && sudahMasuk && !sudahPulang
        : !!location && !!photoUri && !sudahMasuk && !isNonHadirStatus
  );

  return (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      {/* Header */}
      <BlurView intensity={15} tint="dark" style={{
        paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>Absensi</Text>
        <TouchableOpacity onPress={fetchLocation} disabled={locLoading}>
          <Ionicons name="refresh" size={20} color={locLoading ? 'rgba(255,255,255,0.3)' : accentColor} />
        </TouchableOpacity>
      </BlurView>

      {/* Tab */}
      <View style={styles.tabWrapper}>
        {/* Tab Masuk — disabled jika sudah izin/sakit/alpha */}
        <TouchableOpacity
          style={[
            styles.tabBtn,
            tab === 'masuk' && { borderBottomColor: '#f44444', borderBottomWidth: 2 },
            isNonHadirStatus && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (isNonHadirStatus) {
              Alert.alert(
                'Tidak Bisa Absen Masuk',
                `Sudah tercatat ${nonHadirMeta?.label ?? absensiHariIni?.status} untuk hari ini.`
              );
              return;
            }
            setTab('masuk'); setErrorMsg(''); setPhotoUri(null);
          }}
        >
          <Ionicons name="log-in-outline" size={16} color={tab === 'masuk' ? '#f44444' : 'rgba(255,255,255,0.35)'} />
          <Text style={[styles.tabText, { color: tab === 'masuk' ? '#f44444' : 'rgba(255,255,255,0.35)' }]}>Masuk</Text>
          {sudahMasuk && <View style={styles.tabBadgeDone}><Ionicons name="checkmark" size={10} color="#22c55e" /></View>}
        </TouchableOpacity>

        {/* Tab Pulang — disabled jika non-hadir ATAU belum masuk */}
        <TouchableOpacity
          style={[
            styles.tabBtn,
            tab === 'pulang' && { borderBottomColor: '#6366f1', borderBottomWidth: 2 },
            (!sudahMasuk || isNonHadirStatus) && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (isNonHadirStatus) {
              Alert.alert(
                'Tidak Bisa Absen Pulang',
                `Sudah tercatat ${nonHadirMeta?.label ?? absensiHariIni?.status} untuk hari ini.`
              );
              return;
            }
            if (!sudahMasuk) {
              Alert.alert('Belum Absen Masuk', 'Lakukan absensi masuk terlebih dahulu.');
              return;
            }
            setTab('pulang'); setErrorMsg(''); setPhotoUri(null);
          }}
        >
          <Ionicons name="log-out-outline" size={16} color={tab === 'pulang' ? '#6366f1' : 'rgba(255,255,255,0.35)'} />
          <Text style={[styles.tabText, { color: tab === 'pulang' ? '#6366f1' : 'rgba(255,255,255,0.35)' }]}>Pulang</Text>
          {sudahPulang && <View style={styles.tabBadgeDone}><Ionicons name="checkmark" size={10} color="#22c55e" /></View>}
        </TouchableOpacity>

        {/* Tab Izin/Sakit — selalu tampil, konten read-only jika sudah tercatat */}
        <TouchableOpacity
          style={[
            styles.tabBtn,
            tab === 'non-hadir' && { borderBottomColor: nonHadirMeta?.color ?? '#fbbf24', borderBottomWidth: 2 },
            sudahMasuk && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (sudahMasuk) {
              Alert.alert('Sudah Absen Masuk', 'Tidak bisa mengajukan izin/sakit karena sudah absen masuk hari ini.');
              return;
            }
            setTab('non-hadir'); setErrorMsg(''); setPhotoUri(null);
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={tab === 'non-hadir' ? (nonHadirMeta?.color ?? '#fbbf24') : 'rgba(255,255,255,0.35)'}
          />
          <Text style={[styles.tabText, { color: tab === 'non-hadir' ? (nonHadirMeta?.color ?? '#fbbf24') : 'rgba(255,255,255,0.35)' }]}>
            Izin/Sakit
          </Text>
          {isNonHadirStatus && (
            <View style={[styles.tabBadgeDone, { backgroundColor: `${nonHadirMeta?.color}26` }]}>
              <Ionicons name="checkmark" size={10} color={nonHadirMeta?.color ?? '#fbbf24'} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Status bar */}
        {loadingStatus ? (
          <ActivityIndicator color={accentColor} style={{ marginVertical: 8 }} />
        ) : (
          <BlurView intensity={12} tint="dark" style={styles.statusCard}>
            <Ionicons
              name={sudahMasuk ? 'time-outline' : isNonHadirStatus ? 'document-text-outline' : 'alert-circle-outline'}
              size={14}
              color={sudahMasuk ? '#22c55e' : isNonHadirStatus ? (nonHadirMeta?.color ?? '#fbbf24') : 'rgba(255,255,255,0.4)'}
            />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              {sudahMasuk
                ? `Masuk: ${absensiHariIni?.jam_masuk?.slice(0, 5)}${
                    sudahPulang
                      ? `  ·  Pulang: ${absensiHariIni?.jam_keluar?.slice(0, 5)}`
                      : '  ·  Belum pulang'
                  }`
                : isNonHadirStatus
                  ? `Status hari ini: ${nonHadirMeta?.label ?? absensiHariIni?.status}`
                  : 'Belum absen hari ini'}
            </Text>
          </BlurView>
        )}

        {/* Banner: sudah izin/sakit/alpha, tab masuk & pulang dikunci */}
        {isNonHadirStatus && (tab === 'masuk' || tab === 'pulang') && (
          <BlurView intensity={12} tint="dark" style={[styles.statusCard, { borderColor: `${nonHadirMeta?.color}50` }]}>
            <Ionicons name="lock-closed-outline" size={16} color={nonHadirMeta?.color ?? '#fbbf24'} />
            <Text style={{ color: nonHadirMeta?.color ?? '#fbbf24', fontSize: 13, fontWeight: '600', flex: 1 }}>
              Sudah tercatat {nonHadirMeta?.label} hari ini. Absen masuk & pulang tidak tersedia.
            </Text>
          </BlurView>
        )}

        {sudahPulang && tab === 'pulang' && (
          <BlurView intensity={12} tint="dark" style={[styles.statusCard, { borderColor: 'rgba(99,102,241,0.3)' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#6366f1" />
            <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>Jam pulang sudah tercatat hari ini</Text>
          </BlurView>
        )}
        {sudahMasuk && tab === 'masuk' && (
          <BlurView intensity={12} tint="dark" style={[styles.statusCard, { borderColor: 'rgba(34,197,94,0.3)' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>Absensi masuk sudah tercatat hari ini</Text>
          </BlurView>
        )}

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color="#f44444" />
            <Text style={{ color: '#f44444', fontSize: 12, flex: 1, lineHeight: 18 }}>{errorMsg}</Text>
          </View>
        )}

        {step === 'submitting' && !!uploadProgress && (
          <BlurView intensity={12} tint="dark" style={[styles.statusCard, { borderColor: `${accentColor}40` }]}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{uploadProgress}</Text>
          </BlurView>
        )}

        {/* ══ KONTEN: NON-HADIR TAB ══ */}
        {isNonHadirTab && (
          isNonHadirStatus ? (
            // ─ Read-only: sudah tercatat
            <BlurView intensity={15} tint="dark" style={{
              borderRadius: 16, overflow: 'hidden', padding: 20,
              borderWidth: 1.5, borderColor: `${nonHadirMeta?.color}40`,
              gap: 12, alignItems: 'center',
            }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: `${nonHadirMeta?.color}20`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={nonHadirMeta?.icon as any ?? 'document-text-outline'} size={28} color={nonHadirMeta?.color ?? '#fbbf24'} />
              </View>
              <Text style={{ color: nonHadirMeta?.color ?? '#fbbf24', fontWeight: '700', fontSize: 16 }}>
                {nonHadirMeta?.label ?? absensiHariIni?.status} — Sudah Tercatat
              </Text>
              {absensiHariIni?.keterangan ? (
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
                  padding: 12, width: '100%',
                }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Keterangan</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{absensiHariIni.keterangan}</Text>
                </View>
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Tidak ada keterangan</Text>
              )}
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
                Hubungi admin jika perlu koreksi
              </Text>
            </BlurView>
          ) : (
            // ─ Form: belum tercatat
            <BlurView intensity={15} tint="dark" style={{
              borderRadius: 16, overflow: 'hidden', padding: 16,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              gap: 14,
            }}>
              <Text style={{
                color: 'rgba(255,255,255,0.5)', fontSize: 10,
                letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2,
              }}>Pilih Status</Text>

              {NON_HADIR_OPTIONS.map((opt) => {
                const isActive = selectedNonHadir === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => { setSelectedNonHadir(opt.value); setErrorMsg(''); }}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      borderRadius: 12, padding: 14,
                      borderWidth: 1.5,
                      borderColor: isActive ? opt.color : 'rgba(255,255,255,0.08)',
                      backgroundColor: isActive ? `${opt.color}18` : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: isActive ? `${opt.color}26` : 'rgba(255,255,255,0.06)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={opt.icon as any} size={20} color={isActive ? opt.color : 'rgba(255,255,255,0.35)'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isActive ? opt.color : 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 14 }}>
                        {opt.label}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={20} color={opt.color} />}
                  </TouchableOpacity>
                );
              })}

              <View style={{ marginTop: 4 }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.45)', fontSize: 10,
                  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Keterangan {selectedNonHadir !== 'alpha' ? '(Wajib)' : '(Opsional)'}
                </Text>
                <TextInput
                  value={keteranganNonHadir}
                  onChangeText={setKeteranganNonHadir}
                  placeholder={
                    selectedNonHadir === 'izin'
                      ? 'Contoh: Ada keperluan keluarga'
                      : selectedNonHadir === 'sakit'
                        ? 'Contoh: Demam dan istirahat dokter'
                        : 'Keterangan (opsional)'
                  }
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: keteranganNonHadir.trim() ? `${accentColor}80` : 'rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: 12,
                    color: '#fff', fontSize: 13, lineHeight: 20,
                    minHeight: 80, textAlignVertical: 'top',
                  }}
                />
              </View>

              <TouchableOpacity onPress={handleSubmitNonHadir} disabled={!canSubmit} activeOpacity={0.82}>
                <LinearGradient
                  colors={canSubmit ? [accentColor, accentColor] : ['#1a1a2e', '#12121e']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 12, height: 52, alignItems: 'center',
                    justifyContent: 'center', flexDirection: 'row', gap: 8,
                    opacity: canSubmit ? 1 : 0.5,
                  }}
                >
                  {step === 'submitting'
                    ? <ActivityIndicator color="#fff" />
                    : (
                      <>
                        <Ionicons name="document-text-outline" size={20} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>
                          KIRIM {selectedNonHadir.toUpperCase()}
                        </Text>
                      </>
                    )}
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          )
        )}

        {/* ══ KONTEN: MASUK / PULANG ══ */}
        {!isNonHadirTab && !isNonHadirStatus && (
          <>
            {/* Peta */}
            <BlurView intensity={15} tint="dark" style={{
              borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
            }}>
              <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={16} color={accentColor} />
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 }}>
                  {locLoading ? 'Mengambil lokasi...' : location
                    ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                    : 'Lokasi tidak tersedia'}
                </Text>
                {locLoading && <ActivityIndicator size="small" color={accentColor} />}
              </View>
              {location ? (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: mapHtml }}
                  style={{ height: 200, backgroundColor: '#0f1117' }}
                  scrollEnabled={false}
                  javaScriptEnabled
                />
              ) : (
                <View style={{ height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  {locLoading
                    ? <ActivityIndicator color={accentColor} />
                    : <Ionicons name="map-outline" size={40} color="rgba(255,255,255,0.15)" />}
                </View>
              )}
            </BlurView>

            {((tab === 'masuk' && !sudahMasuk) || (tab === 'pulang' && sudahMasuk && !sudahPulang)) && (
              <>
                <BlurView intensity={15} tint="dark" style={{
                  borderRadius: 16, overflow: 'hidden', padding: 16,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: 10,
                    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
                  }}>
                    Foto {tab === 'masuk' ? 'Masuk' : 'Pulang'}
                  </Text>
                  {photoUri ? (
                    <View>
                      <Image
                        source={{ uri: photoUri }}
                        style={{ width: '100%', height: 260, borderRadius: 12, backgroundColor: '#1a1a1a' }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={openCamera}
                        disabled={step === 'submitting'}
                        style={{
                          marginTop: 10, borderRadius: 10, borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 10,
                          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Ionicons name="camera-outline" size={15} color="rgba(255,255,255,0.5)" />
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Ambil ulang foto</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={openCamera}
                      disabled={step === 'submitting'}
                      style={{
                        height: 160, borderRadius: 12, borderWidth: 1.5,
                        borderColor: `${accentColor}4D`, borderStyle: 'dashed',
                        backgroundColor: `${accentColor}0D`,
                        alignItems: 'center', justifyContent: 'center', gap: 10,
                      }}
                    >
                      <View style={{
                        width: 56, height: 56, borderRadius: 28,
                        backgroundColor: `${accentColor}26`, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="camera-outline" size={28} color={accentColor} />
                      </View>
                      <Text style={{ color: accentColor, fontSize: 13, fontWeight: '600', opacity: 0.85 }}>Ambil Foto</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Tap untuk membuka kamera</Text>
                    </TouchableOpacity>
                  )}
                </BlurView>

                <TouchableOpacity
                  onPress={tab === 'masuk' ? handleSubmitMasuk : handleSubmitPulang}
                  disabled={!canSubmit}
                  activeOpacity={0.82}
                >
                  <LinearGradient
                    colors={
                      canSubmit
                        ? isPulangTab ? ['#6366f1', '#4f46e5'] : ['#f44444', '#d92b2b']
                        : ['#1a1a2e', '#12121e']
                    }
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 12, height: 52, alignItems: 'center',
                      justifyContent: 'center', flexDirection: 'row', gap: 8,
                      opacity: canSubmit ? 1 : 0.5,
                    }}
                  >
                    {step === 'submitting'
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <>
                          <Ionicons
                            name={isPulangTab ? 'exit-outline' : 'checkmark-circle-outline'}
                            size={20} color="#fff"
                          />
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>
                            {isPulangTab ? 'CATAT JAM PULANG' : 'CATAT ABSENSI'}
                          </Text>
                        </>
                      )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
          {getLabelTanggalWIB()}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tabWrapper: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBadgeDone: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  statusCard: {
    borderRadius: 12, overflow: 'hidden', padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(244,68,68,0.12)', borderWidth: 1,
    borderColor: 'rgba(244,68,68,0.3)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
  },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera:          { flex: 1 },
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  camIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  camLocBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: SW * 0.5,
  },
  camLocText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: 0.3 },
  captureStatusBar: {
    position: 'absolute', bottom: 148, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 8,
  },
  captureStatusText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  cameraControls: {
    position: 'absolute', bottom: 52, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCapture: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  btnCaptureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  permissionBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  permissionText:  { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center' },
  permissionBtn:   {
    paddingHorizontal: 28, paddingVertical: 13,
    backgroundColor: '#f44444', borderRadius: 12, marginTop: 4,
  },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
});
