import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { Profile, SystemSettings } from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  GraduationCap, 
  Settings, 
  LogOut,
  Menu,
  X,
  Database,
  UserCheck,
  Trophy,
  Compass,
  ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';
import TeacherDashboard from './teacher/TeacherDashboard';
import StudentDashboard from './student/StudentDashboard';
import AdminDashboard from './admin/AdminDashboard';
import DapodikIntegration from './DapodikIntegration';

interface DashboardProps {
  profile: Profile;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    return () => unsubscribe();
  }, []);

  const adminNav = [
    { id: 'overview', name: 'Admin Overview', icon: LayoutDashboard },
    { id: 'settings', name: 'Pengaturan Sekolah', icon: Settings },
    { id: 'approval', name: 'Persetujuan User', icon: UserCheck },
    { id: 'users', name: 'Kelola Pengguna', icon: Users },
    { id: 'students', name: 'Kelola Murid', icon: GraduationCap },
    { id: 'classes', name: 'Kelola Kelas', icon: BookOpen },
    { id: 'extracurricular', name: 'Ekstrakurikuler', icon: Trophy },
    { id: 'cocurricular', name: 'Kokurikuler', icon: Compass },
    { id: 'grades', name: 'Input Nilai', icon: GraduationCap },
    { id: 'recap_reports', name: 'Rekap Nilai & Rapor', icon: ClipboardList },
    { id: 'dapodik', name: 'Integrasi Dapodik', icon: Database },
  ];

  const teacherNav = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'teacher_identity', name: 'Identitas Guru', icon: UserCheck },
    { id: 'students', name: 'Manajemen Siswa', icon: Users },
    { id: 'classes', name: 'Manajemen Kelas', icon: BookOpen },
    { id: 'attendance', name: 'Absensi', icon: ClipboardCheck },
    { id: 'grades', name: 'Input Nilai', icon: GraduationCap },
    { id: 'recap_reports', name: 'Rekap Nilai & Rapor', icon: ClipboardList },
    { id: 'schedule', name: 'Jadwal', icon: Calendar },
    { id: 'docs', name: 'Perangkat Pembelajaran', icon: FileText },
    { id: 'dapodik', name: 'Integrasi Dapodik', icon: Database },
  ];

  const studentNav = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'schedule', name: 'Jadwal Pelajaran', icon: Calendar },
    { id: 'attendance', name: 'Absensi Saya', icon: ClipboardCheck },
    { id: 'grades', name: 'Nilai & Rapor', icon: GraduationCap },
  ];

  const getNavItems = () => {
    switch (profile.role) {
      case 'admin': return adminNav;
      case 'teacher': {
        const isClassTeacher = profile.teacher_type?.startsWith('Guru Kelas');
        return isClassTeacher 
          ? teacherNav 
          : teacherNav.filter(item => item.id !== 'attendance');
      }
      default: return studentNav;
    }
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await signOut(auth);
  };

  const renderDashboard = () => {
    if (activeTab === 'dapodik') {
      return <DapodikIntegration profile={profile} />;
    }
    switch (profile.role) {
      case 'admin':
        return <AdminDashboard activeTab={activeTab} profile={profile} />;
      case 'teacher':
        return <TeacherDashboard activeTab={activeTab} profile={profile} />;
      default:
        return <StudentDashboard activeTab={activeTab} profile={profile} />;
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#F8F9FA] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-gray-100 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <span className="text-xl font-bold text-indigo-600 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                S
              </div>
              SimSek
            </span>
          )}
          {!isSidebarOpen && (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mx-auto">
              S
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative text-left",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-600" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon size={20} className={cn(
                "shrink-0",
                activeTab === item.id ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
              )} />
              {isSidebarOpen && <span className="text-sm font-medium flex-1 text-left">{item.name}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all",
              isSidebarOpen ? "" : "justify-center"
            )}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="text-sm font-medium">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-3 text-right">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900 leading-snug">
                {profile.full_name}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                {profile.role === 'student'
                  ? `NISN. ${profile.nisn || profile.nis || '-'}`
                  : `NIP. ${(profile as any).nip || profile.nis || '-'}`}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {renderDashboard()}
        </div>
      </main>
    </div>
  );
}
