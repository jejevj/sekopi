import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

type Section = 'menu' | 'profil' | 'password';

function parseError(e: any): string {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join(', ');
  if (detail) return JSON.stringify(detail);
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error')
    return 'Tidak dapat terhubung ke server.';
  return e?.message ?? 'Terjadi kesalahan. Coba lagi.';
}

// ─── Label Role ──────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  produksi: 'Produksi',
  inventori: 'Inventori',
  driver: 'Driver',
  shareholder: 'Shareholder',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#f87171',
  produksi: '#60a5fa',
  inventori: '#34d399',
  driver: '#fbbf24',
  shareholder: '#a78bfa',
};

export default function ProfilScreen() {
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth  = useAuthStore((s) => s.clearAuth);

  const [section, setSection] = useState<Section>('menu');

  // ── State edit profil
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail]       = useState(user?.email ?? '');
  const [saving, setSaving]     = useState(false);
  const [profError, setProfError] = useState('');
  const [profSuccess, setProfSuccess] = useState(false);

  // ── State ganti password
  const [curPass, setCurPass]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confPass, setConfPass] = useState('');
  const [showCur, setShowCur]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError]     = useState('');
  const [passSuccess, setPassSuccess] = useState(false);

  if (!user) return null;

  const roleColor = ROLE_COLOR[user.role] ?? '#94a3b8';
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  // ── Avatar initials
  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMIT: Update Profil
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveProfil = async () => {
    setProfError(''); setProfSuccess(false);
    const trimName  = fullName.trim();
    const trimEmail = email.trim();
    if (!trimName) { setProfError('Nama lengkap tidak boleh kosong.'); return; }
    if (!trimEmail) { setProfError('Email tidak boleh kosong.'); return; }
    // Tidak ada perubahan
    if (trimName === user.full_name && trimEmail === user.email) {
      setProfError('Tidak ada perubahan yang disimpan.'); return;
    }
    setSaving(true);
    try {
      const res = await api.patch('/users/me/profile', {
        full_name: trimName !== user.full_name ? trimName : undefined,
        email: trimEmail !== user.email ? trimEmail : undefined,
      });
      await updateUser({ full_name: res.data.full_name, email: res.data.email });
      setProfSuccess(true);
    } catch (e: any) {
      setProfError(parseError(e));
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMIT: Ganti Password
  // ─────────────────────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPassError(''); setPassSuccess(false);
    if (!curPass)           { setPassError('Password saat ini wajib diisi.'); return; }
    if (newPass.length < 6) { setPassError('Password baru minimal 6 karakter.'); return; }
    if (newPass !== confPass) { setPassError('Konfirmasi password tidak cocok.'); return; }
    setPassLoading(true);
    try {
      await api.post('/users/me/change-password', {
        current_password: curPass,
        new_password: newPass,
      });
      setPassSuccess(true);
      setCurPass(''); setNewPass(''); setConfPass('');
    } catch (e: any) {
      setPassError(parseError(e));
    } finally {
      setPassLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Konfirmasi Logout', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: () => { clearAuth(); router.replace('/'); },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPER: Input field
  // ─────────────────────────────────────────────────────────────────────────────
  const renderInput = ({
    label, value, onChange, placeholder, keyboardType, secure, showToggle, onToggle, autoCapitalize,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; keyboardType?: any; secure?: boolean;
    showToggle?: boolean; onToggle?: () => void; autoCapitalize?: any;
  }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? label}
          placeholderTextColor="rgba(255,255,255,0.2)"
          secureTextEntry={secure}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          style={styles.input}
        />
        {showToggle && onToggle && (
          <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
            <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Header (avatar + nama + role)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <BlurView intensity={15} tint="dark" style={styles.avatarCard}>
      <View style={[styles.avatarCircle, { borderColor: `${roleColor}66` }]}>
        <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nameText} numberOfLines={1}>{user.full_name}</Text>
        <Text style={styles.emailText} numberOfLines={1}>{user.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20`, borderColor: `${roleColor}50` }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
      </View>
    </BlurView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Section Menu utama
  // ─────────────────────────────────────────────────────────────────────────────
  const renderMenu = () => (
    <View style={{ gap: 10 }}>
      {[
        {
          icon: 'person-outline' as const,
          label: 'Edit Profil',
          desc: 'Ubah nama dan email',
          color: '#60a5fa',
          onPress: () => { setProfError(''); setProfSuccess(false); setSection('profil'); },
        },
        {
          icon: 'lock-closed-outline' as const,
          label: 'Ganti Password',
          desc: 'Perbarui kata sandi akun',
          color: '#fbbf24',
          onPress: () => { setPassError(''); setPassSuccess(false); setSection('password'); },
        },
      ].map((item) => (
        <TouchableOpacity key={item.label} onPress={item.onPress} activeOpacity={0.8}>
          <BlurView intensity={12} tint="dark" style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
          </BlurView>
        </TouchableOpacity>
      ))}

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} activeOpacity={0.8} style={{ marginTop: 8 }}>
        <BlurView intensity={12} tint="dark" style={[styles.menuItem, { borderColor: 'rgba(244,68,68,0.2)' }]}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(244,68,68,0.12)' }]}>
            <Ionicons name="log-out-outline" size={20} color="#f44444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, { color: '#f44444' }]}>Logout</Text>
            <Text style={styles.menuDesc}>Keluar dari sesi ini</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Form Edit Profil
  // ─────────────────────────────────────────────────────────────────────────────
  const renderEditProfil = () => (
    <BlurView intensity={15} tint="dark" style={styles.formCard}>
      {profSuccess && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 13, flex: 1 }}>Profil berhasil diperbarui.</Text>
        </View>
      )}
      {!!profError && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={16} color="#f44444" />
          <Text style={{ color: '#f44444', fontSize: 12, flex: 1 }}>{profError}</Text>
        </View>
      )}

      {renderInput({ label: 'Nama Lengkap', value: fullName, onChange: setFullName })}
      {renderInput({
        label: 'Email', value: email, onChange: setEmail,
        keyboardType: 'email-address', autoCapitalize: 'none',
      })}

      {/* Role — read only */}
      <View style={{ marginBottom: 14 }}>
        <Text style={styles.inputLabel}>Role</Text>
        <View style={[styles.inputWrapper, { opacity: 0.5 }]}>
          <Text style={[styles.input, { lineHeight: 44, color: roleColor }]}>{roleLabel}</Text>
          <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.25)" style={{ marginRight: 12 }} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 4 }}>
          Role hanya bisa diubah oleh admin
        </Text>
      </View>

      <TouchableOpacity onPress={handleSaveProfil} disabled={saving} activeOpacity={0.82}>
        <LinearGradient
          colors={saving ? ['#1a1a2e', '#12121e'] : ['#60a5fa', '#3b82f6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.submitBtn}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.submitText}>SIMPAN PERUBAHAN</Text>
              </>
            )}
        </LinearGradient>
      </TouchableOpacity>
    </BlurView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Form Ganti Password
  // ─────────────────────────────────────────────────────────────────────────────
  const renderGantiPassword = () => (
    <BlurView intensity={15} tint="dark" style={styles.formCard}>
      {passSuccess && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 13, flex: 1 }}>Password berhasil diubah.</Text>
        </View>
      )}
      {!!passError && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={16} color="#f44444" />
          <Text style={{ color: '#f44444', fontSize: 12, flex: 1 }}>{passError}</Text>
        </View>
      )}

      {renderInput({
        label: 'Password Saat Ini', value: curPass, onChange: setCurPass,
        secure: !showCur, showToggle: true, onToggle: () => setShowCur(!showCur),
        autoCapitalize: 'none',
      })}
      {renderInput({
        label: 'Password Baru', value: newPass, onChange: setNewPass,
        secure: !showNew, showToggle: true, onToggle: () => setShowNew(!showNew),
        autoCapitalize: 'none',
      })}
      {renderInput({
        label: 'Konfirmasi Password Baru', value: confPass, onChange: setConfPass,
        secure: !showConf, showToggle: true, onToggle: () => setShowConf(!showConf),
        autoCapitalize: 'none',
      })}

      {/* Kekuatan password */}
      {newPass.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16, marginTop: -6 }}>
          {[6, 10, 14].map((threshold, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: newPass.length >= threshold
                  ? i === 0 ? '#f87171' : i === 1 ? '#fbbf24' : '#22c55e'
                  : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, alignSelf: 'center', marginLeft: 4 }}>
            {newPass.length < 6 ? 'Terlalu pendek' : newPass.length < 10 ? 'Lemah' : newPass.length < 14 ? 'Sedang' : 'Kuat'}
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={handleChangePassword} disabled={passLoading} activeOpacity={0.82}>
        <LinearGradient
          colors={passLoading ? ['#1a1a2e', '#12121e'] : ['#fbbf24', '#f59e0b']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.submitBtn}
        >
          {passLoading
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                <Text style={styles.submitText}>UBAH PASSWORD</Text>
              </>
            )}
        </LinearGradient>
      </TouchableOpacity>
    </BlurView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  const sectionTitle: Record<Section, string> = {
    menu: 'Profil',
    profil: 'Edit Profil',
    password: 'Ganti Password',
  };

  return (
    <LinearGradient colors={['#0f1117', '#13151e', '#0f1117']} style={{ flex: 1 }}>
      {/* Header */}
      <BlurView intensity={15} tint="dark" style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (section !== 'menu') { setSection('menu'); }
            else { router.back(); }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{sectionTitle[section]}</Text>
        <View style={{ width: 22 }} />
      </BlurView>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader()}

        {section === 'menu'     && renderMenu()}
        {section === 'profil'   && renderEditProfil()}
        {section === 'password' && renderGantiPassword()}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  avatarCard: {
    borderRadius: 16, overflow: 'hidden', padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 20, fontWeight: '800' },
  nameText:    { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  emailText:   { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  menuItem: {
    borderRadius: 14, overflow: 'hidden', padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  menuDesc:  { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },

  formCard: {
    borderRadius: 16, overflow: 'hidden', padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.45)', fontSize: 10,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  input: {
    flex: 1, height: 44, paddingHorizontal: 12,
    color: '#fff', fontSize: 14,
  },
  eyeBtn: { paddingHorizontal: 12, height: 44, alignItems: 'center', justifyContent: 'center' },

  submitBtn: {
    borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(244,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(244,68,68,0.3)',
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
});
