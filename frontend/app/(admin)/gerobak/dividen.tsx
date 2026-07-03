import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { TrendingUp, ChevronDown, ChevronUp, Check, AlertCircle, Receipt, BarChart2 } from 'lucide-react-native';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', letterSpacing: 0.5 };
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f44444', border: 'none', borderRadius: 10, padding: '9px 18px', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 13 };
const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function DividenAdminPage() {
  const qc = useQueryClient();
  const [expandedPreviewGrp, setExpandedPreviewGrp] = useState<number | null>(null);
  const [filterDari] = useState(firstOfMonth());
  const [filterSampai] = useState(todayStr());

  const [divForm, setDivForm] = useState({
    periode_label: '',
    periode_dari: firstOfMonth(),
    periode_sampai: todayStr(),
    catatan: '',
  });
  const [preview, setPreview] = useState<any>(null);
  const [divError, setDivError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const { data: rawGrup } = useQuery({
    queryKey: ['shareholder-groups'],
    queryFn: () => api.get('/gerobak/groups').then(r => r.data),
  });
  const { data: rawDividen } = useQuery({
    queryKey: ['dividen'],
    queryFn: () => api.get('/dividen/').then(r => r.data),
  });
  const { data: rawPengeluaran } = useQuery({
    queryKey: ['pengeluaran', filterDari, filterSampai],
    queryFn: () => api.get('/pengeluaran/', { params: { dari: filterDari, sampai: filterSampai } }).then(r => r.data),
  });

  const grupList: any[] = Array.isArray(rawGrup) ? rawGrup : [];
  const dividenList: any[] = Array.isArray(rawDividen) ? rawDividen : [];
  const pengeluaranList: any[] = Array.isArray(rawPengeluaran) ? rawPengeluaran : [];
  const totalPengeluaran = pengeluaranList.reduce((s: number, p: any) => s + Number(p.jumlah), 0);

  const previewMut = useMutation({
    mutationFn: (p: any) => api.post('/dividen/kalkulasi/preview', p).then(r => r.data),
    onSuccess: (data) => { setPreview(data); setConfirmed(false); setDivError(''); },
    onError: (e: any) => setDivError(e.response?.data?.detail ?? 'Gagal kalkulasi'),
  });
  const konfirmasiMut = useMutation({
    mutationFn: (p: any) => api.post('/dividen/kalkulasi/konfirmasi', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dividen'] }); setConfirmed(true); setPreview(null); },
    onError: (e: any) => setDivError(e.response?.data?.detail ?? 'Gagal konfirmasi'),
  });
  const bayarMut = useMutation({
    mutationFn: ({ id, tgl }: any) => api.patch(`/dividen/${id}/bayar`, { tanggal_bayar: tgl }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dividen'] }),
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Gagal bayar'),
  });

  const submitPreview = () => {
    setDivError('');
    if (!divForm.periode_label) { setDivError('Label periode wajib diisi'); return; }
    previewMut.mutate({
      periode_label: divForm.periode_label,
      periode_dari: divForm.periode_dari,
      periode_sampai: divForm.periode_sampai,
      catatan: divForm.catatan || null,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a' }}>
      <Navbar title="Dividen" />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <BarChart2 size={20} color="#f87171" />
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Kalkulasi & Distribusi Dividen</h1>
          </div>
          <p style={{ color: '#555', fontSize: 13, margin: 0 }}>{grupList.length} grup aktif · {dividenList.length} record distribusi</p>
        </div>

        {/* Pengeluaran banner */}
        {pengeluaranList.length > 0
          ? (
            <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={14} color="#d97706" />
                <span style={{ color: '#d97706', fontSize: 13 }}>
                  Pengeluaran manual ({fmtDate(filterDari)} – {fmtDate(filterSampai)}): <strong>{fmt(totalPengeluaran)}</strong>
                  &nbsp;&middot;&nbsp;Pembelian bahan baku dihitung otomatis dari PO.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertCircle size={14} color="#f87171" />
              <span style={{ color: '#f87171', fontSize: 13 }}>Belum ada pengeluaran manual di periode ini. Pembelian bahan baku tetap dihitung otomatis dari PO.</span>
            </div>
          )
        }

        {/* Form Kalkulasi */}
        <div style={{ ...card, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Kalkulasi Dividen</div>
          {divError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{divError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={lbl}>LABEL PERIODE</label>
              <input value={divForm.periode_label} onChange={e => setDivForm({ ...divForm, periode_label: e.target.value })} placeholder="Juli 2026" style={inp} />
            </div>
            <div>
              <label style={lbl}>DARI</label>
              <input type="date" value={divForm.periode_dari} onChange={e => setDivForm({ ...divForm, periode_dari: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>SAMPAI</label>
              <input type="date" value={divForm.periode_sampai} onChange={e => setDivForm({ ...divForm, periode_sampai: e.target.value })} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / 5' }}>
              <label style={lbl}>CATATAN (opsional)</label>
              <input value={divForm.catatan} onChange={e => setDivForm({ ...divForm, catatan: e.target.value })} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={submitPreview} disabled={previewMut.isPending} style={btnPrimary}>
              <TrendingUp size={14} color="white" /> {previewMut.isPending ? 'Menghitung...' : 'Hitung Preview'}
            </button>
            <span style={{ color: '#555', fontSize: 12 }}>
              Laba = Penjualan &minus; Pembelian PO &minus; Pengeluaran manual (<strong style={{ color: '#fbbf24' }}>{fmt(totalPengeluaran)}</strong>)
            </span>
          </div>
        </div>

        {/* Preview result */}
        {preview && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'white', fontWeight: 700 }}>Preview: {preview.periode_label}</span>
              <span style={{ color: '#888', fontSize: 12 }}>{preview.jumlah_grup} grup</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Total Penjualan',           value: fmt(preview.total_penjualan),    color: '#22c55e' },
                { label: 'Pembelian PO',              value: fmt(preview.total_pembelian),    color: '#f87171' },
                { label: 'Pengeluaran Manual',        value: fmt(preview.total_pengeluaran),  color: '#fbbf24' },
                { label: 'Total Biaya',               value: fmt(preview.total_biaya_global), color: '#fb923c' },
                { label: 'Beban / Grup',              value: fmt((preview.beban_pembelian_per_grup ?? 0) + (preview.beban_pengeluaran_per_grup ?? 0)), color: '#a78bfa' },
              ].map(k => (
                <div key={k.label} style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                  <div style={{ color: k.color, fontWeight: 700, fontSize: 14, marginTop: 4 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {preview.per_grup.map((g: any) => (
              <div key={g.group_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => setExpandedPreviewGrp(expandedPreviewGrp === g.group_id ? null : g.group_id)}
                >
                  <div>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{g.group_nama}</span>
                    <span style={{ color: '#555', fontSize: 12, marginLeft: 10 }}>{g.per_member.length} pemegang saham</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {[
                      { label: 'Penjualan', value: fmt(g.total_penjualan), color: '#22c55e' },
                      { label: 'Pembelian PO', value: fmt(g.total_pembelian_grup), color: '#f87171' },
                      { label: 'Pengeluaran', value: fmt(g.total_pengeluaran_grup), color: '#fbbf24' },
                      { label: 'Laba bersih', value: fmt(g.laba_bersih_grup), color: g.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171' },
                    ].map(col => (
                      <div key={col.label} style={{ textAlign: 'right' }}>
                        <div style={{ color: '#555', fontSize: 10 }}>{col.label}</div>
                        <div style={{ color: col.color, fontWeight: col.label === 'Laba bersih' ? 700 : 600, fontSize: col.label === 'Laba bersih' ? 14 : 13 }}>{col.value}</div>
                      </div>
                    ))}
                    {expandedPreviewGrp === g.group_id ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
                  </div>
                </div>
                {expandedPreviewGrp === g.group_id && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0 18px 12px' }}>
                    {g.per_member.length === 0
                      ? <div style={{ color: '#555', fontSize: 12, padding: '10px 0' }}>Tidak ada anggota dengan porsi saham</div>
                      : g.per_member.map((pm: any) => (
                        <div key={pm.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#f87171', fontWeight: 700 }}>
                              {pm.user_nama?.[0]?.toUpperCase()}
                            </div>
                            <span style={{ color: '#ccc', fontSize: 13 }}>{pm.user_nama}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                            <span style={{ color: '#f87171', fontSize: 13 }}>{pm.porsi_saham.toFixed(2)}%</span>
                            <span style={{ color: pm.jumlah_dividen > 0 ? '#fbbf24' : '#666', fontWeight: 700, fontSize: 14 }}>{fmt(pm.jumlah_dividen)}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}

            {!confirmed && (
              <div style={{ padding: '14px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setPreview(null)} style={btnGhost}>Batal</button>
                <button
                  onClick={() => konfirmasiMut.mutate({ ...divForm, catatan: divForm.catatan || null })}
                  disabled={konfirmasiMut.isPending}
                  style={{ ...btnPrimary, backgroundColor: '#16a34a' }}
                >
                  <Check size={14} color="white" />
                  {konfirmasiMut.isPending ? 'Menyimpan...' : 'Konfirmasi & Simpan'}
                </button>
              </div>
            )}
            {confirmed && (
              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 13 }}>
                <Check size={14} color="#22c55e" /> Distribusi dividen berhasil disimpan.
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div style={card}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, fontSize: 14 }}>History Dividen</div>
          {dividenList.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#444' }}>Belum ada distribusi dividen</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Periode', 'Grup', 'Pemegang Saham', 'Porsi', 'Penjualan', 'Total Beban', 'Laba Bersih', 'Dividen', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dividenList.map((d: any) => (
                    <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '11px 14px', color: '#aaa', fontSize: 13, whiteSpace: 'nowrap' }}>{d.periode_label}</td>
                      <td style={{ padding: '11px 14px', color: 'white', fontWeight: 600 }}>{d.group_nama}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(244,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#f87171', fontWeight: 700 }}>
                            {d.user_nama?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ color: '#ddd', fontSize: 13 }}>{d.user_nama}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#f87171', fontWeight: 700 }}>{parseFloat(d.porsi_saham).toFixed(2)}%</td>
                      <td style={{ padding: '11px 14px', color: '#22c55e', fontSize: 13 }}>{fmt(d.total_penjualan)}</td>
                      <td style={{ padding: '11px 14px', color: '#fb923c', fontSize: 13 }}>{fmt(d.total_beban_grup ?? d.total_pembelian)}</td>
                      <td style={{ padding: '11px 14px', color: d.laba_bersih_grup >= 0 ? '#22c55e' : '#f87171', fontSize: 13, fontWeight: 600 }}>{fmt(d.laba_bersih_grup)}</td>
                      <td style={{ padding: '11px 14px', color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{fmt(d.jumlah_dividen)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {d.status === 'dibayar'
                          ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', whiteSpace: 'nowrap' }}>Dibayar {fmtDate(d.tanggal_bayar)}</span>
                          : <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>Pending</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {d.status !== 'dibayar' && (
                          <button
                            onClick={() => { if (confirm(`Tandai dividen ${d.user_nama} (${d.periode_label}) sebagai dibayar?`)) bayarMut.mutate({ id: d.id, tgl: todayStr() }); }}
                            style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                          >Bayar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}
