import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

// Pisah komponen input agar BlurView tidak re-render saat focus berubah
type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  rightElement?: React.ReactNode;
};

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  rightElement,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.10)', 'rgba(244,68,68,0.65)'],
  });

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.50)',
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 6,
          marginLeft: 2,
        }}
      >
        {label}
      </Text>
      <Animated.View
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          height: 48,  // fixed height — tidak ada double padding
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          style={{
            flex: 1,
            color: '#ffffff',
            fontSize: 14,
            height: 48, // sama dengan wrapper agar tidak ada gap
            // hapus padding default Android
            paddingVertical: 0,
            includeFontPadding: false,
          }}
        />
        {rightElement}
      </Animated.View>
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
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
      // TODO: sambungkan ke backend
      // const res = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/login/`, { email, password });
      // const { token, role } = res.data;
      // switch (role) {
      //   case 'admin':     router.replace('/(admin)/dashboard'); break;
      //   case 'driver':    router.replace('/(driver)/dashboard'); break;
      //   case 'inventori': router.replace('/(inventori)/dashboard'); break;
      //   default:          router.replace('/(admin)/dashboard');
      // }
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      setError('Login gagal. Periksa email dan password kamu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // LinearGradient sebagai root, tidak dibungkus KeyboardAvoidingView lagi
    <LinearGradient
      colors={['#0f1117', '#13151e', '#0f1117']}
      style={{ flex: 1 }}
    >
      {/* Dekorasi glow — absolute, tidak ikut re-render input */}
      <View style={{
        position: 'absolute', width: 350, height: 350, borderRadius: 175,
        top: -80, right: -80, backgroundColor: 'rgba(244,68,68,0.10)',
        pointerEvents: 'none',
      }} />
      <View style={{
        position: 'absolute', width: 250, height: 250, borderRadius: 125,
        bottom: 50, left: -60, backgroundColor: 'rgba(244,68,68,0.07)',
        pointerEvents: 'none',
      }} />

      {/*
        Android: behavior="padding" lebih stabil dari "height".
        Digabung dengan ScrollView agar tidak ada jump/flashing.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingBottom: 40,
            paddingTop: 60,
          }}
          keyboardShouldPersistTaps="handled"
          // Matikan scroll indicator agar tidak ada flicker
          showsVerticalScrollIndicator={false}
          // Penting: jangan animasikan scroll saat keyboard naik
          keyboardDismissMode="none"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* ── Header ── */}
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: 'rgba(244,68,68,0.15)',
                borderWidth: 1.5, borderColor: 'rgba(244,68,68,0.35)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
                shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
              }}>
                <Text style={{ fontSize: 34 }}>☕</Text>
              </View>

              <Text style={{
                color: '#ffffff', fontSize: 30, fontWeight: '800',
                letterSpacing: 6, marginBottom: 6,
              }}>
                SEKOPI
              </Text>

              <View style={{
                width: 40, height: 2, borderRadius: 1,
                backgroundColor: '#f44444', marginBottom: 8,
                shadowColor: '#f44444', shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8, shadowRadius: 6,
              }} />

              <Text style={{
                color: 'rgba(255,255,255,0.40)', fontSize: 11,
                letterSpacing: 3, textTransform: 'uppercase',
              }}>
                Masuk ke akun kamu
              </Text>
            </View>

            {/* ── Glass Card ── */}
            {/*
              BlurView hanya berisi elemen statis + InputField yg sudah dipisah.
              BlurView TIDAK menyimpan state focus, jadi tidak re-render saat ketik.
            */}
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.03)',
                padding: 22,
              }}
            >
              {/* Error */}
              {!!error && (
                <View style={{
                  backgroundColor: 'rgba(244,68,68,0.12)',
                  borderWidth: 1, borderColor: 'rgba(244,68,68,0.30)',
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  marginBottom: 14,
                }}>
                  <Text style={{ color: '#f44444', fontSize: 12 }}>{error}</Text>
                </View>
              )}

              <InputField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="email@sekopi.com"
                keyboardType="email-address"
              />

              <View style={{ marginBottom: 22 }}>
                <InputField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPass}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowPass((p) => !p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={{ color: 'rgba(244,68,68,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>
                        {showPass ? 'HIDE' : 'SHOW'}
                      </Text>
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Tombol Login */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.82}>
                <LinearGradient
                  colors={loading ? ['#4a1f1f', '#3a1515'] : ['#f44444', '#d92b2b']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 12, height: 50,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#f44444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: loading ? 0.1 : 0.45,
                    shadowRadius: 14, elevation: 8,
                  }}
                >
                  {loading
                    ? <ActivityIndicator color="rgba(255,255,255,0.75)" />
                    : <Text style={{
                        color: '#ffffff', fontSize: 13, fontWeight: '700',
                        letterSpacing: 3, textTransform: 'uppercase',
                      }}>Masuk</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>

            <Text style={{
              color: 'rgba(255,255,255,0.18)', fontSize: 11,
              textAlign: 'center', marginTop: 28, letterSpacing: 1,
            }}>
              © 2026 Sekopi Platform
            </Text>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
