import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  MoreVertical, 
  Filter,
  Download,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Profile, Student } from '../../types';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface StudentManagementProps {
  profile: Profile;
}

export default function StudentManagement({ profile }: StudentManagementProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    const path = 'students';
    try {
      // Base query for role: student
      const q = query(
        collection(db, 'students'), 
        orderBy('full_name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Student[];

      // Apply distribution logic
      const teacherType = profile.teacher_type;
      let filteredData = data;

      if (teacherType && teacherType.startsWith('Guru Kelas')) {
        const targetClass = teacherType.split(' ')[2]; // 'Guru Kelas 1' -> '1'
        filteredData = data.filter(s => s.class_id === targetClass);
      } 
      // Guru PJOK and Guru PAI see all by default, so no extra filter needed

      setStudents(filteredData);
      setSelectedStudentIds([]);
    } catch (error: any) {
      console.error('Error fetching students for teacher:', error);
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStudent(id: string, name: string) {
    const path = `students/${id}`;
    const toastId = toast.loading(`Menghapus data ${name}...`);
    try {
      await deleteDoc(doc(db, 'students', id));
      toast.success('Data murid berhasil dihapus', { id: toastId });
      setSelectedStudentIds(prev => prev.filter(item => item !== id));
      fetchStudents();
    } catch (error: any) {
      toast.error('Gagal menghapus data murid', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async function handleBulkDeleteStudents() {
    if (selectedStudentIds.length === 0) return;
    const toastId = toast.loading(`Menghapus ${selectedStudentIds.length} data murid...`);
    try {
      for (const id of selectedStudentIds) {
        await deleteDoc(doc(db, 'students', id));
      }
      toast.success(`${selectedStudentIds.length} data murid berhasil dihapus`, { id: toastId });
      setSelectedStudentIds([]);
      fetchStudents();
    } catch (error: any) {
      console.error('Error deleting students in bulk:', error);
      toast.error('Gagal menghapus beberapa data murid', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, 'students');
    }
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'Semua Kelas' || s.class_id === selectedClass;
    return matchesSearch && matchesClass;
  });

  const availableClasses = Array.from(new Set(students.map(s => s.class_id))).sort();

  const downloadStudentData = () => {
    if (filteredStudents.length === 0) {
      toast.error('Tidak ada data murid untuk diunduh');
      return;
    }

    const dataToExport = filteredStudents.map(student => ({
      'Nama Lengkap': student.full_name || '',
      'Nama Panggilan': student.nickname || '',
      'Jenis Kelamin': student.gender || 'L',
      'Kelas': student.class_id || '',
      'NIS': student.nis || '',
      'NISN': student.nisn || '',
      'Tempat Lahir': student.birth_place || '',
      'Tanggal Lahir': student.birth_date || '',
      'Nama Ayah': student.father_name || '',
      'Nama Ibu': student.mother_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data_Siswa");
    XLSX.writeFile(wb, `Data_Siswa_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSaveStudent = async () => {
    if (!editingStudent) return;
    
    try {
      setIsSaving(true);
      const studentRef = doc(db, 'students', editingStudent.id);
      await updateDoc(studentRef, {
        full_name: editingStudent.full_name,
        nickname: editingStudent.nickname || '',
        nis: editingStudent.nis || '',
        nisn: editingStudent.nisn || '',
        gender: editingStudent.gender || 'L'
      });
      
      toast.success('Data siswa berhasil diubah');
      setShowEditModal(false);
      fetchStudents();
    } catch (error: any) {
      console.error('Error updating student: ', error);
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 lg:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Data Siswa</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editingStudent.full_name}
                  onChange={(e) => setEditingStudent({...editingStudent, full_name: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Panggilan</label>
                <input 
                  type="text" 
                  value={editingStudent.nickname || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, nickname: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NIS</label>
                  <input 
                    type="text" 
                    value={editingStudent.nis || ''}
                    onChange={(e) => setEditingStudent({...editingStudent, nis: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NISN</label>
                  <input 
                    type="text" 
                    value={editingStudent.nisn || ''}
                    onChange={(e) => setEditingStudent({...editingStudent, nisn: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Jenis Kelamin</label>
                <select 
                  value={editingStudent.gender || 'L'}
                  onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value as 'L' | 'P'})}
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="L">Laki-Laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
              <button 
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={isSaving}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveStudent}
                disabled={isSaving || !editingStudent.full_name}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Siswa</h1>
          <p className="text-gray-500">
            {profile.teacher_type 
              ? `Akses Siswa: ${profile.teacher_type}` 
              : 'Daftar seluruh siswa di sekolah.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama atau ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
          
          {/* Only show class filter if PJOK/PAI since others are already class-restricted */}
          {(profile.teacher_type === 'Guru PJOK' || profile.teacher_type === 'Guru PAI') && (
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
            >
              <option>Semua Kelas</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>
          )}

          <button className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-all border border-gray-100 font-medium text-sm">
            <Filter size={18} />
            Filter
          </button>

          <button 
            onClick={downloadStudentData}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
          >
            <FileSpreadsheet size={16} />
            Unduh Excel
          </button>

          {selectedStudentIds.length > 0 && (
            <button 
              onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-sm font-mono"
              type="button"
            >
              <Trash2 size={16} />
              Hapus Terpilih ({selectedStudentIds.length})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-center w-12 min-w-[44px]">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudentIds(filteredStudents.map(s => s.id));
                      } else {
                        setSelectedStudentIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">No</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest leading-tight">Data Siswa / ID</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest leading-tight">Panggilan</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">JK</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">NIS / NISN</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Kelahiran</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Orang Tua</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Kelas</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="p-10 text-center text-gray-400">Memuat data murid...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-gray-400">Tidak ada data murid yang sesuai.</td></tr>
              ) : filteredStudents.map((student, index) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-center w-12 min-w-[44px]">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(prev => [...prev, student.id]);
                        } else {
                          setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-center text-gray-300 font-mono text-xs">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {student.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">{student.full_name}</p>
                        <p className="text-[10px] text-gray-400 italic">{student.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-gray-700">{student.nickname || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black border",
                      student.gender === 'P' ? "bg-pink-50 text-pink-600 border-pink-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {student.gender || 'L'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-xs font-bold text-gray-700">{student.nis || '-'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{student.nisn || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-gray-700">{student.birth_place || '-'}</p>
                    <p className="text-[10px] text-gray-400">{student.birth_date ? new Date(student.birth_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] text-gray-400">A: <span className="text-gray-700 font-medium">{student.father_name || '-'}</span></p>
                    <p className="text-[10px] text-gray-400">I: <span className="text-gray-700 font-medium">{student.mother_name || '-'}</span></p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs">
                      {student.class_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditingStudent(student);
                          setShowEditModal(true);
                        }}
                        className="text-xs px-3 py-1 font-bold bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ id: student.id, name: student.full_name })}
                        className="text-xs p-1.5 font-bold bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        title="Hapus"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sans tracking-tight">Hapus Data Murid</h3>
              <p className="text-sm text-gray-500 mb-6 font-sans">
                Apakah Anda yakin ingin menghapus data murid <strong>{confirmDelete.name}</strong>? Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-colors font-sans"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteStudent(confirmDelete.id, confirmDelete.name);
                    setConfirmDelete(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm transition-colors font-sans"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmBulkDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-sans tracking-tight">Hapus Beberapa Data Murid</h3>
              <p className="text-sm text-gray-500 mb-6 font-sans">
                Apakah Anda yakin ingin menghapus <strong>{selectedStudentIds.length}</strong> data murid yang dipilih? Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-end font-sans">
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleBulkDeleteStudents();
                    setConfirmBulkDelete(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm transition-colors"
                >
                  Hapus Semua
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
