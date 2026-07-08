import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, StyleSheet, StatusBar,
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
  const [errorMsg, setErrorMsg]       = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [facing, setFacing]           = useState<'front' | 'back'>('front');

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef                 = useRef<CameraView>(null);

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
      // Ambil lokasi terbaru saat foto diambil supaya metadata akurat
      let snapLocation = location;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        snapLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLocation(snapLocation);
      } catch {
        // Tetap lanjut pakai lokasi sebelumnya kalau gagal refresh
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
        exif: false,
        // Sisipkan GPS ke EXIF via additionalExif
        additionalExif: snapLocation
          ? {
              GPSLatitude: snapLocation.lat,
              GPSLongitude: snapLocation.lng,
              GPSLatitudeRef: snapLocation.lat >= 0 ? 'N' : 'S',
              GPSLongitudeRef: snapLocation.lng >= 0 ? 'E' : 'W',
              GPSAltitude: 0,
            }
          : {},
      });

      setPhotoUri(photo!.uri);
      setPhotoB64(photo!.base64 ?? null);
      setStep('preview');
    } catch {
      Alert.alert('Error', 'Gagal mengambil foto. Coba lagi.');
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
      const jam_masuk = now.toTimeString().slice(0, 8);
      const foto_url  = `data:image/jpeg;base64,${photoB64}`;

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

  // ── KAMERA ─────────────────────────────────────────────
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

        {/* Kamera fullscreen */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />

        {/* Topbar kamera */}
        <View style={styles.camTopBar}>
          <TouchableOpacity onPress={() => setStep('idle')} style={styles.camIconBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          {/* Info lokasi kecil di tengah */}
          <View style={styles.camLocBadge}>
            <Ionicons name="location" size={11} color={location ? '#4ade80' : '#f44444'} />
            <Text style={styles.camLocText}>
              {location
                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : 'Lokasi tidak tersedia'}
            </Text>
          </View>

          {/* Flip kamera */}
          <TouchableOpacity
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            style={styles.camIconBtn}
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tombol capture bawah */}
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={takePhoto} style={styles.btnCapture}>
            <View style={styles.btnCaptureInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SUKSES ─────────────────────────────────────────────
  if (step === 'done' && successData) {
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
              backgroundColor: successData.dalam_radius
                ? 'rgba(34,197,94,0.12)' : 'rgba(244,68,68,0.12)',
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

  // ── MAP HTML ─────────────────────────────────────────────
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
      L.circle([${location.lat}, ${location.lng}], {
        radius: 100, color: '#f44444', fillColor: '#f44444',
        fillOpacity: 0.08, weight: 1.5, dashArray: '4',
      }).addTo(map);
    </script></body></html>
  ` : '';

  // ── MAIN SCREEN ────────────────────────────────────────────
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
          <Ionicons
            name="refresh"
            size={20}
            color={locLoading ? 'rgba(255,255,255,0.3)' : '#f44444'}
          />
        </TouchableOpacity>
      </BlurView>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error */}
        {!!errorMsg && (
          <View style={{
            backgroundColor: 'rgba(244,68,68,0.12)', borderWidth: 1,
            borderColor: 'rgba(244,68,68,0.3)', borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 10,
            flexDirection: 'row', gap: 8, alignItems: 'flex-start',
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
          {location ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={{ height: 200, backgroundColor: '#0f1117' }}
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

        {/* Foto */}
        <BlurView intensity={15} tint="dark" style={{
          borderRadius: 16, overflow: 'hidden', padding: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        }}>
          <Text style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>Foto Absensi</Text>

          {photoUri ? (
            <View>
              <View style={{
                width: '100%', height: 200, borderRadius: 12, overflow: 'hidden',
                backgroundColor: 'rgba(34,197,94,0.08)',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>Foto diambil</Text>
                {location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="location" size={11} color="#4ade80" />
                    <Text style={{ color: 'rgba(74,222,128,0.8)', fontSize: 10 }}>
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </Text>
                  </View>
                )}
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Tap untuk ganti foto</Text>
              </View>
              <TouchableOpacity
                onPress={openCamera}
                style={{
                  marginTop: 10, borderRadius: 10,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                  paddingVertical: 10, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                <Ionicons name="camera-outline" size={15} color="rgba(255,255,255,0.5)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Ambil ulang foto</Text>
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
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: 'rgba(244,68,68,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="camera-outline" size={28} color="#f44444" />
              </View>
              <Text style={{ color: 'rgba(244,68,68,0.85)', fontSize: 13, fontWeight: '600' }}>Ambil Foto</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Foto akan menyimpan data lokasi</Text>
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

        <Text style={{
          color: 'rgba(255,255,255,0.15)', fontSize: 11,
          textAlign: 'center', letterSpacing: 1,
        }}>
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  camTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  camIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camLocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: SW * 0.5,
  },
  camLocText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCapture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnCaptureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: '#f44444',
    borderRadius: 12,
    marginTop: 4,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
});
