import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [emailFocus, setEmailFocus]       = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // TODO: ganti URL dengan IP backend kamu
      // const res = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/login/`, { email, password });
      // const { token, role } = res.data;
      // switch (role) {
      //   case 'admin':      router.replace('/(admin)/dashboard'); break;
      //   case 'driver':     router.replace('/(driver)/dashboard'); break;
      //   case 'inventori':  router.replace('/(inventori)/dashboard'); break;
      //   default:           router.replace('/(admin)/dashboard');
      // }
      await new Promise((r) => setTimeout(r, 1500)); // simulasi
      router.replace('/(auth)/login'); // ganti dengan route dashboard
    } catch (e: any) {
      setError('Login gagal. Periksa email dan password kamu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0f1117', '#13151e', '#0f1117']}
      style={{ flex: 1 }}
    >
      {/* Background glow dekorasi */}
      <View
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: 175,
          top: -80,
          right: -80,
          backgroundColor: 'rgba(244,68,68,0.10)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 250,
          height: 250,
          borderRadius: 125,
          bottom: 50,
          left: -60,
          backgroundColor: 'rgba(244,68,68,0.07)',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'rgba(244,68,68,0.15)',
                  borderWidth: 1.5,
                  borderColor: 'rgba(244,68,68,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  shadowColor: '#f44444',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                <Text style={{ fontSize: 34 }}>☕</Text>
              </View>

              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 30,
                  fontWeight: '800',
                  letterSpacing: 6,
                  marginBottom: 4,
                }}
              >
                SEKOPI
              </Text>

              {/* Garis aksen merah */}
              <View
                style={{
                  width: 40,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: '#f44444',
                  marginBottom: 8,
                  shadowColor: '#f44444',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 6,
                }}
              />

              <Text
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              >
                Masuk ke akun kamu
              </Text>
            </View>

            {/* Glass Form Card */}
            <BlurView
              intensity={25}
              tint="dark"
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                padding: 24,
              }}
            >
              {/* Error message */}
              {error ? (
                <View
                  style={{
                    backgroundColor: 'rgba(244,68,68,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(244,68,68,0.3)',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: '#f44444', fontSize: 12 }}>{error}</Text>
                </View>
              ) : null}

              {/* Email */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    marginLeft: 2,
                  }}
                >
                  Email
                </Text>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: emailFocus
                      ? 'rgba(244,68,68,0.6)'
                      : 'rgba(255,255,255,0.10)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    shadowColor: emailFocus ? '#f44444' : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                  }}
                >
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    placeholder="email@sekopi.com"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ color: '#ffffff', fontSize: 14 }}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    marginLeft: 2,
                  }}
                >
                  Password
                </Text>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: passwordFocus
                      ? 'rgba(244,68,68,0.6)'
                      : 'rgba(255,255,255,0.10)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: passwordFocus ? '#f44444' : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                  }}
                >
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocus(true)}
                    onBlur={() => setPasswordFocus(false)}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    secureTextEntry={!showPass}
                    style={{ color: '#ffffff', fontSize: 14, flex: 1 }}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                    <Text style={{ color: 'rgba(244,68,68,0.7)', fontSize: 12 }}>
                      {showPass ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={loading ? ['#4a1f1f', '#3a1515'] : ['#f44444', '#d92b2b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 15,
                    alignItems: 'center',
                    shadowColor: '#f44444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: loading ? 0.1 : 0.45,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="rgba(255,255,255,0.7)" />
                  ) : (
                    <Text
                      style={{
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: '700',
                        letterSpacing: 3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Masuk
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>

            <Text
              style={{
                color: 'rgba(255,255,255,0.2)',
                fontSize: 11,
                textAlign: 'center',
                marginTop: 32,
                letterSpacing: 1,
              }}
            >
              © 2026 Sekopi Platform
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
