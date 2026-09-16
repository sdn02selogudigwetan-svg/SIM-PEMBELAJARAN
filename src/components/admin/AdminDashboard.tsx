import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where,
  updateDoc, 
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { Profile, UserRole, TeacherType, Class, LessonMaterial, Extracurricular, Cocurricular } from '../../types';
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  Database, 
  Search, 
  UserCog,
  LayoutDashboard,
  UserPlus,
  X,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  Hash,
  Plus,
  FileSpreadsheet,
  Upload,
  Download,
  UserCheck,
  CheckCircle,
  XCircle,
  FileText,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  Trophy,
  Compass,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatSubjectName } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import GradeManagement from '../teacher/GradeManagement';

const SUBJECT_OPTIONS = [
  'Semua Mapel',
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

interface AdminDashboardProps {
  activeTab: string;
  profile: Profile;
}

export default function AdminDashboard({ activeTab, profile }: AdminDashboardProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview />;
      case 'approval':
        return <UserApproval />;
      case 'users':
        return <UserManagement />;
      case 'students':
        return <StudentManagement />;
      case 'classes':
        return <ClassManagementAdmin />;
      case 'extracurricular':
        return <ExtracurricularManagement />;
      case 'cocurricular':
        return <CocurricularManagement />;
      case 'settings':
        return <SystemSettings />;
      case 'grades':
        return <GradeManagement profile={profile} viewMode="input" />;
      case 'recap_reports':
        return <GradeManagement profile={profile} viewMode="recap" />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {renderContent()}
    </motion.div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState([
    { label: 'Total Pengguna', value: '-', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Administrator', value: '-', icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Database Status', value: 'Optimal', icon: Database, color: 'text-green-600 bg-green-50' },
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const allUsers = querySnapshot.docs.map(d => d.data());
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      const pendingCount = allUsers.filter(u => u.is_approved === false).length;
      
      setStats([
        { label: 'Total Pengguna', value: String(allUsers.length), icon: Users, color: 'text-blue-600 bg-blue-50' },
        { label: 'Administrator', value: String(adminCount), icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50' },
        { label: 'Pending Approval', value: String(pendingCount), icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
      ]);
    } catch (error) {
      console.error('Error fetching stats:', error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Administrator Utama 🛡️</h1>
        <p className="text-gray-500">Kendali penuh sistem manajemen sekolah SimSek.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", stat.color)}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10 max-w-lg">
          <h2 className="text-2xl font-bold mb-2">Selamat Datang di Ruang Kendali</h2>
          <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
            Sebagai Administrator, Anda memiliki otorisasi untuk mengelola hak akses seluruh staf guru, siswa, dan konfigurasi sistem aplikasi.
          </p>
          <div className="flex gap-4">
            <button className="px-5 py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-50">
              Panduan Admin
            </button>
            <button className="px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold text-sm border border-indigo-400 hover:bg-indigo-400">
              Audit System
            </button>
          </div>
        </div>
        <LayoutDashboard className="absolute -bottom-10 -right-10 w-64 h-64 text-indigo-500 opacity-20 rotate-12" />
      </div>
    </div>
  );
}

function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Hapus",
  cancelText = "Batal",
  isDanger = true
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void,
  confirmText?: string,
  cancelText?: string,
  isDanger?: boolean
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg",
              isDanger 
                ? "bg-red-600 text-white shadow-red-100 hover:bg-red-700" 
                : "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700"
            )}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all"
          >
            {cancelText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function UserApproval() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  async function fetchPendingUsers() {
    const path = 'users';
    try {
      const q = query(
        collection(db, 'users'), 
        where('is_approved', '==', false),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at,
      })) as Profile[];
      setPendingUsers(data);
    } catch (error: any) {
      console.error('Error fetching pending users:', error);
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string, name: string) {
    const path = `users/${id}`;
    try {
      await updateDoc(doc(db, 'users', id), {
        is_approved: true
      });
      toast.success(`${name} telah disetujui`);
      fetchPendingUsers();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async function handleReject(id: string, name: string) {
    const path = `users/${id}`;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success(`Pendaftaran ${name} telah ditolak`);
      fetchPendingUsers();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Persetujuan Registrasi Baru 🛡️</h1>
          <p className="text-gray-500">Tinjau dan setujui pengguna yang baru mendaftar.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-5">Nama & Profil</th>
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">Jenis / Kelas</th>
                <th className="px-8 py-5">Waktu Daftar</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-10 h-20 bg-gray-50/20"></td>
                  </tr>
                ))
              ) : pendingUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">
                    Tidak ada pendaftaran baru yang perlu ditinjau.
                  </td>
                </tr>
              ) : pendingUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        {user.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{user.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono italic">{user.email || 'No Email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      user.role === 'teacher' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-gray-700 block">
                      {user.role === 'teacher' ? (user.teacher_type || '-') : `Kelas ${user.class_id || '-'}`}
                    </span>
                    {user.role === 'teacher' && user.nis && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 inline-block mt-0.5">
                        NIP: {user.nis}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-gray-500 font-mono text-xs">
                    {user.created_at ? new Date(user.created_at).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleApprove(user.id, user.full_name)}
                        className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center gap-2"
                      >
                        <CheckCircle size={14} /> Setujui
                      </button>
                       <button 
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setConfirmModal({id: user.id, name: user.full_name});
                         }}
                         className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 relative z-10"
                         type="button"
                       >
                         <XCircle size={14} /> Tolak
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationModal 
        isOpen={!!confirmModal}
        title="Tolak Pendaftaran"
        message={`Apakah Anda yakin ingin menolak pendaftaran ${confirmModal?.name}? Data ini akan dihapus permanen.`}
        onConfirm={() => {
          if (confirmModal) {
            handleReject(confirmModal.id, confirmModal.name);
            setConfirmModal(null);
          }
        }}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}

function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserNis, setNewUserNis] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [newUserTeacherType, setNewUserTeacherType] = useState<TeacherType | undefined>(undefined);
  const [newUserClassId, setNewUserClassId] = useState<string>('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at,
      })) as Profile[];
      setProfiles(data);
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      toast.error('Gagal mengambil data pengguna');
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserName.trim()) return toast.error('Nama harus diisi');
    
    setIsSubmitting(true);
    const tempId = Math.random().toString(36).substring(2, 11).toUpperCase();
    const path = `users/${tempId}`;
    
    try {
      await setDoc(doc(db, 'users', tempId), {
        full_name: newUserName,
        email: newUserEmail || null,
        password: newUserPassword || null,
        role: newUserRole,
        is_approved: true, // Manually added users are pre-approved
        teacher_type: newUserRole === 'teacher' ? newUserTeacherType : null,
        class_id: newUserRole === 'student' ? newUserClassId : null,
        nis: newUserNis || null,
        created_at: serverTimestamp(),
      });
      
      toast.success('Pengguna berhasil ditambahkan');
      setShowAddForm(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserNis('');
      setNewUserRole('student');
      setNewUserTeacherType(undefined);
      setNewUserClassId('1');
      fetchProfiles();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error('Gagal menambahkan pengguna');
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProfile || !editingProfile.full_name.trim()) return toast.error('Nama harus diisi');

    setIsSubmitting(true);
    const path = `users/${editingProfile.id}`;
    const toastId = toast.loading('Memperbarui data pengguna...');
    
    try {
      const userRef = doc(db, 'users', editingProfile.id);
      await updateDoc(userRef, {
        full_name: editingProfile.full_name,
        email: editingProfile.email || null,
        password: editingProfile.password || null,
        role: editingProfile.role,
        teacher_type: editingProfile.role === 'teacher' ? (editingProfile.teacher_type || null) : null,
        nis: editingProfile.nis || null,
      });
      
      toast.success('Data pengguna berhasil diperbarui', { id: toastId });
      setEditingProfile(null);
      fetchProfiles();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Gagal memperbarui data pengguna', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateRole(userId: string, newRole: string) {
    const path = `users/${userId}`;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      
      toast.success('Role berhasil diperbarui');
      fetchProfiles();
    } catch (error: any) {
      toast.error('Gagal memperbarui role');
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    const path = `users/${userId}`;
    const toastId = toast.loading(`Menghapus ${name}...`);
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Pengguna berhasil dihapus', { id: toastId });
      fetchProfiles();
    } catch (error: any) {
      toast.error(`Gagal menghapus: ${error.message || 'Error tidak dikenal'}`, { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const toggleAllPasswords = () => {
    const nextState = !showAllPasswords;
    setShowAllPasswords(nextState);
    const updated: Record<string, boolean> = {};
    profiles.forEach(p => {
      updated[p.id] = nextState;
    });
    setShowPasswords(updated);
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.nis && p.nis.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserCog className="text-indigo-600" />
          Manajemen Hak Akses
        </h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
          >
            <UserPlus size={16} />
            Tambah Pengguna
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari user..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-600/10 min-w-[200px]"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddUser} className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 mb-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-indigo-900 text-sm">Form Tambah Pengguna Baru</h3>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-indigo-400 hover:text-indigo-600">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Email (Opsional)</label>
                  <input 
                    type="email" 
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="budi@sekolah.id"
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Password Login</label>
                  <input 
                    type="text" 
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Set password..."
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Peran / Role</label>
                  <select 
                    value={newUserRole}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setNewUserRole(role);
                      if (role !== 'teacher') setNewUserTeacherType(undefined);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="student">Siswa (Student)</option>
                    <option value="teacher">Guru (Teacher)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                {newUserRole === 'teacher' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NIP (Nomor Induk Pegawai)</label>
                    <input 
                      type="text" 
                      value={newUserNis}
                      onChange={(e) => setNewUserNis(e.target.value)}
                      placeholder="Contoh: 198001012010121001"
                      className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </motion.div>
                )}
                {newUserRole === 'student' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NIS (Nomor Induk Siswa)</label>
                    <input 
                      type="text" 
                      value={newUserNis}
                      onChange={(e) => setNewUserNis(e.target.value)}
                      placeholder="Contoh: 219082..."
                      className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </motion.div>
                )}
                {newUserRole === 'teacher' && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="md:col-span-3"
                  >
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Jenis Guru</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        'Guru Kelas 1', 'Guru Kelas 2', 'Guru Kelas 3', 'Guru Kelas 4', 
                        'Guru Kelas 5', 'Guru Kelas 6', 'Guru PAI', 'Guru PJOK'
                      ].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNewUserTeacherType(type as TeacherType)}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all",
                            newUserTeacherType === type 
                              ? "bg-indigo-600 text-white border-transparent" 
                              : "bg-white text-indigo-600 border-indigo-100 hover:border-indigo-600"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {newUserRole === 'student' && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="md:col-span-3"
                  >
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Tentukan Kelas</label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                       {['1', '2', '3', '4', '5', '6'].map((cId) => (
                        <button
                          key={cId}
                          type="button"
                          onClick={() => setNewUserClassId(cId)}
                          className={cn(
                            "px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                            newUserClassId === cId 
                              ? "bg-indigo-600 text-white border-transparent" 
                              : "bg-white text-indigo-600 border-indigo-100 hover:border-indigo-600"
                          )}
                        >
                          Kelas {cId}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data Pengguna'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProfile && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Edit Profil Pengguna</h3>
                  <p className="text-indigo-100 text-xs">Ubah data identitas dan hak akses</p>
                </div>
                <button 
                  onClick={() => setEditingProfile(null)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={editingProfile.full_name}
                    onChange={(e) => setEditingProfile({...editingProfile, full_name: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Email</label>
                  <input 
                    type="email" 
                    value={editingProfile.email || ''}
                    onChange={(e) => setEditingProfile({...editingProfile, email: e.target.value})}
                    placeholder="Alamat email..."
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Password Login</label>
                  <input 
                    type="text" 
                    value={editingProfile.password || ''}
                    onChange={(e) => setEditingProfile({...editingProfile, password: e.target.value})}
                    placeholder="Set password baru..."
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Peran / Role</label>
                  <select 
                    value={editingProfile.role}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setEditingProfile({...editingProfile, role: role, teacher_type: role === 'teacher' ? editingProfile.teacher_type : undefined});
                    }}
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  >
                    <option value="student">Siswa (Student)</option>
                    <option value="teacher">Guru (Teacher)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                {editingProfile.role === 'teacher' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">NIP (Nomor Induk Pegawai)</label>
                    <input 
                      type="text" 
                      value={editingProfile.nis || ''}
                      onChange={(e) => setEditingProfile({...editingProfile, nis: e.target.value})}
                      placeholder="Contoh: 198001012010121001"
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all"
                    />
                  </div>
                )}
                {editingProfile.role === 'student' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">NIS (Nomor Induk Siswa)</label>
                    <input 
                      type="text" 
                      value={editingProfile.nis || ''}
                      onChange={(e) => setEditingProfile({...editingProfile, nis: e.target.value})}
                      placeholder="Contoh: 219082..."
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all"
                    />
                  </div>
                )}
                {editingProfile.role === 'teacher' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Jenis Guru</label>
                    <div className="grid grid-cols-2 gap-2">
                       {[
                        'Guru Kelas 1', 'Guru Kelas 2', 'Guru Kelas 3', 'Guru Kelas 4', 
                        'Guru Kelas 5', 'Guru Kelas 6', 'Guru PAI', 'Guru PJOK'
                      ].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEditingProfile({...editingProfile, teacher_type: type as TeacherType})}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all text-center",
                            editingProfile.teacher_type === type 
                              ? "bg-indigo-600 text-white border-transparent" 
                              : "bg-white text-indigo-600 border-indigo-100 hover:border-indigo-600"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Nama / ID</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">
                  <div className="flex items-center justify-center gap-1.5 focus-within:outline-none">
                    <span>Password</span>
                    <button 
                      onClick={toggleAllPasswords}
                      className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      title={showAllPasswords ? "Sembunyikan Semua Password" : "Tampilkan Semua Password"}
                      type="button"
                    >
                      {showAllPasswords ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Role Saat Ini</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Ubah Peran</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Aksi</th>
                <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right">Terdaftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : filteredProfiles.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400">Tidak ada pengguna ditemukan</td></tr>
              ) : filteredProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{p.full_name}</p>
                    <div className="flex items-center gap-2 text-[10px] flex-wrap">
                       <span className="text-gray-300 font-mono">{p.id.slice(0, 8)}...</span>
                       {p.email && <span className="text-indigo-400 font-medium italic">{p.email}</span>}
                       {p.role === 'teacher' && p.nis && (
                         <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">NIP: {p.nis}</span>
                       )}
                       {p.role === 'student' && p.nis && (
                         <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">NIS: {p.nis}</span>
                       )}
                    </div>
                  </td>
                 <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       <span className="font-mono text-xs text-gray-500">
                         {showPasswords[p.id] ? (p.password || '(Belum diatur)') : '••••••'}
                       </span>
                       <button 
                        onClick={() => togglePasswordVisibility(p.id)}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                        title={showPasswords[p.id] ? "Sembunyikan" : "Tampilkan"}
                        type="button"
                       >
                         {showPasswords[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        p.role === 'admin' ? "bg-red-50 text-red-600" : p.role === 'teacher' ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-500"
                      )}>
                        {p.role}
                      </span>
                      {p.role === 'teacher' && p.teacher_type && (
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50/30 px-2 py-0.5 rounded-lg border border-indigo-50 italic">
                          {p.teacher_type}
                        </span>
                      )}
                      {p.role === 'student' && p.class_id && (
                        <span className="text-[9px] font-bold text-blue-400 bg-blue-50/30 px-2 py-0.5 rounded-lg border border-blue-50 italic">
                          Kelas {p.class_id}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                       {['student', 'teacher', 'admin'].map((r) => (
                        <button 
                          key={r}
                          onClick={() => updateRole(p.id, r)}
                          disabled={p.role === r}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold border transition-all",
                            p.role === r ? "bg-gray-100 text-gray-400 border-transparent" : "border-gray-100 hover:border-indigo-600 hover:text-indigo-600"
                          )}
                        >
                          SET {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingProfile(p)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Edit Data"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDelete({id: p.id, name: p.full_name});
                        }}
                        className="p-2.5 text-red-600 hover:bg-red-50 hover:scale-110 active:scale-95 rounded-xl transition-all relative z-10 shadow-sm hover:shadow-md border border-transparent hover:border-red-100"
                        title="Hapus Pengguna"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400 text-xs text-nowrap">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!confirmDelete}
        title="Konfirmasi Hapus"
        message={`Apakah Anda yakin ingin menghapus pengguna "${confirmDelete?.name}"? Tindakan ini permanen dan tidak dapat dibatalkan.`}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteUser(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function StudentManagement() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  
  // Manual Form State
  const [newStudent, setNewStudent] = useState({
    full_name: '',
    nickname: '',
    gender: 'L' as 'L' | 'P',
    class_id: '1',
    nis: '',
    nisn: '',
    birth_place: '',
    birth_date: '',
    father_name: '',
    mother_name: ''
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    const path = 'students';
    try {
      const q = query(collection(db, 'students'), orderBy('full_name', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
          created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at,
        })) as Profile[];
      
      setStudents(data);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudent.full_name.trim()) return toast.error('Nama siswa harus diisi');

    setIsSubmitting(true);
    const tempId = `S-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const path = `students/${tempId}`;

    try {
      await setDoc(doc(db, 'students', tempId), {
        ...newStudent,
        role: 'student',
        created_at: serverTimestamp(),
      });

      toast.success('Siswa berhasil ditambahkan');
      setNewStudent({
        full_name: '',
        nickname: '',
        gender: 'L',
        class_id: '1',
        nis: '',
        nisn: '',
        birth_place: '',
        birth_date: '',
        father_name: '',
        mother_name: ''
      });
      setShowAddForm(false);
      fetchStudents();
    } catch (error: any) {
      console.error('Error adding student:', error);
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent || !editingStudent.full_name.trim()) return toast.error('Nama siswa harus diisi');

    setIsSubmitting(true);
    const path = `students/${editingStudent.id}`;
    const toastId = toast.loading('Memperbarui data murid...');

    try {
      const studentRef = doc(db, 'students', editingStudent.id);
      await updateDoc(studentRef, {
        full_name: editingStudent.full_name,
        nickname: editingStudent.nickname || '',
        gender: editingStudent.gender || 'L',
        class_id: editingStudent.class_id || '1',
        nis: editingStudent.nis || '',
        nisn: editingStudent.nisn || '',
        birth_place: editingStudent.birth_place || '',
        birth_date: editingStudent.birth_date || '',
        father_name: editingStudent.father_name || '',
        mother_name: editingStudent.mother_name || '',
      });

      toast.success('Data siswa berhasil diperbarui', { id: toastId });
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast.error('Gagal memperbarui data murid', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
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

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('File Excel kosong');
          return;
        }

        setIsSubmitting(true);
        const batch = writeBatch(db);
        let count = 0;

        for (const row of data) {
          const name = row['Nama Lengkap'] || row.nama || row.Nama;
          if (name) {
            const tempId = `S-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
            const userRef = doc(db, 'students', tempId);
            batch.set(userRef, {
              full_name: name,
              nickname: row['Nama Panggilan'] || row.nickname || '',
              gender: (row['Jenis Kelamin'] || row['JK'] || row.gender || 'L').toUpperCase().startsWith('P') ? 'P' : 'L',
              class_id: String(row['Kelas'] || row.class_id || '1').trim().replace(/\s+/g, '_'),
              nis: String(row['NIS'] || row.nis || ''),
              nisn: String(row['NISN'] || row.nisn || ''),
              birth_place: row['Tempat Lahir'] || row.birth_place || '',
              birth_date: row['Tanggal Lahir'] || row.birth_date || '',
              father_name: row['Nama Ayah'] || row.father_name || '',
              mother_name: row['Nama Ibu'] || row.mother_name || '',
              role: 'student',
              created_at: serverTimestamp(),
            });
            count++;
          }
        }

        await batch.commit();
        toast.success(`${count} siswa berhasil diimpor`);
        fetchStudents();
      } catch (error) {
        console.error('Error importing excel:', error);
        toast.error('Gagal memproses file Excel.');
      } finally {
        setIsSubmitting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  const downloadTemplate = () => {
    const template = [
      { 
        'Nama Lengkap': 'Abdurrahman Bin Auf', 
        'Nama Panggilan': 'Abdur',
        'Jenis Kelamin': 'L',
        'Kelas': '1',
        'NIS': '12345',
        'NISN': '0012345678',
        'Tempat Lahir': 'Probolinggo',
        'Tanggal Lahir': '2015-05-12',
        'Nama Ayah': 'Ayah Abdur',
        'Nama Ibu': 'Ibu Abdur'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
  };

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

  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nisn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="text-indigo-600" />
          Manajemen Murid
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
          >
            <UserPlus size={16} />
            Input Manual
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-sm cursor-pointer border-0">
            <FileSpreadsheet size={16} />
            Import Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>

          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={16} />
            Template
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama / NISN..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-600/10 min-w-[240px]"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddManual} className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 mb-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-indigo-900">Formulir Pendaftaran Murid Baru</h3>
                <button type="button" onClick={() => setShowAddForm(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-400 hover:text-indigo-600 transition-all">
                  <X size={16} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 shadow-sm block">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={newStudent.full_name}
                    onChange={(e) => setNewStudent({...newStudent, full_name: e.target.value})}
                    placeholder="Contoh: Abdurrahman Bin Auf"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Panggilan</label>
                  <input 
                    type="text" 
                    value={newStudent.nickname}
                    onChange={(e) => setNewStudent({...newStudent, nickname: e.target.value})}
                    placeholder="Panggilan"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Jenis Kelamin</label>
                  <select 
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({...newStudent, gender: e.target.value as 'L' | 'P'})}
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Kelas</label>
                  <select 
                    value={newStudent.class_id}
                    onChange={(e) => setNewStudent({...newStudent, class_id: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none"
                  >
                    {[1,2,3,4,5,6].map(num => (
                      <option key={num} value={String(num)}>Kelas {num}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NIS</label>
                  <input 
                    type="text" 
                    value={newStudent.nis}
                    onChange={(e) => setNewStudent({...newStudent, nis: e.target.value})}
                    placeholder="Nomor Induk Siswa"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NISN</label>
                  <input 
                    type="text" 
                    value={newStudent.nisn}
                    onChange={(e) => setNewStudent({...newStudent, nisn: e.target.value})}
                    placeholder="NIS Nasional"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Tempat Lahir</label>
                  <input 
                    type="text" 
                    value={newStudent.birth_place}
                    onChange={(e) => setNewStudent({...newStudent, birth_place: e.target.value})}
                    placeholder="Kota/Kabupaten"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Tanggal Lahir</label>
                  <input 
                    type="date" 
                    value={newStudent.birth_date}
                    onChange={(e) => setNewStudent({...newStudent, birth_date: e.target.value})}
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Ayah</label>
                  <input 
                    type="text" 
                    value={newStudent.father_name}
                    onChange={(e) => setNewStudent({...newStudent, father_name: e.target.value})}
                    placeholder="Nama orang tua laki-laki"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Ibu</label>
                  <input 
                    type="text" 
                    value={newStudent.mother_name}
                    onChange={(e) => setNewStudent({...newStudent, mother_name: e.target.value})}
                    placeholder="Nama orang tua perempuan"
                    className="w-full px-5 py-3 rounded-2xl bg-white border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'Proses menyimpan...' : 'Daftarkan Murid'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold">Edit Data Murid</h3>
                  <p className="text-indigo-100 text-xs">Ubah informasi identitas dan data orang tua</p>
                </div>
                <button 
                  onClick={() => setEditingStudent(null)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateStudent} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={editingStudent.full_name}
                      onChange={(e) => setEditingStudent({...editingStudent, full_name: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Panggilan</label>
                    <input 
                      type="text" 
                      value={editingStudent.nickname || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, nickname: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Jenis Kelamin</label>
                    <select 
                      value={editingStudent.gender || 'L'}
                      onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value as 'L' | 'P'})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Kelas</label>
                    <select 
                      value={editingStudent.class_id || '1'}
                      onChange={(e) => setEditingStudent({...editingStudent, class_id: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none"
                    >
                      {[1,2,3,4,5,6].map(num => (
                        <option key={num} value={String(num)}>Kelas {num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NIS</label>
                    <input 
                      type="text" 
                      value={editingStudent.nis || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, nis: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">NISN</label>
                    <input 
                      type="text" 
                      value={editingStudent.nisn || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, nisn: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Tempat Lahir</label>
                    <input 
                      type="text" 
                      value={editingStudent.birth_place || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, birth_place: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      value={editingStudent.birth_date || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, birth_date: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Ayah</label>
                    <input 
                      type="text" 
                      value={editingStudent.father_name || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, father_name: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Ibu</label>
                    <input 
                      type="text" 
                      value={editingStudent.mother_name || ''}
                      onChange={(e) => setEditingStudent({...editingStudent, mother_name: e.target.value})}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-5 py-5 text-center w-12 min-w-[44px]">
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
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest w-12 text-center">No</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest min-w-[200px]">Data Siswa</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest min-w-[120px]">Panggilan</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">JK</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">NIS / NISN</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest">Kelahiran</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest">Nama Orang Tua</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">Kelas</th>
                <th className="px-5 py-5 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="p-20 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-bold font-mono tracking-tighter">MENYINKRONKAN DATA...</p>
                  </div>
                </td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={10} className="p-20 text-center text-gray-400">Data murid tidak ditemukan.</td></tr>
              ) : filteredStudents.map((s, index) => (
                <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-5 py-6 text-center w-12 min-w-[44px]">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(prev => [...prev, s.id]);
                        } else {
                          setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-6 text-center text-xs font-mono text-gray-300 group-hover:text-indigo-400">{index + 1}</td>
                  <td className="px-5 py-6">
                    <p className="font-bold text-gray-900 leading-tight">{s.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                       <span className="text-[10px] text-gray-300 font-mono tracking-tighter">{s.id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-6">
                    <p className="text-xs font-medium text-gray-700">{s.nickname || '-'}</p>
                  </td>
                  <td className="px-5 py-6 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black border",
                      s.gender === 'P' ? "bg-pink-50 text-pink-600 border-pink-100" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {s.gender || 'L'}
                    </span>
                  </td>
                  <td className="px-5 py-6 text-center">
                    <p className="text-xs font-bold text-gray-700">{s.nis || '-'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{s.nisn || '-'}</p>
                  </td>
                  <td className="px-5 py-6">
                    <p className="text-xs font-medium text-gray-700">{s.birth_place || '-'}</p>
                    <p className="text-[10px] text-gray-400">{s.birth_date ? new Date(s.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                  </td>
                  <td className="px-5 py-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Ayah</span>
                      <span className="text-xs font-medium text-gray-700">{s.father_name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-black text-pink-400 uppercase tracking-tighter">Ibu</span>
                      <span className="text-xs font-medium text-gray-700">{s.mother_name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-6 text-center">
                    <span className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black border border-indigo-100 shadow-sm">
                      {s.class_id}
                    </span>
                  </td>
                  <td className="px-5 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => setEditingStudent(s)}
                        className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        title="Edit Data"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDelete({id: s.id, name: s.full_name});
                        }}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm relative z-10"
                        title="Hapus Data"
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

      <ConfirmationModal 
        isOpen={!!confirmDelete}
        title="Hapus Data Murid"
        message={`Apakah Anda yakin ingin menghapus data murid "${confirmDelete?.name}"? Tindakan ini permanen dan tidak dapat dibatalkan.`}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteStudent(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmationModal 
        isOpen={confirmBulkDelete}
        title="Hapus Beberapa Data Murid"
        message={`Apakah Anda yakin ingin menghapus ${selectedStudentIds.length} data murid yang dipilih? Tindakan ini permanen dan tidak dapat dibatalkan.`}
        onConfirm={() => {
          handleBulkDeleteStudents();
          setConfirmBulkDelete(false);
        }}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}

function SystemSettings() {
  const [academicYear, setAcademicYear] = useState('2023/2024');
  const [schoolName, setSchoolName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalNip, setPrincipalNip] = useState('');
  const [description, setDescription] = useState('');
  
  // Custom predicate template states
  const [academicPredA, setAcademicPredA] = useState('');
  const [academicPredB, setAcademicPredB] = useState('');
  const [academicPredC, setAcademicPredC] = useState('');
  const [academicPredD, setAcademicPredD] = useState('');
  
  const [ekskulPredSb, setEkskulPredSb] = useState('');
  const [ekskulPredB, setEkskulPredB] = useState('');
  const [ekskulPredC, setEkskulPredC] = useState('');
  const [ekskulPredK, setEkskulPredK] = useState('');
  
  const [cocPredSb, setCocPredSb] = useState('');
  const [cocPredBsh, setCocPredBsh] = useState('');
  const [cocPredMb, setCocPredMb] = useState('');
  const [cocPredBb, setCocPredBb] = useState('');

  // Fixed 2-column configuration states
  const [academicRules, setAcademicRules] = useState<{ min: number; pred: string }[]>([
    { min: 85, pred: 'Sangat Baik' },
    { min: 70, pred: 'Baik' },
    { min: 60, pred: 'Cukup' },
    { min: 0, pred: 'Perlu Bimbingan' },
  ]);
  const [ekskulRules, setEkskulRules] = useState<{ min: number; pred: string }[]>([
    { min: 4, pred: 'Sangat Baik' },
    { min: 3, pred: 'Baik' },
    { min: 2, pred: 'Cukup' },
    { min: 1, pred: 'Kurang' },
  ]);
  const [cocRules, setCocRules] = useState<{ min: number; pred: string }[]>([
    { min: 4, pred: 'Sangat Berkembang' },
    { min: 3, pred: 'Berkembang Sesuai Harapan' },
    { min: 2, pred: 'Mulai Berkembang' },
    { min: 1, pred: 'Belum Berkembang' },
  ]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAcademicYear(data.academic_year || '2023/2024');
        setSchoolName(data.school_name || '');
        setSchoolLevel(data.school_level || '');
        setSchoolAddress(data.school_address || '');
        setPrincipalName(data.principal_name || '');
        setPrincipalNip(data.principal_nip || '');
        setDescription(data.school_description || '');
        
        // Load custom predicate templates
        setAcademicPredA(data.academic_pred_a_desc || '');
        setAcademicPredB(data.academic_pred_b_desc || '');
        setAcademicPredC(data.academic_pred_c_desc || '');
        setAcademicPredD(data.academic_pred_d_desc || '');
        
        setEkskulPredSb(data.ekskul_pred_sb_desc || '');
        setEkskulPredB(data.ekskul_pred_b_desc || '');
        setEkskulPredC(data.ekskul_pred_c_desc || '');
        setEkskulPredK(data.ekskul_pred_k_desc || '');
        
        setCocPredSb(data.cocurricular_pred_sb_desc || '');
        setCocPredBsh(data.cocurricular_pred_bsh_desc || '');
        setCocPredMb(data.cocurricular_pred_mb_desc || '');
        setCocPredBb(data.cocurricular_pred_bb_desc || '');

        // Load new rules
        if (data.academic_rules && Array.isArray(data.academic_rules)) {
          setAcademicRules(data.academic_rules);
        }
        if (data.ekskul_rules && Array.isArray(data.ekskul_rules)) {
          setEkskulRules(data.ekskul_rules);
        }
        if (data.coc_rules && Array.isArray(data.coc_rules)) {
          setCocRules(data.coc_rules);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    const path = 'settings/general';
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        academic_year: academicYear,
        school_name: schoolName,
        school_level: schoolLevel,
        school_address: schoolAddress,
        principal_name: principalName,
        principal_nip: principalNip,
        school_description: description,
        
        // Save custom predicate templates
        academic_pred_a_desc: academicPredA,
        academic_pred_b_desc: academicPredB,
        academic_pred_c_desc: academicPredC,
        academic_pred_d_desc: academicPredD,
        
        ekskul_pred_sb_desc: ekskulPredSb,
        ekskul_pred_b_desc: ekskulPredB,
        ekskul_pred_c_desc: ekskulPredC,
        ekskul_pred_k_desc: ekskulPredK,
        
        cocurricular_pred_sb_desc: cocPredSb,
        cocurricular_pred_bsh_desc: cocPredBsh,
        cocurricular_pred_mb_desc: cocPredMb,
        cocurricular_pred_bb_desc: cocPredBb,

        // Save rules
        academic_rules: academicRules,
        ekskul_rules: ekskulRules,
        coc_rules: cocRules,
        
        updated_at: serverTimestamp(),
      }, { merge: true });
      toast.success('Pengaturan sekolah berhasil diperbarui');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGlobalAutomate() {
    if (!window.confirm('Tindakan ini akan membuat kelas & rombel secara otomatis untuk SELURUH GURU yang terdaftar berdasarkan jenis tugas mereka. Lanjutkan?')) return;

    setIsSaving(true);
    const toastId = toast.loading('Memproses otomatisasi massal...');
    
    try {
      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const teachersSnap = await getDocs(teachersQuery);
      const batch = writeBatch(db);
      let classCount = 0;

      for (const teacherDoc of teachersSnap.docs) {
        const teacher = teacherDoc.data();
        const teacherId = teacherDoc.id;
        const teacherType = teacher.teacher_type || '';

        let classesToCreate: any[] = [];

        if (teacherType.includes('Guru Kelas')) {
          const level = teacherType.split(' ').pop();
          classesToCreate.push({
            name: `Kelas ${level}`,
            code: `K${level}-${academicYear.split('/')[0]}`,
            subject: 'Semua Mapel',
            academic_year: academicYear,
            semester: '1',
            teacher_id: teacherId,
            created_at: serverTimestamp()
          });
        } else if (teacherType.includes('Guru PAI') || teacherType.includes('Guru PJOK')) {
          const subject = teacherType.includes('PAI') ? 'PAI' : 'PJOK';
          [1, 2, 3, 4, 5, 6].forEach(level => {
            classesToCreate.push({
              name: `Kelas ${level}`,
              code: `${subject}-${level}`,
              subject: subject,
              academic_year: academicYear,
              semester: '1',
              teacher_id: teacherId,
              created_at: serverTimestamp()
            });
          });
        }

        for (const cls of classesToCreate) {
          const newDocRef = doc(collection(db, 'classes'));
          batch.set(newDocRef, cls);
          classCount++;
        }
      }

      await batch.commit();
      toast.success(`Berhasil membuat ${classCount} kelas untuk ${teachersSnap.size} guru!`, { id: toastId });
    } catch (error: any) {
      toast.error('Otomatisasi gagal: ' + error.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Settings className="text-indigo-600" />
        Pengaturan Sekolah
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
               <ShieldCheck size={20} />
            </div>
            <h4 className="font-bold text-gray-900">Identitas Sekolah</h4>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Nama Sekolah</label>
              <input 
                type="text" 
                value={schoolName} 
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: SDN Karanggeger 2"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Jenjang Sekolah</label>
              <input 
                type="text" 
                value={schoolLevel} 
                onChange={(e) => setSchoolLevel(e.target.value)}
                placeholder="Contoh: Sekolah Dasar (SD)"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Alamat Sekolah</label>
              <input 
                type="text" 
                value={schoolAddress} 
                onChange={(e) => setSchoolAddress(e.target.value)}
                placeholder="Contoh: Jl. Gotong Royong No. 12, Kraksaan"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold" 
              />
            </div>
            <div className="pt-4 border-t border-gray-50">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Tahun Ajaran Aktif</label>
              <input 
                type="text" 
                value={academicYear} 
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2023/2024"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold" 
              />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-50">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                 <UserCog size={20} />
              </div>
              <h4 className="font-bold text-gray-900">Kepala Sekolah</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Nama Kepala Sekolah</label>
                <input 
                  type="text" 
                  value={principalName} 
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="Nama Lengkap & Gelar"
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">NIP Kepala Sekolah</label>
                <input 
                  type="text" 
                  value={principalNip} 
                  onChange={(e) => setPrincipalNip(e.target.value)}
                  placeholder="19xxxxxxxxxxxxxx"
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-mono text-xs font-bold" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col space-y-5">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-50">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                 <FileText size={20} />
              </div>
              <h4 className="font-bold text-gray-900">Visi & Deskripsi</h4>
            </div>
            <textarea 
              className="flex-1 w-full p-5 bg-gray-50 border-0 rounded-3xl text-sm h-32 outline-none focus:ring-2 focus:ring-indigo-600/10 resize-none font-medium italic text-gray-600"
              placeholder="Masukkan deskripsi singkat atau visi misi sekolah..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Menyimpan Perubahan...
                </>
              ) : (
                'Perbarui Data Sekolah'
              )}
            </button>
          </div>
        </div>
      </div>
             {/* Konfigurasi Batas Nilai & Predikat Rapor */}
      <div className="mt-8 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-50">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
             <Settings size={20} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Konfigurasi Skala Nilai & Predikat Rapor</h4>
            <p className="text-xs text-gray-500">Atur batas skor minimum (kolom kiri) dan hubungkan dengan klasifikasi predikat (kolom kanan) untuk otomatisasi pengisian rapor.</p>
          </div>
        </div>

        {/* Small inline React helper functions declared once here */}
        {(() => {
          (window as any)._updateAcademicRule = (index: number, field: 'min' | 'pred', value: any) => {
            setAcademicRules(prev => {
              const next = [...prev];
              next[index] = { ...next[index], [field]: field === 'min' ? Number(value) : value };
              return next;
            });
          };
          (window as any)._updateEkskulRule = (index: number, field: 'min' | 'pred', value: any) => {
            setEkskulRules(prev => {
              const next = [...prev];
              next[index] = { ...next[index], [field]: field === 'min' ? Number(value) : value };
              return next;
            });
          };
          (window as any)._updateCocRule = (index: number, field: 'min' | 'pred', value: any) => {
            setCocRules(prev => {
              const next = [...prev];
              next[index] = { ...next[index], [field]: field === 'min' ? Number(value) : value };
              return next;
            });
          };
          return null;
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Kurikulum Utama / Akademik */}
          <div className="p-6 rounded-3xl bg-amber-50/20 border border-amber-100/50 space-y-4">
            <h5 className="font-bold text-amber-850 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Kurikulum Utama (Akademis)
            </h5>
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-200 text-[10px] text-amber-900 leading-relaxed space-y-1">
              <span className="font-bold uppercase tracking-wide block">Logika Evaluasi Predikat:</span>
              <p>• <b>Sangat Baik:</b> Nilai &amp; lebih dari nilai yang diinput (≥)</p>
              <p>• <b>Baik:</b> Nilai &amp; lebih dari nilai yang diinput (≥)</p>
              <p>• <b>Cukup:</b> Nilai &amp; lebih dari nilai yang diinput (≥)</p>
              <p>• <b>Perlu Bimbingan:</b> Nilai &amp; kurang dari nilai yang diinput (≤)</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-amber-700 uppercase tracking-widest px-1">
                <span>Skala Nilai 1-100</span>
                <span>Predikat Rapor</span>
              </div>
              {academicRules.map((rule, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.min}
                    onChange={(e) => (window as any)._updateAcademicRule(idx, 'min', e.target.value)}
                    className="w-[45%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                    placeholder="Batas Min"
                  />
                  <select
                    value={rule.pred}
                    onChange={(e) => (window as any)._updateAcademicRule(idx, 'pred', e.target.value)}
                    className="w-[55%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-amber-500/20 font-semibold text-gray-700"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                    <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Ekstrakurikuler */}
          <div className="p-6 rounded-3xl bg-indigo-50/20 border border-indigo-100/50 space-y-4">
            <h5 className="font-bold text-indigo-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Ekstrakurikuler
            </h5>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest px-1">
                <span>Skala Nilai 1-4</span>
                <span>Predikat Rapor</span>
              </div>
              {ekskulRules.map((rule, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={0.1}
                    value={rule.min}
                    onChange={(e) => (window as any)._updateEkskulRule(idx, 'min', e.target.value)}
                    className="w-[45%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    placeholder="Batas Min"
                  />
                  <select
                    value={rule.pred}
                    onChange={(e) => (window as any)._updateEkskulRule(idx, 'pred', e.target.value)}
                    className="w-[55%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-gray-700"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Cukup">Cukup</option>
                    <option value="Kurang">Kurang</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Kokurikuler */}
          <div className="p-6 rounded-3xl bg-pink-50/20 border border-pink-100/50 space-y-4">
            <h5 className="font-bold text-pink-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              Kokurikuler
            </h5>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-pink-700 uppercase tracking-widest px-1">
                <span>Skala Nilai 1-4</span>
                <span>Predikat Rapor</span>
              </div>
              {cocRules.map((rule, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={0.1}
                    value={rule.min}
                    onChange={(e) => (window as any)._updateCocRule(idx, 'min', e.target.value)}
                    className="w-[45%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-pink-500/20 font-bold"
                    placeholder="Batas Min"
                  />
                  <select
                    value={rule.pred}
                    onChange={(e) => (window as any)._updateCocRule(idx, 'pred', e.target.value)}
                    className="w-[55%] px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-pink-500/20 font-semibold text-gray-700"
                  >
                    <option value="Sangat Berkembang">Sangat Berkembang</option>
                    <option value="Berkembang Sesuai Harapan">Berkembang Sesuai Harapan</option>
                    <option value="Mulai Berkembang">Mulai Berkembang</option>
                    <option value="Belum Berkembang">Belum Berkembang</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-50 gap-4">
          <button 
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan Seluruh Pengaturan'
            )}
          </button>
        </div>
      </div>

      <div className="mt-12 bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full -mr-32 -mt-32 opacity-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Otomatisasi & Intelijensi Sistem ✨</h3>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Gunakan fitur ini untuk membuat <strong>Kelas (Rombel)</strong> secara otomatis untuk seluruh guru berdasarkan peran mereka. 
              Sistem akan mendeteksi tugas mengajar dan menyiapkan kelas yang sesuai beserta sinkronisasi data murid.
            </p>
          </div>
          <button 
            onClick={handleGlobalAutomate}
            disabled={isSaving}
            className="w-full md:w-auto px-8 py-5 bg-amber-500 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-amber-600 hover:scale-105 transition-all shadow-xl shadow-amber-100 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <LayoutGrid size={18} />}
            Generate Rombel Otomatis
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassManagementAdmin() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [materialsMap, setMaterialsMap] = useState<Record<string, LessonMaterial[]>>({});
  const [studentsInClassMap, setStudentsInClassMap] = useState<Record<string, Profile[]>>({});
  const [editingMaterial, setEditingMaterial] = useState<{classId: string, material: LessonMaterial} | null>(null);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<{classId: string, id: string, subject: string} | null>(null);
  
  const [newClass, setNewClass] = useState({
    name: '',
    code: '',
    subject: '',
    semester: '1' as '1' | '2',
    teacher_id: ''
  });

  useEffect(() => {
    if (selectedTeacherId) {
      fetchMaterialsForTeacher(selectedTeacherId);
    }
  }, [selectedTeacherId, classes]);

  useEffect(() => {
    if (selectedClassId) {
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls) {
        fetchStudentsForClass(cls);
      }
    }
  }, [selectedClassId, classes]);

  async function fetchStudentsForClass(cls: Class) {
    try {
      // The class name is usually "Kelas 1", "Kelas 2", etc.
      // Students have class_id as "1", "2", etc.
      const level = cls.name.split(' ').pop();
      const q = query(
        collection(db, 'students'),
        where('class_id', '==', level),
        orderBy('full_name', 'asc')
      );
      const snap = await getDocs(q);
      const studs = snap.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Profile[];
      setStudentsInClassMap(prev => ({ ...prev, [cls.id]: studs }));
    } catch (error) {
      console.error('Error fetching students for class:', error);
    }
  }

  async function fetchMaterialsForTeacher(teacherId: string) {
    const teacherClasses = classes.filter(c => c.teacher_id === teacherId);
    if (teacherClasses.length === 0) return;

    try {
      const newMaterialsMap: Record<string, LessonMaterial[]> = {};
      await Promise.all(teacherClasses.map(async (cls) => {
        const matSnap = await getDocs(collection(db, 'classes', cls.id, 'materials'));
        const materials = matSnap.docs.map(d => ({
          ...d.data(),
          id: d.id,
          created_at: d.data().created_at?.toDate?.()?.toISOString() || d.data().created_at,
        })) as LessonMaterial[];
        newMaterialsMap[cls.id] = materials;
      }));
      setMaterialsMap(prev => ({ ...prev, ...newMaterialsMap }));
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch classes
      const classSnap = await getDocs(query(collection(db, 'classes'), orderBy('name', 'asc')));
      const classData = classSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        created_at: d.data().created_at?.toDate?.()?.toISOString() || d.data().created_at,
      })) as Class[];
      setClasses(classData);

      // Fetch teachers for mapping names
      const teacherSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      const teacherMap: Record<string, string> = {};
      teacherSnap.docs.forEach(d => {
        teacherMap[d.id] = d.data().full_name;
      });
      setTeachers(teacherMap);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data kelas');
      handleFirestoreError(error, OperationType.GET, 'classes');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClass.name || !newClass.teacher_id) return toast.error('Nama kelas dan Wali Kelas wajib diisi');

    setIsSubmitting(true);
    const tempId = Math.random().toString(36).substring(2, 11).toUpperCase();
    
    try {
      await setDoc(doc(db, 'classes', tempId), {
        ...newClass,
        created_at: serverTimestamp(),
      });
      toast.success('Kelas berhasil ditambahkan');
      setShowAddForm(false);
      setNewClass({ name: '', code: '', subject: '', semester: '1', teacher_id: '' });
      fetchData();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `classes/${tempId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass) return;

    setIsSubmitting(true);
    const path = `classes/${editingClass.id}`;
    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        name: editingClass.name,
        code: editingClass.code || '',
        subject: editingClass.subject || '',
        semester: editingClass.semester || '1',
        teacher_id: editingClass.teacher_id,
      });
      toast.success('Kelas berhasil diperbarui');
      setEditingClass(null);
      fetchData();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteClass(id: string, name: string) {
    const path = `classes/${id}`;
    const toastId = toast.loading(`Menghapus ${name}...`);
    try {
      await deleteDoc(doc(db, 'classes', id));
      toast.success('Kelas berhasil dihapus', { id: toastId });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error('Gagal menghapus kelas', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async function handleUpdateMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMaterial) return;

    const { classId, material } = editingMaterial;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'classes', classId, 'materials', material.id), {
        subject: material.subject,
        semester: material.semester,
        topics: material.topics,
        updated_at: serverTimestamp()
      });
      toast.success('Materi berhasil diperbarui');
      setEditingMaterial(null);
      fetchMaterialsForTeacher(selectedTeacherId!);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${classId}/materials/${material.id}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMaterial(classId: string, materialId: string) {
    const toastId = toast.loading('Menghapus materi...');
    try {
      await deleteDoc(doc(db, 'classes', classId, 'materials', materialId));
      toast.success('Materi berhasil dihapus', { id: toastId });
      fetchMaterialsForTeacher(selectedTeacherId!);
    } catch (error: any) {
      toast.error('Gagal menghapus materi', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `classes/${classId}/materials/${materialId}`);
    }
  }

  const classesByTeacher = classes.reduce((acc, cls) => {
    acc[cls.teacher_id] = (acc[cls.teacher_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const orphanedClasses = classes.filter(c => !teachers[c.teacher_id]);

  const filteredTeachers = Object.entries(teachers).filter(([, name]) => 
    (name as string).toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => (a[1] as string).localeCompare(b[1] as string));

  const filteredClasses = classes.filter(c => 
    (!selectedTeacherId || c.teacher_id === selectedTeacherId) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-indigo-600" />
            Manajemen Kelas (Rombel)
          </h2>
          {(selectedTeacherId || selectedClassId || selectedTeacherId === "orphaned") && (
            <div className="flex items-center gap-2 mt-1">
              {(selectedTeacherId || selectedTeacherId === "orphaned") && (
                <button 
                  onClick={() => {
                    setSelectedTeacherId(null);
                    setSelectedClassId(null);
                  }}
                  className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  ← Daftar Guru
                </button>
              )}
              {selectedClassId && (
                <>
                  <span className="text-[10px] text-gray-300">/</span>
                  <button 
                    onClick={() => setSelectedClassId(null)}
                    className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    Daftar Kelas
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!selectedClassId && selectedTeacherId !== "orphaned" && (
            <button 
              onClick={() => {
                if (selectedTeacherId) {
                  setNewClass(prev => ({ ...prev, teacher_id: selectedTeacherId }));
                }
                setShowAddForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Plus size={16} />
              Tambah Kelas
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={selectedClassId ? "Cari materi..." : (selectedTeacherId || selectedTeacherId === "orphaned") ? "Cari kelas..." : "Cari guru..."} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-600/10 min-w-[200px]"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddClass} className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 mb-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <h3 className="font-bold text-indigo-900 text-sm">Form Tambah Kelas Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Nama Kelas</label>
                  <input 
                    type="text" 
                    value={newClass.name}
                    onChange={(e) => setNewClass({...newClass, name: e.target.value})}
                    placeholder="Contoh: Kelas 1"
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Kode Kelas</label>
                  <input 
                    type="text" 
                    value={newClass.code}
                    onChange={(e) => setNewClass({...newClass, code: e.target.value})}
                    placeholder="Contoh: K1-A"
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Wali Kelas</label>
                  <select 
                    value={newClass.teacher_id}
                    onChange={(e) => setNewClass({...newClass, teacher_id: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="">Pilih Wali Kelas</option>
                    {Object.entries(teachers).map(([id, name]) => (
                      <option key={id} value={id}>{name as string}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Mata Pelajaran</label>
                  <select 
                    value={newClass.subject}
                    onChange={(e) => setNewClass({...newClass, subject: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border-0 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 cursor-pointer"
                  >
                    {SUBJECT_OPTIONS.map(s => (
                      <option key={s} value={s}>{formatSubjectName(s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-2 bg-white text-gray-500 rounded-xl text-xs font-bold border border-gray-200">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 uppercase tracking-widest">Simpan Kelas</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedTeacherId ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : (
            <>
              {orphanedClasses.length > 0 && (
                <motion.button
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedTeacherId("orphaned")}
                  className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm text-left hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3">
                    <div className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">Perlu Tindakan</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="font-bold text-red-900 transition-colors line-clamp-1">Kelas Tanpa Guru</h3>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-1">
                    {orphanedClasses.length} Kelas Yatim Piatu
                  </p>
                </motion.button>
              )}
              {filteredTeachers.length === 0 && orphanedClasses.length === 0 ? (
                <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                  Tidak ada data guru yang ditemukan
                </div>
              ) : filteredTeachers.map(([id, name]) => (
                <motion.button
                  key={id}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedTeacherId(id)}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Users size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{(name as string)}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    {classesByTeacher[id] || 0} Kelas Diampu
                  </p>
                </motion.button>
              ))}
            </>
          )}
        </div>
      ) : !selectedClassId ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                {selectedTeacherId === "orphaned" ? "Daftar Kelas Tanpa Guru" : `Daftar Kelas: ${teachers[selectedTeacherId] as string}`}
              </h3>
              <p className="text-xs text-gray-500">
                {selectedTeacherId === "orphaned" 
                  ? "Kelas-kelas ini tidak memiliki wali kelas (guru mungkin telah dihapus)" 
                  : "Pilih kelas untuk melihat detail materi dan mengelolanya"}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Kelas & Kode</th>
                  <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Mata Pelajaran Utama</th>
                  <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Jumlah Materi</th>
                  <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={4} className="p-10 text-center">Memuat data...</td></tr>
                ) : (selectedTeacherId === "orphaned" ? orphanedClasses : filteredClasses).length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-gray-400">Tidak ada data kelas ditemukan</td></tr>
                ) : (selectedTeacherId === "orphaned" ? orphanedClasses : filteredClasses).map((c) => {
                  const mCount = materialsMap[c.id]?.length || 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedClassId(c.id)}>
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${selectedTeacherId === "orphaned" ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"}`}>
                             {c.name.charAt(0)}
                           </div>
                           <div>
                             <p className="font-bold text-gray-900">{c.name}</p>
                             <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase"><Hash size={10} className="inline mr-1" /> {c.code || '-'}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700 font-medium">
                          {(() => {
                            const mats = materialsMap[c.id];
                            if (mats && mats.length > 0) {
                              const allSubjects = mats.map(m => (m.subject === 'Pendidikan Agama & Budi Pekerti' || m.subject === 'PAI') ? 'PAI & Budi Pekerti' : m.subject).filter(Boolean);
                              let uniqueSubjects = Array.from(new Set(allSubjects));
                              if (uniqueSubjects.length > 1) {
                                uniqueSubjects = uniqueSubjects.filter(s => s !== 'Semua Mapel');
                              }
                              if (uniqueSubjects.length > 0) {
                                return uniqueSubjects.map(formatSubjectName).join(', ');
                              }
                            }
                            return c.subject ? formatSubjectName(c.subject) : '-';
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${mCount > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                          {mCount} Materi
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setSelectedClassId(c.id)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="Lihat Detail Materi">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => setEditingClass(c)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit Kelas">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setConfirmDelete({id: c.id, name: c.name})} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Kelas">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Detail Manajemen Kelas</p>
              <h3 className="text-3xl font-black">{classes.find(c => c.id === selectedClassId)?.name}</h3>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-sm">
                  <BookOpen size={14} />
                  {formatSubjectName(classes.find(c => c.id === selectedClassId)?.subject) || 'Mata Pelajaran Belum Set'}
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-sm">
                  <Hash size={14} />
                  {classes.find(c => c.id === selectedClassId)?.code || 'Tanpa Kode'}
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-sm">
                  <Users size={14} />
                  {teachers[selectedTeacherId!] as string}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedClassId(null)} className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg active:scale-95">
              Tutup Detail
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Student List Section */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <GraduationCap size={20} />
                  </div>
                  <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">Daftar Murid</h4>
                </div>
                <span className="px-3 py-1 bg-white border border-gray-100 text-indigo-600 rounded-full text-[10px] font-bold">
                  {(studentsInClassMap[selectedClassId!] || []).length} Siswa
                </span>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {(studentsInClassMap[selectedClassId!] || []).length === 0 ? (
                  <div className="py-10 text-center text-gray-400 italic text-xs">
                    Belum ada murid di kelas ini
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(studentsInClassMap[selectedClassId!] || []).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl hover:bg-gray-50 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center font-bold text-gray-400 text-[10px] group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate uppercase tracking-tight">{s.full_name}</p>
                          <p className="text-[9px] text-gray-400 font-mono tracking-tighter">NISN: {s.nisn || '-'}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black border",
                          s.gender === 'P' ? "bg-pink-50 text-pink-600 border-pink-100" : "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {s.gender || 'L'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Materials Section */}
            <div className="xl:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['1', '2'].map((sem) => {
                  const semMaterials = (materialsMap[selectedClassId!] || []).filter(m => m.semester === sem);
                  return (
                    <div key={sem} className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-fit">
                      <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                         <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest">Semester {sem}</h4>
                         <span className="px-3 py-1 bg-white border border-gray-100 text-indigo-600 rounded-full text-[10px] font-bold">
                           {semMaterials.length} Materi
                         </span>
                      </div>
                      <div className="p-6 flex-1 space-y-4">
                        {semMaterials.length === 0 ? (
                          <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                             <div className="w-12 h-12 bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
                                <BookOpen size={20} />
                             </div>
                             <p className="text-xs font-medium italic">Belum ada materi diinput</p>
                          </div>
                        ) : (
                          semMaterials.map((mat) => (
                            <div key={mat.id} className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 group relative">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1">
                                  <h5 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{formatSubjectName(mat.subject)}</h5>
                                  <p className="text-[10px] text-gray-400 font-medium">Input pada: {new Date(mat.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => setEditingMaterial({classId: selectedClassId!, material: mat})} className="p-2 bg-white text-gray-400 hover:text-indigo-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-indigo-100">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => setConfirmDeleteMaterial({classId: selectedClassId!, id: mat.id, subject: mat.subject})} className="p-2 bg-white text-gray-400 hover:text-red-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-red-100">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="space-y-4">
                                {mat.topics?.map((topic, i) => (
                                  <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-50/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                      <p className="font-bold text-gray-800 text-[11px]">{topic.title}</p>
                                    </div>
                                    <div className="pl-7 space-y-1">
                                      {topic.sub_topics?.map((sub, j) => (
                                        <div key={j} className="flex items-start gap-2 group/sub">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 mt-1.5 group-hover/sub:bg-indigo-600 group-hover/sub:scale-125 transition-all"></div>
                                          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{sub}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingClass && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Data Kelas</h3>
                <button onClick={() => setEditingClass(null)} className="text-white/70 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={handleUpdateClass} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nama Kelas</label>
                  <input type="text" value={editingClass.name} onChange={(e) => setEditingClass({...editingClass, name: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Kode Kelas</label>
                  <input type="text" value={editingClass.code || ''} onChange={(e) => setEditingClass({...editingClass, code: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Wali Kelas</label>
                  <select value={editingClass.teacher_id} onChange={(e) => setEditingClass({...editingClass, teacher_id: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10">
                    {Object.entries(teachers).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mata Pelajaran</label>
                  <select 
                    value={editingClass.subject || 'Semua Mapel'} 
                    onChange={(e) => setEditingClass({...editingClass, subject: e.target.value})} 
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 cursor-pointer"
                  >
                    {SUBJECT_OPTIONS.map(s => (
                      <option key={s} value={s}>{formatSubjectName(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setEditingClass(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">Batal</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100">Simpan Perubahan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={!!confirmDelete}
        title="Hapus Kelas"
        message={`Apakah Anda yakin ingin menghapus kelas "${confirmDelete?.name}"? Seluruh data yang terhubung mungkin akan hilang.`}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteClass(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <AnimatePresence>
        {editingMaterial && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Edit Materi Pelajaran</h3>
                  <p className="text-indigo-100 text-xs mt-1">Sesuaikan materi, topik, dan sub-topik</p>
                </div>
                <button onClick={() => setEditingMaterial(null)} className="text-white/70 hover:text-white"><X size={24} /></button>
              </div>
              <div className="overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Mata Pelajaran</label>
                     <input 
                       type="text" 
                       value={editingMaterial.material.subject}
                       onChange={(e) => setEditingMaterial({
                         ...editingMaterial,
                         material: { ...editingMaterial.material, subject: e.target.value }
                       })}
                       className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold"
                     />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Semester</label>
                    <select
                      value={editingMaterial.material.semester}
                      onChange={(e) => setEditingMaterial({
                        ...editingMaterial,
                        material: { ...editingMaterial.material, semester: e.target.value as '1' | '2' }
                      })}
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-600/10"
                    >
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Daftar Topik</label>
                  {editingMaterial.material.topics?.map((topic, i) => (
                    <div key={i} className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{i+1}</div>
                           <input 
                             type="text" 
                             value={topic.title}
                             onChange={(e) => {
                               const newTopics = [...editingMaterial.material.topics];
                               newTopics[i].title = e.target.value;
                               setEditingMaterial({
                                 ...editingMaterial,
                                 material: { ...editingMaterial.material, topics: newTopics }
                               });
                             }}
                             className="flex-1 bg-white px-4 py-2 rounded-xl text-sm font-bold border-0 focus:ring-2 focus:ring-indigo-600/10"
                             placeholder="Judul Materi Utama"
                           />
                           <button 
                             type="button"
                             onClick={() => {
                               const newTopics = editingMaterial.material.topics.filter((_, idx) => idx !== i);
                               setEditingMaterial({
                                 ...editingMaterial,
                                 material: { ...editingMaterial.material, topics: newTopics }
                               });
                             }}
                             className="p-2 text-red-400 hover:text-red-600"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                        
                        <div className="pl-11 space-y-2">
                           {topic.sub_topics?.map((sub, j) => (
                             <div key={j} className="flex items-center gap-2">
                               <input 
                                 type="text"
                                 value={sub}
                                 onChange={(e) => {
                                   const newTopics = [...editingMaterial.material.topics];
                                   newTopics[i].sub_topics[j] = e.target.value;
                                   setEditingMaterial({
                                     ...editingMaterial,
                                     material: { ...editingMaterial.material, topics: newTopics }
                                   });
                                 }}
                                 className="flex-1 bg-white px-4 py-2 rounded-xl text-xs border border-gray-100 focus:ring-2 focus:ring-indigo-600/10"
                                 placeholder="Sub-materi"
                               />
                               <button 
                                 type="button"
                                 onClick={() => {
                                   const newTopics = [...editingMaterial.material.topics];
                                   newTopics[i].sub_topics = newTopics[i].sub_topics.filter((_, idx) => idx !== j);
                                   setEditingMaterial({
                                     ...editingMaterial,
                                     material: { ...editingMaterial.material, topics: newTopics }
                                   });
                                 }}
                                 className="p-1.5 text-gray-300 hover:text-red-400"
                               >
                                 <X size={12} />
                               </button>
                             </div>
                           ))}
                           <button 
                             type="button"
                             onClick={() => {
                               const newTopics = [...editingMaterial.material.topics];
                               newTopics[i].sub_topics = [...(newTopics[i].sub_topics || []), ''];
                               setEditingMaterial({
                                 ...editingMaterial,
                                 material: { ...editingMaterial.material, topics: newTopics }
                               });
                             }}
                             className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                           >
                             <Plus size={10} /> Tambah Sub-materi
                           </button>
                        </div>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => {
                      const newTopics = [...(editingMaterial.material.topics || []), { title: '', sub_topics: [] }];
                      setEditingMaterial({
                        ...editingMaterial,
                        material: { ...editingMaterial.material, topics: newTopics }
                      });
                    }}
                    className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-400 text-xs font-bold hover:bg-indigo-50 transition-colors uppercase tracking-widest"
                  >
                    + Tambah Topik Baru
                  </button>
                </div>
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                 <button onClick={() => setEditingMaterial(null)} className="flex-1 py-4 bg-white text-gray-500 rounded-2xl font-bold border border-gray-200 uppercase tracking-widest text-xs">Batal</button>
                 <button 
                   onClick={handleUpdateMaterial} 
                   disabled={isSubmitting} 
                   className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 uppercase tracking-widest text-xs"
                 >
                   Simpan Perubahan
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={!!confirmDeleteMaterial}
        title="Hapus Materi"
        message={`Apakah Anda yakin ingin menghapus materi "${confirmDeleteMaterial?.subject}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={() => {
          if (confirmDeleteMaterial) {
            handleDeleteMaterial(confirmDeleteMaterial.classId, confirmDeleteMaterial.id);
            setConfirmDeleteMaterial(null);
          }
        }}
        onCancel={() => setConfirmDeleteMaterial(null)}
      />
    </div>
  );
}

function ExtracurricularManagement() {
  const [items, setItems] = useState<Extracurricular[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Extracurricular | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    coach_name: '',
    schedule: '',
    description: ''
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const path = 'extracurriculars';
    try {
      setLoading(true);
      const q = query(collection(db, path), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const docData = d.data();
        let createdAtVal = docData.created_at;
        if (createdAtVal && typeof createdAtVal.toDate === 'function') {
          createdAtVal = createdAtVal.toDate().toISOString();
        } else if (createdAtVal && createdAtVal.seconds) {
          createdAtVal = new Date(createdAtVal.seconds * 1000).toISOString();
        }
        return {
          id: d.id,
          ...docData,
          created_at: createdAtVal
        };
      }) as Extracurricular[];
      setItems(data);
    } catch (err) {
      console.error('Error fetching extracurriculars:', err);
      toast.error('Gagal mengambil data ekstrakurikuler');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama ekstrakurikuler tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    const path = 'extracurriculars';
    try {
      if (editingItem) {
        const docRef = doc(db, path, editingItem.id);
        const updateData = {
          name: formData.name,
          coach_name: formData.coach_name || '',
          schedule: formData.schedule || '',
          description: formData.description || '',
          created_at: editingItem.created_at ? new Date(editingItem.created_at) : serverTimestamp()
        };
        await setDoc(docRef, updateData, { merge: true });
        toast.success('Ekstrakurikuler berhasil diperbarui');
      } else {
        const newDocRef = doc(collection(db, path));
        const newData = {
          id: newDocRef.id,
          name: formData.name,
          coach_name: formData.coach_name || '',
          schedule: formData.schedule || '',
          description: formData.description || '',
          created_at: serverTimestamp()
        };
        await setDoc(newDocRef, newData);
        toast.success('Ekstrakurikuler berhasil ditambahkan');
      }
      setFormData({ name: '', coach_name: '', schedule: '', description: '' });
      setEditingItem(null);
      setShowForm(false);
      fetchItems();
    } catch (err) {
      console.error('Error saving extracurricular:', err);
      toast.error('Gagal menyimpan data');
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Apakah Anda yakin ingin menghapus ekstrakurikuler ini?')) return;
    const path = 'extracurriculars';
    try {
      await deleteDoc(doc(db, path, id));
      toast.success('Ekstrakurikuler berhasil dihapus');
      fetchItems();
    } catch (err) {
      console.error('Error deleting extracurricular:', err);
      toast.error('Gagal menghapus data');
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  const startEdit = (item: Extracurricular) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      coach_name: item.coach_name || '',
      schedule: item.schedule || '',
      description: item.description || ''
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="text-indigo-600 shrink-0" size={26} />
            Kelola Ekstrakurikuler 🏆
          </h1>
          <p className="text-gray-500">Daftar & info kegiatan ekstrakurikuler yang dilaksanakan oleh sekolah.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', coach_name: '', schedule: '', description: '' });
            setShowForm(true);
          }}
          className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Tambah Ekstrakurikuler
        </button>
      </div>

      {loading ? (
        <div className="h-60 flex items-center justify-center">
          <RefreshCw className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada Kegiatan Ekstrakurikuler</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">Tambahkan program pengembangan bakat dan minat siswa di sekolah ini.</p>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', coach_name: '', schedule: '', description: '' });
              setShowForm(true);
            }}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 uppercase tracking-widest hover:bg-indigo-700 transition"
          >
            Mulai Tambah
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="px-3 py-1.5 bg-indigo-50 rounded-xl text-indigo-700 font-bold text-xs uppercase tracking-tight flex items-center gap-1.5">
                    <Trophy size={14} /> EKSKUL
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 bg-gray-50 text-gray-400 hover:text-indigo-600 rounded-xl hover:shadow transition border border-transparent hover:border-indigo-100"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-xl hover:shadow transition border border-transparent hover:border-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-gray-950 text-base mb-2 uppercase tracking-tight">{item.name}</h3>
                
                <div className="space-y-2 mb-4">
                  {item.coach_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider bg-indigo-50/50 px-2 py-0.5 rounded">Pembina:</span>
                      <span className="truncate">{item.coach_name}</span>
                    </div>
                  )}
                  {item.schedule && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider bg-indigo-50/50 px-2 py-0.5 rounded">Jadwal:</span>
                      <span className="truncate">{item.schedule}</span>
                    </div>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-2 line-clamp-3 italic">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog/Modal Overlay */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-widest text-indigo-950">
                  {editingItem ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 bg-white text-gray-400 hover:text-gray-600 hover:shadow rounded-xl transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nama Kegiatan *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Contoh: Pramuka, Paduan Suara, Futsal"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nama Pembina/Pelatih</label>
                  <input
                    type="text"
                    value={formData.coach_name}
                    onChange={(e) => setFormData({ ...formData, coach_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Contoh: Kak Akhmad, S.Pd."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Jadwal Pelaksanaan</label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Contoh: Setiap Sabtu, Pkl 14.00 - selesai"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Deskripsi / Kegiatan</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    placeholder="Tuliskan keterangan singkat kegiatan ekstrakurikuler..."
                  />
                </div>

                <div className="flex gap-4 border-t border-gray-50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold uppercase tracking-widest text-xs transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-100 transition"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CocurricularManagement() {
  const [items, setItems] = useState<Cocurricular[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Cocurricular | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    class_level: '',
    semester: '1' as '1' | '2',
    description: ''
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const path = 'cocurriculars';
    try {
      setLoading(true);
      const q = query(collection(db, path), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const docData = d.data();
        let createdAtVal = docData.created_at;
        if (createdAtVal && typeof createdAtVal.toDate === 'function') {
          createdAtVal = createdAtVal.toDate().toISOString();
        } else if (createdAtVal && createdAtVal.seconds) {
          createdAtVal = new Date(createdAtVal.seconds * 1000).toISOString();
        }
        return {
          id: d.id,
          ...docData,
          created_at: createdAtVal
        };
      }) as Cocurricular[];
      setItems(data);
    } catch (err) {
      console.error('Error fetching cocurriculars:', err);
      toast.error('Gagal mengambil data kokurikuler');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Judul kokurikuler tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    const path = 'cocurriculars';
    try {
      if (editingItem) {
        const docRef = doc(db, path, editingItem.id);
        const updateData = {
          title: formData.title,
          class_level: formData.class_level || '',
          semester: formData.semester,
          description: formData.description || '',
          created_at: editingItem.created_at ? new Date(editingItem.created_at) : serverTimestamp()
        };
        await setDoc(docRef, updateData, { merge: true });
        toast.success('Kokurikuler berhasil diperbarui');
      } else {
        const newDocRef = doc(collection(db, path));
        const newData = {
          id: newDocRef.id,
          title: formData.title,
          class_level: formData.class_level || '',
          semester: formData.semester,
          description: formData.description || '',
          created_at: serverTimestamp()
        };
        await setDoc(newDocRef, newData);
        toast.success('Kokurikuler / Proyek Tema berhasil ditambahkan');
      }
      setFormData({ title: '', class_level: '', semester: '1', description: '' });
      setEditingItem(null);
      setShowForm(false);
      fetchItems();
    } catch (err) {
      console.error('Error saving cocurricular:', err);
      toast.error('Gagal menyimpan data');
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Apakah Anda yakin ingin menghapus topik kokurikuler ini?')) return;
    const path = 'cocurriculars';
    try {
      await deleteDoc(doc(db, path, id));
      toast.success('Kokurikuler berhasil dihapus');
      fetchItems();
    } catch (err) {
      console.error('Error deleting cocurricular:', err);
      toast.error('Gagal menghapus data');
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  const startEdit = (item: Cocurricular) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      class_level: item.class_level || '',
      semester: item.semester,
      description: item.description || ''
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Compass className="text-indigo-600 shrink-0" size={26} />
            Kelola Kokurikuler 🧩
          </h1>
          <p className="text-gray-500">Manajemen topik kegiatan kokurikuler sekolah.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ title: '', class_level: '', semester: '1', description: '' });
            setShowForm(true);
          }}
          className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Tambah Topik Kokurikuler
        </button>
      </div>

      {loading ? (
        <div className="h-60 flex items-center justify-center">
          <RefreshCw className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Compass size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada Kegiatan Kokurikuler</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">Tambahkan program kokurikuler pendukung kurikulum inti di sekolah ini.</p>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ title: '', class_level: '', semester: '1', description: '' });
              setShowForm(true);
            }}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 uppercase tracking-widest hover:bg-indigo-700 transition"
          >
            Mulai Tambah
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="px-3 py-1.5 bg-indigo-50 rounded-xl text-indigo-700 font-bold text-xs uppercase tracking-tight flex items-center gap-1.5">
                    <Compass size={14} /> KOKURIKULER
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 bg-gray-50 text-gray-400 hover:text-indigo-600 rounded-xl hover:shadow transition border border-transparent hover:border-indigo-100"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-xl hover:shadow transition border border-transparent hover:border-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-gray-950 text-base mb-2 uppercase tracking-tight">{item.title}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider bg-indigo-50/50 px-2 py-0.5 rounded">Semester:</span>
                    <span>{item.semester}</span>
                  </div>
                  {item.class_level && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider bg-indigo-50/50 px-2 py-0.5 rounded">Sasaran:</span>
                      <span className="truncate">{item.class_level}</span>
                    </div>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-2 line-clamp-3 italic">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog/Modal Overlay */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-widest text-indigo-950">
                  {editingItem ? 'Edit Topik Kokurikuler' : 'Tambah Topik Kokurikuler'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 bg-white text-gray-400 hover:text-gray-600 hover:shadow rounded-xl transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nama Proyek / Topik Kokurikuler *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Contoh: Projek Gaya Hidup Berkelanjutan: Cerdik Kelola Sampah Plastik"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Semester</label>
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value as '1' | '2' })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="1">1 (Ganjil)</option>
                      <option value="2">2 (Genap)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sasaran Tingkat/Kelas</label>
                    <input
                      type="text"
                      value={formData.class_level}
                      onChange={(e) => setFormData({ ...formData, class_level: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Contoh: Kelas 1 & 4, Semua Kelas"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tujuan / Deskripsi Kegiatan</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    placeholder="Tuliskan keterangan detail mengenai capaian, tema, dimensi proyek, atau jenis aksi proyek..."
                  />
                </div>

                <div className="flex gap-4 border-t border-gray-50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold uppercase tracking-widest text-xs transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-100 transition"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
