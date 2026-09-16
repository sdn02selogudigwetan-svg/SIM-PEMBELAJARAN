import React from 'react';
import { Profile } from '../../types';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  Award,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatSubjectName } from '../../lib/utils';

interface StudentDashboardProps {
  activeTab: string;
  profile: Profile;
}

export default function StudentDashboard({ activeTab, profile }: StudentDashboardProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <StudentOverview profile={profile} />;
      case 'schedule':
        return <StudentSchedule />;
      case 'attendance':
        return <StudentAttendance />;
      case 'grades':
        return <StudentGrades />;
      default:
        return <StudentOverview profile={profile} />;
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

function StudentOverview({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Halo, {profile.full_name}! 👋</h1>
        <p className="text-gray-500">Berikut adalah ringkasan akademismu hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Kehadiran', value: '98%', icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Rata-rata Nilai', value: '88.5', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'Tugas Selesai', value: '12/15', icon: BookOpen, color: 'bg-purple-50 text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-indigo-600" />
            Jadwal Hari Ini
          </h3>
          <div className="space-y-4">
            {[
              { time: '07:00 - 08:30', subject: 'Matematika', room: 'R. 102' },
              { time: '08:30 - 10:00', subject: 'Bahasa Indonesia', room: 'R. 102' },
              { time: '10:30 - 12:00', subject: 'IPA', room: 'Laborat' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-10 bg-indigo-500 rounded-full"></div>
                  <div>
                    <p className="font-bold text-sm">{formatSubjectName(s.subject)}</p>
                    <p className="text-xs text-gray-500">{s.time}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-white border border-gray-100 rounded-lg shadow-sm">
                  {s.room}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            Nilai Terakhir
          </h3>
          <div className="space-y-4">
            {[
              { subject: 'Matematika', score: 92, type: 'Harian' },
              { subject: 'Bahasa Inggris', score: 85, type: 'Tugas' },
              { subject: 'Seni Budaya', score: 95, type: 'Proyek' },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                <div>
                  <p className="font-bold text-sm">{formatSubjectName(n.subject)}</p>
                  <p className="text-xs text-gray-500">{n.type}</p>
                </div>
                <div className="text-2xl font-black text-indigo-600">
                  {n.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentSchedule() { return <div>Halaman Jadwal Pelajaran</div>; }
function StudentAttendance() { return <div>Halaman Absensi Saya</div>; }
function StudentGrades() { return <div>Halaman Nilai & Rapor</div>; }

import { cn } from '../../lib/utils';
