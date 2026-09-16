import React from 'react';
import { Profile } from '../../types';
import { 
  Users, 
  BookOpen, 
  ClipboardCheck, 
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react';

export default function Overview({ profile }: { profile: Profile }) {
  const stats = [
    { label: 'Total Siswa', value: '124', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Kelas Aktif', value: '6', icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Kehadiran Hari Ini', value: '96.2%', icon: ClipboardCheck, color: 'bg-green-50 text-green-600' },
    { label: 'Dokumen Perangkat', value: '18', icon: FileText, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Halo, Pak/Bu {profile.full_name?.split(' ')[0]}! 👋</h1>
        <p className="text-gray-500">Selamat datang kembali di panel manajemen sekolah.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <Clock size={20} className="text-indigo-600" />
              Aktivitas Terakhir
            </h3>
            <button className="text-xs font-semibold text-indigo-600 hover:underline">Lihat Semua</button>
          </div>
          <div className="space-y-4">
            {[
              { text: 'Anda mengunggah modul ajar Matematika Bab 2', time: '10 menit yang lalu', type: 'doc' },
              { text: 'Absensi Kelas 7A telah diselesaikan', time: '1 jam yang lalu', type: 'attendance' },
              { text: 'Input nilai sumatif Matematika - Budi Santoso', time: '3 jam yang lalu', type: 'grade' },
            ].map((activity, i) => (
              <div key={i} className="flex gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="w-2 h-2 mt-2 rounded-full bg-indigo-500 shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.text}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              Statistik Kehadiran
            </h3>
            <select className="text-xs bg-gray-50 border-0 rounded-lg p-1 outline-none">
              <option>Minggu Ini</option>
              <option>Bulan Ini</option>
            </select>
          </div>
          <div className="h-48 flex items-end gap-2 px-2">
            {[65, 80, 45, 90, 75, 85, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div 
                  className="w-full bg-indigo-100 group-hover:bg-indigo-600 transition-all rounded-t-lg relative" 
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    {h}%
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">M{i+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
