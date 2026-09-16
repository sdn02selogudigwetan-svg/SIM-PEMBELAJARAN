const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, TeachingDocument } from '../../types';
import { BookMarked, ChevronLeft, Save, Loader2, Sparkles, Printer, CheckSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { formatSubjectName, formatSchoolName } from '../../lib/utils';

interface ModulAjarGeneratorProps {
  profile: Profile;
  onBack: () => void;
  onSave?: (data: any) => void;
}

const DIMENSI_LULUSAN = [
  'Keimanan & Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi'
];

const PEDAGOGIS_OPTIONS = [
  'Inkuiri-Discovery',
  'PjBL',
  'Problem Solving',
  'Game Based Learning',
  'Station Learning'
];

export default function ModulAjarGenerator({ profile, onBack, onSave }: ModulAjarGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [promesDocs, setPromesDocs] = useState<TeachingDocument[]>([]);
  
  const [selectedPromesId, setSelectedPromesId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedFase, setSelectedFase] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState<string>('');
  const [praktikPedagogis, setPraktikPedagogis] = useState<string>('');
  const [selectedDimensi, setSelectedDimensi] = useState<string[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedModul, setGeneratedModul] = useState<string>('');

  const [settings, setSettings] = useState<any>(null);
  const [allTeachers, setAllTeachers] = useState<Profile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(profile.id || '');
  const [printPlace, setPrintPlace] = useState('Karanggeger');
  const [printDate, setPrintDate] = useState('20 Juni 2026');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, 'teaching_documents'), where('type', '==', 'PROMES'));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeachingDocument));
        setPromesDocs(docs);

        const { doc, getDoc } = await import('firebase/firestore');
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }

        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'TEACHER'));
        const teachersSnap = await getDocs(teachersQuery);
        setAllTeachers(teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)));

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePromesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromesId(id);
    const doc = promesDocs.find(d => d.id === id);
    if (doc) {
      if (doc.content?.subject) setSelectedSubject(doc.content.subject);
      if (doc.content?.fase) setSelectedFase(doc.content.fase);
      if (doc.content?.class) setSelectedClass(doc.content.class);
    }
  };

  const toggleDimensi = (dimensi: string) => {
    setSelectedDimensi(prev => 
      prev.includes(dimensi) 
        ? prev.filter(d => d !== dimensi) 
        : [...prev, dimensi]
    );
  };

  const handleGenerate = async () => {
    if (!selectedFase || !selectedClass || !selectedSubject || !selectedPromesId || !tujuanPembelajaran || !praktikPedagogis || selectedDimensi.length === 0) {
      return toast.error('Lengkapi semua form terlebih dahulu');
    }

    const selectedPromes = promesDocs.find(d => d.id === selectedPromesId);
    if (!selectedPromes) return toast.error('PROMES tidak valid');

    setIsGenerating(true);
    try {
      // @ts-ignore
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY);
      if (!apiKey) throw new Error('API key tidak ditemukan');

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const prompt = \`Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar (Deep Learning) dalam bentuk tabel spreadsheet rapi.

Informasi Dasar:
- Mata Pelajaran: \${selectedSubject}
- Fase: \${selectedFase}
- Kelas: \${selectedClass}
- Tahun Ajaran: \${selectedPromes.content?.schoolYear || '-'}

Data PROMES Referensi:
"""
\${selectedPromes.content?.content || 'Tidak ada konten PROMES'}
"""

Fokus Pembelajaran (Tujuan Pembelajaran, Alokasi Waktu (JP), & Pertemuan) yang dipilih:
"\${tujuanPembelajaran}" (Catatan: Tujuan pembelajaran, alokasi waktu JP, dan jumlah pertemuan pada hasil modul ajar harus sama persis dengan informasi ini yang merujuk pada file prosem).

Praktik Pedagogis per Pertemuan: \${praktikPedagogis}
Dimensi Lulusan (Profil Pelajar Pancasila): \${selectedDimensi.join(', ')}

Instruksi Pembuatan Modul Ajar:
Output harus berupa rencana pembelajaran terstruktur dengan 5 bagian utama dalam bentuk tabel HTML murni (bukan Markdown biasa) dengan struktur spreadsheet yang rapi.
Format tulisan rata kanan kiri (justify) sesuai dengan ejaan bahasa Indonesia yang baik dan benar.

Gunakan tag <table>, <thead>, <tbody>, <tr>, <th>, <td>. Jangan bungkus output dengan backtick \`\`\`html.

BAGIAN 1: Identitas
- Nama Satuan Pendidikan (kosongi saja/beri titik-titik)
- Mata Pelajaran (\${selectedSubject})
- Kelas/Semester (\${selectedClass})
- Durasi Pertemuan (sesuai tujuan pembelajaran yang dipilih di atas)

BAGIAN 2: Identifikasi
- Siswa (generated otomatis sesuai konteks kelas)
- Materi Pelajaran (sesuai TP)
- Capaian Dimensi Lulusan (\${selectedDimensi.join(', ')})

BAGIAN 3: Desain Pembelajaran
- Capaian Pembelajaran (sesuaikan)
- Rencana Asesmen (asesmen formatif dan asesmen sumatif)
- Lintas Disiplin Ilmu (generate otomatis)
- Tujuan Pembelajaran (sesuai TP di atas)
- Topik Pembelajaran (disesuaikan oleh AI)
- Praktik Pedagogis per Pertemuan (\${praktikPedagogis})
- Kemitraan Pembelajaran (generate otomatis)
- Lingkungan Pembelajaran (generate otomatis)
- Pemanfaatan Digital (generate otomatis beserta referensi tools online yang sesuai)

BAGIAN 4: Pengalaman Belajar
Buatkan rincian kegiatan pembelajaran yang memuat:
- Memahami (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuaikan langkah dalam kegiatan awal.
- Mengaplikasi (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuai kegiatan inti berdasarkan sintaks praktik pedagogis (\${praktikPedagogis}).
- Refleksi (berkesadaran, bermakna, menggembirakan) -> generated otomatis sesuai langkah penutup.

BAGIAN 5: Asesmen Pembelajaran & LKPD Lengkap
Didalamnya memuat:
- Asesmen Awal (diagnostik/apersepsi) generated otomatis
- Asesmen Proses (observasi, rubrik, diskusi) generated otomatis
- Asesmen Akhir (produk, tugas, presentasi, portofolio) generated otomatis pada pertemuan terakhir.

Pastikan output menggunakan <table> HTML murni yang rapi dan terstruktur, bisa digabung menggunakan rowspan/colspan jika diperlukan.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });
      
      setGeneratedModul(response.text || '');
      toast.success('Modul Ajar berhasil dirumuskan');
    } catch (error) {
      console.error('Generative AI Error:', error);
      toast.error('Gagal menghasilkan Modul Ajar');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    try {
      const printContent = document.getElementById('modul-print-area');
      if (!printContent) {
        window.print();
        return;
      }
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Gagal membuka jendela cetak. Pastikan pop-up tidak diblokir.');
        return;
      }
      
      printWindow.document.write(\`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Modul Ajar - Print</title>
          <style>
            @page { size: portrait; margin: 15mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            body { 
              font-family: Arial, sans-serif;
              padding: 20px;
              color: black;
              background: white;
            }
            #modul-print-area {
              max-width: 100%;
            }
            .markdown-body {
              font-size: 14px;
              line-height: 1.6;
              text-align: justify;
            }
            .markdown-body table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .markdown-body th, .markdown-body td {
              border: 1px solid #000;
              padding: 6px;
              font-size: 12px;
              vertical-align: top;
            }
            .markdown-body th {
              background-color: #f3f4f6 !important;
              font-weight: bold;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div id="modul-print-area">
            <div class="markdown-body">
              \${printContent.innerHTML}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function(){ window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      \`);
      printWindow.document.close();
    } catch (err) {
      console.error("Print failed:", err);
      window.print();
    }
  };

  const handleSaveDraft = () => {
    if (!generatedModul || !selectedSubject || !selectedFase) return;
    if (onSave) {
      const selectedPromes = promesDocs.find(d => d.id === selectedPromesId);
      onSave({
        subject: selectedSubject,
        fase: selectedFase,
        class: selectedClass,
        schoolYear: selectedPromes?.content?.schoolYear || '',
        content: generatedModul,
        title: \`Modul Ajar \${formatSubjectName(selectedSubject)} - \${selectedClass}\`
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat data PROMES...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-bold transition-colors"
        >
          <ChevronLeft size={20} />
          Kembali
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <BookMarked size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Form Modul Ajar (Deep Learning)</h3>
                <p className="text-sm text-gray-500">Buat Modul Ajar berdasarkan PROMES tersimpan</p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pilih PROMES Acuan</label>
              <select
                value={selectedPromesId}
                onChange={handlePromesChange}
                className="w-full bg-slate-50 border-0 px-4 py-3 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none cursor-pointer"
              >
                <option value="">-- Pilih PROMES --</option>
                {promesDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} {doc.content?.schoolYear ? \`(\${doc.content.schoolYear})\` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedPromesId && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Fase</label>
                    <input
                      type="text"
                      value={selectedFase}
                      onChange={(e) => setSelectedFase(e.target.value)}
                      className="w-full bg-slate-50 border-0 px-4 py-3 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kelas</label>
                    <input
                      type="text"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full bg-slate-50 border-0 px-4 py-3 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-slate-50 border-0 px-4 py-3 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tujuan Pembelajaran (dari PROMES)</label>
                  <textarea
                    value={tujuanPembelajaran}
                    onChange={(e) => setTujuanPembelajaran(e.target.value)}
                    placeholder="Contoh: Peserta didik mampu menjelaskan proses fotosintesis (12 JP / 4 Pertemuan)"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-medium h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Praktik Pedagogis</label>
                  <textarea
                    value={praktikPedagogis}
                    onChange={(e) => setPraktikPedagogis(e.target.value)}
                    placeholder="Contoh: Pertemuan 1: PjBL, Pertemuan 2: Game Based Learning"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-medium h-24 resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Opsi: Inkuiri-Discovery, PjBL, Problem Solving, Game Based Learning, Station Learning</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Dimensi Lulusan (Multi)</label>
                  <div className="flex flex-wrap gap-2">
                    {DIMENSI_LULUSAN.map(dimensi => (
                      <button
                        key={dimensi}
                        onClick={() => toggleDimensi(dimensi)}
                        className={\`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 \${selectedDimensi.includes(dimensi) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                      >
                        {selectedDimensi.includes(dimensi) && <CheckSquare size={12} />}
                        {dimensi}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedSubject || !selectedFase || !selectedClass || !selectedPromesId || !tujuanPembelajaran || !praktikPedagogis || selectedDimensi.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Merumuskan Modul Ajar...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate Modul Ajar
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-3xl">
              <h3 className="font-bold text-gray-900 text-sm">Hasil Modul Ajar</h3>
              {generatedModul && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                  >
                    <Printer size={16} />
                    Review Cetak
                  </button>
                  <button 
                    onClick={handleSaveDraft}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Save size={16} />
                    Simpan Draft
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 bg-gray-200/50 rounded-b-3xl relative overflow-hidden hidden-scrollbar">
              {!generatedModul ? (
                <div className="p-8 h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4 bg-white">
                  <BookMarked size={48} className="opacity-20" />
                  <div>
                    <p className="font-medium text-gray-500 mb-1">Belum ada Modul Ajar yang dirumuskan</p>
                    <p className="text-sm">Lengkapi form di samping untuk mulai generate.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full bg-gray-100">
                  <div className="bg-white p-4 border-b border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-end print:hidden shrink-0">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Guru / Pengampu</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">-- Pilih Guru --</option>
                        {allTeachers.map(t => (
                          <option key={t.id} value={t.id}>{t.full_name}</option>
                        ))}
                        {!allTeachers.find(t => t.id === profile.id) && (
                          <option value={profile.id}>{profile.full_name}</option>
                        )}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Tempat TTD</label>
                      <input
                        type="text"
                        value={printPlace}
                        onChange={(e) => setPrintPlace(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal TTD</label>
                      <input
                        type="text"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-100 flex justify-center">
                    <div id="modul-print-area" className="bg-white shadow-md ring-1 ring-black/5 w-full max-w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] print:shadow-none print:ring-0 print:p-0 print:w-auto print:min-h-0 text-black font-sans 
                      prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-justify prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-black prose-td:px-2 prose-td:py-1.5 prose-td:align-top prose-td:text-xs prose-th:border prose-th:border-black prose-th:px-2 prose-th:py-1.5 prose-th:align-top prose-th:bg-gray-50 prose-th:text-xs prose-th:text-center markdown-body overflow-x-auto text-justify">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', pageBreakInside: 'avoid', width: '100%' }} className="not-prose">
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.25rem', lineHeight: 1.2, textAlign: 'center' }}>Modul Ajar (Deep Learning)</h1>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Mata Pelajaran: {selectedSubject ? formatSubjectName(selectedSubject) : '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Fase / Kelas: {selectedFase || '-'} / {selectedClass || '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Tahun Ajaran: {promesDocs.find(d => d.id === selectedPromesId)?.content?.schoolYear || '-'}</p>
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{generatedModul}</ReactMarkdown>
                      
                      {/* SIGNATURE SECTION */}
                      <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0 1rem', fontSize: '12px', textAlign: 'center', fontFamily: 'sans-serif', pageBreakInside: 'avoid', width: '100%' }} className="not-prose text-black">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: '1rem' }}>
                          <span style={{ fontWeight: 'normal', minHeight: '18px' }}>Mengetahui,</span>
                          <span style={{ fontWeight: 'normal', minHeight: '18px' }}>Kepala {formatSchoolName(settings?.school_name?.replace('UPT', 'UPT.') || 'Sekolah')}</span>
                          <div style={{ height: '5rem' }} />
                          <span style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>{settings?.principal_name || '................................'}</span>
                          <span style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {settings?.principal_nip || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '5rem' }}>
                          <span style={{ fontWeight: 'normal', minHeight: '18px' }}>{printPlace || 'Karanggeger'}, {printDate || '20 Juni 2026'}</span>
                          <span style={{ fontWeight: 'normal', minHeight: '18px' }}>Guru Mapel / Kelas</span>
                          <div style={{ height: '5rem' }} />
                          <span style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>
                            {allTeachers.find(t => t.id === selectedTeacherId)?.full_name || profile.full_name}
                          </span>
                          <span style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {allTeachers.find(t => t.id === selectedTeacherId)?.nis || profile.nis || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`

fs.writeFileSync('src/components/teacher/ModulAjarGenerator.tsx', code);
