import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, TeachingDocument } from '../../types';
import { Layout, ChevronLeft, Save, Loader2, Sparkles, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateWithGemini } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { formatSubjectName, formatSchoolName } from '../../lib/utils';

interface PromesGeneratorProps {
  profile: Profile;
  onBack: () => void;
  onSave?: (data: any) => void;
}

export default function PromesGenerator({ profile, onBack, onSave }: PromesGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [protaDocs, setProtaDocs] = useState<TeachingDocument[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedFase, setSelectedFase] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedProtaId, setSelectedProtaId] = useState<string>('');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPromes, setGeneratedPromes] = useState<string>('');

  // Print Configuration States
  const [settings, setSettings] = useState<any>(null);
  const [allTeachers, setAllTeachers] = useState<Profile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(profile.id || '');
  const [printPlace, setPrintPlace] = useState('Karanggeger');
  const [printDate, setPrintDate] = useState('20 Juni 2026');

  const getMyFase = (teacherType?: string) => {
    if (!teacherType) return null;
    if (['Guru Kelas 1', 'Guru Kelas 2'].includes(teacherType)) return 'Fase A (Kelas I-II)';
    if (['Guru Kelas 3', 'Guru Kelas 4'].includes(teacherType)) return 'Fase B (Kelas III-IV)';
    if (['Guru Kelas 5', 'Guru Kelas 6'].includes(teacherType)) return 'Fase C (Kelas V-VI)';
    return null;
  };

  useEffect(() => {
    fetchData();
    fetchPrintConfig();

    if (profile.teacher_type) {
      const match = profile.teacher_type.match(/Guru Kelas (\d)/);
      if (match) {
        setSelectedClass(`Kelas ${match[1]}`);
      }
      const myFase = getMyFase(profile.teacher_type);
      if (myFase) {
        setSelectedFase(myFase);
      }
    }
  }, [profile.id]);

  const fetchPrintConfig = async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }
    } catch(e) {
      console.warn('Failed to fetch settings', e);
    }
    try {
      const teachersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      const teachersList = teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile));
      setAllTeachers(teachersList);
    } catch(e) {
      console.warn('Failed to fetch teachers', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const qMyProta = query(
        collection(db, 'teaching_documents'), 
        where('teacher_id', '==', profile.id),
        where('type', '==', 'PROTA')
      );
      const mySnap = await getDocs(qMyProta);
      
      const getDocTime = (item: any) => {
        if (!item?.created_at) return 0;
        if (typeof item.created_at?.toMillis === 'function') return item.created_at.toMillis();
        if (typeof item.created_at === 'string') return new Date(item.created_at).getTime();
        return 0;
      };

      const docsData = mySnap.docs
        .map(d => ({ id: d.id, ...d.data() } as TeachingDocument))
        .sort((a, b) => getDocTime(b) - getDocTime(a));

      setProtaDocs(docsData);
    } catch (error) {
      console.error('Error fetching data for Promes Generator:', error);
      toast.error('Gagal memuat data PROTA');
    } finally {
      setLoading(false);
    }
  };

  // When PROTA is selected, optionally auto-fill subject and fase if it exists in PROTA content
  useEffect(() => {
    if (selectedProtaId) {
      const prota = protaDocs.find(d => d.id === selectedProtaId);
      if (prota && prota.content) {
        if (prota.content.subject) setSelectedSubject(prota.content.subject);
        if (prota.content.fase) setSelectedFase(prota.content.fase);
      }
    }
  }, [selectedProtaId, protaDocs]);

  const handleGenerate = async () => {
    if (!selectedFase) return toast.error('Pilih fase terlebih dahulu');
    if (!selectedClass) return toast.error('Pilih kelas terlebih dahulu');
    if (!selectedSubject) return toast.error('Pilih/isi mata pelajaran terlebih dahulu');
    if (!selectedProtaId) return toast.error('Pilih PROTA terlebih dahulu');

    const selectedProta = protaDocs.find(d => d.id === selectedProtaId);
    if (!selectedProta) return toast.error('PROTA tidak valid');

    setIsGenerating(true);
    
    try {
      const prompt = `Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Program Semester (PROMES) dalam format tabel Markdown.
Informasi Dasar:
- Mata Pelajaran: ${selectedSubject}
- Tahun Ajaran: ${selectedProta?.content?.schoolYear || '-'}
- Fase: ${selectedFase}
- Kelas: ${selectedClass}

Referensi Program Tahunan (PROTA) yang telah disusun:
"""
${selectedProta.content?.content || 'Tidak ada konten PROTA'}
"""

Instruksi Pembuatan PROMES:
1. Analisis PROTA di atas dan buatlah rincian Program Semester (Bisa dibuat 2 tabel terpisah untuk Semester 1 dan Semester 2).${additionalInstructions ? '\n\nInstruksi Tambahan (WAJIB DIPERHATIKAN):\n' + additionalInstructions + '\n' : ''}
2. PENTING: Teks Tujuan Pembelajaran (TP) dan Alokasi Waktu (JP) yang dicantumkan di dalam tabel Promes HARUS SAMA PERSIS (salin tempel kata per kata dan angka per angka) dan diambil dari data PROTA di atas. Jangan merangkum, menyingkat, atau menambahkan kalimat sendiri.
3. Jabarkan alokasi waktu JP tersebut ke dalam minggu-minggu efektif per bulan (Juli s.d. Desember untuk Semester 1, dan Januari s.d. Juni untuk Semester 2).
4. Sajikan hasil rincian dalam BENTUK TABEL HTML murni (bukan Markdown biasa) agar bisa melakukan merge (gabung) kolom bulan. 
   Gunakan struktur tabel HTML berikut untuk Header:
   <thead>
     <tr>
       <th rowspan="2">No</th>
       <th rowspan="2">Tujuan Pembelajaran</th>
       <th rowspan="2">Alokasi Waktu (JP)</th>
       <th colspan="4">Juli</th> <!-- Sesuaikan colspan dengan jumlah minggu di bulan tersebut -->
       <th colspan="5">Agustus</th>
       <!-- ... Lanjutkan untuk bulan lainnya ... -->
       <th rowspan="2">Keterangan</th>
     </tr>
     <tr>
       <th>1</th><th>2</th><th>3</th><th>4</th> <!-- Minggu Juli -->
       <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th> <!-- Minggu Agustus -->
       <!-- ... Lanjutkan angka minggu untuk bulan lainnya ... -->
     </tr>
   </thead>
5. Isikan alokasi JP atau tanda centang pada sel minggu (<td>) yang sesuai di dalam <tbody>.
6. Tabel harus rapi dan terbagi jelas. PASTIKAN output menggunakan tag <table> standar dan BUKAN dibungkus kode markdown (jangan pakai \`\`\`html).

Pastikan output hanya berisi tabel HTML Promes yang diminta dan sedikit teks pengantar yang relevan.`;

      const text = await generateWithGemini({
        prompt,
        userApiKey: profile.api_key,
        config: {
          temperature: 0.7,
        },
      });
      
      setGeneratedPromes(text);
      toast.success('PROMES berhasil dirumuskan');
    } catch (error: any) {
      console.error('Error generating PROMES:', error);
      toast.error(error.message || 'Gagal merumuskan PROMES, periksa koneksi dan API Key');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    if (!generatedPromes || !selectedSubject || !selectedClass) return;
    if (onSave) {
      onSave({
        subject: selectedSubject,
        fase: selectedFase,
        class: selectedClass,
        protaId: selectedProtaId,
        schoolYear: protaDocs.find(d => d.id === selectedProtaId)?.content?.schoolYear || '-',
        content: generatedPromes,
        title: `PROMES ${selectedSubject} - ${selectedClass}`
      });
    }
  };

  const handlePrint = () => {
    try {
      const printContent = document.getElementById('promes-print-area');
      if (!printContent) {
        window.print();
        return;
      }
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Gagal membuka jendela cetak. Pastikan pop-up tidak diblokir.');
        return;
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Program Semester - Print</title>
          <style>
            @page { size: landscape; margin: 15mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            .markdown-body table th { text-align: center; }
            body { 
              font-family: Arial, sans-serif;
              padding: 20px;
              color: black;
              background: white;
            }
            #promes-print-area {
              max-width: 100%;
            }
            .markdown-body {
              font-size: 14px;
              line-height: 1.6;
            }
            .markdown-body table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .markdown-body th, .markdown-body td {
              border: 1px solid #000;
              padding: 6px 4px;
              font-size: 11px;
              text-align: left;
            }
            .markdown-body th { text-align: center; font-size: 11px; }
            .markdown-body th {
              background-color: #f3f4f6 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .markdown-body h1, .markdown-body h2, .markdown-body h3 {
              margin-top: 20px;
              margin-bottom: 10px;
            }
            @media print {
              body, html { margin: 0; padding: 15px; }
              @page { size: auto; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div id="promes-print-area">
            <div class="markdown-body">
              ${printContent.innerHTML}
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
      `);
      printWindow.document.close();
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layout size={20} className="text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900 leading-none">Generator PROMES</h1>
            </div>
            <p className="text-sm text-gray-500">Buat Program Semester otomatis berdasarkan PROTA tersimpan</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Configuration */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pilih Referensi PROTA</label>
              {protaDocs.length === 0 ? (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                  <p className="text-xs text-orange-700">Belum ada PROTA tersimpan. Buat PROTA terlebih dahulu.</p>
                </div>
              ) : (
                <select
                  value={selectedProtaId}
                  onChange={(e) => setSelectedProtaId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-purple-600/20 appearance-none font-medium"
                >
                  <option value="" disabled>Pilih PROTA...</option>
                  {protaDocs.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} {doc.content?.schoolYear ? `(${doc.content.schoolYear})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pilih Fase</label>
              <select
                value={selectedFase}
                onChange={(e) => setSelectedFase(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-purple-600/20 appearance-none font-medium mb-2"
              >
                <option value="" disabled>Pilih Fase...</option>
                <option value="Fase A (Kelas I-II)">Fase A (Kelas 1 - 2 SD)</option>
                <option value="Fase B (Kelas III-IV)">Fase B (Kelas 3 - 4 SD)</option>
                <option value="Fase C (Kelas V-VI)">Fase C (Kelas 5 - 6 SD)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Kelas</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-purple-600/20 appearance-none font-medium"
              >
                <option value="" disabled>Pilih Kelas...</option>
                <option value="Kelas 1">Kelas 1</option>
                <option value="Kelas 2">Kelas 2</option>
                <option value="Kelas 3">Kelas 3</option>
                <option value="Kelas 4">Kelas 4</option>
                <option value="Kelas 5">Kelas 5</option>
                <option value="Kelas 6">Kelas 6</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Mata Pelajaran</label>
              <input
                type="text"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                placeholder="Misal: Pendidikan Pancasila"
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-purple-600/20 font-medium"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Keterangan Tambahan (Opsional)</label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Misal: Tambahkan kegiatan P5 pada minggu terakhir setiap bulan..."
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-purple-600/20 font-medium resize-none"
                rows={3}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedSubject || !selectedFase || !selectedClass || !selectedProtaId}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-2xl font-bold transition-all hover:bg-purple-700 shadow-sm shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Merumuskan PROMES...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate PROMES
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-3xl">
              <h3 className="font-bold text-gray-900 text-sm">Hasil Perumusan PROMES</h3>
              {generatedPromes && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 rounded-xl text-sm font-bold text-purple-700 hover:bg-purple-100 transition-colors shadow-sm"
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
              {!generatedPromes ? (
                <div className="p-8 h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4 bg-white">
                  <Layout size={48} className="opacity-20" />
                  <div>
                    <p className="font-medium text-gray-500 mb-1">Belum ada PROMES yang dirumuskan</p>
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
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-purple-500 focus:bg-white transition-all cursor-pointer"
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
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-purple-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal TTD</label>
                      <input
                        type="text"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:border-purple-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-100 flex justify-center">
                    <div id="promes-print-area" className="bg-white shadow-md ring-1 ring-black/5 w-full max-w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] print:shadow-none print:ring-0 print:p-0 print:w-auto print:min-h-0 text-black font-sans 
                      prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-justify prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-black prose-td:px-1.5 prose-td:py-1 prose-td:align-top prose-td:text-[10px] prose-th:border prose-th:border-black prose-th:px-1.5 prose-th:py-1 prose-th:align-top prose-th:bg-gray-50 prose-th:text-[10px] prose-th:text-center markdown-body">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', pageBreakInside: 'avoid', width: '100%' }} className="not-prose">
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.25rem', lineHeight: 1.2, textAlign: 'center' }}>Program Semester (PROMES)</h1>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Mata Pelajaran: {selectedSubject ? formatSubjectName(selectedSubject) : '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Fase / Kelas: {selectedFase || '-'} / {selectedClass || '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Tahun Ajaran: {protaDocs.find(d => d.id === selectedProtaId)?.content?.schoolYear || '-'}</p>
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{generatedPromes}</ReactMarkdown>
                      {/* SIGNATURE SECTION */}
                      <table style={{ marginTop: '4rem', width: '100%', fontSize: '12px', textAlign: 'center', fontFamily: 'sans-serif', pageBreakInside: 'avoid', border: 'none' }} className="not-prose text-black">
      <tbody>
        <tr>
          <td style={{ width: '50%', paddingLeft: '1rem', verticalAlign: 'top', border: 'none' }}>
            
                          <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Mengetahui,</div>
                          <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Kepala {formatSchoolName(settings?.school_name?.replace('UPT', 'UPT.') || 'Sekolah')}</div>
                          <div style={{ height: '5rem' }} />
                          <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>{settings?.principal_name || '................................'}</div>
                          <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {settings?.principal_nip || '-'}</div>
                        
          </td>
          <td style={{ width: '50%', paddingRight: '5rem', verticalAlign: 'top', border: 'none' }}>
            
                          <div style={{ fontWeight: 'normal', minHeight: '18px' }}>{printPlace || 'Karanggeger'}, {printDate || '20 Juni 2026'}</div>
                          <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Guru Mapel / Kelas</div>
                          <div style={{ height: '5rem' }} />
                          <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>
                            {allTeachers.find(t => t.id === selectedTeacherId)?.full_name || profile.full_name}
                          </div>
                          <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {allTeachers.find(t => t.id === selectedTeacherId)?.nis || profile.nis || '-'}</div>
                        
          </td>
        </tr>
      </tbody>
    </table>
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
