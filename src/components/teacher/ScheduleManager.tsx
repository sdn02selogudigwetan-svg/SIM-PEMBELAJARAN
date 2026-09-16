import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatSubjectName } from '../../lib/utils';

export default function ScheduleManager() {
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const times = ['07:00', '08:30', '10:00', '11:00', '12:30'];

  const schedules = [
    { day: 'Senin', time: '07:00', subject: 'Matematika', class: '7A', room: 'R. 101' },
    { day: 'Senin', time: '08:30', subject: 'Matematika', class: '7B', room: 'R. 102' },
    { day: 'Selasa', time: '10:00', subject: 'IPA', class: '8A', room: 'Lab IPA' },
    { day: 'Rabu', time: '07:00', subject: 'Matematika', class: '7A', room: 'R. 101' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Pelajaran</h1>
          <p className="text-gray-500">Atur jadwal mengajar dan ruangan kelas.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={20} />
          Tambah Jadwal
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-4 border border-gray-100 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center w-24">Waktu</th>
                {days.map((day) => (
                  <th key={day} className="p-4 border border-gray-100 font-bold text-gray-600 uppercase text-[10px] tracking-widest text-center min-w-[150px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <td className="p-4 border border-gray-100 font-black text-xs text-gray-400 text-center bg-gray-50/20">
                    {time}
                  </td>
                  {days.map((day) => {
                    const item = schedules.find(s => s.day === day && s.time === time);
                    return (
                      <td key={`${day}-${time}`} className="p-2 border border-gray-100 align-top h-32">
                        {item ? (
                          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl h-full flex flex-col justify-between group hover:bg-indigo-600 transition-all cursor-pointer">
                            <div>
                              <p className="font-bold text-indigo-700 text-xs group-hover:text-white transition-colors">{formatSubjectName(item.subject)}</p>
                              <p className="text-[10px] text-indigo-400 font-black uppercase group-hover:text-indigo-100 transition-colors mt-0.5">{item.class}</p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-indigo-300 font-medium group-hover:text-indigo-200 transition-colors">
                              <MapPin size={10} />
                              {item.room}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full w-full rounded-xl border border-dashed border-gray-100 flex items-center justify-center text-gray-300 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                             <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
