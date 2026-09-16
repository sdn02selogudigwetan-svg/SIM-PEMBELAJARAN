import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Profile, Class } from '../../types';
import { BookOpen, Users, Plus, Hash, X, Edit2, Trash2, ChevronRight, FileText, ChevronLeft, Sparkles, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { cn, formatSubjectName } from '../../lib/utils';
import { writeBatch } from 'firebase/firestore';

interface ClassManagementProps {
  profile: Profile;
}

import { LessonMaterial } from '../../types';

const SUBJECTS = [
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'Pendidikan Pancasila',
  'PAI & Budi Pekerti',
  'PJOK',
  'Seni Budaya',
  'Seni Rupa',
  'Bahasa Inggris',
  'Bahasa Jawa',
  'Muatan Lokal'
];

function ClassDetail({ classData, onBack }: { classData: Class, onBack: () => void }) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [activeSemester, setActiveSemester] = useState<'1' | '2'>((classData.semester || '1') as '1' | '2');
  const [newMaterial, setNewMaterial] = useState({
    subject: classData.subject && classData.subject !== 'Semua Mapel' ? classData.subject : SUBJECTS[0],
    topics: [{ title: '', sub_topics: [''] }],
    description: '',
    semester: activeSemester,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<LessonMaterial | null>(null);

  useEffect(() => {
    setNewMaterial(prev => ({ ...prev, semester: activeSemester }));
    fetchData();
  }, [classData.id, activeSemester]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch Students
      const jenjang = classData.name.replace(/\D/g, '');
      const studentQuery = query(
        collection(db, 'students'),
        where('class_id', 'in', [jenjang, classData.id])
      );
      const studentSnap = await getDocs(studentQuery);
      setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)));

      // Fetch Materials (filtered by active semester)
      const materialQuery = query(
        collection(db, 'classes', classData.id, 'materials'),
        where('semester', '==', activeSemester),
        orderBy('created_at', 'desc')
      );
      const materialSnap = await getDocs(materialQuery);
      setMaterials(materialSnap.docs.map(d => ({ id: d.id, ...d.data() } as LessonMaterial)));
    } catch (error) {
      console.error('Error fetching class details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    const filteredTopics = newMaterial.topics
      .map(topic => ({
        title: topic.title.trim(),
        sub_topics: topic.sub_topics.filter(st => st.trim() !== '')
      }))
      .filter(topic => topic.title !== '');

    if (filteredTopics.length === 0) return toast.error('Minimal satu judul materi harus diisi');

    setIsSubmitting(true);
    const path = editingMaterial 
      ? `classes/${classData.id}/materials/${editingMaterial.id}` 
      : `classes/${classData.id}/materials`;

    try {
      if (editingMaterial) {
        await updateDoc(doc(db, 'classes', classData.id, 'materials', editingMaterial.id), {
          subject: newMaterial.subject,
          topics: filteredTopics,
          description: newMaterial.description,
          semester: newMaterial.semester,
        });
        toast.success('Materi pelajaran berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'classes', classData.id, 'materials'), {
          subject: newMaterial.subject,
          topics: filteredTopics,
          description: newMaterial.description,
          semester: newMaterial.semester,
          class_id: classData.id,
          created_at: serverTimestamp()
        });
        toast.success('Materi pelajaran berhasil ditambahkan');
      }
      
      setShowAddMaterial(false);
      setEditingMaterial(null);
      setNewMaterial({ 
        subject: classData.subject && classData.subject !== 'Semua Mapel' ? classData.subject : SUBJECTS[0],
        topics: [{ title: '', sub_topics: [''] }], 
        description: '', 
        semester: (classData.semester || '1') as '1' | '2'
      });
      fetchData();
    } catch (error: any) {
      handleFirestoreError(error, editingMaterial ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  const addTopicField = () => {
    setNewMaterial(prev => ({
      ...prev,
      topics: [...prev.topics, { title: '', sub_topics: [''] }]
    }));
  };

  const updateTopicTitle = (index: number, value: string) => {
    const updated = [...newMaterial.topics];
    updated[index] = { ...updated[index], title: value };
    setNewMaterial(prev => ({ ...prev, topics: updated }));
  };

  const removeTopicField = (index: number) => {
    if (newMaterial.topics.length <= 1) return;
    const updated = newMaterial.topics.filter((_, i) => i !== index);
    setNewMaterial(prev => ({ ...prev, topics: updated }));
  };

  const addSubTopicField = (topicIndex: number) => {
    const updatedTopics = [...newMaterial.topics];
    updatedTopics[topicIndex].sub_topics = [...updatedTopics[topicIndex].sub_topics, ''];
    setNewMaterial(prev => ({ ...prev, topics: updatedTopics }));
  };

  const updateSubTopic = (topicIndex: number, subIdx: number, value: string) => {
    const updatedTopics = [...newMaterial.topics];
    const updatedSubTopics = [...updatedTopics[topicIndex].sub_topics];
    updatedSubTopics[subIdx] = value;
    updatedTopics[topicIndex].sub_topics = updatedSubTopics;
    setNewMaterial(prev => ({ ...prev, topics: updatedTopics }));
  };

  const removeSubTopicField = (topicIndex: number, subIdx: number) => {
    if (newMaterial.topics[topicIndex].sub_topics.length <= 1) return;
    const updatedTopics = [...newMaterial.topics];
    updatedTopics[topicIndex].sub_topics = updatedTopics[topicIndex].sub_topics.filter((_, i) => i !== subIdx);
    setNewMaterial(prev => ({ ...prev, topics: updatedTopics }));
  };

  const handleEditMaterial = (mat: LessonMaterial) => {
    setEditingMaterial(mat);
    setNewMaterial({
      subject: mat.subject || (classData.subject && classData.subject !== 'Semua Mapel' ? classData.subject : SUBJECTS[0]),
      topics: mat.topics || [{ title: '', sub_topics: [''] }],
      description: mat.description || '',
      semester: (mat.semester || activeSemester) as '1' | '2',
    });
    setShowAddMaterial(true);
  };

  // Group materials by subject
  const materialsBySubject = materials.reduce((acc, mat) => {
    const sub = mat.subject || 'Lainnya';
    if (!acc[sub]) acc[sub] = [];
    acc[sub].push(mat);
    return acc;
  }, {} as Record<string, LessonMaterial[]>);

  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<string | null>(null);

  async function proceedDeleteMaterial() {
    if (!deleteMaterialTarget) return;
    const id = deleteMaterialTarget;
    setDeleteMaterialTarget(null);
    try {
      const path = `classes/${classData.id}/materials/${id}`;
      const toastId = toast.loading('Menghapus materi...');
      
      try {
        await deleteDoc(doc(db, 'classes', classData.id, 'materials', id));
        toast.success('Materi berhasil dihapus', { id: toastId });
        fetchData();
      } catch (error: any) {
        console.error('Error deleting material (Firestore):', error);
        toast.error('Gagal menghapus materi', { id: toastId });
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } catch (err) {
      console.error('Error in handleDeleteMaterial:', err);
      toast.error('Terjadi kesalahan saat memproses penghapusan.');
    }
  }

  async function handleDeleteMaterial(id: string) {
    setDeleteMaterialTarget(id);
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{classData.name}</h1>
            <p className="text-gray-500 text-sm">{formatSubjectName(classData.subject || 'Semua Mapel')} • {classData.academic_year || '-'}</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveSemester('1')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeSemester === '1' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Semester 1
          </button>
          <button 
            onClick={() => setActiveSemester('2')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeSemester === '2' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Semester 2
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Mater Pelajaran */}
          <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Materi Pelajaran</h2>
              </div>
              <button 
                onClick={() => {
                  setEditingMaterial(null);
                  setNewMaterial({ 
                    subject: classData.subject && classData.subject !== 'Semua Mapel' ? classData.subject : SUBJECTS[0],
                    topics: [{ title: '', sub_topics: [''] }], 
                    description: '', 
                    semester: (classData.semester || '1') as '1' | '2'
                  });
                  setShowAddMaterial(true);
                }}
                className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-8">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse"></div>
                ))
              ) : Object.keys(materialsBySubject).length === 0 ? (
                <div className="text-center py-10 italic text-gray-400 text-sm">Belum ada materi pelajaran.</div>
              ) : (Object.entries(materialsBySubject) as [string, LessonMaterial[]][]).map(([subject, mats]) => (
                <div key={subject} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-100"></div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-3 py-1 bg-indigo-50 rounded-full">{formatSubjectName(subject)}</span>
                    <div className="h-px flex-1 bg-gray-100"></div>
                  </div>
                  <div className="space-y-4">
                    {mats.map((mat) => (
                      <div key={mat.id} className="flex items-start gap-4 p-5 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all group shadow-sm hover:shadow-md">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-3 mb-2">
                            {mat.topics && mat.topics.map((topic, tIdx) => (
                              <div key={tIdx} className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-sm bg-white px-3 py-1.5 rounded-xl border border-gray-100 inline-block shadow-sm">
                                  {topic.title}
                                </h4>
                                {topic.sub_topics && topic.sub_topics.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pl-4">
                                    {topic.sub_topics.map((sub, sIdx) => (
                                      <span key={sIdx} className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/50">
                                        • {sub}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{mat.description || 'Tidak ada deskripsi'}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMaterial(mat);
                            }}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all shadow-sm opacity-60 hover:opacity-100"
                            title="Edit Materi"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMaterial(mat.id);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all shadow-sm opacity-60 hover:opacity-100"
                            title="Hapus Materi"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* Confirm Delete Material Modal */}
          <AnimatePresence>
            {deleteMaterialTarget && (
               <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"
                 >
                   <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Materi</h3>
                   <p className="text-gray-500 mb-6 text-sm">Apakah Anda yakin ingin menghapus materi ini?</p>
                   <div className="flex gap-3">
                     <button
                       onClick={() => setDeleteMaterialTarget(null)}
                       className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                     >
                       Batal
                     </button>
                     <button
                       onClick={proceedDeleteMaterial}
                       className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                     >
                       Hapus
                     </button>
                   </div>
                 </motion.div>
               </div>
            )}
          </AnimatePresence>

          {/* Materi Add Modal */}
          <AnimatePresence>
            {showAddMaterial && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
                >
                  <div className={cn("p-8 text-white flex justify-between items-center transition-colors", editingMaterial ? "bg-indigo-600" : "bg-orange-500")}>
                    <div>
                      <h3 className="text-xl font-bold">{editingMaterial ? 'Edit Materi' : 'Tambah Materi'}</h3>
                      <p className={cn("text-xs uppercase tracking-widest font-black mt-1", editingMaterial ? "text-indigo-100" : "text-orange-100")}>
                        Bahan Ajar Semester {classData.semester || '1'}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowAddMaterial(false);
                        setEditingMaterial(null);
                        setNewMaterial({ 
                          subject: classData.subject && classData.subject !== 'Semua Mapel' ? classData.subject : SUBJECTS[0],
                          topics: [{ title: '', sub_topics: [''] }], 
                          description: '', 
                          semester: (classData.semester || '1') as '1' | '2'
                        });
                      }} 
                      className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleAddMaterial} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div>
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Pilih Mata Pelajaran</label>
                      <select 
                        required
                        value={newMaterial.subject}
                        onChange={(e) => setNewMaterial({...newMaterial, subject: e.target.value})}
                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-bold appearance-none cursor-pointer"
                      >
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{formatSubjectName(s)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Materi & Sub Materi</label>
                        <button 
                          type="button"
                          onClick={addTopicField}
                          className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm group"
                        >
                          <Plus size={14} />
                          <span className="text-[9px] font-black uppercase tracking-wider">Tambah Materi</span>
                        </button>
                      </div>
                      <div className="space-y-4">
                        {newMaterial.topics.map((topic, idx) => (
                          <div key={idx} className="p-4 rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                required
                                value={topic.title}
                                onChange={(e) => updateTopicTitle(idx, e.target.value)}
                                placeholder={`Judul Materi ${idx + 1}`}
                                className="flex-1 px-5 py-3 rounded-2xl bg-white border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-bold"
                              />
                              {newMaterial.topics.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeTopicField(idx)}
                                  className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                            
                            <div className="space-y-2 pl-4 border-l-2 border-orange-200 ml-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Sub Materi</span>
                                <button 
                                  type="button"
                                  onClick={() => addSubTopicField(idx)}
                                  className="p-1 px-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-all text-[9px] font-bold border border-orange-100"
                                >
                                  + Sub
                                </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {topic.sub_topics.map((sub, sIdx) => (
                                  <div key={sIdx} className="flex gap-2">
                                    <input 
                                      type="text" 
                                      value={sub}
                                      onChange={(e) => updateSubTopic(idx, sIdx, e.target.value)}
                                      placeholder={`Sub Materi ${sIdx + 1}`}
                                      className="flex-1 px-4 py-2 rounded-xl bg-white border border-gray-100 text-xs outline-none focus:ring-2 focus:ring-orange-500/10 transition-all"
                                    />
                                    {topic.sub_topics.length > 1 && (
                                      <button 
                                        type="button"
                                        onClick={() => removeSubTopicField(idx, sIdx)}
                                        className="p-2 text-gray-300 hover:text-red-400 transition-all"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Deskripsi Singkat</label>
                      <textarea 
                        value={newMaterial.description}
                        onChange={(e) => setNewMaterial({...newMaterial, description: e.target.value})}
                        placeholder="Apa yang akan dipelajari..."
                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all min-h-[100px]"
                      />
                    </div>
                    <button 
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-4 text-white rounded-2xl font-bold transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 mt-4",
                        editingMaterial ? "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700" : "bg-orange-500 shadow-orange-100 hover:bg-orange-600"
                      )}
                    >
                      {isSubmitting ? 'Menyimpan...' : editingMaterial ? 'Simpan Perubahan' : 'Tambahkan Materi'}
                    </button>
                  </form>

                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          {/* Daftar Murid Terdaftar */}
          <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Murid Terdaftar</h3>
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Otomatis Terdeteksi</p>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"></div>
                ))
              ) : students.length === 0 ? (
                <div className="text-center py-5 italic text-gray-400 text-xs">Belum ada murid di jenjang ini.</div>
              ) : students.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                    {s.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{s.full_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{s.nis || '-'} | {s.nisn || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ClassManagement({ profile }: ClassManagementProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    subject: 'Semua Mapel',
    semester: '1' as '1' | '2',
    academic_year: ''
  });

  const [globalSettings, setGlobalSettings] = useState<{ academic_year: string; semester: string } | null>(null);

  useEffect(() => {
    fetchClasses();
    fetchStudentCounts();
    fetchGlobalSettings();
  }, [profile.id]);

  async function fetchGlobalSettings() {
    try {
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalSettings({
          academic_year: data.academic_year || '2023/2024',
          semester: data.semester === 'Ganjil' ? '1' : '2'
        });
        setFormData(prev => ({
          ...prev,
          academic_year: data.academic_year || '2023/2024',
          semester: (data.semester === 'Ganjil' ? '1' : '2') as '1' | '2'
        }));
      }
    } catch (error) {
      console.error('Error fetching global settings:', error);
    }
  }

  async function fetchStudentCounts() {
    try {
      const q = query(collection(db, 'students'));
      const snapshot = await getDocs(q);
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const classId = data.class_id;
        if (classId) {
          counts[classId] = (counts[classId] || 0) + 1;
        }
      });
      setStudentCounts(counts);
    } catch (error) {
      console.error('Error counting students:', error);
    }
  }

  async function fetchClasses() {
    setLoading(true);
    const path = 'classes';
    try {
      const q = query(
        collection(db, 'classes'),
        where('teacher_id', '==', profile.id),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Class[];
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Nama kelas harus diisi');

    setIsSubmitting(true);
    const path = 'classes';
    try {
      await addDoc(collection(db, 'classes'), {
        ...formData,
        teacher_id: profile.id,
        created_at: serverTimestamp()
      });
      toast.success('Kelas baru berhasil ditambahkan');
      setShowAddForm(false);
      setFormData({ 
        name: '', 
        code: '', 
        subject: 'Semua Mapel', 
        semester: globalSettings?.semester as '1' | '2' || '1', 
        academic_year: globalSettings?.academic_year || '2023/2024' 
      });
      fetchClasses();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass || !editingClass.name.trim()) return toast.error('Nama kelas harus diisi');

    setIsSubmitting(true);
    const path = `classes/${editingClass.id}`;
    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        name: editingClass.name,
        code: editingClass.code || '',
        subject: editingClass.subject || '',
        semester: editingClass.semester || '1',
        academic_year: editingClass.academic_year || ''
      });
      toast.success('Informasi kelas berhasil diperbarui');
      setEditingClass(null);
      fetchClasses();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  const [confirmGenerateTarget, setConfirmGenerateTarget] = useState(false);

  async function proceedAutoGenerate() {
    setConfirmGenerateTarget(false);
    setIsSubmitting(true);
    const toastId = toast.loading('Sedang mengotomatisasi kelas...');
    
    try {
      const batch = writeBatch(db);
      const teacherType = profile.teacher_type || '';
      const year = globalSettings?.academic_year || '2023/2024';
      const semStr = globalSettings?.semester === 'Genap' ? '2' : '1';
      const sem = semStr as '1' | '2';

      let classesToCreate: Partial<Class>[] = [];

      if (teacherType.includes('Guru Kelas')) {
        const level = teacherType.split(' ').pop(); // e.g., "1", "2"
        classesToCreate = [
          {
            name: `Kelas ${level}`,
            code: `K${level}-${year.split('/')[0]}`,
            subject: 'Semua Mapel',
            semester: sem,
            academic_year: year
          }
        ];
      } else if (teacherType.includes('Guru PAI') || teacherType.includes('Guru PJOK')) {
        const subject = teacherType.includes('PAI') ? 'PAI' : 'PJOK';
        classesToCreate = [1, 2, 3, 4, 5, 6].map(level => ({
          name: `Kelas ${level}`,
          code: `${subject}-${level}`,
          subject: subject,
          semester: sem,
          academic_year: year
        }));
      } else {
        // Fallback for general teachers
        classesToCreate = [
          {
            name: 'Kelas Baru',
            code: 'NEW',
            subject: 'Semua Mapel',
            semester: sem,
            academic_year: year
          }
        ];
      }

      for (const clsData of classesToCreate) {
        const newDocRef = doc(collection(db, 'classes'));
        batch.set(newDocRef, {
          ...clsData,
          teacher_id: profile.id,
          created_at: serverTimestamp()
        });
      }

      await batch.commit();
      toast.success('Kelas dan Rombel berhasil dibuat secara otomatis!', { id: toastId });
      fetchClasses();
    } catch (error: any) {
      toast.error('Gagal membuat kelas otomatis', { id: toastId });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAutoGenerate() {
    if (classes.length > 0) {
      setConfirmGenerateTarget(true);
      return;
    }
    proceedAutoGenerate();
  }

  const [deleteClassTarget, setDeleteClassTarget] = useState<{id: string, name: string} | null>(null);

  async function proceedDeleteClass() {
    if (!deleteClassTarget) return;
    const { id, name } = deleteClassTarget;
    setDeleteClassTarget(null);
    try {
      const path = `classes/${id}`;
      const toastId = toast.loading('Menghapus kelas...');
      
      try {
        await deleteDoc(doc(db, 'classes', id));
        toast.success(`Kelas "${name}" berhasil dihapus`, { id: toastId });
        fetchClasses();
      } catch (error: any) {
        console.error('Error deleting class (Firestore):', error);
        toast.error('Gagal menghapus kelas. Anda mungkin tidak memiliki izin.', { id: toastId });
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } catch (err) {
      console.error('Error in handleDeleteClass:', err);
      toast.error('Terjadi kesalahan saat memproses penghapusan.');
    }
  }

  async function handleDeleteClass(id: string, name: string) {
    setDeleteClassTarget({ id, name });
  }

  if (selectedClass) {
    return <ClassDetail classData={selectedClass} onBack={() => setSelectedClass(null)} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Kelas & Rombel 🏫</h1>
          <p className="text-gray-500">Kelola daftar kelas dan mata pelajaran yang Anda ampu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            disabled={isSubmitting}
            onClick={handleAutoGenerate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl font-bold transition-all hover:bg-amber-100 uppercase text-[10px] tracking-widest border border-amber-200 disabled:opacity-50"
          >
            <Sparkles size={16} />
            Otomatisasi
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 shadow-sm shadow-indigo-200 uppercase text-[10px] tracking-widest"
          >
            <Plus size={16} />
            Tambah Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-48"></div>
          ))
        ) : classes.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 italic text-gray-400">
            Belum ada kelas yang Anda ampu.
          </div>
        ) : classes.map((cls) => (
          <div key={cls.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen size={24} />
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <Hash size={12} /> {cls.code || '-'}
                </span>
                <div className="flex gap-1">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClass(cls);
                    }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                    title="Edit Kelas"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClass(cls.id, cls.name);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Hapus Kelas"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{cls.name}</h3>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-gray-500">
                <Users size={16} />
                <span className="text-xs font-bold">{studentCounts[cls.name.replace(/\D/g, '')] || studentCounts[cls.id] || 0} Siswa Terdaftar</span>
              </div>
              <button 
                onClick={() => setSelectedClass(cls)}
                className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
              >
                Detail Kelas <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Class Confirm Modal */}
      <AnimatePresence>
        {deleteClassTarget && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"
             >
               <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Kelas</h3>
               <p className="text-gray-500 mb-6 text-sm">Hapus kelas "{deleteClassTarget.name}"? Seluruh data yang terhubung dengan kelas ini mungkin akan terdampak.</p>
               <div className="flex gap-3">
                 <button
                   onClick={() => setDeleteClassTarget(null)}
                   className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                 >
                   Batal
                 </button>
                 <button
                   onClick={proceedDeleteClass}
                   className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                 >
                   Hapus
                 </button>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Auto Generate Confirm Modal */}
      <AnimatePresence>
        {confirmGenerateTarget && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"
             >
               <h3 className="text-xl font-bold text-gray-900 mb-2">Buat Kelas Baru</h3>
               <p className="text-gray-500 mb-6 text-sm">Anda sudah memiliki kelas. Apakah ingin membuat kelas otomatis tambahan?</p>
               <div className="flex gap-3">
                 <button
                   onClick={() => setConfirmGenerateTarget(false)}
                   className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                 >
                   Batal
                 </button>
                 <button
                   onClick={proceedAutoGenerate}
                   className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                 >
                   Buat Tambahan
                 </button>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Tambah Kelas Baru</h3>
                  <p className="text-indigo-100 text-xs uppercase tracking-widest font-black mt-1">Identitas Rombel</p>
                </div>
                <button onClick={() => setShowAddForm(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddClass} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Kelas (Contoh: VII-A)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Masukkan nama kelas..."
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Kode Kelas (Opsional)</label>
                  <input 
                    type="text" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    placeholder="Contoh: K7A-2024"
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                  />
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Tambahkan Kelas'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingClass && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Edit Informasi Kelas</h3>
                  <p className="text-indigo-100 text-xs uppercase tracking-widest font-black mt-1">Perbarui Identitas</p>
                </div>
                <button onClick={() => setEditingClass(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateClass} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Kelas</label>
                  <input 
                    type="text" 
                    required
                    value={editingClass.name}
                    onChange={(e) => setEditingClass({...editingClass, name: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Kode Kelas</label>
                  <input 
                    type="text" 
                    value={editingClass.code || ''}
                    onChange={(e) => setEditingClass({...editingClass, code: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                  />
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
