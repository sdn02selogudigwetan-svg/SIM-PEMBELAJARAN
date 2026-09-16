import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Calendar as CalendarIcon, 
  Check, 
  X as XIcon, 
  UserMinus, 
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { Profile, Class } from '../../types';
import { toast } from 'react-hot-toast';

interface AttendanceControlProps {
  profile: Profile;
}

interface StudentItem {
  id: string;
  name: string;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function AttendanceControl({ profile }: AttendanceControlProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsList, setStudentsList] = useState<StudentItem[]>([]);
  
  // Monthly navigation states
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Format: { [dateStrKey]: { [studentIdKey]: { status, notes } } }
  const [monthlyAttendance, setMonthlyAttendance] = useState<Record<string, Record<string, { status: string; notes?: string }>>>({});
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Editing active cell popover/modal state
  const [activeCell, setActiveCell] = useState<{ 
    studentId: string; 
    studentName: string; 
    dateStr: string; 
    currentStatus: string; 
    currentNotes: string;
  } | null>(null);

  useEffect(() => {
    fetchClasses();
  }, [profile.id]);

  useEffect(() => {
    if (selectedClassId) {
      fetchMonthlyAttendance();
    }
  }, [selectedClassId, selectedMonth, selectedYear]);

  async function fetchClasses() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'classes'),
        where('teacher_id', '==', profile.id),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      
      // Filter classes only (guru kelas types are already handled securely via routing/sidebar)
      setClasses(data);
      if (data.length > 0) {
        setSelectedClassId(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setLoading(false);
    }
  }

  async function fetchMonthlyAttendance() {
    setLoading(true);
    try {
      const cls = classes.find(c => c.id === selectedClassId);
      if (!cls) {
        setLoading(false);
        return;
      }

      // 1. Fetch Students registered in this class level
      const jenjang = cls.name.replace(/\D/g, '');
      const studentQuery = query(
        collection(db, 'students'),
        where('class_id', 'in', [jenjang, cls.id])
      );
      const studentSnap = await getDocs(studentQuery);
      const list = studentSnap.docs.map(d => ({
        id: d.id,
        name: d.data().full_name || 'Tanpa Nama'
      }));
      // Sort alphabetically by name
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudentsList(list);

      // 2. Fetch Attendance docs for this class
      const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const q = query(
        collection(db, 'attendance'),
        where('class_id', '==', selectedClassId)
      );
      const snapshot = await getDocs(q);
      
      const attendanceMap: Record<string, Record<string, { status: string; notes?: string }>> = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const dateStr = data.date; // e.g., "2026-05-18"
        if (dateStr && dateStr.startsWith(monthPrefix)) {
          attendanceMap[dateStr] = data.records || {};
        }
      });
      setMonthlyAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      toast.error('Gagal mengambil data presensi bulanan');
    } finally {
      setLoading(false);
    }
  }

  // Helper date calculations
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInMonth = Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => i + 1);

  const getDayName = (day: number) => {
    const d = new Date(selectedYear, selectedMonth, day);
    const names = ['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return names[d.getDay()];
  };

  const isWeekend = (day: number) => {
    const d = new Date(selectedYear, selectedMonth, day);
    const dayOfWeek = d.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  };

  const changeMonth = (direction: number) => {
    let nextMonth = selectedMonth + direction;
    let nextYear = selectedYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  };

  const handleCellClick = (studentId: string, studentName: string, dayNum: number) => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const studentRecords = monthlyAttendance[dateStr] || {};
    const record = studentRecords[studentId] || { status: 'present', notes: '' };
    
    setActiveCell({
      studentId,
      studentName,
      dateStr,
      currentStatus: record.status,
      currentNotes: record.notes || ''
    });
  };

  async function handleSaveCellUpdate(status: string, notes: string) {
    if (!activeCell || !selectedClassId) return;
    const { studentId, dateStr } = activeCell;
    setIsSubmitting(true);

    // Optimistic UI update
    const updatedRecords = { ...(monthlyAttendance[dateStr] || {}) };
    updatedRecords[studentId] = { status, notes };

    const nextAttendance = { ...monthlyAttendance };
    nextAttendance[dateStr] = updatedRecords;
    setMonthlyAttendance(nextAttendance);

    const attDocRef = doc(db, 'attendance', `${selectedClassId}_${dateStr}`);
    try {
      await setDoc(attDocRef, {
        class_id: selectedClassId,
        date: dateStr,
        teacher_id: profile.id,
        records: updatedRecords,
        updated_at: serverTimestamp()
      }, { merge: true });
      
      toast.success('Presensi berhasil diperbarui!');
      setActiveCell(null);
    } catch (error: any) {
      console.error('Error saving single attendance cell:', error);
      toast.error('Gagal memperbarui presensi');
      handleFirestoreError(error, OperationType.WRITE, `attendance/${selectedClassId}_${dateStr}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper count status for the current active month and class
  const getTotalsByStatus = (status: 'present' | 'absent' | 'late' | 'sick') => {
    let total = 0;
    Object.values(monthlyAttendance).forEach(dayRecord => {
      Object.values(dayRecord).forEach(rec => {
        if (rec.status === status) {
          total++;
        }
      });
    });
    return total;
  };

  const totals = {
    present: getTotalsByStatus('present'),
    absent: getTotalsByStatus('absent'),
    late: getTotalsByStatus('late'),
    sick: getTotalsByStatus('sick')
  };

  const statusMap: Record<string, { label: string; shortLabel: string; color: string; badge: string; icon: any }> = {
    present: { label: 'Hadir', shortLabel: 'H', color: 'bg-green-500 text-white', badge: 'bg-green-50 text-green-700 border-green-100', icon: Check },
    absent: { label: 'Alfa', shortLabel: 'A', color: 'bg-red-500 text-white', badge: 'bg-red-50 text-red-700 border-red-100', icon: XIcon },
    late: { label: 'Izin', shortLabel: 'I', color: 'bg-amber-500 text-white', badge: 'bg-amber-50 text-amber-700 border-amber-100', icon: UserMinus },
    sick: { label: 'Sakit', shortLabel: 'S', color: 'bg-blue-500 text-white', badge: 'bg-blue-50 text-blue-700 border-blue-100', icon: Stethoscope }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Presensi Bulanan Siswa 📋
          </h1>
          <p className="text-gray-500">Kelola dan pantau kehadiran kelas Anda dalam tampilan kalender bulanan.</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm grow-0 shrink-0 self-start">
          <button 
            type="button"
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2 px-4 font-black text-sm text-gray-700 uppercase tracking-widest leading-none">
            <CalendarIcon size={16} className="text-indigo-600" />
            <span>{INDONESIAN_MONTHS[selectedMonth]} {selectedYear}</span>
          </div>
          <button 
            type="button"
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Class picker & stats summary bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-[2rem] border border-gray-150 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Kelas Anda:</span>
          {classes.length === 1 || profile.teacher_type?.startsWith('Guru Kelas') ? (
            <span className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-700">
              {classes.find(c => c.id === selectedClassId)?.name || 'Pilih Kelas'}
            </span>
          ) : (
            <select 
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {classes.length === 0 && !loading && <option disabled>Tidak ada kelas wali</option>}
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} - Wali Kelas</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span className="text-gray-300">Total Akumulasi Kehadiran Bulan Ini:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Hadir ({totals.present})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Sakit ({totals.sick})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Izin ({totals.late})</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Alfa ({totals.absent})</span>
          </div>
        </div>
      </div>

      {/* Instruction alert */}
      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-3">
        <Info className="text-indigo-500 shrink-0 mt-0.5" size={16} />
        <div className="text-xs text-indigo-900 leading-relaxed">
          <span className="font-bold block mb-0.5">Petunjuk Pengisian Absensi:</span>
          Klik langsung pada sel sel tanggal di sebelah nama siswa untuk memperbarui status presensi siswa (Hadir, Sakit, Izin, atau Alfa) beserta catatan pada tanggal tersebut secara langsung. Hari Sabtu dan Minggu berwarna merah muda pudar.
        </div>
      </div>

      {/* Monthly Interactive Grid Board */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-5 font-bold text-gray-400 uppercase text-[10px] tracking-widest sticky left-0 bg-gray-50 z-15 border-r border-gray-100 w-[200px] shrink-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  Nama Lengkap Siswa
                </th>
                {daysInMonth.map(dayNum => {
                  const weekend = isWeekend(dayNum);
                  return (
                    <th 
                      key={dayNum} 
                      className={cn(
                        "px-2.5 py-4 text-center font-bold border-r border-gray-100/70 min-w-[36px]",
                        weekend ? "text-red-400 bg-red-50/20" : "text-gray-500"
                      )}
                    >
                      <span className="block text-[8px] uppercase tracking-tighter text-gray-400">{getDayName(dayNum)}</span>
                      <span className="text-xs font-black">{dayNum}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={36} className="text-indigo-100 animate-spin" />
                      <p className="text-gray-400 font-bold">Mengambil data presensi kelas...</p>
                    </div>
                  </td>
                </tr>
              ) : studentsList.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="py-20 text-center text-gray-400 font-medium italic">
                    Belum ada siswa yang terdaftar di kelas Anda.
                  </td>
                </tr>
              ) : (
                studentsList.map(student => (
                  <tr key={student.id} className="hover:bg-indigo-50/10 transition-colors">
                    {/* Student Name column - Sticky Left */}
                    <td className="px-6 py-3.5 font-bold text-gray-700 bg-white sticky left-0 border-r border-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-ellipsis overflow-hidden whitespace-nowrap max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <span className="truncate">{student.name}</span>
                      </div>
                    </td>

                    {/* All Dates Columns */}
                    {daysInMonth.map(dayNum => {
                      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const dayRecords = monthlyAttendance[dateStr] || {};
                      const rec = dayRecords[student.id];
                      const weekend = isWeekend(dayNum);
                      const status = rec?.status || 'present';
                      const notes = rec?.notes || '';
                      const isDefault = !rec;
                      
                      return (
                        <td 
                          key={dayNum} 
                          onClick={() => handleCellClick(student.id, student.name, dayNum)}
                          className={cn(
                            "p-1 text-center cursor-pointer hover:bg-indigo-50/40 border-r border-gray-150/70 transition-all text-xs font-bold",
                            weekend ? "bg-red-50/10" : ""
                          )}
                        >
                          <div 
                            className={cn(
                              "w-7 h-7 mx-auto rounded-full font-black text-[10px] flex items-center justify-center shadow-sm select-none transition-transform active:scale-95",
                              status === 'present' ? (isDefault ? "bg-green-500/80 text-white" : "bg-green-500 text-white") :
                              status === 'absent' ? "bg-red-500 text-white" :
                              status === 'late' ? "bg-amber-500 text-white" :
                              "bg-blue-500 text-white"
                            )}
                            title={isDefault ? 'Belum Diisi (Hadir)' : `${statusMap[status]?.label}${notes ? ': ' + notes : ''}`}
                          >
                            {statusMap[status]?.shortLabel}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal update cell dialog overlay */}
      {activeCell && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border border-gray-100 max-w-md w-full p-6 shadow-2xl relative">
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  Ubah Presensi
                </span>
                <h3 className="font-bold text-gray-900 text-base mt-2 truncate">
                  {activeCell.studentName}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Tanggal: {new Date(activeCell.dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Status Picker Selector buttons */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Status Kehadiran:</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(statusMap).map(([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveCell({ ...activeCell, currentStatus: key })}
                      className={cn(
                        "py-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 focus:outline-none relative group",
                        activeCell.currentStatus === key 
                          ? "bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-100" 
                          : "bg-white border-gray-150 text-gray-700 hover:border-indigo-600 hover:text-indigo-600"
                      )}
                    >
                      <config.icon size={16} />
                      <span className="text-[10px] font-bold">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Attendance notes text input form */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Catatan Tambahan (Opsional):</label>
                <input 
                  type="text" 
                  value={activeCell.currentNotes}
                  onChange={(e) => setActiveCell({ ...activeCell, currentNotes: e.target.value })}
                  placeholder="Sakit demam, Izin acara nikah, dll..."
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-600/10 placeholder:text-gray-300"
                />
              </div>

              {/* Dialog action buttons control */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCell(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveSave()}
                  className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 flex items-center justify-center gap-1"
                >
                  {isSubmitting ? (
                    <RefreshCw className="animate-spin text-white" size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  Simpan Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper dispatcher to bridge onclick target save
  function handleSaveSave() {
    if (!activeCell) return;
    handleSaveCellUpdate(activeCell.currentStatus, activeCell.currentNotes);
  }
}
