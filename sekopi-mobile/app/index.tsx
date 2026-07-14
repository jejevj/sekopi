import { useEffect, useRef } from 'react';
import { Animated, View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuthStore, isSessionValid } from '../stores/authStore';

export default function SplashScreen() {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const loadAuth  = useAuthStore((s) => s.loadAuth);

  useEffect(() => {
    // Animasi masuk
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Load auth dari AsyncStorage lalu tentukan redirect
    const bootstrap = async () => {
      await loadAuth();

      // Ambil state terbaru langsung dari store
      const { user, accessToken, loginDate } = useAuthStore.getState();
      const sessionOk = !!user && !!accessToken && isSessionValid(loginDate);

      // Tunggu minimal 2.8 detik agar splash screen terlihat
      await new Promise((r) => setTimeout(r, 2800));

      if (sessionOk) {
        router.replace('/(main)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    };

    bootstrap();
  }, []);

  return (
    <LinearGradient
      colors={['#0f1117', '#13151e', '#0f1117']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Radial glow merah kopi di background */}
      <View
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: 200,
          top: '10%',
          left: '-20%',
          backgroundColor: 'rgba(244,68,68,0.12)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: 150,
          bottom: '10%',
          right: '-10%',
          backgroundColor: 'rgba(244,68,68,0.07)',
        }}
      />

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: 'center',
        }}
      >
        {/* Glass Card */}
        <BlurView
          intensity={20}
          tint="dark"
          style={{
            borderRadius: 28,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            paddingHorizontal: 52,
            paddingVertical: 44,
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          {/* Icon Container */}
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: 'rgba(244,68,68,0.15)',
              borderWidth: 1.5,
              borderColor: 'rgba(244,68,68,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              elevation: 12,
              overflow: 'hidden',
            }}
          >
            <Image
              source={require('../assets/android-icon-background.png')}
              style={{ width: 88, height: 88, borderRadius: 44 }}
              resizeMode="cover"
            />
          </View>

          {/* Brand Name */}
          <Text
            style={{
              fontSize: 36,
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: 8,
              marginBottom: 4,
            }}
          >
            SEKOPI
          </Text>

          {/* Garis aksen merah */}
          <View
            style={{
              width: 48,
              height: 2.5,
              borderRadius: 2,
              backgroundColor: '#f44444',
              marginBottom: 10,
            }}
          />

          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Platform Ordering
          </Text>
        </BlurView>

        {/* Loading dots */}
        <View style={{ flexDirection: 'row', marginTop: 36, gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === 1 ? '#f44444' : 'rgba(244,68,68,0.35)',
              }}
            />
          ))}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}
