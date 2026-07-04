"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

// ──── types ────────────────────────────────────────────────────────────────────────────────
interface User { id: number; full_name: string; role: string }
interface AbsensiRecord {
  id: number; tanggal: string; status: "hadir"|"izin"|"sakit"|"alpha";
  jam_masuk: string|null; jam_keluar: string|null; keterangan: string|null;
  latitude: number|null; longitude: number|null;
  jarak_meter: number|null; dalam_radius: boolean|null;
  foto_url: string|null;
  user: User; pencatat: User|null;
}
interface Rekap {
  tanggal: string; total: number; hadir: number; izin: number;
  sakit: number; alpha: number; di_luar_radius: number;
  records: AbsensiRecord[];
}
interface Setting {
  id: number; nama_lokasi: string; latitude: number; longitude: number;
  radius_meter: number; is_active: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  hadir: "bg-green-100 text-green-700",
  izin:  "bg-yellow-100 text-yellow-700",
  sakit: "bg-blue-100 text-blue-700",
  alpha: "bg-red-100 text-red-700",
};

function Toast({ msg, type, onClose }: { msg: string; type: "success"|"error"; onClose: ()=>void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
      type === "success" ? "bg-green-600" : "bg-red-600"
    }`}>
      {msg}
      <button className="ml-4 opacity-70 hover:opacity-100" onClick={onClose}>×</button>
    </div>
  );
}

// ──── komponen map kecil untuk memilih koordinat ────────────────────────────────────────────────
function MapPicker({ lat, lon, radius, onChange }: {
  lat: number; lon: number; radius: number;
  onChange: (lat: number, lon: number) => void;
}) {
  // Embed OpenStreetMap iframe — tidak butuh API key
  // Gunakan Leaflet via iframe sederhana dengan marker param
  const markerUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    lon - 0.005
  }%2C${lat - 0.005}%2C${lon + 0.005}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={markerUrl}
          width="100%"
          height="320"
          className="block"
          title="Peta Lokasi Absensi"
          loading="lazy"
        />
      </div>
      <p className="text-xs text-gray-500">
        Pin di peta di atas menampilkan koordinat yang tersimpan. Edit latitude/longitude di form untuk memindahkan pin.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Latitude</label>
          <input
            type="number" step="0.0000001" value={lat}
            onChange={e => onChange(parseFloat(e.target.value) || lat, lon)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Longitude</label>
          <input
            type="number" step="0.0000001" value={lon}
            onChange={e => onChange(lat, parseFloat(e.target.value) || lon)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Radius (meter)</label>
        <input
          type="range" min={10} max={1000} step={10} value={radius}
          className="flex-1 accent-blue-600"
          readOnly
        />
        <span className="text-sm font-bold text-blue-600 w-16 text-right">{radius} m</span>
      </div>
      <p className="text-xs text-gray-400">
        Tip: buka <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer" className="text-blue-500 underline">Google Maps</a> →
        klik kanan pada titik lokasi → salin koordinat ke form.
      </p>
    </div>
  );
}

// ──── modal setting ─────────────────────────────────────────────────────────────────────────────
function SettingModal({ data, onClose, onSaved }: {
  data: Partial<Setting>|null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState({
    nama_lokasi: data?.nama_lokasi ?? "",
    latitude:    data?.latitude    ?? -6.2,
    longitude:   data?.longitude   ?? 106.816,
    radius_meter: data?.radius_meter ?? 100,
    is_active:   data?.is_active   ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.nama_lokasi.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/absensi/settings/${data!.id}`, form);
      } else {
        await api.post("/absensi/settings", form);
      }
      onSaved(isEdit ? "Setting diperbarui" : "Lokasi absensi ditambahkan");
      onClose();
    } catch {
      onSaved("Gagal menyimpan setting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
          <h2 className="font-bold text-gray-800">{isEdit ? "Edit Lokasi Absensi" : "Tambah Lokasi Absensi"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Nama Lokasi</label>
            <input
              value={form.nama_lokasi}
              onChange={e => setForm(f => ({ ...f, nama_lokasi: e.target.value }))}
              placeholder="contoh: Kantor Pusat"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Titik Koordinat & Radius</label>
            <MapPicker
              lat={form.latitude} lon={form.longitude} radius={form.radius_meter}
              onChange={(lat, lon) => setForm(f => ({ ...f, latitude: lat, longitude: lon }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Radius (meter)</label>
            <input
              type="number" min={10} max={5000} value={form.radius_meter}
              onChange={e => setForm(f => ({ ...f, radius_meter: parseInt(e.target.value) || 100 }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="is_active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Lokasi aktif (digunakan untuk validasi)</label>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Batal
          </button>
          <button
            onClick={save} disabled={saving || !form.nama_lokasi.trim()}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── main page ───────────────────────────────────────────────────────────────────────────────
type Tab = "rekap" | "setting";

export default function AbsensiPage() {
  const [tab, setTab] = useState<Tab>("rekap");

  // — rekap state
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  const [rekap, setRekap] = useState<Rekap|null>(null);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [fotoModal, setFotoModal] = useState<string|null>(null);

  // — setting state
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loadingSetting, setLoadingSetting] = useState(false);
  const [settingModal, setSettingModal] = useState<Partial<Setting>|null|false>(false);
  const [deleteTarget, setDeleteTarget] = useState<Setting|null>(null);
  const [deleting, setDeleting] = useState(false);

  // — toast
  const [toast, setToast] = useState<{msg: string; type: "success"|"error"}|null>(null);
  const showToast = (msg: string, type: "success"|"error" = "success") => setToast({ msg, type });

  // —— fetch rekap
  async function fetchRekap(d: string) {
    setLoadingRekap(true);
    try {
      const { data } = await api.get(`/absensi/rekap?tanggal=${d}`);
      setRekap(data);
    } catch {
      showToast("Gagal memuat data absensi", "error");
    } finally {
      setLoadingRekap(false);
    }
  }

  // —— fetch settings
  async function fetchSettings() {
    setLoadingSetting(true);
    try {
      const { data } = await api.get("/absensi/settings");
      setSettings(data);
    } catch {
      showToast("Gagal memuat setting lokasi", "error");
    } finally {
      setLoadingSetting(false);
    }
  }

  useEffect(() => { fetchRekap(tanggal); }, [tanggal]);
  useEffect(() => { if (tab === "setting") fetchSettings(); }, [tab]);

  function shiftDate(days: number) {
    const d = new Date(tanggal);
    d.setDate(d.getDate() + days);
    setTanggal(d.toISOString().split("T")[0]);
  }

  async function hapusSetting() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/absensi/settings/${deleteTarget.id}`);
      showToast("Lokasi dihapus");
      setDeleteTarget(null);
      fetchSettings();
    } catch {
      showToast("Gagal menghapus lokasi", "error");
    } finally {
      setDeleting(false);
    }
  }

  const pct = rekap && rekap.total > 0 ? Math.round((rekap.hadir / rekap.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Absensi</h1>
        <div className="flex gap-2">
          {(["rekap", "setting"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}>
              {t === "rekap" ? "Rekap Harian" : "Setting Lokasi"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ──── TAB REKAP ──── */}
        {tab === "rekap" && (
          <div className="space-y-5">
            {/* Date nav */}
            <div className="flex items-center gap-3">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-full hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button onClick={() => shiftDate(1)} className="p-2 rounded-full hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
              <button onClick={() => setTanggal(new Date().toISOString().split("T")[0])}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                Hari Ini
              </button>
            </div>

            {/* Summary cards */}
            {rekap && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {([
                    { label: "Total",         val: rekap.total,         color: "bg-gray-700" },
                    { label: "Hadir",         val: rekap.hadir,         color: "bg-green-600" },
                    { label: "Izin/Sakit",    val: rekap.izin + rekap.sakit, color: "bg-yellow-500" },
                    { label: "Alpha",         val: rekap.alpha,         color: "bg-red-500" },
                    { label: "Di Luar Radius",val: rekap.di_luar_radius, color: "bg-orange-500" },
                  ] as {label: string; val: number; color: string}[]).map(c => (
                    <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border flex flex-col gap-1">
                      <span className="text-xs text-gray-500">{c.label}</span>
                      <span className={`text-2xl font-bold ${c.color.replace("bg-", "text-")}`}>{c.val}</span>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Kehadiran</span>
                    <span className="font-semibold text-green-600">{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </>
            )}

            {/* Tabel */}
            {loadingRekap ? (
              <div className="text-center py-16 text-gray-400">Memuat...</div>
            ) : !rekap || rekap.records.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Belum ada data absensi untuk tanggal ini.</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Nama","Role","Status","Jam Masuk","Jam Keluar","Radius","Jarak","Foto","Keterangan","Dicatat oleh"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rekap.records.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.user.full_name}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{r.user.role}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[r.status]}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.jam_masuk ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{r.jam_keluar ?? "—"}</td>
                          <td className="px-4 py-3">
                            {r.dalam_radius === null ? (
                              <span className="text-gray-400 text-xs">—</span>
                            ) : r.dalam_radius ? (
                              <span className="text-green-600 font-medium text-xs">✓ Dalam</span>
                            ) : (
                              <span className="text-red-500 font-medium text-xs">✗ Luar</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {r.jarak_meter != null ? `${r.jarak_meter} m` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {r.foto_url ? (
                              <button onClick={() => setFotoModal(r.foto_url!)}
                                className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={r.foto_url} alt="foto" className="w-full h-full object-cover" />
                              </button>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{r.keterangan ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{r.pencatat?.full_name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──── TAB SETTING ──── */}
        {tab === "setting" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Setting Lokasi Absensi</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tentukan titik koordinat dan radius toleransi. Karyawan harus berada dalam radius saat absen via mobile.
                </p>
              </div>
              <button
                onClick={() => setSettingModal({})}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                <span className="text-base leading-none">+</span> Tambah Lokasi
              </button>
            </div>

            {loadingSetting ? (
              <div className="text-center py-16 text-gray-400">Memuat...</div>
            ) : settings.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Belum ada lokasi absensi. Tambah lokasi terlebih dahulu.</div>
            ) : (
              <div className="grid gap-4">
                {settings.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="flex items-start justify-between px-5 pt-4 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{s.nama_lokasi}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>{s.is_active ? "Aktif" : "Nonaktif"}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {s.latitude}, {s.longitude} — radius <strong>{s.radius_meter} m</strong>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSettingModal(s)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >Edit</button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                        >Hapus</button>
                      </div>
                    </div>
                    {/* Map embed preview */}
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                        s.longitude - 0.004
                      }%2C${s.latitude - 0.004}%2C${s.longitude + 0.004}%2C${s.latitude + 0.004}&layer=mapnik&marker=${s.latitude}%2C${s.longitude}`}
                      width="100%" height="200"
                      className="block border-t border-gray-100"
                      title={`Peta ${s.nama_lokasi}`}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal foto preview */}
      {fotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setFotoModal(null)}>
          <div className="relative max-w-sm w-full mx-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoModal} alt="Foto Absensi" className="w-full rounded-2xl shadow-2xl" />
            <button
              onClick={() => setFotoModal(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full w-8 h-8 flex items-center justify-center shadow-lg text-sm font-bold hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}

      {/* Modal setting */}
      {settingModal !== false && (
        <SettingModal
          data={settingModal || {}}
          onClose={() => setSettingModal(false)}
          onSaved={(msg) => { showToast(msg); fetchSettings(); setSettingModal(false); }}
        />
      )}

      {/* Modal konfirmasi hapus setting */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-800 mb-1">Hapus Lokasi?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Lokasi <strong>{deleteTarget.nama_lokasi}</strong> akan dihapus permanen.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={hapusSetting} disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
