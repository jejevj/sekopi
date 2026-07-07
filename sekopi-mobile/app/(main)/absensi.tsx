import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const { width: SW } = Dimensions.get('window');

type Step = 'idle' | 'camera' | 'preview' | 'submitting' | 'done';

export default function AbsensiScreen() {
  const user = useAuthStore((s) => s.user);

  const [step, setStep]               = useState<Step>('idle');
  const [photoUri, setPhotoUri]       = useState<string | null>(null);
  const [photoB64, setPhotoB64]       = useState<string | null>(null);
  const [location, setLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading]   = useState(false);
  const [mapReady, setMapReady]       = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  const [camPerm, requestCamPerm]     = useCameraPermissions();
  const cameraRef                     = useRef<CameraView>(null);

  // Ambil lokasi saat layar dibuka
  useEffect(() => {
    fetchLocation();
  }, []);

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
    setStep('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        exif: false,
      });
      setPhotoUri(photo!.uri);
      setPhotoB64(photo!.base64 ?? null);
      setStep('preview');
    } catch {
      Alert.alert('Error', 'Gagal mengambil foto.');
    }
  };

  const handleSubmit = async () => {
    if (!user || !location || !photoB64) {
      setErrorMsg('Pastikan lokasi dan foto sudah tersedia.');
      return;
    }
    setStep('submitting');
    setErrorMsg('');
    try {
      const now       = new Date();
      const tanggal   = now.toISOString().split('T')[0];
      const jam_masuk = now.toTimeString().slice(0, 8); // HH:MM:SS

      // Upload foto sebagai base64 data URL — backend bisa terima foto_url string
      // Jika backend punya endpoint upload terpisah, ganti bagian ini
      const foto_url = `data:image/jpeg;base64,${photoB64}`;

      const payload = {
        user_id:   user.id,
        tanggal,
        jam_masuk,
        status:    'hadir',
        latitude:  location.lat,
        longitude: location.lng,
        foto_url,
      };

      const res = await api.post('/absensi/', payload);
      setSuccessData(res.data);
      setStep('done');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErrorMsg(detail ?? 'Gagal menyimpan absensi. Coba lagi.');
      setStep('preview');
    }
  };

  // ── KAMERA ─────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="front"
        />
        {/* Overlay guide */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Frame wajah */}
          <View style={{
            width: 220, height: 270, borderRadius: 110,
            borderWidth: 2, borderColor: 'rgba(244,68,68,0.7)',
            borderStyle: 'dashed',
          }} />
          <Text style={{
            color: 'rgba(255,255,255,0.7)', marginTop: 16,
            fontSize: 12, letterSpacing: 1,
          }}>Posisikan wajah di dalam frame</Text>
        </View>

        {/* Tombol bawah */}
        <View style={{
          position: 'absolute', bottom: 48, left: 0, right: 0,
          flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32,
        }}>
          <TouchableOpacity onPress={() => setStep('idle')} style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={takePhoto} style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: '#f44444',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
          }}>
            <Ionicons name="camera" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SUKSES ───────────────────────────────────────────────────────────
  if (step === 'done' && successData) {
    return (
      <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <BlurView intensity={20} tint="dark" style={{
          borderRadius: 24, overflow: 'hidden', padding: 32,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          alignItems: 'center', width: '100%',
        }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: 'rgba(34,197,94,0.15)',
            borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.4)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="checkmark-circle" size={36} color="#22c55e" />
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>Absensi Berhasil</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>
            {successData.tanggal} • {successData.jam_masuk?.slice(0, 5)}
          </Text>
          {successData.dalam_radius !== null && (
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
                {successData.dalam_radius ? 'Dalam radius lokasi' : `Di luar radius (${Math.round(successData.jarak_meter ?? 0)} m)`}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.replace('/(main)/dashboard')}
            style={{ marginTop: 24, width: '100%' }}
          >
            <LinearGradient
              colors={['#f44444', '#d92b2b']}
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

  // ── MAP HTML untuk embed OpenStreetMap (tanpa API key) ──────────────────
  const mapHtml = location ? `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%;background:#0f1117}</style>
    </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map', { zoomControl: false, attributionControl: false })
        .setView([${location.lat}, ${location.lng}], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      L.circleMarker([${location.lat}, ${location.lng}], {
        radius: 10, color: '#f44444', fillColor: '#f44444',
        fillOpacity: 0.9, weight: 3,
      }).addTo(map);
      // Radius ring
      L.circle([${location.lat}, ${location.lng}], {
        radius: 100, color: '#f44444', fillColor: '#f44444',
        fillOpacity: 0.08, weight: 1.5, dashArray: '4',
      }).addTo(map);
    </script></body></html>
  ` : '';

  // ── MAIN SCREEN (idle + preview) ───────────────────────────────────────
  return (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      {/* Topbar */}
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
          <Ionicons name="refresh" size={20} color={locLoading ? 'rgba(255,255,255,0.3)' : '#f44444'} />
        </TouchableOpacity>
      </BlurView>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Error */}
        {!!errorMsg && (
          <View style={{
            backgroundColor: 'rgba(244,68,68,0.12)', borderWidth: 1,
            borderColor: 'rgba(244,68,68,0.3)', borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 8,
          }}>
            <Ionicons name="warning-outline" size={16} color="#f44444" />
            <Text style={{ color: '#f44444', fontSize: 12, flex: 1 }}>{errorMsg}</Text>
          </View>
        )}

        {/* Peta Lokasi */}
        <BlurView intensity={15} tint="dark" style={{
          borderRadius: 16, overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        }}>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="location" size={16} color="#f44444" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 }}>
              {locLoading
                ? 'Mengambil lokasi...'
                : location
                ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                : 'Lokasi tidak tersedia'}
            </Text>
            {locLoading && <ActivityIndicator size="small" color="#f44444" />}
          </View>
          {/* Map embed via Leaflet + OpenStreetMap */}
          {location ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={{ height: 200, backgroundColor: '#0f1117' }}
              onLoadEnd={() => setMapReady(true)}
              scrollEnabled={false}
              javaScriptEnabled
            />
          ) : (
            <View style={{
              height: 160, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}>
              {locLoading
                ? <ActivityIndicator color="#f44444" />
                : <Ionicons name="map-outline" size={40} color="rgba(255,255,255,0.15)" />}
            </View>
          )}
        </BlurView>

        {/* Foto Selfie */}
        <BlurView intensity={15} tint="dark" style={{
          borderRadius: 16, overflow: 'hidden', padding: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        }}>
          <Text style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>Foto Selfie</Text>

          {photoUri ? (
            // Preview foto
            <View style={{ position: 'relative' }}>
              <View style={{
                width: '100%', height: 200, borderRadius: 12,
                overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Tampilkan preview dengan native Image */}
                <View style={{
                  width: '100%', height: '100%',
                  backgroundColor: 'rgba(244,68,68,0.08)',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>Foto diambil</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Tap ulang untuk ganti</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={openCamera}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 8, padding: 6,
                }}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={openCamera}
              style={{
                height: 160, borderRadius: 12,
                borderWidth: 1.5, borderColor: 'rgba(244,68,68,0.3)',
                borderStyle: 'dashed', backgroundColor: 'rgba(244,68,68,0.05)',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: 'rgba(244,68,68,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="camera-outline" size={26} color="#f44444" />
              </View>
              <Text style={{ color: 'rgba(244,68,68,0.8)', fontSize: 13, fontWeight: '600' }}>Ambil Foto Selfie</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Diperlukan untuk absensi</Text>
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Tombol Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!location || !photoUri || step === 'submitting'}
          activeOpacity={0.82}
        >
          <LinearGradient
            colors={(!location || !photoUri) ? ['#2a1515', '#1a0f0f'] : ['#f44444', '#d92b2b']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 12, height: 52,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: (!location || !photoUri) ? 0.5 : 1,
            }}
          >
            {step === 'submitting'
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>CATAT ABSENSI</Text>
                </>
              )
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
          Absensi dicatat pada {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}
