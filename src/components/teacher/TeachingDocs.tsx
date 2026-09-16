import React, { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { 
  Plus, 
  FileText, 
  Calendar, 
  Layout, 
  Target, 
  BookMarked,
  Search,
  Filter,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  X,
  ChevronRight,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatSubjectName, formatSchoolName } from '../../lib/utils';
import ModulAjarGenerator from './ModulAjarGenerator';
import ATPGenerator from './ATPGenerator';
import ProtaGenerator from './ProtaGenerator';
import PromesGenerator from './PromesGenerator';
import { Profile, TeachingDocument } from '../../types';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ModulAjarView from './ModulAjarView';
import KKTPGenerator from './KKTPGenerator';

type DocType = 'ATP' | 'PROTA' | 'PROMES' | 'KKTP' | 'MODUL_AJAR';

export default function TeachingDocs({ profile }: { profile: Profile }) {
  const [activeType, setActiveType] = useState<DocType | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditingDeepModule, setIsEditingDeepModule] = useState(false);
  const [isGeneratingATP, setIsGeneratingATP] = useState(false);
  const [isGeneratingProta, setIsGeneratingProta] = useState(false);
  const [selectedAtpForProta, setSelectedAtpForProta] = useState<string | undefined>(undefined);
  const [isGeneratingPromes, setIsGeneratingPromes] = useState(false);
  const [isGeneratingKKTP, setIsGeneratingKKTP] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<TeachingDocument | null>(null);

  const docTypes: { id: DocType; name: string; icon: any; color: string }[] = [
    { id: 'ATP', name: 'Alur Tujuan Pembelajaran', icon: Target, color: 'text-blue-600 bg-blue-50' },
    { id: 'PROTA', name: 'Program Tahunan', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
    { id: 'PROMES', name: 'Program Semester', icon: Layout, color: 'text-pink-600 bg-pink-50' },
    { id: 'KKTP', name: 'Kriteria Ketercapaian (KKTP)', icon: FileText, color: 'text-amber-600 bg-amber-50' },
    { id: 'MODUL_AJAR', name: 'Modul Ajar (Deep Learning)', icon: BookMarked, color: 'text-indigo-600 bg-indigo-50' },
  ];

  const [docs, setDocs] = useState<TeachingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Print Configuration States
  const [settings, setSettings] = useState<any>(null);
  const [allTeachers, setAllTeachers] = useState<Profile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(profile.id || '');
  const [printPlace, setPrintPlace] = useState('Karanggeger');
  const [printDate, setPrintDate] = useState('20 Juni 2026');

  React.useEffect(() => {
    loadDocs();
    loadPrintConfig();
  }, [profile.id]);

  const getMyFase = (teacherType?: string) => {
    if (!teacherType) return null;
    if (['Guru Kelas 1', 'Guru Kelas 2'].includes(teacherType)) return 'Fase A (Kelas I-II)';
    if (['Guru Kelas 3', 'Guru Kelas 4'].includes(teacherType)) return 'Fase B (Kelas III-IV)';
    if (['Guru Kelas 5', 'Guru Kelas 6'].includes(teacherType)) return 'Fase C (Kelas V-VI)';
    return null;
  };

  const loadPrintConfig = async () => {
    try {
      // Load Settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
      
    try {
      // Load Teachers
      const teachersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      const teachersList = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setAllTeachers(teachersList);
    } catch (e) {
      console.error('Failed to load print config', e);
    }
  };

  const loadDocs = async () => {
    try {
      setLoading(true);
      
      const qMyDocs = query(
        collection(db, 'teaching_documents'),
        where('teacher_id', '==', profile.id)
      );
      
      const qAllATPs = query(
        collection(db, 'teaching_documents'),
        where('type', '==', 'ATP')
      );

      const [myDocsSnap, allATPsSnap] = await Promise.all([getDocs(qMyDocs), getDocs(qAllATPs)]);
      
      const myFase = getMyFase(profile.teacher_type);
      const docsMap = new Map<string, TeachingDocument>();
      
      // Load my own documents
      myDocsSnap.docs.forEach(doc => {
        docsMap.set(doc.id, { id: doc.id, ...doc.data() } as TeachingDocument);
      });
      
      // Load shared ATPs for the same phase
      allATPsSnap.docs.forEach(doc => {
        const data = doc.data() as any;
        if (myFase && data.content?.fase === myFase && data.teacher_id !== profile.id) {
          docsMap.set(doc.id, { id: doc.id, ...data } as TeachingDocument);
        }
      });
      
      const getDocTime = (item: any) => {
        if (!item?.created_at) return 0;
        if (typeof item.created_at?.toMillis === 'function') return item.created_at.toMillis();
        if (typeof item.created_at === 'string') return new Date(item.created_at).getTime();
        return 0;
      };

      const data = Array.from(docsMap.values()).sort((a, b) => {
        return getDocTime(b) - getDocTime(a);
      });
      
      setDocs(data);
    } catch (error) {
      console.error('Error loading docs:', error);
      toast.error('Gagal memuat dokumen pembelajaran');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (docItem: TeachingDocument) => {
    if (docItem.content?.content) {
      try {
        let contentNode;
        if (docItem.type === 'MODUL_AJAR') {
          contentNode = <ModulAjarView dataStr={docItem.content.content} signatureNode={
            <table style={{ marginTop: '4rem', width: '100%', fontSize: '12px', textAlign: 'center', fontFamily: 'sans-serif', pageBreakInside: 'avoid', border: 'none' }} className="not-prose text-black">
      <tbody>
        <tr>
          <td style={{ width: '50%', paddingLeft: '1rem', verticalAlign: 'top', border: 'none' }}>
            
                 <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Mengetahui,</div>
                 <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Kepala Sekolah</div>
                 <div style={{ height: '5rem' }} />
                 <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>................................</div>
                 <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. -</div>
               
          </td>
          <td style={{ width: '50%', paddingRight: '5rem', verticalAlign: 'top', border: 'none' }}>
            
                 <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Tempat, Tanggal</div>
                 <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Guru Mapel / Kelas</div>
                 <div style={{ height: '5rem' }} />
                 <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>
                   {profile.full_name}
                 </div>
                 <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {profile.nis || '-'}</div>
               
          </td>
        </tr>
      </tbody>
    </table>
          } />;
        } else {
          contentNode = (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{docItem.content.content}</ReactMarkdown>
              <table style={{ marginTop: '4rem', width: '100%', fontSize: '12px', textAlign: 'center', fontFamily: 'sans-serif', pageBreakInside: 'avoid', border: 'none' }} className="not-prose text-black">
      <tbody>
        <tr>
          <td style={{ width: '50%', paddingLeft: '1rem', verticalAlign: 'top', border: 'none' }}>
            
                   <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Mengetahui,</div>
                   <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Kepala Sekolah</div>
                   <div style={{ height: '5rem' }} />
                   <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>................................</div>
                   <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. -</div>
                 
          </td>
          <td style={{ width: '50%', paddingRight: '5rem', verticalAlign: 'top', border: 'none' }}>
            
                   <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Tempat, Tanggal</div>
                   <div style={{ fontWeight: 'normal', minHeight: '18px' }}>Guru Mapel / Kelas</div>
                   <div style={{ height: '5rem' }} />
                   <div style={{ fontWeight: 'bold', textDecoration: 'underline', minHeight: '18px' }}>
                     {profile.full_name}
                   </div>
                   <div style={{ fontWeight: 'normal', marginTop: '0.125rem', minHeight: '18px' }}>NIP. {profile.nis || '-'}</div>
                 
          </td>
        </tr>
      </tbody>
    </table>
            </>
          );
        }

        const htmlString = renderToString(contentNode);
        const html = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
            <meta charset='utf-8'>
            <title>${docItem.title}</title>
            <style>
              body { font-family: sans-serif; }
              .markdown-body table { border-collapse: collapse; width: 100%; }
              .markdown-body th, .markdown-body td { border: 1px solid black; padding: 8px; text-align: left; }
            </style>
          </head>
          <body>
            ${htmlString}
          </body>
          </html>
        `;

        const element = document.createElement("a");
        const file = new Blob(['\ufeff', html], {type: 'application/msword'});
        element.href = URL.createObjectURL(file);
        element.download = `${docItem.title}.doc`;
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
        document.body.removeChild(element);
      } catch (err) {
        console.error("Error generating word doc", err);
        toast.error("Gagal mengunduh dokumen");
      }
    } else {
      toast.error('Format dokumen belum didukung untuk diunduh');
    }
  };

  const handlePrintDoc = (docItem: TeachingDocument) => {
    try {
      const printContent = document.getElementById('doc-print-area');
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
          <title>${docItem.title} - Print</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              padding: 20px;
              color: black;
              background: white;
            }
            #doc-print-area {
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
          <div id="doc-print-area">
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

  const handleSaveATP = async (data: any) => {
    try {
      await addDoc(collection(db, 'teaching_documents'), {
        teacher_id: profile.id,
        type: 'ATP',
        title: data.title || `ATP ${formatSubjectName(data.subject)} - ${data.fase}`,
        content: data,
        created_at: serverTimestamp(),
      });
      toast.success('ATP berhasil disimpan');
      setIsGeneratingATP(false);
      loadDocs();
    } catch (error) {
      console.error('Error saving ATP:', error);
      toast.error('Gagal menyimpan ATP');
    }
  };

  const handleSaveProta = async (data: any) => {
    try {
      await addDoc(collection(db, 'teaching_documents'), {
        teacher_id: profile.id,
        type: 'PROTA',
        title: data.title || `PROTA ${formatSubjectName(data.subject)} - ${data.class}`,
        content: data,
        created_at: serverTimestamp(),
      });
      toast.success('Program Tahunan berhasil disimpan');
      setIsGeneratingProta(false);
      loadDocs();
    } catch (error) {
      console.error('Error saving Prota:', error);
      toast.error('Gagal menyimpan Program Tahunan');
    }
  };

  const handleSavePromes = async (data: any) => {
    try {
      await addDoc(collection(db, 'teaching_documents'), {
        teacher_id: profile.id,
        type: 'PROMES',
        title: data.title || `PROMES ${formatSubjectName(data.subject)} - ${data.class}`,
        content: data,
        created_at: serverTimestamp(),
      });
      toast.success('Program Semester berhasil disimpan');
      setIsGeneratingPromes(false);
      loadDocs();
    } catch (error) {
      console.error('Error saving Promes:', error);
      toast.error('Gagal menyimpan Program Semester');
    }
  };

  const handleSaveKKTP = async (data: any) => {
    try {
      await addDoc(collection(db, 'teaching_documents'), {
        teacher_id: profile.id,
        type: 'KKTP',
        title: data.title || `KKTP ${formatSubjectName(data.subject)} - ${data.class}`,
        content: data,
        created_at: serverTimestamp(),
      });
      toast.success('KKTP berhasil disimpan');
      setIsGeneratingKKTP(false);
      loadDocs();
    } catch (error) {
      console.error('Error saving KKTP:', error);
      toast.error('Gagal menyimpan KKTP');
    }
  };

  const handleSaveModulAjar = async (data: any) => {
    try {
      await addDoc(collection(db, 'teaching_documents'), {
        teacher_id: profile.id,
        type: 'MODUL_AJAR',
        title: data.title || `Modul Ajar ${formatSubjectName(data.subject)} - ${data.class}`,
        content: data,
        created_at: serverTimestamp(),
      });
      toast.success('Modul Ajar berhasil disimpan');
      setIsEditingDeepModule(false);
      loadDocs();
    } catch (error) {
      console.error('Error saving Modul Ajar:', error);
      toast.error('Gagal menyimpan Modul Ajar');
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'teaching_documents', id));
      toast.success('Dokumen dihapus');
      loadDocs();
    } catch (error) {
      console.error('Error deleting doc:', error);
      toast.error('Gagal menghapus dokumen');
    } finally {
      setConfirmDelete(null);
    }
  };

  const filteredDocs = activeType === 'ALL' 
    ? docs 
    : docs.filter(d => d.type === activeType);

  if (viewingDoc) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewingDoc(null)}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
            >
              <ChevronRight size={24} className="rotate-180" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-gray-900">{viewingDoc.title}</h2>
              <p className="text-gray-500 font-medium">{viewingDoc.content?.fase || viewingDoc.content?.class || ''} - {viewingDoc.content?.subject ? formatSubjectName(viewingDoc.content.subject) : ''}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {viewingDoc.type === 'ATP' && (
              <button
                onClick={() => {
                  setSelectedAtpForProta(viewingDoc.id);
                  setViewingDoc(null);
                  setIsGeneratingProta(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm shadow-purple-200 transition-all"
              >
                <Calendar size={18} />
                Buat PROTA dari ATP Ini
              </button>
            )}
            <button
              onClick={() => handlePrintDoc(viewingDoc)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold transition-all"
            >
              <Printer size={18} />
              Cetak
            </button>
            <button
              onClick={() => handleDownload(viewingDoc)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold transition-all"
            >
              <Download size={18} />
              Unduh ke Word
            </button>
          </div>
        </div>

        

      {/* Configuration for Signatures */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-end mb-4 print:hidden">
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

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[700px]">
             <div className="h-[700px] overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-100 flex justify-center">
               <div id="doc-print-area" className="bg-white shadow-md ring-1 ring-black/5 w-full max-w-[210mm] min-h-[297mm] p-[15mm] md:p-[20mm] print:shadow-none print:ring-0 print:p-0 print:w-auto print:min-h-0 text-black font-sans 
                 prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-justify prose-table:border-collapse prose-table:w-full prose-td:border prose-td:border-black prose-td:px-2 prose-td:py-1.5 prose-td:align-top prose-td:text-xs prose-th:border prose-th:border-black prose-th:px-2 prose-th:py-1.5 prose-th:align-top prose-th:bg-gray-50 prose-th:text-xs prose-th:text-center markdown-body overflow-x-auto text-justify">
                 {viewingDoc.content?.content ? (
                   <>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', pageBreakInside: 'avoid', width: '100%' }} className="not-prose">
                       <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.25rem', lineHeight: 1.2, textAlign: 'center' }}>
                         {viewingDoc.type === 'ATP' ? 'Alur Tujuan Pembelajaran (ATP)' : 
                          viewingDoc.type === 'PROTA' ? 'Program Tahunan (PROTA)' : 
                          viewingDoc.type === 'PROMES' ? 'Program Semester (PROMES)' : 
                          viewingDoc.type === 'KKTP' ? 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)' : 
                          viewingDoc.type === 'MODUL_AJAR' ? 'Modul Ajar (Deep Learning)' : viewingDoc.title}
                       </h1>
                       <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Mata Pelajaran: {viewingDoc.content?.subject ? formatSubjectName(viewingDoc.content.subject) : '-'}</p>
                       <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Fase / Kelas: {viewingDoc.content?.fase || '-'} {viewingDoc.content?.class ? `/ ${viewingDoc.content.class}` : ''}</p>
                       {(viewingDoc.content?.schoolYear || viewingDoc.type !== 'ATP') && (
                          <p style={{ fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Tahun Ajaran: {viewingDoc.content?.schoolYear || '-'}</p>
                       )}
                     </div>

                     
                     {viewingDoc.type === 'MODUL_AJAR' ? (
                       <ModulAjarView dataStr={viewingDoc.content.content} signatureNode={
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
                     ) : (
                       <>
                         <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{viewingDoc.content.content}</ReactMarkdown>
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
                       </>
                     )}
                   </>
                 ) : (
                   <p className="text-center text-gray-400 py-20">Preview tidak tersedia</p>
                 )}
               </div>
             </div>
        </div>
      </div>
    );
  }

  if (isEditingDeepModule) {
    return (
      <ModulAjarGenerator 
        profile={profile}
        onBack={() => setIsEditingDeepModule(false)}
        onSave={(data) => {
          handleSaveModulAjar(data);
        }}
      />
    );
  }

  if (isGeneratingATP) {
    return (
      <ATPGenerator 
        profile={profile}
        onBack={() => setIsGeneratingATP(false)}
        onSave={handleSaveATP}
      />
    );
  }

  if (isGeneratingProta) {
    return (
      <ProtaGenerator 
        profile={profile}
        initialAtpId={selectedAtpForProta}
        onBack={() => {
          setIsGeneratingProta(false);
          setSelectedAtpForProta(undefined);
        }}
        onSave={(data) => {
          handleSaveProta(data);
          setSelectedAtpForProta(undefined);
        }}
      />
    );
  }

  if (isGeneratingPromes) {
    return (
      <PromesGenerator 
        profile={profile}
        onBack={() => setIsGeneratingPromes(false)}
        onSave={handleSavePromes}
      />
    );
  }

  if (isGeneratingKKTP) {
    return (
      <KKTPGenerator 
        profile={profile}
        onBack={() => setIsGeneratingKKTP(false)}
        onSave={handleSaveKKTP}
      />
    );
  }

  return (
    <div className="space-y-8">
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Dokumen</h3>
            <p className="text-gray-500 mb-6">Apakah Anda yakin ingin menghapus dokumen ini? Tindakan ini permanen dan tidak dapat dibatalkan.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => confirmDelete && handleDelete(confirmDelete)}
                className="px-4 py-2 font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all"
              >
                Hapus Permanen
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perangkat Pembelajaran</h1>
          <p className="text-gray-500">Kelola ATP, Prota, Promes, KKTP, dan Modul Ajar.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 shadow-sm shadow-indigo-200"
        >
          <Plus size={20} />
          Buat Perangkat
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {docTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveType(activeType === type.id ? 'ALL' : type.id)}
            className={cn(
              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 text-center group",
              activeType === type.id 
                ? "border-indigo-600 bg-indigo-50" 
                : "border-gray-100 bg-white hover:border-gray-200"
            )}
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", type.color)}>
              <type.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipe</p>
              <p className="text-xs font-bold text-gray-700">{type.name}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari perangkat..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
          <button className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
            <Filter size={18} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Judul Dokumen</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Tipe</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Kelas / Mapel</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Diupdate</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-700">{doc.title}</div>
                        {doc.teacher_id !== profile.id && (
                          <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1">
                            Dari: {allTeachers.find(t => t.id === doc.teacher_id)?.full_name || 'Guru Lain'}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 font-medium">{doc.content?.fase || doc.content?.class || '-'}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold">{doc.content?.subject ? formatSubjectName(doc.content.subject) : '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {doc.created_at ? (typeof doc.created_at === 'string' ? new Date(doc.created_at).toLocaleDateString('id-ID') : (doc.created_at as any).toDate?.().toLocaleDateString('id-ID')) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {doc.type === 'ATP' && (
                        <button 
                          onClick={() => {
                            setSelectedAtpForProta(doc.id);
                            setIsGeneratingProta(true);
                          }} 
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all" 
                          title="Buat PROTA dari ATP ini"
                        >
                          <Calendar size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => setViewingDoc(doc)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" 
                        title="Lihat Detail"
                      >
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleDownload(doc)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Unduh ke Word">
                        <Download size={18} />
                      </button>
                      {doc.teacher_id === profile.id && (
                        <button onClick={() => setConfirmDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all" title="Hapus Dokumen">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDocs.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex w-16 h-16 bg-gray-50 rounded-full items-center justify-center text-gray-300 mb-4">
                <FileText size={32} />
              </div>
              <p className="text-gray-400 font-medium">Tidak ada dokumen ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Creating Simplified for UI Demo */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 overflow-hidden relative"
            >
              <button 
                onClick={() => setShowCreateModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-xl font-bold mb-2">Buat Perangkat Baru</h2>
              <p className="text-gray-500 text-sm mb-6">Pilih jenis perangkat pembelajaran yang ingin dibuat.</p>

              <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {docTypes.map((type) => (
                  <button 
                    key={type.id}
                    onClick={() => {
                      setShowCreateModal(false);
                      if (type.id === 'MODUL_AJAR') {
                        setIsEditingDeepModule(true);
                      } else if (type.id === 'ATP') {
                        setIsGeneratingATP(true);
                      } else if (type.id === 'PROTA') {
                        setIsGeneratingProta(true);
                      } else if (type.id === 'PROMES') {
                        setIsGeneratingPromes(true);
                      } else if (type.id === 'KKTP') {
                        setIsGeneratingKKTP(true);
                      } else {
                        toast.error('Fitur belum tersedia');
                      }
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", type.color)}>
                      <type.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 group-hover:text-indigo-600">{type.name}</p>
                      <p className="text-xs text-gray-500">
                        {type.id === 'MODUL_AJAR' 
                          ? 'Gunakan format pembelajaran mendalam (Deep Learning).' 
                          : 'Buat dokumen perangkat pembelajaran sesuai kurikulum.'}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
