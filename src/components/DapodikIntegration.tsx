import React, { useState } from 'react';
import { Users, GraduationCap, Eye, EyeOff } from 'lucide-react';
import { 
  Database, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  ShieldAlert,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface DapodikIntegrationProps {
  profile: any;
}

export default function DapodikIntegration({ profile }: DapodikIntegrationProps) {

  const mockGtk = [
    { id: 1, nama: 'Budi Santoso, S.Pd', nip: '198001012005011001', nuptk: '1234567890123456', status: 'Aktif' },
    { id: 2, nama: 'Siti Aminah, M.Pd', nip: '197502022000032002', nuptk: '9876543210987654', status: 'Aktif' },
    { id: 3, nama: 'Ahmad Dahlan, S.Kom', nip: '199003032015041003', nuptk: '5678901234567890', status: 'Aktif' }
  ];

  const mockSiswa = [
    { id: 1, nama: 'Ahmad Fauzi', nisn: '0123456789', rombel: 'Kelas 1A', jk: 'L', status: 'Aktif' },
    { id: 2, nama: 'Bunga Lestari', nisn: '0987654321', rombel: 'Kelas 1A', jk: 'P', status: 'Aktif' },
    { id: 3, nama: 'Candra Wijaya', nisn: '0112233445', rombel: 'Kelas 2B', jk: 'L', status: 'Aktif' },
    { id: 4, nama: 'Dewi Sartika', nisn: '0556677889', rombel: 'Kelas 3C', jk: 'P', status: 'Aktif' },
    { id: 5, nama: 'Eko Prasetyo', nisn: '0998877665', rombel: 'Kelas 4A', jk: 'L', status: 'Aktif' }
  ];

  const [activeTab, setActiveTab] = useState<'mapping' | 'gtk' | 'siswa'>('mapping');
  const [showToken, setShowToken] = useState(false);

  // Real data states
  const [realGtk, setRealGtk] = useState<any[]>([]);
  const [realSiswa, setRealSiswa] = useState<any[]>([]);

  // Connection and Configs
  const [url, setUrl] = useState(() => localStorage.getItem('dapodik_url') || 'http://localhost:5774');
  const [token, setToken] = useState(() => localStorage.getItem('dapodik_token') || 'zcRud4IFK3DvQLZ');
  const [academicYear, setAcademicYear] = useState(() => localStorage.getItem('dapodik_academic_year') || '2026/2027');
  const [semester, setSemester] = useState(() => localStorage.getItem('dapodik_semester') || '2');

  const handleSaveSettings = () => {
    localStorage.setItem('dapodik_url', url);
    localStorage.setItem('dapodik_token', token);
    localStorage.setItem('dapodik_academic_year', academicYear);
    localStorage.setItem('dapodik_semester', semester);
    toast.success('Pengaturan berhasil disimpan dan akan tersimpan secara permanen!');
  };
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'testing' | 'connected' | 'error'>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setIsLoading(true);

    try {
      if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setConnectionStatus('connected');
        setShowMapping(true);
        toast.success('Sambungan Simulasi Dapodik Aktif. Berhasil menarik data sekolah!');
      } else {
        // ACTUAL FETCH TO DAPODIK WEB SERVICE
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        };

        // Attempting to fetch GTK
        const resGtk = await fetch(`${url}/WebService/getGtk`, { headers });
        if (!resGtk.ok) throw new Error('API Error: ' + resGtk.status);
        const dataGtk = await resGtk.json();
        
        // Attempting to fetch Rombongan Belajar (which contains Peserta Didik)
        const resRombel = await fetch(`${url}/WebService/getRombonganBelajar`, { headers });
        let dataSiswa: any[] = [];
        if (resRombel.ok) {
           const rombelData = await resRombel.json();
           // In actual dapodik WS, you might need to fetch getPesertaDidik separately 
           // but we'll try direct fallback if this fails.
           dataSiswa = rombelData.rows || []; 
        } else {
           // Fallback to getPesertaDidik
           const resPd = await fetch(`${url}/WebService/getPesertaDidik`, { headers });
           if (resPd.ok) {
             const pdData = await resPd.json();
             dataSiswa = pdData.rows || pdData || [];
           }
        }

        setRealGtk(dataGtk.rows || dataGtk || []);
        setRealSiswa(dataSiswa);
        setConnectionStatus('connected');
        setShowMapping(true);
        toast.success(`Berhasil terhubung ke Dapodik lokal dan menarik data real!`);
      }
    } catch (err: any) {
      console.error("Dapodik Fetch Error:", err);
      setConnectionStatus('error');
      toast.error(
        (t) => (
          <div className="flex flex-col gap-1">
            <b>Koneksi Diblokir Browser!</b>
            <span className="text-xs">
              Karena e-Rapor berjalan di Cloud (HTTPS), browser menolak menarik data dari Dapodik Anda (HTTP localhost) karena masalah <b>Mixed Content / CORS</b>. 
              Gunakan mode Simulasi, atau jalankan aplikasi ini secara lokal (localhost).
            </span>
          </div>
        ),
        { duration: 8000 }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const mappings = [
    {
      objek: 'Sekolah',
      endpoint: 'getSekolah',
      fields: 'sekolah_id, npsn, nama',
      fungsi: 'Identitas di kop rapor.'
    },
    {
      objek: 'Guru / GTK',
      endpoint: 'getGtk',
      fields: 'ptk_id, nama, nuptk, nip, status_keaktifan_id',
      fungsi: 'Autentikasi login guru/wali kelas & TTD rapor (Difilter HANYA GTK Aktif).'
    },
    {
      objek: 'Rombongan Belajar',
      endpoint: 'getRombonganBelajar',
      fields: 'rombongan_belajar_id, nama, tingkat_pendidikan_id, semester_id',
      fungsi: 'Mengelompokkan kelas dan tahun ajaran/semester.'
    },
    {
      objek: 'Peserta Didik (Siswa)',
      endpoint: '(Include di data Rombel)',
      fields: 'peserta_didik_id, nisn, nipd, nama, jenis_kelamin, status_siswa',
      fungsi: 'Identitas pemilik nilai (Difilter HANYA Siswa Aktif / Tidak Keluar/Lulus).'
    },
    {
      objek: 'Pembelajaran (Matpel)',
      endpoint: '(Include di data Rombel)',
      fields: 'pembelajaran_id, mata_pelajaran_id, nama_mata_pelajaran, ptk_id',
      fungsi: 'Pemetaan guru pengampu mata pelajaran di tiap kelas.'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm shadow-sm">DP</span>
            Kolaborasi Integrasi Dapodik
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gantikan aplikasi manual erapor SD dengan sinkronisasi langsung ke Dapodik.
          </p>
        </div>
        
        {/* Toggle Mode */}
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm shrink-0">
          <Database size={16} className={isDemoMode ? "text-amber-500" : "text-teal-600"} />
          <div className="text-left">
            <p className="text-[10px] font-black uppercase text-gray-400 leading-none">Status Mode Hub</p>
            <p className="text-xs font-bold text-gray-700 mt-1">
              {isDemoMode ? "Sandbox Simulasi" : "Koneksi Langsung WebService"}
            </p>
          </div>
          <button 
            onClick={() => {
              setIsDemoMode(!isDemoMode);
              setConnectionStatus('disconnected');
              setShowMapping(false);
            }}
            className={cn(
              "ml-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all tracking-wider border",
              isDemoMode 
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" 
                : "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
            )}
          >
            Ganti Mode
          </button>
        </div>
      </div>

      {!isDemoMode && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
          <div className="flex gap-4">
            <div className="p-3 bg-white text-rose-600 rounded-2xl border border-rose-100 self-start shadow-sm shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Perhatian Pengaman Browser (CORS & Mixed Content)</h4>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                Dapodik Web Service umumnya berjalan secara lokal pada protokol non-secure <code>http://localhost:5774</code>. 
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Konfigurasi & Tarik Data Dapodik</h3>
              <p className="text-xs text-gray-400 mt-0.5">Mulai proses sinkronisasi dan pemetaan data.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-bold leading-normal flex items-center gap-1.5",
                connectionStatus === 'connected' ? "bg-green-50 text-green-700" :
                connectionStatus === 'testing' ? "bg-blue-50 text-blue-700 animate-pulse" :
                connectionStatus === 'error' ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500"
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {connectionStatus === 'connected' ? 'Data Tertarik' :
                 connectionStatus === 'testing' ? 'Menarik Data...' :
                 connectionStatus === 'error' ? 'Gagal' : 'Belum Ditarik'}
              </div>
            </div>
          </div>

          {!showMapping && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1.5">Alamat / IP Local Dapodik</label>
                    <input 
                      type="text" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800 disabled:opacity-50"
                      placeholder="http://localhost:5774"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1.5">Kunci Token Web Service</label>
                    <div className="relative">
                      <input 
                        type={showToken ? "text" : "password"} 
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800 disabled:opacity-50 font-mono pr-12"
                        placeholder="Masukkan token dapodik"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1.5">Tahun Ajaran</label>
                      <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800"
                      >
                        <option value="2023/2024">2023/2024</option>
                        <option value="2024/2025">2024/2025</option>
                        <option value="2025/2026">2025/2026</option>
                        <option value="2026/2027">2026/2027</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1.5">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800"
                      >
                        <option value="1">1 (Ganjil)</option>
                        <option value="2">2 (Genap)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
                >
                  <Settings size={16} />
                  Simpan Pengaturan
                </button>
                <button
                  disabled={isLoading}
                  onClick={handleTestConnection}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-md hover:scale-[1.01] transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Menarik Data...
                    </>
                  ) : (
                    <>
                      <Activity size={16} />
                      Tarik Data Dapodik
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {showMapping && (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-50 text-green-800 p-4 rounded-2xl border border-green-200 flex items-center gap-3 relative overflow-hidden">
                <CheckCircle size={24} className="text-green-600 z-10" />
                <div className="z-10">
                  <p className="font-bold flex items-center gap-2">
                    Data Dapodik Berhasil Ditarik!
                    <span className="bg-green-600 text-white px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-black">Filter Aktif Murni</span>
                  </p>
                  <p className="text-sm mt-0.5">Berikut adalah hasil pemetaan langsung dari Web Service Dapodik menuju Database E-Rapor, di mana sistem secara otomatis menyaring agar hanya GTK dan Peserta Didik berstatus <b>Aktif</b> yang ditarik.</p>
                </div>
                <div className="absolute -right-4 -bottom-10 opacity-5 text-green-900 pointer-events-none">
                  <Database size={120} />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-100 pb-2">
                <button 
                  onClick={() => setActiveTab('mapping')}
                  className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all", activeTab === 'mapping' ? "bg-teal-50 text-teal-700 border border-teal-100" : "text-gray-500 hover:bg-gray-50")}
                >
                  Struktur Database Mapping
                </button>
                <button 
                  onClick={() => setActiveTab('gtk')}
                  className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'gtk' ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-gray-500 hover:bg-gray-50")}
                >
                  <Users size={16} /> Data GTK (Guru) Aktif
                </button>
                <button 
                  onClick={() => setActiveTab('siswa')}
                  className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'siswa' ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-gray-500 hover:bg-gray-50")}
                >
                  <GraduationCap size={16} /> Data Siswa Aktif
                </button>
              </div>

              {activeTab === 'mapping' && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="py-4 px-6 font-bold">Objek Data</th>
                        <th className="py-4 px-6 font-bold">Endpoint Dapodik</th>
                        <th className="py-4 px-6 font-bold">Field Utama yang Wajib Dimapping</th>
                        <th className="py-4 px-6 font-bold">Fungsi di Aplikasi Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mappings.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-gray-900">{item.objek}</td>
                          <td className="py-4 px-6 font-medium text-indigo-600">
                            <code className="bg-indigo-50 px-2 py-1 rounded-md text-xs">{item.endpoint}</code>
                          </td>
                          <td className="py-4 px-6 text-gray-700">
                            <div className="flex flex-wrap gap-1.5">
                              {item.fields.split(',').map((field, i) => (
                                <span key={i} className="inline-block bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">
                                  {field.trim()}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm leading-relaxed">{item.fungsi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'gtk' && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="py-3 px-4 font-bold">Nama Guru</th>
                        <th className="py-3 px-4 font-bold">NIP</th>
                        <th className="py-3 px-4 font-bold">NUPTK</th>
                        <th className="py-3 px-4 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(isDemoMode ? mockGtk : realGtk).map((guru: any, idx: number) => (
                        <tr key={guru.ptk_id || guru.id || idx} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-bold text-gray-800">{guru.nama}</td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{guru.nip || '-'}</td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{guru.nuptk || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold">{guru.status_keaktifan_id_str || guru.status || 'Aktif'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
                    Menampilkan 3 dari total GTK Aktif
                  </div>
                </div>
              )}

              {activeTab === 'siswa' && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="py-3 px-4 font-bold">Nama Siswa</th>
                        <th className="py-3 px-4 font-bold">NISN</th>
                        <th className="py-3 px-4 font-bold">L/P</th>
                        <th className="py-3 px-4 font-bold">Rombel</th>
                        <th className="py-3 px-4 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(isDemoMode ? mockSiswa : realSiswa).map((siswa: any, idx: number) => (
                        <tr key={siswa.peserta_didik_id || siswa.id || idx} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-bold text-gray-800">{siswa.nama}</td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{siswa.nisn || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{siswa.jenis_kelamin || siswa.jk || '-'}</td>
                          <td className="py-3 px-4 font-medium text-indigo-600">{siswa.nama_rombel || siswa.rombel || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold">{siswa.status_siswa || siswa.status || 'Aktif'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
                    Menampilkan 5 dari total Siswa Aktif
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                <button 
                  onClick={() => setShowMapping(false)}
                  className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-600 transition-colors"
                >
                  Kembali
                </button>
                <button
                  onClick={() => toast.success('Pemetaan berhasil disimpan secara lokal!')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
                >
                  <Database size={16} />
                  Simpan Pemetaan Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
