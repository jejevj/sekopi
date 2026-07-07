import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

export default function SplashScreen() {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade + scale masuk
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

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();

    // Redirect ke login setelah 2.8 detik
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    // Background: dark navy sama persis seperti --background: #0f1117
    <LinearGradient
      colors={['#0f1117', '#13151e', '#0f1117']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Radial glow merah kopi di background, sama dengan global.css */}
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
          {/* Icon Container dengan glow merah */}
          <Animated.View
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
              shadowColor: '#f44444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowOpacity as any,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 42 }}>☕</Text>
          </Animated.View>

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
              shadowColor: '#f44444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 8,
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
