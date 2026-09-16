import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, Class, LessonMaterial } from '../../types';
import { Target, ChevronLeft, Save, Loader2, Sparkles, AlertCircle, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateWithGemini } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { formatSubjectName, formatSchoolName } from '../../lib/utils';

interface ATPGeneratorProps {
  profile: Profile;
  onBack: () => void;
  onSave?: (data: any) => void;
}

export default function ATPGenerator({ profile, onBack, onSave }: ATPGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedFase, setSelectedFase] = useState<string>('');
  const [schoolYear, setSchoolYear] = useState<string>('2026/2027');
  const [tpCounts, setTpCounts] = useState<Record<string, number>>({});
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [cpInput, setCpInput] = useState<string>('');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedATP, setGeneratedATP] = useState<string>('');

  // Print Configuration States
  const [settings, setSettings] = useState<any>(null);
  const [allTeachers, setAllTeachers] = useState<Profile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(profile.id || '');
  const [printPlace, setPrintPlace] = useState('Karanggeger');
  const [printDate, setPrintDate] = useState('20 Juni 2026');

  const ALTERNATIVES = [
    {
      id: 'alt1',
      title: 'Alternatif 1',
      description: 'Merumuskan tujuan pembelajaran secara langsung berdasarkan CP'
    },
    {
      id: 'alt2',
      title: 'Alternatif 2',
      description: 'Merumuskan tujuan pembelajaran dengan menganalisis \'kompetensi\' dan \'konten\' pada ruang lingkup materi pada CP'
    },
    {
      id: 'alt3',
      title: 'Alternatif 3',
      description: 'Merumuskan tujuan pembelajaran Lintas Elemen CP'
    }
  ];

  const GURU_KELAS_SUBJECTS = [
    'Pendidikan Pancasila',
    'Bahasa Indonesia',
    'Matematika',
    'Ilmu Pengetahuan Alam dan Sosial',
    'Seni Rupa',
    'Bahasa Inggris',
    'Koding dan Kecerdasan Artifisial',
    'Bahasa Jawa',
  ];

  const getMyFase = (teacherType?: string) => {
    if (!teacherType) return null;
    if (['Guru Kelas 1', 'Guru Kelas 2'].includes(teacherType)) return 'Fase A (Kelas I-II)';
    if (['Guru Kelas 3', 'Guru Kelas 4'].includes(teacherType)) return 'Fase B (Kelas III-IV)';
    if (['Guru Kelas 5', 'Guru Kelas 6'].includes(teacherType)) return 'Fase C (Kelas V-VI)';
    return null;
  };

  useEffect(() => {
    fetchTeacherData();
    fetchPrintConfig();

    if (profile.teacher_type) {
      const myFase = getMyFase(profile.teacher_type);
      if (myFase) {
        setSelectedFase(myFase);
        if (myFase === 'Fase A (Kelas I-II)') setTpCounts({ 'Kelas 1': 8, 'Kelas 2': 8 });
        else if (myFase === 'Fase B (Kelas III-IV)') setTpCounts({ 'Kelas 3': 8, 'Kelas 4': 8 });
        else if (myFase === 'Fase C (Kelas V-VI)') setTpCounts({ 'Kelas 5': 8, 'Kelas 6': 8 });
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

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes for this teacher
      const classQuery = query(collection(db, 'classes'), where('teacher_id', '==', profile.id));
      const classSnap = await getDocs(classQuery);
      const classesData = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      setClasses(classesData);

      // 2. Prepare subjects list based on teacher type and standard curriculum
      let baseSubjects: string[] = [];
      if (profile.teacher_type === 'Guru PAI') {
        baseSubjects = ['Pendidikan Agama Islam dan Budi Pekerti', ...GURU_KELAS_SUBJECTS];
      } else if (profile.teacher_type === 'Guru PJOK') {
        baseSubjects = ['Pendidikan Jasmani, Olahraga, dan Kesehatan', ...GURU_KELAS_SUBJECTS];
      } else {
        baseSubjects = [...GURU_KELAS_SUBJECTS];
      }

      // Add any additional distinct subjects from materials/classes if not already present
      const allSubjects = new Set<string>(baseSubjects);
      
      for (const cls of classesData) {
        if (cls.subject && cls.subject !== 'Semua Mapel') {
          allSubjects.add(cls.subject);
        }
        
        const matQuery = query(collection(db, 'classes', cls.id, 'materials'));
        const matSnap = await getDocs(matQuery);
        matSnap.docs.forEach(d => {
          const mat = d.data() as LessonMaterial;
          if (mat.subject && mat.subject !== 'Semua Mapel') {
            allSubjects.add(mat.subject);
          }
        });
      }
      
      const subjectList = Array.from(allSubjects).filter(Boolean);
      setSubjects(subjectList);
      if (subjectList.length > 0 && !selectedSubject) {
        setSelectedSubject(subjectList[0]);
      }

    } catch (error) {
      console.error('Error fetching data for ATP Generator:', error);
      toast.error('Gagal memuat data kelas dan mata pelajaran');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFase) return toast.error('Pilih fase terlebih dahulu');
    if (!selectedSubject) return toast.error('Pilih mata pelajaran terlebih dahulu');
    if (!selectedAlternative) return toast.error('Pilih alternatif perumusan ATP');

    setIsGenerating(true);
    
    try {
      let altText = ALTERNATIVES.find(a => a.id === selectedAlternative)?.title || '';
      const tpTargetStr = Object.entries(tpCounts)
        .map(([cls, count]) => `tepat ${count} tujuan untuk ${cls}`)
        .join(' dan ');
      
      const prompt = `Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan rumusan Alur Tujuan Pembelajaran (ATP) untuk:
- Mata Pelajaran: ${selectedSubject}
- Tahun Ajaran: ${schoolYear}
- Fase: ${selectedFase}
- Metode: ${altText} (Sesuai BSKAP Nomor 046/H/KR/2025)

${cpInput ? `Guru telah memberikan teks spesifik untuk Capaian Pembelajaran (CP) berikut:\n"${cpInput}"\nPastikan untuk MENGACU SEPENUHNYA pada teks CP tersebut dalam menyusun ATP.\n` : ''}
${additionalInstructions ? `Guru juga memberikan instruksi/keterangan tambahan berikut:\n"${additionalInstructions}"\nHarap IKUTI instruksi spesial ini dengan saksama dalam merumuskan ATP.\n` : ''}

Syarat mutlak dan khusus:
1. ${cpInput ? 'Fokus pada Capaian Pembelajaran yang direquest oleh guru di atas.' : 'WAJIB menggunakan struktur dan kalimat Capaian Pembelajaran (CP) yang SAMA PERSIS dengan SK BSKAP Nomor 046/H/KR/2025 yang diterbitkan oleh Kemendikdasmen RI.\n   Contoh: Untuk mapel PJOK, elemen terbarunya adalah "Terampil Bergerak", "Belajar melalui Gerak", "Bergaya Hidup Aktif", dan "Memilih Hidup yang Menyehatkan". Pastikan isi CP untuk setiap mata pelajaran tidak dikarang sendiri, melainkan sesuai dengan teks asli salinan SK BSKAP 046/H/KR/2025.'}
2. Sajikan hasil rincian ${selectedAlternative === 'alt2' ? '(Elemen, Capaian Pembelajaran, Analisis Kompetensi, Lingkup Materi, Tujuan Pembelajaran, dan Alur Pelaksanaan)' : '(Elemen, Capaian Pembelajaran, dan Tujuan Pembelajaran)'} dalam BENTUK TABEL Markdown.${selectedAlternative === 'alt2' ? `\n   - PENTING (Alternatif 2): Tabel TETAP WAJIB MAUPUN HARUS menampilkan kolom "Analisis Kompetensi" dan "Lingkup Materi".\n   - PENTING: Pada kolom "Tujuan Pembelajaran", WAJIB merumuskan Tujuan Pembelajaran sesuai kuota berikut: (${tpTargetStr}). Ini sangat penting agar dapat dikembangkan menjadi tabel pemetaan Prota dan Promes nantinya.\n   - SUPER PENTING: SATU ELEMEN HANYA BOLEH MENJADI 1 BARIS (ROW) DI TABEL. Semua Tujuan Pembelajaran dan Alur Pelaksanaannya dari elemen yang sama harus disatukan dalam satu sel tabel menggunakan list bullet/number.` : ''}
3. JANGAN GUNAKAN tag HTML seperti <br> di dalam tabel. Gunakan Markdown bullet points (- atau *) atau newline biasa untuk membuat daftar/baris baru di dalam sel tabel.
4. Tambahkan sedikit penjelasan pengantar mengapa dan bagaimana metode ${altText} diterapkan pada ATP ini.
5. Buatlah tujuan pembelajaran spesifik untuk setiap elemen / dimensi.

Pastikan output tabel rapih dan bisa di render dengan baik.`;

      const text = await generateWithGemini({
        prompt,
        userApiKey: profile.api_key,
        config: {
          temperature: 0.8,
        },
      });
      
      setGeneratedATP(text);
      toast.success('ATP berhasil dirumuskan');
    } catch (error: any) {
      console.error('Error generating ATP:', error);
      toast.error(error.message || 'Gagal merumuskan ATP, periksa koneksi dan API Key');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    if (!generatedATP || !selectedSubject || !selectedFase) return;
    if (onSave) {
      onSave({
        subject: selectedSubject,
        fase: selectedFase,
        schoolYear: schoolYear,
        content: generatedATP,
        alternative: selectedAlternative,
        title: `ATP ${selectedSubject} - ${selectedFase}`
      });
    }
  };

  const handlePrint = () => {
    try {
      const printContent = document.getElementById('atp-print-area');
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
          <title>Alur Tujuan Pembelajaran - Print</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              padding: 20px;
              color: black;
              background: white;
            }
            #atp-print-area {
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
              padding: 10px;
              text-align: left;
            }
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
          <div id="atp-print-area">
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
              <Target size={20} className="text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900 leading-none">Generator ATP</h1>
            </div>
            <p className="text-sm text-gray-500">Buat Alur Tujuan Pembelajaran sesuai BSKAP Nomor 046/H/KR/2025</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Configuration */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pilih Fase</label>
              <select
                value={selectedFase}
                onChange={(e) => {
                  const fase = e.target.value;
                  setSelectedFase(fase);
                  if (fase === 'Fase A (Kelas I-II)') setTpCounts({ 'Kelas 1': 8, 'Kelas 2': 8 });
                  else if (fase === 'Fase B (Kelas III-IV)') setTpCounts({ 'Kelas 3': 8, 'Kelas 4': 8 });
                  else if (fase === 'Fase C (Kelas V-VI)') setTpCounts({ 'Kelas 5': 8, 'Kelas 6': 8 });
                  else setTpCounts({});
                }}
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none font-medium mb-2"
              >
                <option value="" disabled>Pilih Fase...</option>
                <option value="Fase A (Kelas I-II)">Fase A (Kelas 1 - 2 SD)</option>
                <option value="Fase B (Kelas III-IV)">Fase B (Kelas 3 - 4 SD)</option>
                <option value="Fase C (Kelas V-VI)">Fase C (Kelas 5 - 6 SD)</option>
              </select>
              {selectedFase && Object.keys(tpCounts).length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {Object.keys(tpCounts).map((className) => (
                    <div key={className}>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Target TP {className}</label>
                      <input 
                        type="number" 
                        min="1" max="20"
                        value={tpCounts[className]}
                        onChange={(e) => setTpCounts({ ...tpCounts, [className]: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tahun Ajaran</label>
              <input
                type="text"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="Contoh: 2026/2027"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-medium transition-all"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Mata Pelajaran</label>
              {subjects.length === 0 ? (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                  <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 leading-relaxed">Belum ada mata pelajaran yang tersedia.</p>
                </div>
              ) : (
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none font-medium"
                >
                  <option value="" disabled>Pilih Mata Pelajaran...</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub}>{formatSubjectName(sub)}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Metode Perumusan</label>
              {ALTERNATIVES.map((alt) => (
                <div 
                  key={alt.id}
                  onClick={() => setSelectedAlternative(alt.id)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAlternative === alt.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedAlternative === alt.id ? 'border-indigo-600' : 'border-gray-300'}`}>
                      {selectedAlternative === alt.id && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                    </div>
                    <span className={`font-bold text-sm ${selectedAlternative === alt.id ? 'text-indigo-900' : 'text-gray-700'}`}>{alt.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 pl-6 leading-relaxed">{alt.description}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Capaian Pembelajaran (Opsional)</label>
              <textarea 
                value={cpInput}
                onChange={(e) => setCpInput(e.target.value)}
                placeholder="Masukkan Capaian Pembelajaran jika ingin mendikte AI secara presisi..."
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600/30 transition-all font-sans min-h-[100px] resize-y"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Keterangan Tambahan (Opsional)</label>
              <textarea 
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Misal: Buat tujuan pembelajaran lebih ke ranah kognitif tingkat tinggi, atau lebih spesifik ke praktikum..."
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600/30 transition-all font-sans min-h-[100px] resize-y"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedSubject || !selectedAlternative}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold transition-all hover:bg-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Merumuskan ATP...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Mulai Rumuskan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-3xl">
              <h3 className="font-bold text-gray-900 text-sm">Hasil Perumusan ATP</h3>
              {generatedATP && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                  >
                    <Printer size={16} />
                    Cetak Review
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
              {!generatedATP ? (
                <div className="p-8 h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4 bg-white">
                  <Target size={48} className="opacity-20" />
                  <div>
                    <p className="font-medium text-gray-500 mb-1">Belum ada ATP yang dirumuskan</p>
                    <p className="text-sm">Pilih mata pelajaran dan alternatif metode di samping untuk memulai.</p>
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
                    <div id="atp-print-area" className="bg-white shadow-md ring-1 ring-black/5 w-full max-w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] print:shadow-none print:ring-0 print:p-0 print:w-auto print:min-h-0 text-black font-sans 
                      prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-justify prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-black prose-td:px-3 prose-td:py-2 prose-td:align-top prose-th:border prose-th:border-black prose-th:px-3 prose-th:py-2 prose-th:align-top prose-th:bg-gray-50 markdown-body">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', pageBreakInside: 'avoid', width: '100%' }} className="not-prose">
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.25rem', lineHeight: 1.2, textAlign: 'center' }}>Alur Tujuan Pembelajaran (ATP)</h1>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Mata Pelajaran: {selectedSubject ? formatSubjectName(selectedSubject) : '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Fase: {selectedFase || '-'}</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Tahun Ajaran: {schoolYear || '-'}</p>
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{generatedATP}</ReactMarkdown>
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
