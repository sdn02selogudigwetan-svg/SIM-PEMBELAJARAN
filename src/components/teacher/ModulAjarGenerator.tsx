import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, TeachingDocument } from '../../types';
import { BookMarked, ChevronLeft, Save, Loader2, Sparkles, Printer, CheckSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateWithGemini } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ModulAjarView from './ModulAjarView';
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
  'Inkuiri',
  'Discovery',
  'PjBL',
  'Problem Based Learning (PBL)',
  'Problem Solving',
  'Game Based Learning',
  'Station Learning',
  'Cooperative Learning',
  'Flipped Classroom',
  'Blended Learning',
  'Role Playing',
  'Jigsaw'
];

export default function ModulAjarGenerator({ profile, onBack, onSave }: ModulAjarGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [kktpDocs, setKktpDocs] = useState<TeachingDocument[]>([]);
  
  const [selectedKktpId, setSelectedKktpId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedFase, setSelectedFase] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState<string>('');
  const [tpOptions, setTpOptions] = useState<string[]>([]);
  const [selectedPedagogis, setSelectedPedagogis] = useState<string[]>([]);
  const [selectedDimensi, setSelectedDimensi] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  
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
        const q = query(
          collection(db, 'teaching_documents'), 
          where('teacher_id', '==', profile.id),
          where('type', '==', 'KKTP')
        );
        const querySnapshot = await getDocs(q);
        
        const getDocTime = (item: any) => {
          if (!item?.created_at) return 0;
          if (typeof item.created_at?.toMillis === 'function') return item.created_at.toMillis();
          if (typeof item.created_at === 'string') return new Date(item.created_at).getTime();
          return 0;
        };

        const docs = querySnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as TeachingDocument))
          .sort((a, b) => getDocTime(b) - getDocTime(a));

        setKktpDocs(docs);

        const { doc, getDoc } = await import('firebase/firestore');
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }

        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnap = await getDocs(teachersQuery);
        setAllTeachers(teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)));

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile.id]);

  const handleKktpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedKktpId(id);
    setTujuanPembelajaran('');
    setTpOptions([]);
    const doc = kktpDocs.find(d => d.id === id);
    if (doc) {
      if (doc.content?.subject) setSelectedSubject(doc.content.subject);
      if (doc.content?.fase) setSelectedFase(doc.content.fase);
      if (doc.content?.class) setSelectedClass(doc.content.class);
      
      if (doc.content?.content) {
        try {
          const lines = doc.content.content.split('\n');
          const options: string[] = [];
          let tpColIndex = -1;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('|')) {
              // Extract columns robustly
              const rawCols = line.split('|').map(c => c.trim());
              if (rawCols[0] === '') rawCols.shift();
              if (rawCols.length > 0 && rawCols[rawCols.length - 1] === '') rawCols.pop();
              const cols = rawCols;
              
              if (tpColIndex === -1) {
                const lowerCols = cols.map(c => c.toLowerCase());
                tpColIndex = lowerCols.findIndex(c => c.includes('tujuan') || c.includes('tp'));
                if (tpColIndex === -1 && lowerCols.length >= 2) {
                    tpColIndex = 1; // Fallback to 2nd column
                }
              } else if (!line.includes('---')) {
                if (tpColIndex >= 0 && cols.length > tpColIndex) {
                   const tp = cols[tpColIndex];
                   if (tp && tp.length > 5 && !tp.toLowerCase().includes('tujuan pembelajaran')) {
                      options.push(tp);
                   }
                }
              }
            }
          }
          
          setTpOptions(Array.from(new Set(options)));
        } catch (err) {
          console.error("Error parsing TP from KKTP:", err);
        }
      }
    }
  };

  const toggleDimensi = (dimensi: string) => {
    setSelectedDimensi(prev => 
      prev.includes(dimensi) 
        ? prev.filter(d => d !== dimensi) 
        : [...prev, dimensi]
    );
  };

  const togglePedagogis = (model: string) => {
    if (model === 'PjBL') {
      setSelectedPedagogis(prev => prev.includes('PjBL') ? [] : ['PjBL']);
    } else {
      setSelectedPedagogis(prev => {
        if (prev.includes('PjBL')) return [model];
        return prev.includes(model) 
          ? prev.filter(m => m !== model) 
          : [...prev, model];
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedFase || !selectedClass || !selectedSubject || !selectedKktpId || !tujuanPembelajaran || selectedPedagogis.length === 0 || selectedDimensi.length === 0) {
      return toast.error('Lengkapi semua form terlebih dahulu');
    }

    const selectedKktp = kktpDocs.find(d => d.id === selectedKktpId);
    if (!selectedKktp) return toast.error('KKTP tidak valid');

    setIsGenerating(true);
    try {
      const pjblNote = selectedPedagogis.includes('PjBL') ? "Karena PjBL dipilih, sintaks proyek HARUS BERKELANJUTAN (continuous) di seluruh pertemuan (misal pertemuan 1: penentuan pertanyaan mendasar & menyusun perencanaan, pertemuan 2: menyusun jadwal & memantau siswa, dst hingga evaluasi pengalaman)." : "";

      const promptStr = `Sebagai pakar Kurikulum Merdeka di Indonesia, buatkan Modul Ajar (Deep Learning).

Informasi Dasar:
- Mata Pelajaran: ${selectedSubject}
- Fase: ${selectedFase}
- Kelas: ${selectedClass}
- Tahun Ajaran: ${selectedKktp.content?.schoolYear || '-'}

Data KKTP Referensi:
"""
${selectedKktp.content?.content || 'Tidak ada konten KKTP'}
"""

Fokus Pembelajaran (Tujuan Pembelajaran, Alokasi Waktu (JP), & Pertemuan) yang dipilih:
"${tujuanPembelajaran}" (Catatan: Tujuan pembelajaran, alokasi waktu JP, dan jumlah pertemuan pada hasil modul ajar harus sama persis dengan informasi ini).

Praktik Pedagogis per Pertemuan: ${selectedPedagogis.join(', ')}
Dimensi Lulusan (Profil Pelajar Pancasila): ${selectedDimensi.join(', ')}

Instruksi Pembuatan Modul Ajar:
Bagian 4 (Pengalaman Belajar) dan Bagian 5 (Asesmen) HARUS dibuat rinciannya untuk SETIAP pertemuan berdasarkan jumlah pertemuan yang ada di "Fokus Pembelajaran".
${pjblNote}

Pada Bagian 4, Pengalaman Belajar sama dengan Kegiatan Pembelajaran, sehingga setiap pertemuan harus memiliki:
1. Kegiatan Awal (minimal 5 kegiatan, sertakan alokasi waktu dalam menit).
2. Kegiatan Inti (minimal 15 kegiatan, SERTAKAN sintaks-sintaks / langkah-langkah sesuai model pembelajaran/praktik pedagogis yang dipilih yaitu ${selectedPedagogis.join(', ')}. Jika ada lebih dari satu praktik pedagogis, gunakan satu model untuk satu pertemuan (JANGAN mencampuradukkan sintaks model pembelajaran yang berbeda dalam pertemuan yang sama agar tidak bentrok). Sertakan juga secara eksplisit rumus 3 pengalaman belajar mulai dari memahami, mengaplikasikan, dan merefleksi. Sertakan alokasi waktu).
3. Kegiatan Penutup (minimal 5 kegiatan, sertakan alokasi waktu).
4. SUPER PENTING: Untuk "Tujuan Pembelajaran Khusus" di SETIAP PERTEMUAN, Anda HARUS MENGAMBIL SECARA BERURUTAN dari kolom "Indikator Ketercapaian" (atau Deskripsi Kriteria) untuk Tujuan Pembelajaran tersebut yang ada di tabel KKTP Referensi di atas. 

Pada Bagian 5, buatkan Rencana Asesmen dan Evaluasi. 
SUPER PENTING: Rencana asesmen dan evaluasi ini HARUS menyesuaikan dari hasil "Interval Nilai" atau "Skala" yang ada pada hasil KKTP di atas, sehingga kriteria penilaiannya selaras dengan dokumen KKTP. Pada pertemuan terakhir, tambahkan Asesmen Sumatif.
Selain itu, WAJIB buatkan LKPD (Lembar Kerja Peserta Didik) yang menarik dan terstruktur untuk setiap pertemuan di dalam properti "lkpdDetail". Gunakan format Markdown (menggunakan '\n' untuk baris baru) dengan komponen berikut:
1. JUDUL LKPD
2. IDENTITAS SISWA: Kolom Nama Kelompok, Anggota, Kelas, dan Tanggal.
3. PETUNJUK PENGGUNAAN.
4. STIMULUS / AMATAN: narasi, studi kasus, dll.
5. PERTANYAAN PEMANTIK / MASALAH.
6. LANGKAH KERJA / KEGIATAN.
7. LEMBAR DISKUSI & PERTANYAAN ANALISIS: 3-5 pertanyaan HOTS dengan ruang kosong (titik-titik).
8. KESIMPULAN.
TAMBAHAN: Sertakan Rubrik Penilaian Singkat (tabel) di bagian paling akhir LKPD. KEMUDIAN, berikan Kunci Jawaban di bawah Rubrik Penilaian. WAJIB pisahkan Kunci Jawaban dengan pembatas halaman markdown ('---') agar Kunci Jawaban berada di halaman baru. Gunakan bahasa yang mudah dipahami siswa.

Output HARUS berupa JSON murni dengan struktur persis seperti berikut (jangan gunakan markdown backticks, kembalikan JSON raw saja):

{
  "identitas": {
    "namaSatuanPendidikan": "...",
    "mataPelajaran": "...",
    "kelasSemester": "...",
    "durasiPertemuan": "..."
  },
  "identifikasi": {
    "siswa": "...",
    "materiPelajaran": "...",
    "capaianDimensiLulusan": "..."
  },
  "desainPembelajaran": {
    "capaianPembelajaran": "...",
    "rencanaAsesmen": "...",
    "lintasDisiplinIlmu": "...",
    "tujuanPembelajaran": "...",
    "topikPembelajaran": "...",
    "praktikPedagogis": "...",
    "kemitraanPembelajaran": "...",
    "lingkunganPembelajaran": "...",
    "pemanfaatanDigital": "..."
  },
  "pertemuan": [
    {
      "nomorPertemuan": "Pertemuan 1",
      "tujuanPembelajaranKhusus": "...",
      "pengalamanBelajar": {
        "kegiatanAwal": {
          "alokasiWaktu": "... Menit",
          "kegiatan": [
            "1. ...",
            "2. ...",
            "3. ...",
            "4. ...",
            "5. ..."
          ]
        },
        "kegiatanInti": {
          "alokasiWaktu": "... Menit",
          "kegiatan": [
            "1. (Sintaks ...) ...",
            "... (minimal 15 kegiatan)"
          ]
        },
        "kegiatanPenutup": {
          "alokasiWaktu": "... Menit",
          "kegiatan": [
            "1. ...",
            "2. ...",
            "3. ...",
            "4. ...",
            "5. ..."
          ]
        }
      },
      "asesmenLkpd": {
        "tataCaraPenilaian": "...",
        "metodePenilaian": "...",
        "asesmenSumatif": "... (isi hanya pada pertemuan terakhir, selain itu kosongi atau beri strip)",
        "lkpdDetail": "... (Buatkan detail LKPD dalam format Markdown di sini sesuai instruksi)"
      }
    }
  ]
}

Setiap value berupa string atau array of strings (untuk kegiatan).
Jangan tambahkan tag HTML. Kembalikan JSON murni saja.`;

      const responseText = await generateWithGemini({
        prompt: promptStr,
        userApiKey: profile.api_key,
        config: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });
      
      setGeneratedModul(responseText || '{}');
      toast.success('Modul Ajar berhasil dirumuskan');
    } catch (error: any) {
      console.error('Generative AI Error:', error);
      toast.error(error.message || 'Gagal menghasilkan Modul Ajar');
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
      if (printWindow) {
        printWindow.document.write('<html><head><title>Modul Ajar - Print</title>');
        
        // Copy styles
        const styles = document.getElementsByTagName('style');
        for (let i = 0; i < styles.length; i++) {
          printWindow.document.write(styles[i].outerHTML);
        }
        const links = document.getElementsByTagName('link');
        for (let i = 0; i < links.length; i++) {
          if (links[i].rel === 'stylesheet') {
            printWindow.document.write(links[i].outerHTML);
          }
        }
        
        printWindow.document.write(`
          <style>
            @page { size: portrait; margin: 15mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            body { background: white; margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; }
            #modul-print-area { max-width: 100%; color: black; font-size: 12px !important; }
            #recap-print-wrapper { width: 100%; }
            #recap-print-wrapper h2 { background-color: #f3f4f6 !important; color: #000 !important; border-bottom: 1px solid #000 !important; border-top: 1px solid #000 !important; }
            #recap-print-wrapper > div > div { border-bottom: 1px solid #ccc !important; }
            .no-print { display: none !important; }
          </style>
        `);
        printWindow.document.write('</head><body class="bg-white">');
        printWindow.document.write('<div id="modul-print-area">');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Print failed:", err);
      window.print();
    }
  };

  const handleSaveDraft = () => {
    if (!generatedModul || !selectedSubject || !selectedFase) return;
    if (onSave) {
      const selectedKktp = kktpDocs.find(d => d.id === selectedKktpId);
      onSave({
        subject: selectedSubject,
        fase: selectedFase,
        class: selectedClass,
        schoolYear: selectedKktp?.content?.schoolYear || '',
        content: generatedModul,
        title: `Modul Ajar ${formatSubjectName(selectedSubject)} - ${selectedClass}`
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat data KKTP...</p>
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
                <p className="text-sm text-gray-500">Buat Modul Ajar berdasarkan KKTP tersimpan</p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pilih KKTP Acuan</label>
              <select
                value={selectedKktpId}
                onChange={handleKktpChange}
                className="w-full bg-slate-50 border-0 px-4 py-3 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none cursor-pointer"
              >
                <option value="">-- Pilih KKTP --</option>
                {kktpDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} {doc.content?.schoolYear ? `(${doc.content.schoolYear})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedKktpId && (
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
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tujuan Pembelajaran (dari KKTP)</label>
                  <select
                    value={tujuanPembelajaran}
                    onChange={(e) => setTujuanPembelajaran(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-medium appearance-none cursor-pointer"
                  >
                    <option value="">-- Pilih Tujuan Pembelajaran --</option>
                    {tpOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {tpOptions.length === 0 && selectedKktpId && (
                     <p className="text-[10px] text-amber-600 mt-1">Tidak dapat mengekstrak otomatis Tujuan Pembelajaran dari KKTP ini. Pastikan KKTP memiliki tabel yang sesuai.</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Praktik Pedagogis (Bisa pilih lebih dari satu)</label>
                  <div className="flex flex-wrap gap-2">
                    {PEDAGOGIS_OPTIONS.map(model => (
                      <button
                        key={model}
                        onClick={() => togglePedagogis(model)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${selectedPedagogis.includes(model) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {selectedPedagogis.includes(model) && <CheckSquare size={12} />}
                        {model}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Dimensi Lulusan (Multi)</label>
                  <div className="flex flex-wrap gap-2">
                    {DIMENSI_LULUSAN.map(dimensi => (
                      <button
                        key={dimensi}
                        onClick={() => toggleDimensi(dimensi)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${selectedDimensi.includes(dimensi) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {selectedDimensi.includes(dimensi) && <CheckSquare size={12} />}
                        {dimensi}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Keterangan Tambahan (Opsional)</label>
                  <textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="Misal: Tambahkan kegiatan ice breaking di kegiatan awal..."
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-medium resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedSubject || !selectedFase || !selectedClass || !selectedKktpId || !tujuanPembelajaran || selectedPedagogis.length === 0 || selectedDimensi.length === 0}
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
                        <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Tahun Ajaran: {kktpDocs.find(d => d.id === selectedKktpId)?.content?.schoolYear || '-'}</p>
                      </div>
                      <ModulAjarView dataStr={generatedModul} signatureNode={
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
                      } />
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
