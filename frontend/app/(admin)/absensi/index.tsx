import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import {
  CalendarDays, UserCheck, UserX, Clock, AlertCircle,
  CheckCircle, X, ChevronLeft, ChevronRight, MapPin, Eye,
} from 'lucide-react-native';

// ── helpers WIB (Asia/Jakarta = UTC+7) ────────────────────────────────────
/** Kembalikan string 'YYYY-MM-DD' dari objek Date sesuai timezone WIB */
const toISOWIB = (d: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(d);

/** Tanggal hari ini dalam WIB */
const today = (): string => toISOWIB(new Date());

/** Tambah/kurangi n hari dari string 'YYYY-MM-DD', tetap dalam WIB */
const addDays = (iso: string, n: number): string => {
  // parse tanggal sebagai waktu lokal WIB tengah hari supaya DST-safe
  const d = new Date(`${iso}T12:00:00+07:00`);
  d.setDate(d.getDate() + n);
  return toISOWIB(d);
};

/** Format tanggal panjang WIB untuk tampilan, mis: "Kamis, 09 Juli 2026" */
const formatTanggalWIB = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${iso}T12:00:00+07:00`));

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  hadir: { label: 'Hadir',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: <UserCheck size={13} color="#22c55e" /> },
  izin:  { label: 'Izin',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: <CalendarDays size={13} color="#60a5fa" /> },
  sakit: { label: 'Sakit',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  icon: <AlertCircle size={13} color="#fbbf24" /> },
  alpha: { label: 'Alpha',   color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: <UserX size={13} color="#f87171" /> },
};

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };

// ── Toast ──────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error';
interface Toast { id: number; type: ToastType; message: string; }
let _tid = Date.now();
function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const show = (type: ToastType, message: string) => {
    const id = _tid++;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, show, remove: (id: number) => setToasts(p => p.filter(t => t.id !== id)) };
}
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.type === 'success' ? 'rgba(22,163,74,0.95)' : 'rgba(220,38,38,0.95)', border: `1px solid ${t.type === 'success' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`, borderRadius: 10, padding: '11px 16px', color: 'white', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', pointerEvents: 'auto', minWidth: 260 }}>
          {t.type === 'success' ? <CheckCircle size={15} color="white" /> : <AlertCircle size={15} color="white" />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.7 }}><X size={13} color="white" /></button>
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────
interface AbsensiRecord {
  id: number; tanggal: string; status: string;
  jam_masuk: string | null; jam_keluar: string | null; keterangan: string | null;
  user: { id: number; full_name: string; role: string };
  pencatat: { id: number; full_name: string } | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  foto_url?: string | null;
  foto_keluar_url?: string | null;
}
interface Rekap {
  tanggal: string; total: number; hadir: number; izin: number; sakit: number; alpha: number;
  records: AbsensiRecord[];
}

// ── helpers foto ──────────────────────────────────────────────────────────
const toImgSrc = (raw: string) =>
  raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;

// ── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: AbsensiRecord; onClose: () => void }) {
  const s = STATUS_META[record.status] ?? STATUS_META.alpha;
  const hasLocation = record.latitude != null && record.longitude != null;
  const mapUrl = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${record.longitude! - 0.003}%2C${record.latitude! - 0.003}%2C${record.longitude! + 0.003}%2C${record.latitude! + 0.003}&layer=mapnik&marker=${record.latitude}%2C${record.longitude}`
    : null;
  const mapsLink = hasLocation
    ? `https://www.google.com/maps?q=${record.latitude},${record.longitude}`
    : null;

  const hasFotoMasuk  = !!record.foto_url;
  const hasFotoKeluar = !!record.foto_keluar_url;
  const showFotoGrid  = hasFotoMasuk || hasFotoKeluar;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={18} color="#60a5fa" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Detail Absensi</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={17} color="#555" /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Karyawan info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(96,165,250,0.15)', border: '2px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 18 }}>{record.user.full_name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{record.user.full_name}</div>
              <div style={{ color: '#888', fontSize: 12, textTransform: 'capitalize', marginTop: 2 }}>{record.user.role}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
                {s.icon} {s.label}
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              // ✅ Gunakan formatTanggalWIB agar tanggal tidak mundur 1 hari
              { label: 'Tanggal', value: formatTanggalWIB(record.tanggal) },
              { label: 'Dicatat Oleh', value: record.pencatat?.full_name ?? '—' },
              { label: 'Jam Masuk', value: record.jam_masuk ? record.jam_masuk.slice(0, 5) : '—' },
              { label: 'Jam Keluar', value: record.jam_keluar ? record.jam_keluar.slice(0, 5) : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Keterangan */}
          {record.keterangan && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Keterangan</div>
              <div style={{ color: '#ccc', fontSize: 13 }}>{record.keterangan}</div>
            </div>
          )}

          {/* Foto Masuk & Foto Keluar */}
          {showFotoGrid && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: hasFotoMasuk && hasFotoKeluar ? '1fr 1fr' : '1fr',
              gap: 12,
            }}>
              {/* Foto Masuk */}
              {hasFotoMasuk && (
                <div>
                  <div style={{ color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Foto Masuk</div>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img
                      src={toImgSrc(record.foto_url!)}
                      alt="Foto masuk"
                      style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                </div>
              )}
              {/* Foto Keluar */}
              {hasFotoKeluar && (
                <div>
                  <div style={{ color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Foto Keluar</div>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img
                      src={toImgSrc(record.foto_keluar_url!)}
                      alt="Foto keluar"
                      style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                </div>
              )}
              {/* Placeholder jika masuk ada tapi keluar belum */}
              {hasFotoMasuk && !hasFotoKeluar && (
                <div>
                  <div style={{ color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Foto Keluar</div>
                  <div style={{ borderRadius: 10, border: '1px dashed rgba(255,255,255,0.1)', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#444', fontSize: 12 }}>Belum absen pulang</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <MapPin size={11} color="#666" /> Lokasi Absensi
              </div>
              {mapsLink && (
                <a href={mapsLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>Buka di Google Maps ↗</a>
              )}
            </div>
            {mapUrl ? (
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: 220 }}>
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="220"
                  style={{ border: 0, display: 'block' }}
                  title="Lokasi Absensi"
                  loading="lazy"
                />
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '28px 14px', textAlign: 'center' }}>
                <MapPin size={24} color="#333" style={{ marginBottom: 8 }} />
                <div style={{ color: '#555', fontSize: 13 }}>Data lokasi tidak tersedia</div>
              </div>
            )}
            {hasLocation && (
              <div style={{ marginTop: 6, color: '#555', fontSize: 11 }}>
                {record.latitude?.toFixed(6)}, {record.longitude?.toFixed(6)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AbsensiMonitorPage() {
  const qc = useQueryClient();
  const { toasts, show: showToast, remove: removeToast } = useToast();

  const [tanggal, setTanggal] = useState(today());

  // form catat absensi
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ user_id: '', tanggal, status: 'hadir', jam_masuk: '', jam_keluar: '', keterangan: '' });

  // edit modal
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ status: 'hadir', jam_masuk: '', jam_keluar: '', keterangan: '' });

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // detail modal
  const [detailRecord, setDetailRecord] = useState<AbsensiRecord | null>(null);

  // ── Queries
  const { data: rekap, isLoading } = useQuery<Rekap>({
    queryKey: ['absensi-rekap', tanggal],
    queryFn: () => api.get('/absensi/rekap', { params: { tanggal } }).then(r => r.data),
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then(r => r.data),
  });

  // ── Mutations
  const createM = useMutation({
    mutationFn: (p: any) => api.post('/absensi/', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absensi-rekap'] }); setShowForm(false); setFormError(''); showToast('success', 'Absensi berhasil dicatat'); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? 'Gagal menyimpan'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, p }: any) => api.patch(`/absensi/${id}`, p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absensi-rekap'] }); setEditId(null); showToast('success', 'Absensi diperbarui'); },
    onError: (e: any) => showToast('error', e.response?.data?.detail ?? 'Gagal memperbarui'),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/absensi/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absensi-rekap'] }); setDeleteTarget(null); showToast('success', 'Absensi dihapus'); },
    onError: (e: any) => { setDeleteTarget(null); showToast('error', e.response?.data?.detail ?? 'Gagal menghapus'); },
  });

  const submitCreate = () => {
    if (!form.user_id) { setFormError('Pilih pengguna terlebih dahulu'); return; }
    createM.mutate({
      user_id: Number(form.user_id),
      tanggal: form.tanggal,
      status: form.status,
      jam_masuk: form.jam_masuk || null,
      jam_keluar: form.jam_keluar || null,
      keterangan: form.keterangan || null,
    });
  };

  const openEdit = (r: AbsensiRecord) => {
    setEditId(r.id);
    setEditForm({ status: r.status, jam_masuk: r.jam_masuk ?? '', jam_keluar: r.jam_keluar ?? '', keterangan: r.keterangan ?? '' });
  };

  const hadir   = rekap?.hadir   ?? 0;
  const izin    = rekap?.izin    ?? 0;
  const sakit   = rekap?.sakit   ?? 0;
  const alpha   = rekap?.alpha   ?? 0;
  const total   = rekap?.total   ?? 0;
  const records = rekap?.records ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Absensi" />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <CalendarDays size={20} color="#60a5fa" />
              <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Monitoring Absensi</h1>
            </div>
            <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Pantau kehadiran semua karyawan per hari</p>
          </div>
          <button onClick={() => { setShowForm(true); setForm(f => ({ ...f, tanggal })); setFormError(''); }} style={btnPrimary}>
            + Catat Absensi
          </button>
        </div>

        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setTanggal(d => addDays(d, -1))} style={{ ...btnGhost, padding: '8px 10px' }}>
            <ChevronLeft size={15} color="#aaa" />
          </button>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
            style={{ ...inp, width: 160, cursor: 'pointer' }} />
          <button onClick={() => setTanggal(d => addDays(d, 1))} style={{ ...btnGhost, padding: '8px 10px' }}>
            <ChevronRight size={15} color="#aaa" />
          </button>
          {tanggal !== today() && (
            <button onClick={() => setTanggal(today())} style={{ ...btnGhost, fontSize: 12 }}>Hari Ini</button>
          )}
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Karyawan', value: total,  color: 'white' },
            { label: 'Hadir',          value: hadir,  color: '#22c55e' },
            { label: 'Izin / Sakit',   value: izin + sakit, color: '#fbbf24' },
            { label: 'Alpha',          value: alpha,  color: '#f87171' },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{k.label}</div>
              <div style={{ color: k.color, fontWeight: 700, fontSize: 22 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar kehadiran */}
        {total > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#888', fontSize: 12 }}>Tingkat kehadiran</span>
              <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>{Math.round(hadir / total * 100)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hadir / total * 100}%`, background: '#22c55e', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Table */}
        <div style={card}>
          {isLoading
            ? <div style={{ padding: 48, textAlign: 'center', color: '#555' }}>Memuat...</div>
            : records.length === 0
              ? <div style={{ padding: 48, textAlign: 'center', color: '#444' }}>Belum ada data absensi untuk tanggal ini</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Karyawan', 'Role', 'Status', 'Jam Masuk', 'Jam Keluar', 'Keterangan', 'Dicatat Oleh', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => {
                      const s = STATUS_META[r.status] ?? STATUS_META.alpha;
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{r.user.full_name}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#888', fontSize: 12 }}>{r.user.role}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
                              {s.icon} {s.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {r.jam_masuk
                              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#aaa', fontSize: 13 }}><Clock size={11} color="#555" />{r.jam_masuk.slice(0,5)}</span>
                              : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {r.jam_keluar
                              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#aaa', fontSize: 13 }}><Clock size={11} color="#555" />{r.jam_keluar.slice(0,5)}</span>
                              : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#888', fontSize: 12, maxWidth: 180 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {r.keterangan || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#666', fontSize: 12 }}>{r.pencatat?.full_name ?? '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setDetailRecord(r)} title="Detail" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', cursor: 'pointer', fontSize: 11, color: '#60a5fa' }}>
                                <Eye size={11} color="#60a5fa" /> Detail
                              </button>
                              <button onClick={() => openEdit(r)} title="Edit" style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 11, color: '#aaa' }}>Edit</button>
                              <button onClick={() => setDeleteTarget({ id: r.id, name: r.user.full_name })} title="Hapus" style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
                                <X size={11} color="#f87171" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
        </div>
      </div>

      {/* ══ Modal: Detail Absensi */}
      {detailRecord && <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}

      {/* ══ Modal: Catat Absensi */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Catat Absensi</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            {formError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{formError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>KARYAWAN *</label>
                <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a1a1a' }}>-- Pilih Karyawan --</option>
                  {users.map((u: any) => <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>{u.full_name} ({u.role})</option>)}
                </select>
              </div>
              <div><label style={lbl}>TANGGAL *</label><input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} style={inp} /></div>
              <div>
                <label style={lbl}>STATUS *</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#1a1a1a' }}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>JAM MASUK</label><input type="time" value={form.jam_masuk} onChange={e => setForm({ ...form, jam_masuk: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>JAM KELUAR</label><input type="time" value={form.jam_keluar} onChange={e => setForm({ ...form, jam_keluar: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>KETERANGAN</label><input value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Opsional" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button onClick={submitCreate} disabled={createM.isPending} style={btnPrimary}>
                {createM.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Edit Absensi */}
      {editId !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 28, width: 420, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Edit Absensi</span>
              <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color="#555" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>STATUS</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#1a1a1a' }}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>JAM MASUK</label><input type="time" value={editForm.jam_masuk} onChange={e => setEditForm({ ...editForm, jam_masuk: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>JAM KELUAR</label><input type="time" value={editForm.jam_keluar} onChange={e => setEditForm({ ...editForm, jam_keluar: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>KETERANGAN</label><input value={editForm.keterangan} onChange={e => setEditForm({ ...editForm, keterangan: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditId(null)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>Batal</button>
              <button onClick={() => updateM.mutate({ id: editId, p: { status: editForm.status, jam_masuk: editForm.jam_masuk || null, jam_keluar: editForm.jam_keluar || null, keterangan: editForm.keterangan || null } })} disabled={updateM.isPending} style={btnPrimary}>
                {updateM.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Konfirmasi Hapus */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: 28, width: 380, maxWidth: '92vw' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Hapus Absensi</p>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 4 }}>Hapus catatan absensi <strong style={{ color: 'white' }}>{deleteTarget.name}</strong>?</p>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 22 }}>Tindakan ini tidak bisa dibatalkan.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 }} disabled={deleteM.isPending}>Batal</button>
              <button onClick={() => deleteM.mutate(deleteTarget.id)} disabled={deleteM.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#dc2626', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', minWidth: 100, justifyContent: 'center' }}>
                {deleteM.isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
