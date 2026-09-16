import React, { useState } from 'react';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  ChevronDown, 
  BookOpen, 
  Target, 
  Lightbulb, 
  MessageSquare,
  ClipboardList,
  RefreshCcw,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface DeepLearningEditorProps {
  onBack: () => void;
  onSave: (moduleData: any) => void;
}

export default function DeepLearningEditor({ onBack, onSave }: DeepLearningEditorProps) {
  const [activeSection, setActiveSection] = useState('umum');

  const sections = [
    { id: 'umum', name: 'Informasi Umum', icon: Info },
    { id: 'kompetensi', name: 'Kompetensi Inti', icon: Target },
    { id: 'kegiatan', name: 'Langkah Pembelajaran', icon: BookOpen },
    { id: 'asesmen', name: 'Asesmen & Refleksi', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-all font-bold text-sm"
        >
          <ArrowLeft size={18} />
          Kembali ke Daftar
        </button>
        <button 
          onClick={() => onSave({})}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
        >
          <Save size={18} />
          Simpan Modul
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 bg-gray-50/50 border-r border-gray-100 p-6 space-y-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Navigasi Modul</p>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                activeSection === section.id 
                  ? "bg-white text-indigo-600 shadow-sm shadow-indigo-100" 
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <section.icon size={18} />
              {section.name}
            </button>
          ))}
        </div>

        {/* Editor Content */}
        <div className="flex-1 p-8 overflow-y-auto max-h-[70vh]">
          {activeSection === 'umum' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Info className="text-indigo-600" size={24} />
                Identitas & Informasi Umum
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400 uppercase">Judul Modul</label>
                  <input type="text" placeholder="Contoh: Eksplorasi Ekosistem Lokal" className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600/10 font-medium" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400 uppercase">Profil Pelajar Pancasila</label>
                  <select className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600/10 font-medium">
                    <option>Mandiri & Berpikir Kritis</option>
                    <option>Gotong Royong</option>
                    <option>Kreatif</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-400 uppercase">Model Pembelajaran</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {['Problem Based Learning', 'Project Based Learning', 'Inquiry Learning'].map((model) => (
                    <label key={model} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-indigo-100 cursor-pointer transition-all">
                      <input type="radio" name="model" className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-gray-700">{model}</span>
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'kompetensi' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Target className="text-indigo-600" size={24} />
                Kompetensi Inti
              </h3>
              
              <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb size={20} className="text-indigo-600" />
                  <h4 className="font-bold text-indigo-900">Pemahaman Bermakna</h4>
                </div>
                <textarea 
                  placeholder="Apa inti dari pembelajaran ini yang akan diingat siswa seumur hidup?" 
                  className="w-full bg-white border-0 rounded-2xl p-4 text-sm font-medium outline-none h-24 shadow-sm focus:ring-2 focus:ring-indigo-600/20"
                ></textarea>
              </div>

              <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-amber-600" />
                  <h4 className="font-bold text-amber-900">Pertanyaan Pemantik</h4>
                </div>
                <textarea 
                  placeholder="Pertanyaan terbuka yang merangsang diskusi mendalam..." 
                  className="w-full bg-white border-0 rounded-2xl p-4 text-sm font-medium outline-none h-24 shadow-sm focus:ring-2 focus:ring-amber-600/20"
                ></textarea>
              </div>
            </motion.div>
          )}

          {activeSection === 'kegiatan' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <BookOpen className="text-indigo-600" size={24} />
                Alur Pembelajaran Inkuiri
              </h3>
              
              <div className="space-y-6">
                {[
                  { phase: 'Orientasi', desc: 'Membangun konteks dan menarik minat.' },
                  { phase: 'Eksplorasi/Inkuiri', desc: 'Siswa menyelidiki fenomena atau masalah.' },
                  { phase: 'Evaluasi & Refleksi', desc: 'Menarik kesimpulan dan merefleksikan proses.' }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                        {i + 1}
                      </div>
                      {i < 2 && <div className="w-1 flex-1 bg-gray-100 my-2"></div>}
                    </div>
                    <div className="flex-1 pb-8">
                      <h4 className="font-black text-gray-900 mb-1">{step.phase}</h4>
                      <p className="text-xs text-gray-500 mb-3">{step.desc}</p>
                      <textarea 
                        className="w-full bg-gray-50 border-0 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/10 min-h-[100px]"
                        placeholder="Detail langkah pembelajaran..."
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'asesmen' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <RefreshCcw className="text-indigo-600" size={24} />
                Asesmen, Remedial, & Refleksi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-700">Asesmen Sumatif</h4>
                  <div className="p-4 border border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-all cursor-pointer">
                    <Plus size={20} className="mr-2" />
                    Tambah Rubrik Penilaian
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-700">Refleksi Guru & Siswa</h4>
                  <textarea 
                    className="w-full bg-gray-50 border-0 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600/10 h-32"
                    placeholder="Pertanyaan refleksi untuk mengakhiri sesi..."
                  ></textarea>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
