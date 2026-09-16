import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Edit3,
  BookOpen,
  ChevronRight,
  Save,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Trophy,
  Compass,
  Calendar,
  X,
  Printer,
  ClipboardList,
  FileText,
  RefreshCcw
} from 'lucide-react';
import { cn, formatSubjectName } from '../../lib/utils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Profile, Class, LessonMaterial, Student, Grade, SystemSettings, Extracurricular, Cocurricular } from '../../types';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

const ACADEMIC_SUBJECTS = [
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

const sortSubjects = (subjList: string[]) => {
  const getIndex = (name: string) => {
    const norm = name.toLowerCase();
    if (norm.includes('agama') || norm === 'pai' || norm.includes('islam') || norm.includes('budi pekerti')) return 0;
    if (norm.includes('pancasila')) return 1;
    if (norm.includes('indonesia')) return 2;
    if (norm.includes('matematika')) return 3;
    if (norm.includes('ipas') || norm.includes('ipa') || norm.includes('ips')) return 4;
    if (norm.includes('seni rupa') || norm.includes('seni budaya') || norm.trim() === 'seni') return 5;
    if (norm.includes('pjok') || norm.includes('jasmani') || norm.includes('olahraga')) return 6;
    if (norm.includes('inggris')) return 7;
    if (norm.includes('jawa')) return 8;
    return 100; // default for others
  };
  return [...subjList].sort((a, b) => getIndex(a) - getIndex(b));
};

const customRound = (num: number): number => {
  // Clear potential float representation errors (e.g., 74.49999999999) before rounding
  return Math.round(parseFloat(num.toFixed(4)));
};

const evaluateAcademicPredicate = (score: number, rules?: { min: number; pred: string }[]): string => {
  const finalRules = rules || [
    { min: 85, pred: 'Sangat Baik' },
    { min: 70, pred: 'Baik' },
    { min: 60, pred: 'Cukup' },
    { min: 60, pred: 'Perlu Bimbingan' }
  ];
  const sangatBaik = finalRules.find(r => r.pred === 'Sangat Baik')?.min ?? 85;
  const baik = finalRules.find(r => r.pred === 'Baik')?.min ?? 70;
  const cukup = finalRules.find(r => r.pred === 'Cukup')?.min ?? 60;
  const perluBimbingan = finalRules.find(r => r.pred === 'Perlu Bimbingan')?.min ?? 60;

  if (score >= sangatBaik) return 'Sangat Baik';
  if (score >= baik) return 'Baik';
  if (score >= cukup) return 'Cukup';
  if (score <= perluBimbingan) return 'Perlu Bimbingan';
  return 'Perlu Bimbingan';
};

const isDateInSemester = (dateStr: string, semString: string) => {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length < 2) return false;
  const month = parseInt(parts[1], 10);
  if (semString === '1') {
    return month >= 7 && month <= 12;
  } else {
    return month >= 1 && month <= 6;
  }
};

const getNumericLevel = (str: string | undefined): string => {
  if (!str) return '';
  const match = str.match(/\d+/);
  return match ? match[0] : str.trim();
};

const isSameNISN = (nisn1: string | undefined, nisn2: string | undefined): boolean => {
  if (!nisn1 || !nisn2) return false;
  const n1 = nisn1.trim().toLowerCase();
  const n2 = nisn2.trim().toLowerCase();
  return n1 === n2 && n1 !== '' && n1 !== '-' && n1 !== 'null' && n1 !== 'undefined';
};

interface GradeManagementProps {
  profile: Profile;
  viewMode?: 'input' | 'recap';
}

const withAnandaPrefix = (text: string, studentName: string) => {
  if (!text) return '';
  const prefix = `Ananda ${studentName}`;
  let cleaned = text.trim();
  
  const anandaMatch = cleaned.match(/^Ananda\s+/i);
  if (anandaMatch) {
    cleaned = cleaned.substring(anandaMatch[0].length);
  }
  
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }
  
  return `${prefix} ${cleaned}`;
};

const isSameSubject = (subj1: string | undefined | null, subj2: string | undefined | null): boolean => {
  if (!subj1 || !subj2) return false;
  const s1 = subj1.trim().toLowerCase();
  const s2 = subj2.trim().toLowerCase();
  if (s1 === s2) return true;

  // Normalize strings by removing non-alphanumeric characters and spaces
  const norm = (s: string) => s.replace(/[^a-z0-9]/g, '');
  const n1 = norm(s1);
  const n2 = norm(s2);
  if (n1 === n2 && n1.length > 0) return true;

  // Comprehensive primary school subject alias groups (Indonesia)
  const groups = [
    // PAI / Islamic Religion
    ['pai', 'agama', 'budipekerti', 'pendidikanagama', 'pendidikanagamaislam', 'agamaislam', 'pendidikanagamaislamdanbudipekerti', 'pendidikanagamaislambudipekerti', 'pendidikanagamadanbudipekerti', 'agamadanbudipekerti', 'paibudipekerti', 'paidanbudipekerti', 'pendidikanagamaislamdanbudipekerti'],
    // Pancasila / PKn / PPKn
    ['pancasila', 'pendidikanpancasila', 'pkn', 'ppkn', 'pendidikanpancasiladankewarganegaraan', 'pendidikanpancasilakewarganegaraan'],
    // Bahasa Indonesia
    ['bahasaindonesia', 'bindonesia', 'bindo', 'indonesia'],
    // Matematika / MTK
    ['matematika', 'mtk', 'math', 'mathematics'],
    // IPAS
    ['ipas', 'ilmupengetahuanalamdansosial', 'ilmupengetahuanalamdanilmupengetahuansosial'],
    // IPA
    ['ipa', 'ilmupengetahuanalam'],
    // IPS
    ['ips', 'ilmupengetahuansosial'],
    // PJOK / Penjas / Olahraga
    ['pjok', 'jasmani', 'olahraga', 'kesehatan', 'penjas', 'penjaskes', 'penjasorkes', 'pendidikanjasmani', 'pendidikanjasmaniolahragadankesehatan', 'pendidikanjasmaniolahragakesehatan', 'jasmaniolahragadankesehatan'],
    // Bahasa Inggris / English
    ['bahasainggris', 'binggris', 'inggris', 'english'],
    // Seni Rupa
    ['senirupa', 'senirupadanprakarya'],
    // Seni Musik
    ['senimusik'],
    // Seni Tari
    ['senitari'],
    // Seni Teater
    ['seniteater'],
    // Seni / SBdP (Seni Budaya dan Prakarya)
    ['senibudaya', 'senilukis', 'sbdp', 'senibudayadanprakarya', 'seni']
  ];

  for (const group of groups) {
    if (group.includes(n1) && group.includes(n2)) return true;
  }

  // Fallback heuristic keyword-based matches
  if (
    (s1.includes('agama') || s1.includes('pai') || s1.includes('budi pekerti') || s1.includes('islam')) &&
    (s2.includes('agama') || s2.includes('pai') || s2.includes('budi pekerti') || s2.includes('islam'))
  ) return true;

  if (
    (s1.includes('jasmani') || s1.includes('olahraga') || s1 === 'pjok' || s1.includes('penjas')) &&
    (s2.includes('jasmani') || s2.includes('olahraga') || s2 === 'pjok' || s2.includes('penjas'))
  ) return true;

  if (
    (s1.includes('pancasila') || s1 === 'pkn' || s1 === 'ppkn') &&
    (s2.includes('pancasila') || s2 === 'pkn' || s2 === 'ppkn')
  ) return true;

  if (
    (s1.includes('indonesia') || s1 === 'bindo') &&
    (s2.includes('indonesia') || s2 === 'bindo')
  ) return true;

  if (
    (s1.includes('inggris') || s1 === 'english') &&
    (s2.includes('inggris') || s2 === 'english')
  ) return true;

  if (
    (s1 === 'ipas' || s1 === 'ipa' || s1 === 'ips' || s1.includes('pengetahuan')) &&
    (s2 === 'ipas' || s2 === 'ipa' || s2 === 'ips' || s2.includes('pengetahuan'))
  ) {
    const isIPAS1 = s1 === 'ipas' || s1.includes('pengetahuan alam dan sosial');
    const isIPAS2 = s2 === 'ipas' || s2.includes('pengetahuan alam dan sosial');
    if (isIPAS1 && isIPAS2) return true;
    
    const isIPA1 = s1 === 'ipa' || s1.includes('pengetahuan alam');
    const isIPA2 = s2 === 'ipa' || s2.includes('pengetahuan alam');
    if (isIPA1 && isIPA2) return true;

    const isIPS1 = s1 === 'ips' || s1.includes('pengetahuan sosial');
    const isIPS2 = s2 === 'ips' || s2.includes('pengetahuan sosial');
    if (isIPS1 && isIPS2) return true;
  }

  return false;
};

export default function GradeManagement({ profile, viewMode = 'input' }: GradeManagementProps) {
  const isGuruPAI = profile.teacher_type === 'Guru PAI';
  const isGuruPJOK = profile.teacher_type === 'Guru PJOK';
  const isSubjectTeacher = isGuruPAI || isGuruPJOK;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [classSubjects, setClassSubjects] = useState<{classId: string, className: string, subject: string}[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, any>>>({}); // { studentId: { topicKey: score } }
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMode, setActiveMode] = useState<'academic' | 'extracurricular' | 'cocurricular'>('academic');
  const [extracurriculars, setExtracurriculars] = useState<Extracurricular[]>([]);
  const [cocurriculars, setCocurriculars] = useState<Cocurricular[]>([]);

  // Recap Modal States
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapGrades, setRecapGrades] = useState<Grade[]>([]);
  const [recapClasses, setRecapClasses] = useState<Class[]>([]);
  const [recapMaterials, setRecapMaterials] = useState<LessonMaterial[]>([]);
  const [recapSearchTerm, setRecapSearchTerm] = useState('');
  const [recapStudents, setRecapStudents] = useState<Student[]>([]);
  const [recapPlace, setRecapPlace] = useState('Karanggeger');
  const [recapDate, setRecapDate] = useState('20 Juni 2026');
  const [selectedRecapTeacherId, setSelectedRecapTeacherId] = useState<string>(profile.id || '');

  // Report Card Modal States
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);
  const [reportPlace, setReportPlace] = useState('Karanggeger');
  const [reportDate, setReportDate] = useState('20 Juni 2026');
  const [selectedParentSignature, setSelectedParentSignature] = useState<'father' | 'mother' | 'empty'>('father');
  const [selectedHomeroomTeacherId, setSelectedHomeroomTeacherId] = useState<string>('');
  const [allTeachers, setAllTeachers] = useState<Profile[]>([]);
  const [isSavingReportData, setIsSavingReportData] = useState(false);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, { sick: number; leave: number; absent: number }>>({});
  const [isSyncingDapodik, setIsSyncingDapodik] = useState(false);
  const [isProcessingRecap, setIsProcessingRecap] = useState(false);



  const getActiveSubjectsForClass = (classId: string) => {
    const isGuruPAIObj = profile.teacher_type === 'Guru PAI';
    const isGuruPJOKObj = profile.teacher_type === 'Guru PJOK';
    if (isGuruPAIObj) return ['PAI & Budi Pekerti'];
    if (isGuruPJOKObj) return ['PJOK'];

    // Get numeric level of this class to aggregate of all class subjects under same level (not just single subject class!)
    const currentClassObj = classes.find(c => c.id === classId) || recapClasses.find(c => c.id === classId);
    const classLevel = getNumericLevel(currentClassObj?.name) || getNumericLevel(classId) || classId;

    let combinedSubjects = new Set<string>();

    // First try from classSubjects which loads all subjects from all classes initially
    if (classSubjects.length > 0) {
      const loadedClassSubjects = classSubjects.filter(cs => cs.classId === classId || getNumericLevel(cs.className) === classLevel).map(cs => cs.subject);
      loadedClassSubjects.forEach(sub => {
        if (sub === 'PAI' || sub === 'Pendidikan Agama & Budi Pekerti') combinedSubjects.add('PAI & Budi Pekerti');
        else if (sub !== 'Semua Mapel') combinedSubjects.add(sub);
      });
    }

    // Find all classes registered under same level level
    const levelClasses = recapClasses.filter(c => getNumericLevel(c.name) === classLevel);
    const levelClassIds = levelClasses.map(c => c.id);
    if (classId && !levelClassIds.includes(classId)) {
      levelClassIds.push(classId);
    }

    // Load materials from all classes of this level (across either semester to unify active subjects)
    const classMats = recapMaterials.filter(m => 
      (levelClassIds.includes(m.class_id) || m.class_id === classLevel || getNumericLevel(m.class_id) === classLevel)
    );
    
    classMats.forEach(m => {
      if (m.subject === 'PAI' || m.subject === 'Pendidikan Agama & Budi Pekerti') combinedSubjects.add('PAI & Budi Pekerti');
      else combinedSubjects.add(m.subject);
    });
    
    // Try current live/editing materials
    if (materials.length > 0) {
      const activeClassObj = classes.find(c => c.id === selectedClassId);
      const activeLevel = getNumericLevel(activeClassObj?.name) || selectedClassId;
      if (activeLevel === classLevel) {
        materials.forEach(m => {
          if (m.subject === 'PAI' || m.subject === 'Pendidikan Agama & Budi Pekerti') combinedSubjects.add('PAI & Budi Pekerti');
          else combinedSubjects.add(m.subject);
        });
      }
    }
    
    // Also include from student grades for this class to be extremely safe, in case there are no materials
    const gradesForLevel = recapGrades.filter(g => levelClassIds.includes(g.class_id) || g.class_id === classId);
    // Since we don't store subject directly on grade except maybe through class, we can map class_id to subject.
    // If we have subjects like PAI or PJOK in grades, they often correspond to the class' subject.
    
    // Add default fallbacks if still empty
    if (combinedSubjects.size === 0) {
       // Just fallback to common ones
    }
    
    // Ensure PAI and PJOK are always added if they exist anywhere in recapClasses for this level
    recapClasses.filter(c => getNumericLevel(c.name) === classLevel).forEach(c => {
       if (c.subject) {
         if (c.subject === 'PAI' || c.subject === 'Pendidikan Agama & Budi Pekerti') combinedSubjects.add('PAI & Budi Pekerti');
         else if (c.subject !== 'Semua Mapel') combinedSubjects.add(c.subject);
       }
    });

    const subjs = Array.from(combinedSubjects).filter(Boolean);
    if (subjs.length > 0) {
      return sortSubjects(subjs);
    }
    
    // Default fallback to all standard academic subjects
    return [];
  };

  const getPromotionStatement = (level: number, studentName: string, studentId?: string) => {
    const sGrades = studentId ? getStudentGrades(studentId) : {};
    const decision = sGrades['promotion_decision'] || '';

    if (level === 6) {
      const displayDecision = decision || 'LULUS';
      return (
        <div className="border border-black p-4 text-center font-sans">
          <p className="font-bold uppercase tracking-widest text-gray-950 mb-1">Keputusan Kelulusan</p>
          <p className="text-gray-950 font-normal-force">
            Berdasarkan kriteria kelulusan satuan pendidikan, peserta didik bernama <span className="capitalize underline font-bold">{studentName}</span> dinyatakan:
          </p>
          <div className="mt-2 font-bold text-gray-950 tracking-wider uppercase px-4 py-1.5 inline-block">
            {displayDecision}
          </div>
        </div>
      );
    } else {
      const nextLevel = level + 1;
      const nextLevelRoman = nextLevel === 2 ? 'II' : nextLevel === 3 ? 'III' : nextLevel === 4 ? 'IV' : nextLevel === 5 ? 'V' : nextLevel === 6 ? 'VI' : nextLevel.toString();
      
      let displayDecision = '';
      if (decision === 'Naik Kelas') {
        displayDecision = `NAIK KE KELAS ${nextLevel} ( ${nextLevelRoman} )`;
      } else if (decision === 'Tinggal Kelas') {
        displayDecision = `TINGGAL DI KELAS ${level} ( ${level === 1 ? 'I' : level === 2 ? 'II' : level === 3 ? 'III' : level === 4 ? 'IV' : level === 5 ? 'V' : level === 6 ? 'VI' : level.toString()} )`;
      } else {
        // Fallback default if not selected yet
        displayDecision = `NAIK KE KELAS ${nextLevel} ( ${nextLevelRoman} )`;
      }

      return (
        <div className="border border-black p-4 text-center font-sans tracking-tight">
          <p className="uppercase font-bold tracking-widest text-gray-950 mb-1">Keterangan Kenaikan Kelas</p>
          <p className="text-gray-950 font-normal-force border-b border-transparent">
            Berdasarkan hasil yang dicapai pada semester 1 dan 2, peserta didik dinyatakan:
          </p>
          <div className="mt-2 font-bold text-gray-950 tracking-wider uppercase px-5 py-1.5 inline-block">
            {displayDecision}
          </div>
        </div>
      );
    }
  };

  const getStudentGradeLevel = () => {
    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return 5; // default fallback
    const name = currentClass.name.toLowerCase();
    
    if (name.includes('1') || (name.includes('i') && !name.includes('iv') && !name.includes('v') && !name.includes('vi'))) {
      if (name.includes('v')) return 5;
      return 1;
    }
    if (name.includes('ii') && !name.includes('iii')) {
      return 2;
    }
    if (name.includes('iii')) {
      return 3;
    }
    if (name.includes('iv')) {
      return 4;
    }
    if (name.includes('v') && !name.includes('vi') && !name.includes('iv')) {
      return 5;
    }
    if (name.includes('vi')) {
      return 6;
    }
    
    // Fallback digit matches
    const match = currentClass.name.match(/\d+/);
    if (match) return parseInt(match[0]);
    
    return 5; // fallback
  };

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch settings for academic year
        const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
        let activeYear = '';
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data() as SystemSettings;
          setSettings(settingsData);
          activeYear = settingsData.academic_year || '';
        }

        // Fetch classes for this teacher or all classes if admin / subject teacher
        let classesQuery;
        if (profile.role === 'admin' || isSubjectTeacher) {
          if (activeYear) {
            classesQuery = query(collection(db, 'classes'), where('academic_year', '==', activeYear));
          } else {
            classesQuery = collection(db, 'classes');
          }
        } else {
          if (activeYear) {
            classesQuery = query(
              collection(db, 'classes'),
              where('teacher_id', '==', profile.id),
              where('academic_year', '==', activeYear)
            );
          } else {
            classesQuery = query(
              collection(db, 'classes'),
              where('teacher_id', '==', profile.id)
            );
          }
        }
        const classesSnap = await getDocs(classesQuery);
        let classesData = classesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Class));
        classesData = classesData.filter((cls, idx, self) => self.findIndex(c => c.name === cls.name) === idx);
        setClasses(classesData);

        const currentClassSubjects: { classId: string; className: string; subject: string }[] = [];
        for (const cls of classesData) {
          const matQuery = query(collection(db, 'classes', cls.id, 'materials'));
          const matSnap = await getDocs(matQuery);
          const mapels = Array.from(new Set(matSnap.docs.map(d => d.data().subject as string))).filter(Boolean);
          if (mapels.length > 0) {
            mapels.forEach(mapel => {
              currentClassSubjects.push({ classId: cls.id, className: cls.name, subject: mapel });
            });
          } else {
            currentClassSubjects.push({ classId: cls.id, className: cls.name, subject: 'Semua Mapel' });
          }
        }
        setClassSubjects(currentClassSubjects);

        if (currentClassSubjects.length > 0) {
          setSelectedClassId(currentClassSubjects[0].classId);
          setSelectedSubject(currentClassSubjects[0].subject);
        } else if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }

        // Fetch extracurriculars
        const ekskulSnap = await getDocs(collection(db, 'extracurriculars'));
        const ekskulData = ekskulSnap.docs.map(d => ({ id: d.id, ...d.data() } as Extracurricular));
        setExtracurriculars(ekskulData);

        // Fetch cocurriculars
        const cokSnap = await getDocs(collection(db, 'cocurriculars'));
        const cokData = cokSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cocurricular));
        setCocurriculars(cokData);

      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error('Gagal mengambil data awal kelas, ekskul & kokurikuler');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [profile.id]);

  const loadRecapData = async () => {
    setRecapLoading(true);
    try {
      const classesQuery = query(collection(db, 'classes'), where('academic_year', '==', settings?.academic_year || ''));
      const classesSnap = await getDocs(classesQuery);
      let allCls = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      allCls = allCls.filter((cls, idx, self) => self.findIndex(c => c.name === cls.name) === idx);
      setRecapClasses(allCls);

      const materialsPromises = allCls.map(cls => 
        getDocs(collection(db, 'classes', cls.id, 'materials'))
      );
      const materialsSnaps = await Promise.all(materialsPromises);
      const allMats: LessonMaterial[] = [];
      materialsSnaps.forEach((snap, idx) => {
        const cls = allCls[idx];
        snap.docs.forEach(d => {
          allMats.push({ id: d.id, class_id: cls.id, ...d.data() } as LessonMaterial);
        });
      });
      setRecapMaterials(allMats);

      const gradesQuery = query(
        collection(db, 'grades'),
        where('semester', '==', parseInt(selectedSemester)),
        where('academic_year', '==', settings?.academic_year)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      setRecapGrades(allGrades);

      const studentsSnap = await getDocs(collection(db, 'students'));
      const allStuds = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setRecapStudents(allStuds);

      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const teachersSnap = await getDocs(teachersQuery);
      const teachersList = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setAllTeachers(teachersList);

      if (profile.role === 'teacher') {
        setSelectedHomeroomTeacherId(profile.id);
      } else if (teachersList.length > 0) {
        setSelectedHomeroomTeacherId(teachersList[0].id);
      }

      if (students.length > 0) {
        setSelectedReportStudentId(students[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengambil data lengkap rekap & rapor');
    } finally {
      setRecapLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'recap' && selectedClassId && settings?.academic_year) {
      loadRecapData();
    }
  }, [viewMode, selectedClassId, selectedSemester, settings?.academic_year]);

  // Fetch materials and students when class changes
  useEffect(() => {
    if (!selectedClassId) return;

    let unsubscribeGrades: (() => void) | undefined;

    async function fetchClassData() {
      try {
        setLoading(true);
        // Fetch materials for selected class & semester
        const matQuery = query(
          collection(db, 'classes', selectedClassId, 'materials'),
          where('semester', '==', selectedSemester)
        );
        const matSnap = await getDocs(matQuery);
        let matData = matSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonMaterial));
        
        if (selectedSubject && selectedSubject !== 'Semua Mapel') {
          matData = matData.filter(m => isSameSubject(m.subject, selectedSubject));
        }
        
        setMaterials(matData);

        // Fetch students in this class
        const currentClass = classes.find(c => c.id === selectedClassId);
        const level = getNumericLevel(currentClass?.name) || selectedClassId;
        const studQuery = query(
          collection(db, 'students'),
          where('class_id', '==', level)
        );
        const studSnap = await getDocs(studQuery);
        const studData = studSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
        setStudents(studData);

        // Fetch attendance records to count for each student
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('class_id', '==', selectedClassId)
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const countsMap: Record<string, { sick: number; leave: number; absent: number }> = {};
        
        attendanceSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const dateStr = data.date;
          if (isDateInSemester(dateStr, selectedSemester)) {
            const records = data.records || {};
            Object.entries(records).forEach(([studentId, recVal]: [string, any]) => {
              if (!countsMap[studentId]) {
                countsMap[studentId] = { sick: 0, leave: 0, absent: 0 };
              }
              if (recVal.status === 'sick') {
                countsMap[studentId].sick++;
              } else if (recVal.status === 'late') {
                countsMap[studentId].leave++;
              } else if (recVal.status === 'absent') {
                countsMap[studentId].absent++;
              }
            });
          }
        });
        setAttendanceCounts(countsMap);

      } catch (error) {
        console.error('Error fetching class data:', error);
        toast.error('Gagal mengambil data materi/siswa');
      } finally {
        setLoading(false);
      }
    }

    fetchClassData();

    // Subscribe to existing grades in real-time
    const gradeQuery = query(
      collection(db, 'grades'),
      where('class_id', '==', selectedClassId),
      where('semester', '==', parseInt(selectedSemester))
    );

    unsubscribeGrades = onSnapshot(gradeQuery, (gradeSnap) => {
      const gradeData: Record<string, Record<string, any>> = {};
      
      gradeSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        if (!gradeData[data.student_id]) gradeData[data.student_id] = {};
        
        if (data.topic_title?.startsWith('recap_final_')) return;

        let key = '';
        if (data.type === 'daily') key = `daily_${data.topic_title}`;
        else if (data.type === 'midterm') {
          const isMatch = isSameSubject(data.topic_title, selectedSubject) || 
                          !data.topic_title || 
                          data.topic_title === 'Semua Mapel' || 
                          selectedSubject === 'Semua Mapel';
          if (!isMatch) return;
          key = 'uts';
        }
        else if (data.type === 'final') {
          const isMatch = isSameSubject(data.topic_title, selectedSubject) || 
                          !data.topic_title || 
                          data.topic_title === 'Semua Mapel' || 
                          selectedSubject === 'Semua Mapel';
          if (!isMatch) return;
          key = 'uas';
        }
        else if (data.type === 'project') {
          if (data.topic_title === 'custom_wali_note') {
            key = 'custom_wali_note';
          } else if (data.topic_title === 'parent_feedback') {
            key = 'parent_feedback';
          } else if (data.topic_title === 'promotion_decision') {
            key = 'promotion_decision';
          } else {
            key = `project_${data.topic_title}`;
          }
        } else if (data.type === 'attendance') {
          key = `attendance_${data.topic_title}`;
        }
        
        if (key) {
          if (key === 'custom_wali_note' || key === 'parent_feedback' || key === 'promotion_decision') {
            gradeData[data.student_id][key] = data.achievement || '';
          } else {
            gradeData[data.student_id][key] = data.score;
          }
          if (data.predicate) {
            gradeData[data.student_id][`${key}_predicate`] = data.predicate;
          }
          if (data.achievement) {
            gradeData[data.student_id][`${key}_achievement`] = data.achievement;
          }
        }
      });
      setGrades(gradeData);
    }, (error) => {
      console.error('Error listening to grades:', error);
    });

    return () => {
      if (unsubscribeGrades) unsubscribeGrades();
    };
  }, [selectedClassId, selectedSubject, selectedSemester]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const currentTopics = materials.flatMap(m => m.topics || []);

  const handleGradeChange = (studentId: string, key: string, value: string) => {
    const isText = key.endsWith('_predicate') || key.endsWith('_achievement');
    const finalValue = isText ? value : (value === '' ? '' : parseFloat(value));
    
    setGrades(prev => {
      const studentGrades = { ...(prev[studentId] || {}) };
      studentGrades[key] = finalValue;
      
      // 1. Auto-predicate for academics (UTS/UAS/Daily) on score change
      if (key === 'uts' || key === 'uas' || key.startsWith('daily_')) {
        const validDaily = currentTopics
          .map(t => studentGrades[`daily_${t.title}`])
          .filter((s): s is number => s !== undefined && s !== null && s !== '' as any && !isNaN(Number(s)))
          .map(Number);
          
        const rawUts = studentGrades['uts'];
        const validUts = (rawUts !== undefined && rawUts !== null && rawUts !== '' as any && !isNaN(Number(rawUts))) ? Number(rawUts) : null;
        
        const rawUas = studentGrades['uas'];
        const validUas = (rawUas !== undefined && rawUas !== null && rawUas !== '' as any && !isNaN(Number(rawUas))) ? Number(rawUas) : null;
        
        const components: number[] = [...validDaily];
        if (validUts !== null) components.push(validUts);
        if (validUas !== null) components.push(validUas);
        
        if (components.length > 0) {
          const score = customRound(components.reduce((a, b) => a + b, 0) / components.length);
          if (settings) {
            const predStr = evaluateAcademicPredicate(score, settings.academic_rules);
            if (predStr === 'Sangat Baik' || predStr === 'A') studentGrades['uas_predicate'] = 'A';
            else if (predStr === 'Baik' || predStr === 'B') studentGrades['uas_predicate'] = 'B';
            else if (predStr === 'Cukup' || predStr === 'C') studentGrades['uas_predicate'] = 'C';
            else studentGrades['uas_predicate'] = 'D';
          }
        }
      }

      // 2. Auto-predicate for Extracurriculars on score change
      if (key.startsWith('project_ekskul_') && !key.endsWith('_predicate') && !key.endsWith('_achievement')) {
        const ekskulId = key.replace('project_ekskul_', '');
        const score = Number(value);
        if (!isNaN(score) && value !== '' && settings) {
          const rules = settings.ekskul_rules || [
            { min: 3.5, pred: 'Sangat Baik' },
            { min: 3.0, pred: 'Baik' },
            { min: 2.0, pred: 'Cukup' },
            { min: 1.0, pred: 'Kurang' }
          ];
          const sortedRules = [...rules].sort((a, b) => b.min - a.min);
          const matchingRule = sortedRules.find(r => score >= r.min);
          if (matchingRule) {
            studentGrades[`project_ekskul_${ekskulId}_predicate`] = matchingRule.pred;
          }
        }
      }

      // 3. Auto-predicate for Cocurriculars on score change
      if (key.startsWith('project_kokurikuler_') && !key.endsWith('_predicate') && !key.endsWith('_achievement')) {
        const cocId = key.replace('project_kokurikuler_', '');
        const score = Number(value);
        if (!isNaN(score) && value !== '' && settings) {
          const rules = settings.coc_rules || [
            { min: 3.5, pred: 'Sangat Berkembang' },
            { min: 3.0, pred: 'Berkembang Sesuai Harapan' },
            { min: 2.0, pred: 'Mulai Berkembang' },
            { min: 1.0, pred: 'Belum Berkembang' }
          ];
          const sortedRules = [...rules].sort((a, b) => b.min - a.min);
          const matchingRule = sortedRules.find(r => score >= r.min);
          if (matchingRule) {
            studentGrades[`project_kokurikuler_${cocId}_predicate`] = matchingRule.pred;
          }
        }
      }
      
      // Auto-populate achievement if matching predicate is selected and achievement is empty/blank
      if (key === 'uas_predicate' && settings) {
        const achKey = 'uas_achievement';
        const currentAch = studentGrades[achKey] || '';
        if (currentAch.trim() === '') {
          if (value === 'A' && settings.academic_pred_a_desc) {
            studentGrades[achKey] = settings.academic_pred_a_desc;
          } else if (value === 'B' && settings.academic_pred_b_desc) {
            studentGrades[achKey] = settings.academic_pred_b_desc;
          } else if (value === 'C' && settings.academic_pred_c_desc) {
            studentGrades[achKey] = settings.academic_pred_c_desc;
          } else if (value === 'D' && settings.academic_pred_d_desc) {
            studentGrades[achKey] = settings.academic_pred_d_desc;
          }
        }
      } else if (key.startsWith('project_ekskul_') && key.endsWith('_predicate') && settings) {
        const ekskulId = key.replace('project_ekskul_', '').replace('_predicate', '');
        
        // Map to corresponding score behind the scenes for database compatibility (1-4)
        const scoreKey = `project_ekskul_${ekskulId}`;
        if (value === 'Sangat Baik') studentGrades[scoreKey] = 4;
        else if (value === 'Baik') studentGrades[scoreKey] = 3;
        else if (value === 'Cukup') studentGrades[scoreKey] = 2;
        else if (value === 'Kurang') studentGrades[scoreKey] = 1;
        else studentGrades[scoreKey] = '';

        const achKey = `project_ekskul_${ekskulId}_achievement`;
        const currentAch = studentGrades[achKey] || '';
        if (currentAch.trim() === '') {
          if (value === 'Sangat Baik' && settings.ekskul_pred_sb_desc) {
            studentGrades[achKey] = settings.ekskul_pred_sb_desc;
          } else if (value === 'Baik' && settings.ekskul_pred_b_desc) {
            studentGrades[achKey] = settings.ekskul_pred_b_desc;
          } else if (value === 'Cukup' && settings.ekskul_pred_c_desc) {
            studentGrades[achKey] = settings.ekskul_pred_c_desc;
          } else if (value === 'Kurang' && settings.ekskul_pred_k_desc) {
            studentGrades[achKey] = settings.ekskul_pred_k_desc;
          }
        }
      } else if (key.startsWith('project_kokurikuler_') && key.endsWith('_predicate') && settings) {
        const cocId = key.replace('project_kokurikuler_', '').replace('_predicate', '');
        
        // Map to corresponding score behind the scenes for database compatibility (1-4)
        const scoreKey = `project_kokurikuler_${cocId}`;
        if (value === 'Sangat Berkembang') studentGrades[scoreKey] = 4;
        else if (value === 'Berkembang Sesuai Harapan') studentGrades[scoreKey] = 3;
        else if (value === 'Mulai Berkembang') studentGrades[scoreKey] = 2;
        else if (value === 'Belum Berkembang') studentGrades[scoreKey] = 1;
        else studentGrades[scoreKey] = '';

        const achKey = `project_kokurikuler_${cocId}_achievement`;
        const currentAch = studentGrades[achKey] || '';
        if (currentAch.trim() === '') {
          if (value === 'Sangat Berkembang' && settings.cocurricular_pred_sb_desc) {
            studentGrades[achKey] = settings.cocurricular_pred_sb_desc;
          } else if (value === 'Berkembang Sesuai Harapan' && settings.cocurricular_pred_bsh_desc) {
            studentGrades[achKey] = settings.cocurricular_pred_bsh_desc;
          } else if (value === 'Mulai Berkembang' && settings.cocurricular_pred_mb_desc) {
            studentGrades[achKey] = settings.cocurricular_pred_mb_desc;
          } else if (value === 'Belum Berkembang' && settings.cocurricular_pred_bb_desc) {
            studentGrades[achKey] = settings.cocurricular_pred_bb_desc;
          }
        }
      }
      
      return {
        ...prev,
        [studentId]: studentGrades
      };
    });
  };

  const handleSaveAll = async () => {
    if (!selectedClassId || !settings) return;
    
    setIsSaving(true);
    const toastId = toast.loading('Menyimpan nilai...');
    
    try {
      const batchPromises: Promise<any>[] = [];
      
      for (const student of students) {
        const studentGrades = grades[student.id] || {};
        
        if (activeMode === 'academic') {
          // Save topic grades
          for (const topic of currentTopics) {
            const val = studentGrades[`daily_${topic.title}`];
            const gradeId = `${student.id}_${selectedClassId}_${selectedSemester}_daily_${topic.title.replace(/\s+/g, '_')}`;
            
            if (val !== undefined && val !== null && val !== '') {
              batchPromises.push(setDoc(doc(db, 'grades', gradeId), {
                student_id: student.id,
                class_id: selectedClassId,
                score: Number(val),
                type: 'daily',
                topic_title: topic.title,
                semester: parseInt(selectedSemester),
                academic_year: settings.academic_year,
                created_at: serverTimestamp()
              }));
            } else if (val === '') {
              batchPromises.push(deleteDoc(doc(db, 'grades', gradeId)));
            }
          }

          // Save UTS
          const subjectKey = selectedSubject ? selectedSubject.replace(/\s+/g, '') : 'Semua Mapel';
          const utsId = `${student.id}_${selectedClassId}_${subjectKey}_${selectedSemester}_midterm`;
          const utsVal = studentGrades['uts'];
          if (utsVal !== undefined && utsVal !== null && utsVal !== '') {
            batchPromises.push(setDoc(doc(db, 'grades', utsId), {
              student_id: student.id,
              class_id: selectedClassId,
              score: Number(utsVal),
              type: 'midterm',
              topic_title: selectedSubject,
              semester: parseInt(selectedSemester),
              academic_year: settings.academic_year,
              created_at: serverTimestamp()
            }));
          } else if (utsVal === '') {
            batchPromises.push(deleteDoc(doc(db, 'grades', utsId)));
          }

          // Save UAS (with predicate & achievement for academic)
          const uasId = `${student.id}_${selectedClassId}_${subjectKey}_${selectedSemester}_final`;
          const uasVal = studentGrades['uas'];
          const uasPred = studentGrades['uas_predicate'];
          const uasAch = studentGrades['uas_achievement'];
          if ((uasVal !== undefined && uasVal !== null && uasVal !== '') || uasPred || uasAch) {
            batchPromises.push(setDoc(doc(db, 'grades', uasId), {
              student_id: student.id,
              class_id: selectedClassId,
              score: uasVal ? Number(uasVal) : 0,
              type: 'final',
              topic_title: selectedSubject,
              semester: parseInt(selectedSemester),
              academic_year: settings.academic_year,
              created_at: serverTimestamp(),
              predicate: uasPred || null,
              achievement: uasAch || null
            }));
          } else if (uasVal === '') {
            batchPromises.push(deleteDoc(doc(db, 'grades', uasId)));
          }


        } else if (activeMode === 'extracurricular') {
          // Save extracurricular grades
          for (const ekskul of extracurriculars) {
            const score = studentGrades[`project_ekskul_${ekskul.id}`];
            const pred = studentGrades[`project_ekskul_${ekskul.id}_predicate`];
            const ach = studentGrades[`project_ekskul_${ekskul.id}_achievement`];
            const gradeId = `${student.id}_${selectedClassId}_${selectedSemester}_ekskul_${ekskul.id}`;
            if ((score !== undefined && score !== null && score !== '') || pred || ach) {
              batchPromises.push(setDoc(doc(db, 'grades', gradeId), {
                student_id: student.id,
                class_id: selectedClassId,
                score: score ? Number(score) : 0,
                type: 'project',
                topic_title: `ekskul_${ekskul.id}`,
                semester: parseInt(selectedSemester),
                academic_year: settings.academic_year,
                created_at: serverTimestamp(),
                predicate: pred || null,
                achievement: ach || null
              }));
            } else {
              batchPromises.push(deleteDoc(doc(db, 'grades', gradeId)));
            }
          }
        } else if (activeMode === 'cocurricular') {
          // Save cocurricular grades
          for (const cok of cocurriculars) {
            const score = studentGrades[`project_kokurikuler_${cok.id}`];
            const pred = studentGrades[`project_kokurikuler_${cok.id}_predicate`];
            const ach = studentGrades[`project_kokurikuler_${cok.id}_achievement`];
            const gradeId = `${student.id}_${selectedClassId}_${selectedSemester}_kokurikuler_${cok.id}`;
            if ((score !== undefined && score !== null && score !== '') || pred || ach) {
              batchPromises.push(setDoc(doc(db, 'grades', gradeId), {
                student_id: student.id,
                class_id: selectedClassId,
                score: score ? Number(score) : 0,
                type: 'project',
                topic_title: `kokurikuler_${cok.id}`,
                semester: parseInt(selectedSemester),
                academic_year: settings.academic_year,
                created_at: serverTimestamp(),
                predicate: pred || null,
                achievement: ach || null
              }));
            } else {
              batchPromises.push(deleteDoc(doc(db, 'grades', gradeId)));
            }
          }
        }
      }

      await Promise.all(batchPromises);
      toast.success('Semua nilai berhasil disimpan', { id: toastId });
    } catch (error: any) {
      console.error('Error saving grades:', error);
      toast.error('Gagal menyimpan nilai', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReportData = async (studentId: string) => {
    if (!selectedClassId) return;
    setIsSavingReportData(true);
    const toastId = toast.loading('Menyimpan data absensi & catatan...');
    try {
      const studentGrades = grades[studentId] || {};
      const batchPromises: Promise<any>[] = [];
      
      // Save sickness
      const sicknessId = `${studentId}_${selectedClassId}_${selectedSemester}_attendance_sakit`;
      const sakitVal = studentGrades['attendance_sakit'];
      if (sakitVal !== undefined && sakitVal !== null && sakitVal !== '') {
        batchPromises.push(setDoc(doc(db, 'grades', sicknessId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: Number(sakitVal),
          type: 'attendance',
          topic_title: 'sakit',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp()
        }));
      } else {
        batchPromises.push(deleteDoc(doc(db, 'grades', sicknessId)));
      }

      // Save izin
      const izinId = `${studentId}_${selectedClassId}_${selectedSemester}_attendance_izin`;
      const izinVal = studentGrades['attendance_izin'];
      if (izinVal !== undefined && izinVal !== null && izinVal !== '') {
        batchPromises.push(setDoc(doc(db, 'grades', izinId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: Number(izinVal),
          type: 'attendance',
          topic_title: 'izin',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp()
        }));
      } else {
        batchPromises.push(deleteDoc(doc(db, 'grades', izinId)));
      }

      // Save alpa
      const alpaId = `${studentId}_${selectedClassId}_${selectedSemester}_attendance_alpa`;
      const alpaVal = studentGrades['attendance_alpa'];
      if (alpaVal !== undefined && alpaVal !== null && alpaVal !== '') {
        batchPromises.push(setDoc(doc(db, 'grades', alpaId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: Number(alpaVal),
          type: 'attendance',
          topic_title: 'alpa',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp()
        }));
      } else {
        batchPromises.push(deleteDoc(doc(db, 'grades', alpaId)));
      }

      // Save custom_wali_note
      const noteId = `${studentId}_${selectedClassId}_${selectedSemester}_custom_wali_note`;
      const noteVal = studentGrades['custom_wali_note'];
      if (noteVal !== undefined && noteVal !== null && noteVal !== '') {
        batchPromises.push(setDoc(doc(db, 'grades', noteId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: 0,
          type: 'project',
          topic_title: 'custom_wali_note',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp(),
          achievement: noteVal
        }));
      } else {
        batchPromises.push(deleteDoc(doc(db, 'grades', noteId)));
      }

      // Save parent_feedback
      const feedbackId = `${studentId}_${selectedClassId}_${selectedSemester}_parent_feedback`;
      const feedbackVal = studentGrades['parent_feedback'];
      if (feedbackVal !== undefined && feedbackVal !== null && feedbackVal !== '') {
        batchPromises.push(setDoc(doc(db, 'grades', feedbackId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: 0,
          type: 'project',
          topic_title: 'parent_feedback',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp(),
          achievement: feedbackVal
        }));
      } else {
        batchPromises.push(deleteDoc(doc(db, 'grades', feedbackId)));
      }

      await Promise.all(batchPromises);
      
      // Update in-memory recapGrades list to immediately reflect inside the report preview!
      setRecapGrades(prev => {
        const withAbsences = prev.filter(g => 
          g.student_id !== studentId || 
          (g.type !== 'attendance' && 
           g.topic_title !== 'custom_wali_note' && 
           g.topic_title !== 'parent_feedback')
        );
        
        const newItems: any[] = [];
        if (sakitVal !== undefined && sakitVal !== null && sakitVal !== '') {
          newItems.push({ student_id: studentId, class_id: selectedClassId, score: Number(sakitVal), type: 'attendance', topic_title: 'sakit', semester: parseInt(selectedSemester) });
        }
        if (izinVal !== undefined && izinVal !== null && izinVal !== '') {
          newItems.push({ student_id: studentId, class_id: selectedClassId, score: Number(izinVal), type: 'attendance', topic_title: 'izin', semester: parseInt(selectedSemester) });
        }
        if (alpaVal !== undefined && alpaVal !== null && alpaVal !== '') {
          newItems.push({ student_id: studentId, class_id: selectedClassId, score: Number(alpaVal), type: 'attendance', topic_title: 'alpa', semester: parseInt(selectedSemester) });
        }
        if (noteVal !== undefined && noteVal !== null && noteVal !== '') {
          newItems.push({ student_id: studentId, class_id: selectedClassId, score: 0, type: 'project', topic_title: 'custom_wali_note', semester: parseInt(selectedSemester), achievement: noteVal });
        }
        if (feedbackVal !== undefined && feedbackVal !== null && feedbackVal !== '') {
          newItems.push({ student_id: studentId, class_id: selectedClassId, score: 0, type: 'project', topic_title: 'parent_feedback', semester: parseInt(selectedSemester), achievement: feedbackVal });
        }
        return [...withAbsences, ...newItems];
      });

      toast.success('Data absensi & catatan rapor berhasil disimpan!', { id: toastId });
    } catch (err: any) {
      console.error('Error saving report data:', err);
      toast.error('Gagal menyimpan data absensi', { id: toastId });
    } finally {
      setIsSavingReportData(false);
    }
  };

  const handleSavePromotionDecision = async (studentId: string, decision: string) => {
    if (!selectedClassId) return;
    const toastId = toast.loading('Menyimpan keputusan kenaikan kelas...');
    try {
      const gId = `${studentId}_${selectedClassId}_${selectedSemester}_promotion_decision`;
      if (decision) {
        await setDoc(doc(db, 'grades', gId), {
          student_id: studentId,
          class_id: selectedClassId,
          score: 0,
          type: 'project',
          topic_title: 'promotion_decision',
          semester: parseInt(selectedSemester),
          academic_year: settings?.academic_year || '2025/2026',
          created_at: serverTimestamp(),
          achievement: decision
        });
        
        // Update local state 'grades' and 'recapGrades' list
        setGrades(prev => {
          const updated = { ...prev };
          if (!updated[studentId]) updated[studentId] = {};
          updated[studentId]['promotion_decision'] = decision;
          return updated;
        });

        setRecapGrades(prev => {
          const filtered = prev.filter(g => g.id !== gId && !(g.student_id === studentId && g.topic_title === 'promotion_decision'));
          return [
            ...filtered,
            {
              id: gId,
              student_id: studentId,
              class_id: selectedClassId,
              score: 0,
              type: 'project',
              topic_title: 'promotion_decision',
              semester: parseInt(selectedSemester),
              achievement: decision
            } as any
          ];
        });
        
        toast.success('Keputusan kenaikan kelas berhasil disimpan!', { id: toastId });
      } else {
        await deleteDoc(doc(db, 'grades', gId));
        setGrades(prev => {
          const updated = { ...prev };
          if (updated[studentId]) {
            delete updated[studentId]['promotion_decision'];
          }
          return updated;
        });
        setRecapGrades(prev => prev.filter(g => g.student_id !== studentId || g.topic_title !== 'promotion_decision'));
        toast.success('Keputusan dihapus', { id: toastId });
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal menyimpan keputusan', { id: toastId });
    }
  };

  const calculateTotal = (studentId: string) => {
    const sGrades = grades[studentId] || {};
    
    // Filter active/valid daily scores (ignore empty ones)
    const validDaily = currentTopics
      .map(t => sGrades[`daily_${t.title}`])
      .filter((s): s is number => s !== undefined && s !== null && s !== '' as any && !isNaN(Number(s)))
      .map(Number);
      
    const rawUts = sGrades['uts'];
    const validUts = (rawUts !== undefined && rawUts !== null && rawUts !== '' as any && !isNaN(Number(rawUts))) ? Number(rawUts) : null;
    
    const rawUas = sGrades['uas'];
    const validUas = (rawUas !== undefined && rawUas !== null && rawUas !== '' as any && !isNaN(Number(rawUas))) ? Number(rawUas) : null;
    
    // Flat average of all individual active/valid scores
    const components: number[] = [...validDaily];
    if (validUts !== null) components.push(validUts);
    if (validUas !== null) components.push(validUas);
    
    if (components.length === 0) return null;
    const result = components.reduce((a, b) => a + b, 0) / components.length;
    return customRound(result);
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSyncDapodik = async () => {
    try {
      setIsSyncingDapodik(true);
      
      const API_URL = 'http://localhost:5774/WebService/sinkron_nilai';
      const API_KEY = 'zcRud4IFK3DvQLZ'; // User provided API Key for Dapodik
      
      // We simulate creating the payload from the currently loaded students and grades
      const payload = {
        semester_id: '20232', // Example format expected by Dapodik
        grades: students.map(s => {
          return {
            peserta_didik_id: s.id,
            nilai_akhir: getStudentGrades(s.id)
          };
        })
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Gagal terhubung ke aplikasi Dapodik. Pastikan aplikasi Dapodik berjalan.');
      }
      
      toast.success('Nilai berhasil disinkronkan ke server Dapodik!');
    } catch (error: any) {
      console.warn('Dapodik Sync Error:', error);
      toast.error(
        <div className="flex flex-col gap-2">
          <strong>Koneksi ke Dapodik diblokir oleh Browser (CORS/Mixed Content).</strong>
          <span className="text-sm">Karena Dapodik berjalan di localhost tanpa pengaturan CORS, browser memblokir pengiriman data secara langsung.</span>
          <span className="text-sm font-bold mt-1">Solusi:</span>
          <span className="text-sm">Silakan gunakan browser dengan keamanan web yang dimatikan (misal: <code>chrome.exe --disable-web-security</code>) khusus untuk admin saat melakukan sinkronisasi.</span>
        </div>,
        { duration: 8000 }
      );
    } finally {
      setIsSyncingDapodik(false);
    }
  };

  const handleOpenRecap = async () => {
    if (!selectedClassId) {
      toast.error('Silakan pilih kelas terlebih dahulu');
      return;
    }
    setShowRecapModal(true);
    setRecapLoading(true);
    try {
      // 1. Fetch all classes
      const classesQuery = query(collection(db, 'classes'), where('academic_year', '==', settings?.academic_year || ''));
      const classesSnap = await getDocs(classesQuery);
      let allCls = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      allCls = allCls.filter((cls, idx, self) => self.findIndex(c => c.name === cls.name) === idx);
      setRecapClasses(allCls);

      // 2. Fetch all materials (retrieve both semesters to align active subject listings)
      const materialsPromises = allCls.map(cls => 
        getDocs(collection(db, 'classes', cls.id, 'materials'))
      );
      const materialsSnaps = await Promise.all(materialsPromises);
      const allMats: LessonMaterial[] = [];
      materialsSnaps.forEach((snap, idx) => {
        const cls = allCls[idx];
        snap.docs.forEach(d => {
          allMats.push({ id: d.id, class_id: cls.id, ...d.data() } as LessonMaterial);
        });
      });
      setRecapMaterials(allMats);

      // 3. Fetch all grades of the current semester
      const gradesQuery = query(
        collection(db, 'grades'),
        where('semester', '==', parseInt(selectedSemester)),
        where('academic_year', '==', settings?.academic_year)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      setRecapGrades(allGrades);

      // 4. Fetch all students for NISN cross-class matching
      const studentsSnap = await getDocs(collection(db, 'students'));
      const allStuds = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setRecapStudents(allStuds);

      // 5. Fetch all teachers from users collection
      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const teachersSnap = await getDocs(teachersQuery);
      const teachersList = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setAllTeachers(teachersList);

      // Pre-select current teacher as default recap teacher
      if (profile.role === 'teacher') {
        setSelectedRecapTeacherId(profile.id || '');
      } else if (teachersList.length > 0) {
        setSelectedRecapTeacherId(teachersList[0].id || '');
      }

    } catch (error) {
      console.error('Error fetching recap data:', error);
      toast.error('Gagal memuat rekap nilai');
    } finally {
      setRecapLoading(false);
    }
  };

  // ==========================================
  // INDONESIAN REPORT CARD & PRINT ENGINE 2025
  // ==========================================

  // 1. Get automatic extracurricular description based on class and predicate
  const getAutomaticEkskulDesc = (ekskulName: string, predicate: string, studentClassName: string) => {
    if (!predicate) return '';
    const cls = studentClassName || 'Kelas';
    
    const templates: Record<string, Record<string, string>> = {
      Pramuka: {
        'Sangat Baik': `Ananda menunjukkan keaktifan yang sangat luar biasa, mandiri, dan sangat disiplin dalam mengikuti berbagai latihan kepanduan Pramuka di ${cls}. Mampu menjadi teladan yang baik bagi anggota kelompoknya.`,
        'Baik': `Ananda aktif mengikuti kegiatan Pramuka dengan baik, terampil dalam baris-berbaris dan mampu berkolaborasi dengan kompak dalam kerja sama tim di ${cls}.`,
        'Cukup': `Ananda cukup konsisten dalam mengikuti latihan Pramuka dan menunjukkan kedisiplinan yang memadai untuk memahami materi kepanduan dasar di ${cls}.`,
        'Kurang': `Ananda mulai berpartisipasi dalam latihan Pramuka namun membutuhkan bimbingan intensif dan dukungan motivasi untuk meningkatkan kedisiplinan kerja samanya di ${cls}.`
      },
      Apotek_Hidup: {
        'Sangat Baik': `Sangat aktif dan antusias dalam mengelola apotek hidup di ${cls}, memahami fungsi berbagai tanaman obat secara mendalam serta rajin merawat kebun sekolah.`,
        'Baik': `Memiliki kontribusi yang baik dalam membersihkan dan menanam tanaman obat pada apotek hidup, serta dapat merawat tanaman bersama teman sekelas di ${cls}.`,
        'Cukup': `Berperan cukup baik dalam aktivitas apotek hidup di kelas, sudah memahami beberapa tanaman obat dasar di ${cls}.`,
        'Kurang': `Memerlukan bimbingan pendampingan untuk lebih peduli dan aktif menjaga kebun apotek hidup di ${cls}.`
      },
      UKS: {
        'Sangat Baik': `Sangat responsif dan memiliki pemahaman kesehatan dasar yang sangat menonjol sebagai anggota UKS di ${cls}. Menunjukkan keteladanan tata cara hidup bersih dan sehat.`,
        'Baik': `Mampu membantu menjalankan tugas pertolongan pertama dan menerapkan pola hidup sehat dengan baik di lingkungan ${cls}.`,
        'Cukup': `Menunjukkan pemahaman dasar yang cukup tentang kesehatan jasmani dan aktivitas UKS di sekolah ${cls}.`,
        'Kurang': `Memerlukan motivasi tambahan agar lebih aktif berpartisipasi dalam pembiasaan hidup sehat di lingkungan ${cls}.`
      },
      Seni_Tari: {
        'Sangat Baik': `Ananda menunjukkan keluwesan gerak tari yang sangat luar biasa, serta memiliki daya ingat koreografi yang sangat menonjol selama mengikuti latihan Seni Tari di ${cls}.`,
        'Baik': `Ananda menguasai gerakan tari tradisional dengan baik dan menunjukkan ekspresi yang serasi serta kompak saat tampil bersama kelompok di ${cls}.`,
        'Cukup': `Ananda cukup mampu mengikuti pola lantai dan menyelaraskan gerakan dasar tari dengan iringan musik di ${cls}.`,
        'Kurang': `Ananda membutuhkan bimbingan gerak dasar tari dan pendampingan untuk meningkatkan rasa percaya diri saat menari di ${cls}.`
      },
      Seni_Rupa: {
        'Sangat Baik': `Ananda sangat kreatif dalam eksplorasi warna, serta memiliki teknik menggambar dan kreativitas seni yang amat menakjubkan selama berkarya seni rupa di ${cls}.`,
        'Baik': `Ananda mampu menggambar dan mewarnai dengan rapi dan terampil, serta menunjukkan komposisi bentuk seni yang proporsional di ${cls}.`,
        'Cukup': `Ananda cukup baik dalam menggambar bentuk dasar dan menggunakan media warna yang disediakan di ${cls}.`,
        'Kurang': `Ananda memerlukan bimbingan teknik dasar rupa serta dorongan motivasi untuk bereksperimen dengan warna-warni yang lebih berani di ${cls}.`
      },
      Seni_Musik: {
        'Sangat Baik': `Ananda menunjukkan kepekaan nada yang sangat tajam, terampil mengiringi lagu, dan sangat ekspresif dalam memperagakan musik di ${cls}.`,
        'Baik': `Ananda dapat memainkan instrumen musik dasar dengan ritme yang stabil serta kompak bernyanyi bersama rekan di ${cls}.`,
        'Cukup': `Ananda cukup lancar dalam mengikuti ketukan dasar dan menyanyikan lagu-lagu wajib nasional di ${cls}.`,
        'Kurang': `Ananda memerlukan bimbingan lebih dalam menstabilkan tempo ketukan serta melatih keselarasan suara kelompok di ${cls}.`
      }
    };

    const standardKey = Object.keys(templates).find(k => 
      ekskulName.toLowerCase().replace(/\s+/g, '_').includes(k.toLowerCase())
    );
    
    if (standardKey && templates[standardKey][predicate]) {
      return templates[standardKey][predicate];
    }

    switch (predicate) {
      case 'Sangat Baik':
        return `Ananda menunjukkan antusiasme yang sangat luar biasa dan aktif konsisten berpartisipasi penuh dalam kegiatan ${ekskulName} di ${cls}.`;
      case 'Baik':
        return `Ananda aktif mengikuti seluruh rangkaian kegiatan ${ekskulName} dengan gembira, serta terampil mengaplikasikan materi pembelajaran di ${cls}.`;
      case 'Cukup':
        return `Ananda cukup aktif berpartisipasi dan berkolaborasi dalam mengikuti arahan pembimbing di kegiatan ${ekskulName} di ${cls}.`;
      case 'Kurang':
        return `Ananda sudah mulai mengikuti latihan ${ekskulName}, namun memerlukan dorongan motivasi serta pendampingan untuk peningkatan kedisplinan di ${cls}.`;
      default:
        return '';
    }
  };

  // 2. Fetch manual or compile automatic achievement note for an extra-curricular
  const getEkskulAchievement = (studentId: string, ekskulId: string, ekskulName: string, predicate: string, className: string) => {
    const uGrades = getStudentGrades(studentId);
    const manualAch = uGrades[`project_ekskul_${ekskulId}_achievement`] || '';
    if (manualAch.trim() !== '') {
      return manualAch;
    }
    return getAutomaticEkskulDesc(ekskulName, predicate, className);
  };

  // 2b. Fetch manual or compile automatic achievement note for a cocurricular
  const getAutomaticCocurricularDesc = (projectTitle: string, predicate: string, studentClassName: string) => {
    if (!predicate) return '';
    const cls = studentClassName || 'Kelas';
    
    // Determine class level (1-6)
    let level = 5; // Default to Class 5 if no level name matches
    const clsUpper = cls.toUpperCase();
    if (clsUpper.includes('VI') || clsUpper.includes('6')) {
      level = 6;
    } else if (clsUpper.includes('IV') || clsUpper.includes('4')) {
      level = 4;
    } else if (clsUpper.includes('V') || clsUpper.includes('5')) { // Check V after VI & IV
      level = 5;
    } else if (clsUpper.includes('III') || clsUpper.includes('3')) {
      level = 3;
    } else if (clsUpper.includes('II') || clsUpper.includes('2')) {
      level = 2;
    } else if (clsUpper.includes('I') || clsUpper.includes('1')) {
      level = 1;
    }

    const titleText = projectTitle ? `"${projectTitle}"` : 'Proyek Kokurikuler';

    if (level === 1 || level === 2) {
      // Fase A (Kelas 1 - 2)
      switch (predicate) {
        case 'Sangat Berkembang':
          return `Ananda menunjukkan kemandirian yang mengagumkan dan kepedulian tinggi dalam proyek kokurikuler ${titleText}. Sangat aktif memilah sampah, peduli kebersihan kelas, serta kreatif memanfaatkan bahan daur ulang menjadi karya bermanfaat.`;
        case 'Berkembang Sesuai Harapan':
          return `Ananda menunjukkan sikap kerja sama dan kepedulian yang baik dalam proyek kokurikuler ${titleText}. Mampu memilah sampah dengan benar and bergotong-royong menyelesaikan tugas produk kelompok dengan antusias.`;
        case 'Mulai Berkembang':
          return `Ananda mulai berpartisipasi aktif dalam jalannya proyek kokurikuler ${titleText}. Mulai menunjukkan kepedulian terhadap kebersihan lingkungan kelompok, meskipun sesekali masih memerlukan bimbingan guru.`;
        case 'Belum Berkembang':
          return `Ananda sudah mulai ikut serta dalam proyek kokurikuler ${titleText}, namun memerlukan motivasi khusus dan bimbingan yang intensif dari guru agar dapat berkontribusi di dalam kelompoknya.`;
        default:
          return '';
      }
    } else if (level === 3 || level === 4) {
      // Fase B (Kelas 3 - 4)
      switch (predicate) {
        case 'Sangat Berkembang':
          return `Ananda menunjukkan kreativitas yang luar biasa serta bernalar kritis dalam proyek kokurikuler ${titleText}. Memiliki inisiatif tinggi dalam melestarikan budaya lokal, memimpin diskusi kelompok, dan menyajikan laporan proyek dengan sangat rapi.`;
        case 'Berkembang Sesuai Harapan':
          return `Ananda mampu bekerja sama dan bergotong-royong dengan solid dalam proyek kokurikuler ${titleText}. Terampil melaksanakan tugas kelompok, menghargai pendapat teman, serta menyelesaikan karya sesuai dengan target waktu.`;
        case 'Mulai Berkembang':
          return `Ananda sudah menunjukkan perkembangan dalam proyek kokurikuler ${titleText}. Berperan aktif membantu menyiapkan perlengkapan kelompok, namun membutuhkan ketekunan mandiri agar hasil karyanya lebih maksimal.`;
        case 'Belum Berkembang':
          return `Ananda mulai merespons arahan guru dalam proyek kokurikuler ${titleText}, namun membutuhkan motivasi berkelanjutan dan bimbingan rutin agar lebih mandiri menyelesaikan bagian kerjanya.`;
        default:
          return '';
      }
    } else {
      // Fase C (Kelas 5 - 6)
      switch (predicate) {
        case 'Sangat Berkembang':
          return `Ananda menunjukkan kemandirian luar biasa, berjiwa kepemimpinan, dan bernalar kritis dalam menyukseskan proyek kokurikuler ${titleText}. Mampu merancang strategi, menyelesaikan tantangan kelompok secara mandiri, dan berinovasi menghasilkan produk bernilai guna tinggi.`;
        case 'Berkembang Sesuai Harapan':
          return `Ananda berkolaborasi dengan sangat baik dan menunjukkan sikap gotong-royong yang solid dalam proyek kokurikuler ${titleText}. Aktif menyumbang pemikiran, konsisten dengan tugas kelompok yang disepakati, serta mampu mempresentasikan hasil produk dengan baik.`;
        case 'Mulai Berkembang':
          return `Ananda menunjukkan partisipasi yang cukup aktif dalam proyek kokurikuler ${titleText}. Membantu kelancaran aktivitas kelompok dalam menyiapkan stan pameran/pemasaran, namun memerlukan dorongan konsistensi bernalar kritis.`;
        case 'Belum Berkembang':
          return `Ananda mulai diperkenalkan pada aktivitas kelompok proyek kokurikuler ${titleText}, namun memerlukan pendampingan intensif agar lebih percaya diri dan aktif menuangkan idenya bersama teman sejawat.`;
        default:
          return '';
      }
    }
  };

  const getCocurricularAchievement = (studentId: string, cocId: string, cocTitle: string, predicate: string, className: string) => {
    const uGrades = getStudentGrades(studentId);
    const manualAch = uGrades[`project_kokurikuler_${cocId}_achievement`] || '';
    if (manualAch.trim() !== '') {
      return manualAch;
    }
    return getAutomaticCocurricularDesc(cocTitle, predicate, className);
  };

  // 3. Compile all saved + live grades into a single unified record lookup
  const getStudentGrades = (studentId: string) => {
    const uGrades: Record<string, any> = {};
    
    // Default attendance from monthly database logs if available
    const sCounts = attendanceCounts[studentId];
    if (sCounts) {
      uGrades['attendance_sakit'] = sCounts.sick;
      uGrades['attendance_izin'] = sCounts.leave;
      uGrades['attendance_alpa'] = sCounts.absent;
    } else {
      uGrades['attendance_sakit'] = 0;
      uGrades['attendance_izin'] = 0;
      uGrades['attendance_alpa'] = 0;
    }
    
    // Seed with database values
    const currentStudent = students.find(s => s.id === studentId) || recapStudents.find(s => s.id === studentId);
    recapGrades.filter(g => {
      if (g.student_id === studentId) return true;
      if (!currentStudent) return false;
      const gradeStudent = recapStudents.find(s => s.id === g.student_id) || students.find(s => s.id === g.student_id);
      return gradeStudent && isSameNISN(gradeStudent.nisn, currentStudent.nisn);
    }).forEach(g => {
      let key = '';
      if (g.type === 'daily') key = `daily_${g.topic_title}`;
      else if (g.type === 'midterm') {
        const isMatch = isSameSubject(g.topic_title, selectedSubject) || 
                        !g.topic_title || 
                        g.topic_title === 'Semua Mapel' || 
                        selectedSubject === 'Semua Mapel';
        if (isMatch) key = 'uts';
      }
      else if (g.type === 'final') {
        const isMatch = isSameSubject(g.topic_title, selectedSubject) || 
                        !g.topic_title || 
                        g.topic_title === 'Semua Mapel' || 
                        selectedSubject === 'Semua Mapel';
        if (isMatch) key = 'uas';
      }
      else if (g.type === 'project') {
        if (g.topic_title === 'custom_wali_note') {
          key = 'custom_wali_note';
        } else if (g.topic_title === 'parent_feedback') {
          key = 'parent_feedback';
        } else if (g.topic_title === 'promotion_decision') {
          key = 'promotion_decision';
        } else {
          key = `project_${g.topic_title}`;
        }
      } else if (g.type === 'attendance') {
        key = `attendance_${g.topic_title}`;
      }
      
      if (key) {
        if (key === 'custom_wali_note' || key === 'parent_feedback' || key === 'promotion_decision') {
          uGrades[key] = g.achievement || '';
        } else {
          uGrades[key] = g.score;
        }
        if (g.predicate) uGrades[`${key}_predicate`] = g.predicate;
        if (g.achievement) uGrades[`${key}_achievement`] = g.achievement;
      }
    });
    
    // Merge live local working draft values
    if (grades[studentId]) {
      Object.assign(uGrades, grades[studentId]);
    }
    
    return uGrades;
  };

  // 4. Generate encouraging Wali Kelas notes based on their computed academic averages, attendance, and activities
  const generateWaliNotes = (avgScore: number, studentName: string, sakit: number, izin: number, alpa: number, hasCo: boolean, hasExtra: boolean) => {
    let baseNote = '';
    if (avgScore >= 85) {
      baseNote = `Ananda ${studentName} menunjukkan prestasi akademis yang sangat baik.`;
    } else if (avgScore >= 75) {
      baseNote = `Ananda ${studentName} menunjukkan perkembangan nilai akademis yang mantap dan stabil.`;
    } else if (avgScore >= 60) {
      baseNote = `Ananda ${studentName} telah mengikuti pembelajaran akademis dengan baik, tingkatkan lagi belajarnya secara mandiri di rumah.`;
    } else {
      baseNote = `Ananda ${studentName} memerlukan motivasi tambahan dalam menguasai materi pelajaran akademis.`;
    }

    let activitiesNote = '';
    if (hasCo && hasExtra) {
      activitiesNote = ' Kemampuan pada kegiatan kokurikuler dan ekstrakurikuler juga menunjukkan partisipasi yang aktif.';
    } else if (hasCo) {
      activitiesNote = ' Partisipasi pada proyek kokurikuler sangat baik dan perlu dipertahankan.';
    } else if (hasExtra) {
      activitiesNote = ' Keaktifan pada kegiatan ekstrakurikuler patut diapresiasi.';
    }

    let attendanceNote = '';
    const totalAbsen = sakit + izin + alpa;
    if (totalAbsen === 0) {
      attendanceNote = ' Tingkat kehadiran ananda sangat sempurna, pertahankan kedisiplinannya.';
    } else if (totalAbsen > 5) {
      attendanceNote = ' Mohon untuk lebih meningkatkan kedisiplinan kehadiran di sekolah pada masa mendatang.';
    } else {
      attendanceNote = ' Tingkat kedisiplinan kehadiran terpantau cukup baik.';
    }

    return `${baseNote}${activitiesNote}${attendanceNote}`;
  };

  // 5. Unified calculations engine that blends saved and live values
  const getStudentSubjectCalculations = (studentStudent: Student, subject: string) => {
    const studentLevel = studentStudent.class_id;
    
    const subjectMats = recapMaterials.filter(m => {
      const matClass = recapClasses.find(c => c.id === m.class_id);
      if (!matClass) return false;
      
      const matClassLevel = getNumericLevel(matClass.name);
      // Check if matches the class prefix/level of student
      const userClassObj = recapClasses.find(c => c.id === studentStudent.class_id) || classes.find(c => c.id === studentStudent.class_id);
      const userClassLevel = getNumericLevel(userClassObj ? userClassObj.name : studentLevel);
      if (matClassLevel !== userClassLevel) return false;

      // Filter by current active semester
      if (String(m.semester) !== String(selectedSemester)) return false;

      return isSameSubject(m.subject, subject);
    });

    const subjectTopicTitles = subjectMats.flatMap(m => m.topics || []).map(t => t.title);
    
    // Merge database saved grades AND live grades input
    const studentGradesList: any[] = [];
    
    recapGrades.filter(g => {
      if (g.student_id === studentStudent.id) return true;
      const gradeStudent = recapStudents.find(s => s.id === g.student_id) || students.find(s => s.id === g.student_id);
      return gradeStudent && isSameNISN(gradeStudent.nisn, studentStudent.nisn);
    }).forEach(g => {
      studentGradesList.push({ ...g });
    });

    const liveObj = grades[studentStudent.id];
    if (liveObj) {
      const currentTopicsLoc = materials.flatMap(m => m.topics || []);
      currentTopicsLoc.forEach(t => {
        const liveScore = liveObj[`daily_${t.title}`];
        if (liveScore !== undefined && liveScore !== '') {
          const existingIdx = studentGradesList.findIndex(g => g.type === 'daily' && g.topic_title === t.title && g.class_id === selectedClassId);
          if (existingIdx > -1) {
            studentGradesList[existingIdx].score = liveScore;
          } else {
            studentGradesList.push({
              student_id: studentStudent.id,
              type: 'daily',
              topic_title: t.title,
              class_id: selectedClassId,
              score: liveScore
            });
          }
        }
      });

      if (liveObj['uts'] !== undefined && liveObj['uts'] !== '') {
        const existingIdx = studentGradesList.findIndex(g => g.type === 'midterm' && g.class_id === selectedClassId && isSameSubject(g.topic_title, subject));
        if (existingIdx > -1) {
          studentGradesList[existingIdx].score = liveObj['uts'];
        } else {
          studentGradesList.push({
            student_id: studentStudent.id,
            type: 'midterm',
            class_id: selectedClassId,
            topic_title: subject,
            score: liveObj['uts']
          });
        }
      }

      if (liveObj['uas'] !== undefined && liveObj['uas'] !== '') {
        const existingIdx = studentGradesList.findIndex(g => g.type === 'final' && g.class_id === selectedClassId && isSameSubject(g.topic_title, subject));
        if (existingIdx > -1) {
          studentGradesList[existingIdx].score = liveObj['uas'];
        } else {
          studentGradesList.push({
            student_id: studentStudent.id,
            type: 'final',
            class_id: selectedClassId,
            topic_title: subject,
            score: liveObj['uas']
          });
        }
      }
    }

    const dailyGradesData = studentGradesList
      .filter(g => g.type === 'daily' && g.topic_title && subjectTopicTitles.includes(g.topic_title) && subjectMats.some(m => m.class_id === g.class_id));

    const dailyScores = dailyGradesData.map(g => g.score);

    const allSubjectTopics = subjectMats.flatMap(m => m.topics || []);
    const topicScores = dailyGradesData.map(g => {
       const matchedTopic = allSubjectTopics.find(t => t.title === g.topic_title);
       return {
         title: g.topic_title,
         sub_topics: matchedTopic ? (matchedTopic.sub_topics || []) : [],
         score: (g.score !== undefined && g.score !== '' && !isNaN(Number(g.score))) ? Number(g.score) : null
       };
    }).filter(t => t.score !== null) as { title: string, sub_topics: string[], score: number }[];

    let uts: number | null = null;
    let uas: number | null = null;

    const utsGrade = studentGradesList.find(g => {
      if (g.type !== 'midterm') return false;
      return g.topic_title && isSameSubject(g.topic_title, subject);
    });
    if (utsGrade && utsGrade.score !== undefined && utsGrade.score !== null && utsGrade.score !== '' && !isNaN(Number(utsGrade.score))) {
      uts = Number(utsGrade.score);
    }

    const uasGrade = studentGradesList.find(g => {
      if (g.type !== 'final') return false;
      return g.topic_title && isSameSubject(g.topic_title, subject);
    });
    if (uasGrade && uasGrade.score !== undefined && uasGrade.score !== null && uasGrade.score !== '' && !isNaN(Number(uasGrade.score))) {
      uas = Number(uasGrade.score);
    }

    const validDaily = dailyScores
      .filter((score): score is number => score !== undefined && score !== null && score !== '' && !isNaN(Number(score)))
      .map(Number);
    const hasDaily = validDaily.length > 0;
    const calculatedAvgDaily = hasDaily ? validDaily.reduce((a, b) => a + b, 0) / validDaily.length : null;

    const components: number[] = [...validDaily];
    if (uts !== null) components.push(uts);
    if (uas !== null) components.push(uas);

    const hasAnyGrades = components.length > 0;
    if (!hasAnyGrades) return { avgDaily: 0, uts: 0, uas: 0, finalScore: 0, hasData: false, topicScores: [] };

    const finalScore = customRound(components.reduce((a, b) => a + b, 0) / components.length);

    return { avgDaily: calculatedAvgDaily || 0, uts: uts || 0, uas: uas || 0, finalScore, hasData: true, topicScores };
  };

  // 6. Automatically generate academic descriptions synchronizing topic scores and admin predicate settings
  const generateSubjectDescription = (studentId: string, subject: string, studentClassName: string) => {
    const uGrades = getStudentGrades(studentId);
    const actualStudent = students.find(s => s.id === studentId) || recapStudents.find(s => s.id === studentId) || ({ id: studentId } as Student);
    
    // Find materials relevant to subject and matching grade level
    const subjMats = recapMaterials.filter(m => {
      const mClass = recapClasses.find(c => c.id === m.class_id);
      if (!mClass) return false;
      const mClassLevel = getNumericLevel(mClass.name);
      const studClassLevel = getNumericLevel(studentClassName);
      if (mClassLevel !== studClassLevel) return false;

      // Filter by current active semester
      if (String(m.semester) !== String(selectedSemester)) return false;

      return isSameSubject(m.subject, subject);
    });

    const anandaPrefix = `Ananda ${actualStudent?.nickname || actualStudent?.full_name?.split(' ')[0]}`;

    const getPhrase = (predText: string) => {
      const p = predText ? predText.toLowerCase() : '';
      if (p === 'sangat baik' || p === 'a') return 'sangat baik';
      if (p === 'baik' || p === 'b') return 'baik';
      if (p === 'cukup' || p === 'c') return 'cukup';
      return 'perlu bimbingan';
    };

    const buildTujuanPembelajaran = (title: string, subTopics: string[]) => {
      const filteredSub = subTopics ? subTopics.filter(st => st && st.trim() !== '') : [];
      if (filteredSub.length > 0) {
        return `memahami ${title.toLowerCase()} khususnya pada materi ${filteredSub.map(s => s.toLowerCase()).join(', ')}`;
      }
      return `memahami dan menguasai materi ${title.toLowerCase()}`;
    };

    const calcs = getStudentSubjectCalculations(actualStudent, subject);
    const topicScores = calcs.topicScores || [];

    if (topicScores.length === 0) {
      const score = calcs.hasData ? calcs.finalScore : 80;
      
      const uasPred = evaluateAcademicPredicate(score, settings?.academic_rules);
      const phrase = getPhrase(uasPred);
      return `${anandaPrefix} ${phrase} dalam menguasai seluruh materi kompetensi pembelajaran pada mata pelajaran ini secara umum.`;
    }

    // Find highest and lowest scores
    const sortedTopics = [...topicScores].sort((a, b) => b.score - a.score);
    const highest = sortedTopics[0];
    const lowest = sortedTopics[sortedTopics.length - 1];

    const getPredText = (score: number) => {
      return evaluateAcademicPredicate(score, settings?.academic_rules);
    };

    const predHighest = getPredText(highest.score);
    const predLowest = getPredText(lowest.score);

    const tujuanHighest = buildTujuanPembelajaran(highest.title, highest.sub_topics);
    const tujuanLowest = buildTujuanPembelajaran(lowest.title, lowest.sub_topics);

    if (highest.title === lowest.title) {
      return `${anandaPrefix} ${getPhrase(predHighest)} dalam ${tujuanHighest}.`;
    }

    const sentence1 = `${anandaPrefix} ${getPhrase(predHighest)} dalam ${tujuanHighest}.`;
    const sentence2 = `Selain itu, ${anandaPrefix} juga ${getPhrase(predLowest)} dalam ${tujuanLowest}.`;
    return `${sentence1} ${sentence2}`;
  };

  // 7. Open report card and run fetchers
  const handleOpenReportCard = async () => {
    if (!selectedClassId) {
      toast.error('Silakan pilih kelas terlebih dahulu');
      return;
    }
    setShowReportCardModal(true);
    setRecapLoading(true);
    try {
      // a. Fetch all classes
      const classesQuery = query(collection(db, 'classes'), where('academic_year', '==', settings?.academic_year || ''));
      const classesSnap = await getDocs(classesQuery);
      let allCls = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      allCls = allCls.filter((cls, idx, self) => self.findIndex(c => c.name === cls.name) === idx);
      setRecapClasses(allCls);

      // b. Fetch all materials (retrieve both semesters to align active subject listings)
      const materialsPromises = allCls.map(cls => 
        getDocs(collection(db, 'classes', cls.id, 'materials'))
      );
      const materialsSnaps = await Promise.all(materialsPromises);
      const allMats: LessonMaterial[] = [];
      materialsSnaps.forEach((snap, idx) => {
        const cls = allCls[idx];
        snap.docs.forEach(d => {
          allMats.push({ id: d.id, class_id: cls.id, ...d.data() } as LessonMaterial);
        });
      });
      setRecapMaterials(allMats);

      // c. Fetch all grades config
      const gradesQuery = query(
        collection(db, 'grades'),
        where('semester', '==', parseInt(selectedSemester)),
        where('academic_year', '==', settings?.academic_year)
      );
      const gradesSnap = await getDocs(gradesQuery);
      const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      setRecapGrades(allGrades);

      // Fetch all students for NISN cross-class matching
      const studentsSnap = await getDocs(collection(db, 'students'));
      const allStuds = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setRecapStudents(allStuds);

      // d. Fetch all teachers from users collection
      const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const teachersSnap = await getDocs(teachersQuery);
      const teachersList = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setAllTeachers(teachersList);

      // Default the selected homeroom teacher to current user
      if (profile.role === 'teacher') {
        setSelectedHomeroomTeacherId(profile.id);
      } else if (teachersList.length > 0) {
        setSelectedHomeroomTeacherId(teachersList[0].id);
      }

      // Pre-select first student
      if (students.length > 0) {
        setSelectedReportStudentId(students[0].id);
      }

    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat kelengkapan data lembar rapor siswa');
    } finally {
      setRecapLoading(false);
    }
  };

  // 8. Dynamic signature selections rendering for the Report Card
  const renderReportCardModal = () => {
    if (!showReportCardModal) return null;

    const currentStudent = students.find(s => s.id === selectedReportStudentId) as any;
    const currentClass = classes.find(c => c.id === selectedClassId);
    
    // Calculate global academic averages to generate Wali Kelas note
    let totalScoreSum = 0;
    let counts = 0;
    getActiveSubjectsForClass(currentStudent?.class_id || selectedClassId || '').forEach(sub => {
      if (currentStudent) {
        const calcs = getStudentSubjectCalculations(currentStudent, sub);
        if (calcs.hasData) {
          totalScoreSum += calcs.finalScore;
          counts++;
        }
      }
    });
    
    let attendanceSakit = 0;
    let attendanceIzin = 0;
    let attendanceAlpa = 0;
    let hasCo = false;
    let hasExtra = false;
    
    if (currentStudent) {
      const uGrades = getStudentGrades(currentStudent.id);
      attendanceSakit = Number(uGrades['attendance_sakit']) || 0;
      attendanceIzin = Number(uGrades['attendance_izin']) || 0;
      attendanceAlpa = Number(uGrades['attendance_alpa']) || 0;
      
      hasCo = cocurriculars.some(c => !!uGrades[`project_kokurikuler_${c.id}_predicate`]);
      hasExtra = extracurriculars.some(e => !!uGrades[`project_ekstrakurikuler_${e.id}_predicate`]);
    }
    
    const computedAverage = counts > 0 ? customRound(totalScoreSum / counts) : 0;
    const waliNoteCalculated = currentStudent ? generateWaliNotes(computedAverage, currentStudent.nickname || currentStudent.full_name?.split(' ')[0], attendanceSakit, attendanceIzin, attendanceAlpa, hasCo, hasExtra) : '';

    const getFaseVal = () => {
      const clsName = currentStudent?.class_id ? String(currentStudent.class_id) : (currentClass?.name || '5');
      if (clsName.includes('1') || clsName.includes('2') || clsName.toUpperCase().includes('I') || clsName.toUpperCase().includes('II')) {
        if (clsName.toUpperCase().includes('III') || clsName.toUpperCase().includes('IV')) return 'Fase B';
        return 'Fase A';
      }
      if (clsName.includes('3') || clsName.includes('4') || clsName.toUpperCase().includes('III') || clsName.toUpperCase().includes('IV')) {
        return 'Fase B';
      }
      return 'Fase C';
    };

    // Selected parent name matching criteria
    let selectedParentDisplayedName = '';
    if (currentStudent) {
      if (selectedParentSignature === 'father') {
        selectedParentDisplayedName = currentStudent.father_name || '............................................';
      } else if (selectedParentSignature === 'mother') {
        selectedParentDisplayedName = currentStudent.mother_name || '............................................';
      } else {
        selectedParentDisplayedName = '............................................';
      }
    }

    const matchedTeacher = allTeachers.find(t => t.id === selectedHomeroomTeacherId);
    const teacherNameDisplayed = matchedTeacher ? matchedTeacher.full_name : '............................................';

    const handlePrint = () => {
      try {
        const printContent = document.getElementById('report-card-print-area');
        if (!printContent) {
          window.print();
          return;
        }
        
        // Clone the element so we can modify inputs/textareas to static text for clean printing
        const printContentClone = printContent.cloneNode(true) as HTMLElement;

        // Replace all inputs with text spans to preserve student attendance values
        const originalInputs = printContent.querySelectorAll('input');
        const clonedInputs = printContentClone.querySelectorAll('input');
        clonedInputs.forEach((input: any, idx: number) => {
          const originalVal = originalInputs[idx] ? (originalInputs[idx] as HTMLInputElement).value : '';
          const span = document.createElement('span');
          span.innerText = originalVal !== '' ? originalVal : '0';
          span.style.fontWeight = 'bold';
          span.style.fontFamily = 'monospace, sans-serif';
          span.style.display = 'inline-block';
          span.style.width = '100%';
          span.style.textAlign = 'center';
          input.parentNode?.replaceChild(span, input);
        });

        // Replace textareas with div paragraphs to preserve homeroom notes and feedback
        const originalTextareas = printContent.querySelectorAll('textarea');
        const clonedTextareas = printContentClone.querySelectorAll('textarea');
        clonedTextareas.forEach((ta: any, idx: number) => {
          const originalVal = originalTextareas[idx] ? (originalTextareas[idx] as HTMLTextAreaElement).value : '';
          const div = document.createElement('div');
          div.style.whiteSpace = 'pre-wrap';
          div.style.wordBreak = 'normal';
          div.style.wordWrap = 'break-word';
          div.style.overflowWrap = 'break-word';
          div.style.fontFamily = 'sans-serif';
          div.style.fontSize = '11px';
          div.style.lineHeight = '1.6';
          div.style.color = '#111827';
          div.style.textAlign = 'justify';
          div.style.width = '100%';
          div.style.padding = '4px';

          const placeholder = ta.getAttribute('placeholder') || '';
          div.innerText = originalVal || placeholder;
          ta.parentNode?.replaceChild(div, ta);
        });

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write('<html><head><title>Cetak Rapor - ' + currentStudent.full_name + '</title>');
          
          // Copy styles
          const styles = document.getElementsByTagName('style');
          for (let i = 0; i < styles.length; i++) {
            printWindow.document.write(styles[i].outerHTML);
          }
          const links = document.getElementsByTagName('link');
          for (let i = 0; i < links.length; i++) {
            if (links[i].rel === 'stylesheet') {
              printWindow.document.write(links[i].outerHTML);
            }
          }
          
          printWindow.document.write(`
            <style>
              body { background: white; margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; }
              #report-card-print-area { font-size: 12px !important; color: black; }
              table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
              th, td { word-wrap: break-word !important; overflow-wrap: break-word !important; word-break: normal !important; white-space: normal !important; }
              th { text-align: center !important; }
              .text-justify { text-align: justify !important; text-justify: inter-word !important; }
              .no-print { display: none !important; }
            </style>
          `);
          printWindow.document.write('</head><body class="bg-white">');
          printWindow.document.write(printContentClone.outerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          
          // Focus and print after a slight delay to allow rendering
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }, 500);
        } else {
          // If popup is blocked, fallback to normal print
          window.print();
        }
      } catch (e) {
        console.error(e);
        window.print();
      }
    };

    const handleDownloadWord = () => {
      try {
        const printContent = document.getElementById('report-card-print-area');
        if (!printContent) return;

        // Clone the content so we don't modify the visible UI
        const printContentClone = printContent.cloneNode(true) as HTMLElement;

        // 1. Convert form inputs/textareas to text nodes to prevent them from becoming messy controls in Word
        const inputs = printContentClone.querySelectorAll('input');
        inputs.forEach((input: any) => {
            const span = document.createElement('span');
            span.innerText = input.value || '';
            input.parentNode?.replaceChild(span, input);
        });
        
        const textareas = printContentClone.querySelectorAll('textarea');
        textareas.forEach((ta: any) => {
            const p = document.createElement('p');
            p.innerHTML = ta.value.replace(/\n/g, '<br/>') || '........................................................';
            ta.parentNode?.replaceChild(p, ta);
        });

        // 2. Convert `.grid.grid-cols-2` into true HTML <table> to preserve the 2-column layout in Word
        const grids = Array.from(printContentClone.querySelectorAll('.grid.grid-cols-2'));
        grids.forEach(grid => {
           const newTable = document.createElement('table');
           newTable.style.width = '100%';
           newTable.style.border = 'none';
           newTable.style.marginBottom = '20px';
           const tbody = document.createElement('tbody');
           const tr = document.createElement('tr');
           
           const col1 = document.createElement('td');
           col1.style.width = '50%';
           col1.style.verticalAlign = 'top';
           col1.style.border = 'none';
           
           const col2 = document.createElement('td');
           col2.style.width = '50%';
           col2.style.verticalAlign = 'top';
           col2.style.border = 'none';
           
           const children = Array.from(grid.children);
           if (children[0]) col1.innerHTML = children[0].innerHTML;
           if (children[1]) col2.innerHTML = children[1].innerHTML;
           
           tr.appendChild(col1);
           tr.appendChild(col2);
           tbody.appendChild(tr);
           newTable.appendChild(tbody);
           
           // Convert flex inside these columns (for Student Details key-value pairs)
           const flexRows = Array.from(newTable.querySelectorAll('.flex.justify-between'));
           flexRows.forEach(flex => {
               const flexTable = document.createElement('table');
               flexTable.style.width = '100%';
               flexTable.style.border = 'none';
               
               const ftbody = document.createElement('tbody');
               const ftr = document.createElement('tr');
               const ftd1 = document.createElement('td');
               ftd1.style.width = '35%';
               ftd1.style.border = 'none';
               ftd1.style.padding = '2px 0';
               const ftd2 = document.createElement('td');
               ftd2.style.width = '65%';
               ftd2.style.border = 'none';
               ftd2.style.padding = '2px 0';
               
               const flexKids = Array.from(flex.children);
               if (flexKids[0]) ftd1.innerHTML = flexKids[0].innerHTML;
               if (flexKids[1]) ftd2.innerHTML = flexKids[1].innerHTML;
               
               ftr.appendChild(ftd1);
               ftr.appendChild(ftd2);
               ftbody.appendChild(ftr);
               flexTable.appendChild(ftbody);
               
               flex.parentNode?.replaceChild(flexTable, flex);
           });
           
           // Handle signatures in the columns
           const centeredDivs = Array.from(newTable.querySelectorAll('.flex-col.items-center.text-center'));
           centeredDivs.forEach(div => {
              (div as HTMLElement).style.textAlign = 'center';
              (div as HTMLElement).style.display = 'block';
           });

           grid.parentNode?.replaceChild(newTable, grid);
        });

        // 3. Make the Principal block centered explicitly
        const pBlock = printContentClone.querySelector('.flex-col.items-center.text-center.mt-4');
        if (pBlock) {
             (pBlock as HTMLElement).style.textAlign = 'center';
             (pBlock as HTMLElement).style.display = 'block';
             (pBlock as HTMLElement).style.marginTop = '40px';
             (pBlock as HTMLElement).style.width = '100%';
        }
        
        // Fix spacer divs for signatures
        const spacers = Array.from(printContentClone.querySelectorAll('.h-14'));
        spacers.forEach(spacer => {
            (spacer as HTMLElement).style.height = '60px';
            (spacer as HTMLElement).style.display = 'block';
        });

        // 4. Force all normal tables to have borders explicitly for Word
        const tables = Array.from(printContentClone.querySelectorAll('table'));
        tables.forEach(table => {
            // Only style non-structural tables
            if (table.style.border === 'none' || table.style.borderColor === 'transparent') return; 
            
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.border = '1px solid black';
            table.style.marginBottom = '20px';
            
            const ths = Array.from(table.querySelectorAll('th'));
            ths.forEach(th => {
                const thEl = th as HTMLElement;
                thEl.style.border = '1px solid black';
                thEl.style.backgroundColor = '#d1d5db';
                thEl.style.padding = '5px';
                thEl.style.fontWeight = 'bold';
                thEl.style.textAlign = 'center';
            });
            
            const tds = Array.from(table.querySelectorAll('td'));
            tds.forEach(td => {
                const tdEl = td as HTMLElement;
                if (tdEl.style.border !== 'none') {
                    tdEl.style.border = '1px solid black';
                    tdEl.style.padding = '5px';
                    tdEl.style.verticalAlign = 'top';
                }
            });
        });

        let contentHtml = printContentClone.innerHTML;
        
        const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Rapor</title><style>body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; } h2 { font-size: 14pt; margin-bottom: 20px; text-align: center; font-weight: bold; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .uppercase { text-transform: uppercase; } .capitalize { text-transform: capitalize; } .underline { text-decoration: underline; }</style></head><body>";
        const postHtml = "</body></html>";
        const html = preHtml + contentHtml + postHtml;

        const blob = new Blob(['\\ufeff', html], {
          type: 'application/msword'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rapor_${currentStudent.full_name}.doc`;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Download to Word failed:', e);
      }
    };
    
    // Helper to format school name properly
    const toTitleCase = (str: string) => {
      const romanRegex = /^[IVX]+$/i;
      const levelRegex = /^(SD|SDN|SMP|SMA|SMK|MI|MTS|MA)$/i;

      return str.split(' ').map(word => {
        const upperWord = word.toUpperCase();
        if (romanRegex.test(upperWord)) {
          return upperWord;
        }
        if (levelRegex.test(upperWord)) {
          if (upperWord === 'SDN') return 'SD Negeri';
          return upperWord;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    };

    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-950 flex flex-col">
        <style>{`
          #report-card-print-area {
            font-size: 12px !important;
          }
          #report-card-print-area, #report-card-print-area * {
            font-family: Arial, Helvetica, sans-serif !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }
          #report-card-print-area h2.report-title, #report-card-print-area h2.report-title * {
            font-size: 14px !important;
          }
          #report-card-print-area .font-normal-force {
            font-weight: normal !important;
          }
          #report-card-print-area table {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          #report-card-print-area th,
          #report-card-print-area td {
            border: 1px solid #000000 !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: normal !important;
            white-space: normal !important;
          }
          #report-card-print-area .text-justify {
            text-align: justify !important;
            text-justify: inter-word !important;
          }
          #report-card-print-area th {
            background-color: #d1d5db !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            text-align: center !important;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            #report-card-print-area, #report-card-print-area * {
              visibility: visible;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              box-sizing: border-box !important;
            }
            #report-card-print-area {
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              background: white !important;
              font-size: 12px !important;
              line-height: 1.4 !important;
              padding: 10px 20px !important;
              margin: 0 !important;
            }
            #report-card-print-area h2.report-title, #report-card-print-area h2.report-title * {
              font-size: 14px !important;
            }
            .no-print {
              display: none !important;
            }
            .print-border-print {
              border-color: #000000 !important;
            }
          }
        `}</style>

        {/* CONTROLS BAR (Hidden during printing) */}
        <div className="no-print bg-slate-900 text-white p-4 md:p-6 border-b border-slate-800 shadow-2xl flex flex-col gap-3 md:gap-4 w-full shrink-0 z-10 max-h-[45vh] lg:max-h-none overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 md:pb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <FileText className="text-rose-400" size={24} />
              <div>
                <h3 className="font-black text-sm md:text-base text-gray-50 uppercase tracking-widest leading-none">Review Halaman Rapor</h3>
                <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 leading-none">Asesmen Kurikulum Merdeka Terpadu & Revisi 2025</p>
              </div>
            </div>
            <button 
              onClick={() => setShowReportCardModal(false)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Student Dropdown Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 truncate">1. Pilih Murid:</label>
              <select
                value={selectedReportStudentId || ''}
                onChange={(e) => setSelectedReportStudentId(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 px-2 md:px-3 py-1.5 md:py-2 rounded-xl text-xs font-bold outline-none focus:border-rose-500 transition-all font-sans"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>

            {/* Signature option for Parent */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 truncate">2. TTD Orang Tua:</label>
              <select
                value={selectedParentSignature}
                onChange={(e) => setSelectedParentSignature(e.target.value as any)}
                className="w-full bg-slate-800 text-white border border-slate-700 px-2 md:px-3 py-1.5 md:py-2 rounded-xl text-xs font-bold outline-none focus:border-rose-500 transition-all font-sans"
              >
                <option value="father">Nama Ayah ({currentStudent?.father_name || 'Tidak Ada'})</option>
                <option value="mother">Nama Ibu ({currentStudent?.mother_name || 'Tidak Ada'})</option>
                <option value="empty">Pilih Kosong / Titik-Titik</option>
              </select>
            </div>

            {/* Homeroom teacher selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 truncate">3. Wali Kelas (Ttd kanan):</label>
              <select
                value={selectedHomeroomTeacherId}
                onChange={(e) => setSelectedHomeroomTeacherId(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 px-2 md:px-3 py-1.5 md:py-2 rounded-xl text-xs font-bold outline-none focus:border-rose-500 transition-all font-sans text-ellipsis max-w-full"
              >
                <option value="">-- Pilih Wali Kelas --</option>
                {allTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>

            {/* Date settings */}
            <div className="flex flex-col gap-1.5 overflow-hidden">
              <label className="text-[10px] uppercase font-bold text-gray-400 truncate">4. Tempat & Tanggal Rapor:</label>
              <div className="flex gap-1.5 md:gap-2">
                <input
                  type="text"
                  placeholder="Tempat"
                  value={reportPlace}
                  onChange={(e) => setReportPlace(e.target.value)}
                  className="w-1/2 min-w-0 bg-slate-800 text-white border border-slate-700 px-2 py-1.5 md:py-2 rounded-xl text-xs font-bold text-center outline-none focus:border-rose-500 transition-all font-sans"
                />
                <input
                  type="text"
                  placeholder="Tanggal"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-1/2 min-w-0 bg-slate-800 text-white border border-slate-700 px-2 py-1.5 md:py-2 rounded-xl text-xs font-bold text-center outline-none focus:border-rose-500 transition-all font-sans"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-slate-800 pt-3 md:pt-4 gap-3">
            <p className="text-[9px] md:text-[10px] text-zinc-400 max-w-xl hidden md:block">
              💡 <span className="font-bold text-white">Panduan Cetak:</span> Gunakan setelan ukuran kertas <span className="text-rose-400 font-bold">A4</span>, skala <span className="text-rose-400 font-bold">Default (100%)</span>, dan aktifkan pilihan <span className="text-rose-400 font-bold">"Grafik Latar Belakang (Background Graphics)"</span> pada opsi cetak browser untuk hasil grafis terbaik.
            </p>
            <div className="flex flex-wrap gap-2 md:gap-3 ml-auto">
              <button
                onClick={handleDownloadWord}
                className="flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-lg shadow-blue-900/30"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Download / Ekspor Word</span>
                <span className="sm:hidden">Word</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-lg shadow-rose-900/30"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Cetak Lembar Rapor</span>
                <span className="sm:hidden">Print</span>
              </button>
              <button
                onClick={() => setShowReportCardModal(false)}
                className="flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-slate-800 hover:bg-slate-700 text-zinc-300 rounded-xl font-bold transition-all text-xs cursor-pointer border border-slate-700 text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE MAIN WRAPPER (Full view of report card sheet) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950/45 flex flex-col items-center w-full min-h-0">
          {recapLoading ? (
            <div className="bg-white rounded-2xl p-12 max-w-5xl w-full shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="animate-spin text-rose-600 mb-3" size={40} />
              <p className="text-xs text-gray-500 font-extrabold uppercase tracking-widest">SINKRONISASI DATA DAN PREDIKAT...</p>
            </div>
          ) : !currentStudent ? (
            <div className="bg-white rounded-2xl p-12 max-w-5xl w-full shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
              <p className="text-sm font-bold text-gray-700">Tidak ada murid terpilih</p>
            </div>
          ) : (
            /* EMBEDDED REALISTIC indonesian REPORT CARD DRAW AREA */
            <div 
              id="report-card-print-area"
              className="bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-2xl max-w-5xl w-full p-4 sm:p-8 md:p-12 lg:p-16 flex flex-col font-sans text-xs leading-relaxed overflow-x-auto print:mx-0 print:my-0 print:p-0 print:border-none print:shadow-none print:rounded-none mb-12 shrink-0 animate-in fade-in zoom-in-95 duration-200"
            >
              {/* SCHOOL HEAD OFFICE STATEMENT */}
              <div className="flex flex-col items-center text-center mb-8">
                <h2 className="report-title text-gray-950 font-bold uppercase tracking-widest leading-none">LAPORAN HASIL BELAJAR (RAPOR)</h2>
              </div>
 
              {/* STUDENT DETAILS BLOCK HEADER */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 pb-2 mb-4 font-normal-force">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Nama Murid</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span className="capitalize">{currentStudent.full_name}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">NISN / NIS</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{currentStudent.nisn || '-'} / {currentStudent.nis || '-'}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Sekolah</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{settings?.school_name || 'SDN Karanggeger II'}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Alamat</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>Desa Karanggeger, Kec. Pajarakan</span></span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pl-12 md:pl-24">
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Kelas</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{currentStudent?.class_id ? `Kelas ${currentStudent.class_id}` : (currentClass?.name || 'Kelas V A')}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Fase</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{getFaseVal()}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Semester</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{selectedSemester === '1' ? 'I - Ganjil' : 'II - Genap'}</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-1/3 text-gray-500">Tahun Pelajaran</span>
                    <span className="w-2/3 text-gray-950 flex gap-1">:<span>{settings?.academic_year || '2025/2026'}</span></span>
                  </div>
                </div>
              </div>

            {/* SECTION A: ACADEMIC TABLE */}
            <div className="mb-6 overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-gray-300 text-left text-[11px] leading-snug min-w-[500px] print:min-w-0">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-300 text-gray-700">
                    <th className="border border-gray-300 px-3 py-2 text-center font-bold w-12">No</th>
                    <th className="border border-gray-300 px-4 py-2 font-bold w-1/4">Mata Pelajaran</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-bold w-24">Nilai Akhir</th>
                    <th className="border border-gray-300 px-4 py-2 font-bold">Capaian Kompetensi</th>
                  </tr>
                </thead>
                <tbody>
                  {getActiveSubjectsForClass(currentStudent?.class_id || selectedClassId || '').map((sub, index) => {
                    const calculations = getStudentSubjectCalculations(currentStudent, sub);
                    const isEven = index % 2 === 1;
                    return (
                      <tr key={sub} className={cn("border-b border-gray-200 hover:bg-slate-50/40 transition-colors", isEven && "bg-slate-50/20")}>
                        <td className="border border-gray-200 px-3 py-2.5 text-center text-gray-400 font-normal-force">{index + 1}</td>
                        <td className="border border-gray-200 px-4 py-2.5 text-gray-900 capitalize font-normal-force">{formatSubjectName(sub)}</td>
                        <td className="border border-gray-200 px-3 py-2.5 text-center text-rose-600 font-normal-force">
                          {calculations.hasData ? calculations.finalScore : '-'}
                        </td>
                        <td className="border border-gray-200 px-4 py-2.5 text-gray-600 leading-relaxed font-normal-force text-justify">
                          {calculations.hasData ? (
                            generateSubjectDescription(currentStudent.id, sub, currentStudent?.class_id ? `Kelas ${currentStudent.class_id}` : (currentClass?.name || 'Kelas V A'))
                          ) : (
                            <span className="text-gray-400 italic">Belum ada data nilai materi/ujian pada kelas.</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* SECTION B: PROYEK KOKURIKULER TABLE */}
            <div className="mb-6 animate-in fade-in duration-200 overflow-x-auto print:overflow-visible">
              {cocurriculars.length === 0 ? (
                <div className="border border-gray-200 p-4 rounded-xl text-center text-gray-400 italic text-[11px]">
                  Tidak ada proyek kokurikuler terdaftar.
                </div>
              ) : (
                <table className="w-full border-collapse border border-gray-300 text-left text-[11px] leading-snug min-w-[500px] print:min-w-0">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-300 text-gray-700">
                      <th colSpan={3} className="border border-gray-300 px-4 py-2 text-center font-bold">Kokurikuler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cocurriculars.map((cok, index) => {
                      const uGrades = getStudentGrades(currentStudent.id);
                      const predicate = uGrades[`project_kokurikuler_${cok.id}_predicate`] || '';
                      const description = predicate ? withAnandaPrefix(getCocurricularAchievement(currentStudent.id, cok.id, cok.title, predicate, currentStudent?.class_id ? `Kelas ${currentStudent.class_id}` : (currentClass?.name || 'Kelas V A')), currentStudent.nickname || currentStudent.full_name.split(' ')[0]) : '';
                      const isEven = index % 2 === 1;
                      
                      return (
                        <tr key={cok.id} className={cn("border-b border-gray-200", isEven && "bg-slate-50/20")}>
                          <td colSpan={3} className="border border-gray-200 px-4 py-3 text-gray-800 text-[11px] leading-relaxed text-justify">
                            {predicate ? description : <span className="text-gray-400 italic">Siswa belum / tidak dinilai dalam proyek ini.</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* SECTION C: EXTRACURRICULAR TABLE */}
            <div className="mb-6 overflow-x-auto print:overflow-visible">
              {extracurriculars.length === 0 ? (
                <div className="border border-gray-200 p-4 rounded-xl text-center text-gray-400 italic text-[11px]">
                  Tidak ada data ekstrakurikuler terdaftar.
                </div>
              ) : (
                <table className="w-full border-collapse border border-gray-300 text-left text-[11px] leading-snug min-w-[500px] print:min-w-0">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-300 text-gray-700">
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold w-12">No</th>
                      <th className="border border-gray-300 px-4 py-2 font-bold w-1/3">Ekstrakurikuler</th>
                      <th className="border border-gray-300 px-4 py-2 font-bold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extracurriculars.map((ekskul, index) => {
                      const uGrades = getStudentGrades(currentStudent.id);
                      const predicate = uGrades[`project_ekskul_${ekskul.id}_predicate`] || '';
                      const description = predicate ? withAnandaPrefix(getEkskulAchievement(currentStudent.id, ekskul.id, ekskul.name, predicate, currentStudent?.class_id ? `Kelas ${currentStudent.class_id}` : (currentClass?.name || 'Kelas V A')), currentStudent.nickname || currentStudent.full_name.split(' ')[0]) : '';
                      const isEven = index % 2 === 1;
                      
                      return (
                        <tr key={ekskul.id} className={cn("border-b border-gray-200", isEven && "bg-slate-50/20")}>
                          <td className="border border-gray-200 px-3 py-2.5 text-center font-normal-force text-gray-455">{index + 1}</td>
                          <td className="border border-gray-200 px-4 py-2.5 font-normal-force text-gray-900">{ekskul.name}</td>
                          <td className="border border-gray-200 px-4 py-2.5 text-gray-600 font-normal-force text-justify">
                            {predicate ? description : <span className="text-gray-400 italic">Siswa belum/tidak mengikuti program ini.</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* BOTTOM SECTIONS: KETIDAKHADIRAN & CATATAN WALI KELAS IN A GRID */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Left: Ketidakhadiran Table */}
              <div className="flex flex-col overflow-x-auto print:overflow-visible min-w-0">
                <table className="w-full border-collapse border border-gray-300 text-[11px] leading-snug h-full min-w-[300px] print:min-w-0">
                  <thead>
                    <tr className="bg-slate-50 text-gray-700">
                      <th colSpan={2} className="border border-gray-300 px-4 py-2 font-black uppercase text-gray-950 text-center tracking-wider bg-slate-100/70">
                        Ketidakhadiran
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2.5 font-normal-force text-gray-700 w-2/3 bg-slate-50/20">Sakit (S)</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={getStudentGrades(currentStudent.id)['attendance_sakit'] ?? ''}
                          onChange={(e) => handleGradeChange(currentStudent.id, 'attendance_sakit', e.target.value)}
                          placeholder="0"
                          className="w-full text-center border-0 bg-transparent font-normal-force text-indigo-600 outline-none placeholder:text-gray-300"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2.5 font-normal-force text-gray-700 bg-slate-50/20">Izin (I)</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={getStudentGrades(currentStudent.id)['attendance_izin'] ?? ''}
                          onChange={(e) => handleGradeChange(currentStudent.id, 'attendance_izin', e.target.value)}
                          placeholder="0"
                          className="w-full text-center border-0 bg-transparent font-normal-force text-indigo-600 outline-none placeholder:text-gray-300"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2.5 font-normal-force text-gray-700 bg-slate-50/20">Tanpa Keterangan (A)</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={getStudentGrades(currentStudent.id)['attendance_alpa'] ?? ''}
                          onChange={(e) => handleGradeChange(currentStudent.id, 'attendance_alpa', e.target.value)}
                          placeholder="0"
                          className="w-full text-center border-0 bg-transparent font-normal-force text-indigo-600 outline-none placeholder:text-gray-300"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right: Catatan Wali Kelas Table */}
              <div className="flex flex-col overflow-x-auto print:overflow-visible min-w-0">
                <table className="w-full border-collapse border border-gray-300 text-[11px] leading-snug h-full min-w-[300px] print:min-w-0">
                  <thead>
                    <tr className="bg-slate-50 text-gray-700">
                      <th className="border border-gray-300 px-4 py-2 font-black uppercase text-gray-950 text-center tracking-wider bg-slate-100/70">
                        Catatan Wali Kelas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-3 bg-slate-50/5 align-top text-justify">
                        <textarea
                          value={getStudentGrades(currentStudent.id)['custom_wali_note'] ?? ''}
                          placeholder={waliNoteCalculated}
                          onChange={(e) => handleGradeChange(currentStudent.id, 'custom_wali_note', e.target.value)}
                          className="w-full border-0 bg-transparent outline-none p-1 text-[12px] font-bold leading-relaxed text-gray-900 resize-none placeholder:text-gray-500 font-sans text-justify"
                          rows={4}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION: TANGGAPAN ORANG TUA / WALI AS A TABLE */}
            <div className="mb-6 overflow-x-auto print:overflow-visible w-full">
              <table className="w-full border-collapse border border-gray-300 text-[11px] leading-snug min-w-[500px] print:min-w-0">
                <thead>
                  <tr className="bg-slate-50 text-gray-700">
                    <th className="border border-gray-300 px-4 py-2 font-black uppercase text-gray-950 text-center tracking-wider bg-slate-100/70">
                      Tanggapan Orang Tua / Wali
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3 bg-slate-50/5 align-top text-justify">
                      <textarea
                        value={getStudentGrades(currentStudent.id)['parent_feedback'] ?? ''}
                        placeholder="........................................................................................................................................................................................................................................................................................................................................................................................................................"
                        onChange={(e) => handleGradeChange(currentStudent.id, 'parent_feedback', e.target.value)}
                        className="w-full border-0 bg-transparent outline-none p-1 text-[11px] font-semibold text-gray-800 leading-loose resize-none placeholder:text-gray-300 focus:placeholder:text-transparent font-sans text-justify"
                        rows={3}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION G: KEPUTUSAN (Semester 2 only) */}
            {selectedSemester === '2' && (
              <div className="mb-6">
                {getPromotionStatement(getStudentGradeLevel(), currentStudent.full_name, currentStudent.id)}
              </div>
            )}

            {/* SIGNATURE SECTION */}
            <div className="flex flex-col gap-8 pt-8 mt-auto font-sans">
              {/* Row 1: Parents & Homeroom Teacher */}
              <div className="grid grid-cols-2 gap-12">
                {/* Parent Left Signature */}
                <div className="flex flex-col items-center text-center">
                  <span className="font-normal-force block min-h-[18px]">&nbsp;</span>
                  <span className="font-normal-force">Orang Tua / Wali Murid</span>
                  <div className="h-14" />
                  <span className="font-bold underline capitalize">{selectedParentDisplayedName}</span>
                  <span className="font-normal-force mt-0.5 block min-h-[18px]">&nbsp;</span>
                </div>

                {/* Teacher Right Signature */}
                <div className="flex flex-col items-center text-center">
                  <span className="font-normal-force">{reportPlace}, {reportDate}</span>
                  <span className="font-normal-force">Wali Kelas</span>
                  <div className="h-14" />
                  <span className="font-bold underline">{teacherNameDisplayed}</span>
                  <span className="font-normal-force mt-0.5">NIP. {matchedTeacher?.nis ? matchedTeacher.nis : '-'}</span>
                </div>
              </div>

              {/* Row 2: Centered Principal (placed lower down in the middle) */}
              <div className="flex flex-col items-center text-center mt-4">
                <span className="font-normal-force">Mengetahui,</span>
                <span className="font-normal-force">Kepala {toTitleCase(settings?.school_name || 'SDN Karanggeger II')}</span>
                <div className="h-14" />
                <span className="font-bold underline">{settings?.principal_name || 'Kepala Sekolah'}</span>
                <span className="font-normal-force mt-0.5">NIP. {settings?.principal_nip || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderRecapModal = () => {
    if (!showRecapModal) return null;

    const matchedTeacher = allTeachers.find(t => t.id === selectedRecapTeacherId) || profile;
    const teacherNameDisplayed = matchedTeacher ? matchedTeacher.full_name : profile.full_name;
    const teacherNipDisplayed = matchedTeacher ? (matchedTeacher.nis || '-') : (profile.nis || '-');

    const handlePrint = () => {
      try {
        const printContent = document.getElementById('recap-print-area');
        if (!printContent) {
          window.print();
          return;
        }
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write('<html><head><title>Rekapitulasi Nilai Kelas - ' + (selectedClass?.name || 'Kelas') + '</title>');
          
          // Copy styles
          const styles = document.getElementsByTagName('style');
          for (let i = 0; i < styles.length; i++) {
            printWindow.document.write(styles[i].outerHTML);
          }
          const links = document.getElementsByTagName('link');
          for (let i = 0; i < links.length; i++) {
            if (links[i].rel === 'stylesheet') {
              printWindow.document.write(links[i].outerHTML);
            }
          }
          
          printWindow.document.write(`
            <style>
              body { background: white; margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; }
              #recap-print-area {
                font-size: 12px !important;
                color: #000000 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
              #recap-print-area, #recap-print-area * {
                font-family: Arial, Helvetica, sans-serif !important;
                color: #000000 !important;
                box-sizing: border-box !important;
                font-size: 12px !important;
              }
              #recap-print-area h2.report-title, #recap-print-area h2.report-title * {
                font-size: 14px !important;
                font-weight: bold !important;
              }
              #recap-print-area table {
                border: 1px solid #000000 !important;
                border-collapse: collapse !important;
                box-sizing: border-box !important;
                width: 100% !important;
                margin-top: 15px !important;
              }
              #recap-print-area th,
              #recap-print-area td {
                border: 1px solid #000000 !important;
                box-sizing: border-box !important;
                padding: 6px 8px !important;
              }
              #recap-print-area th {
                background-color: #f3f4f6 !important;
                font-weight: bold !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .font-normal-force {
                font-weight: normal !important;
              }
              .no-print {
                display: none !important;
              }
            </style>
          `);
          printWindow.document.write('</head><body class="bg-white">');
          printWindow.document.write(printContent.outerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          
          // Focus and print after a slight delay to allow rendering
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }, 500);
        } else {
          // If popup is blocked, fallback to normal print
          window.print();
        }
      } catch (e) {
        console.error('Print failed:', e);
        window.print();
      }
    };

    const getStudentSubjectData = (student: Student, subject: string) => {
      const calcs = getStudentSubjectCalculations(student, subject);
      return {
        avgDaily: calcs.avgDaily,
        uts: calcs.uts,
        uas: calcs.uas,
        finalScore: calcs.finalScore,
        hasData: calcs.hasData
      };
    };

    const isGuruKelas = profile.teacher_type?.startsWith('Guru Kelas');
    const isGuruPAI = profile.teacher_type === 'Guru PAI';
    const isGuruPJOK = profile.teacher_type === 'Guru PJOK';
    const isSubjectTeacher = isGuruPAI || isGuruPJOK;

    let displayedSubjects = getActiveSubjectsForClass(selectedClassId || '');
    if (isGuruPAI) {
      displayedSubjects = ['PAI & Budi Pekerti'];
    } else if (isGuruPJOK) {
      displayedSubjects = ['PJOK'];
    }

    const filteredRecapStudents = students.filter(s => 
      s.full_name.toLowerCase().includes(recapSearchTerm.toLowerCase())
    );

    // PRE-CALCULATE STUDENT RANKINGS FOR CLASS TEACHERS
    const studentRanks: Record<string, number> = {};
    if (!isSubjectTeacher) {
      const studentAverages = filteredRecapStudents.map(student => {
        let totalSum = 0;
        let subjectCount = 0;
        displayedSubjects.forEach(sub => {
          const data = getStudentSubjectData(student, sub);
          if (data.hasData) {
            totalSum += data.finalScore;
            subjectCount++;
          }
        });
        const average = subjectCount > 0 ? customRound(totalSum / subjectCount) : 0;
        return { studentId: student.id, average };
      });

      // Sort desc by average
      const sortedAverages = [...studentAverages].sort((a, b) => b.average - a.average);
      
      studentAverages.forEach(curr => {
        const rank = sortedAverages.findIndex(x => x.average === curr.average) + 1;
        studentRanks[curr.studentId] = rank;
      });
    }

    const handleDownloadExcel = () => {
      try {
        const dataRows: any[] = [];
        
        if (isSubjectTeacher) {
          filteredRecapStudents.forEach((student, index) => {
            const studentGrades = grades[student.id] || {};
            
            const validDaily = currentTopics
              .map(t => studentGrades[`daily_${t.title}`])
              .filter((score): score is number => score !== undefined && score !== null && score !== '' as any && !isNaN(Number(score)))
              .map(Number);
              
            const rawUts = studentGrades['uts'];
            const validUts = (rawUts !== undefined && rawUts !== null && rawUts !== '' as any && !isNaN(Number(rawUts))) ? Number(rawUts) : null;
            
            const rawUas = studentGrades['uas'];
            const validUas = (rawUas !== undefined && rawUas !== null && rawUas !== '' as any && !isNaN(Number(rawUas))) ? Number(rawUas) : null;
            
            // Flat average of all individual active/valid scores
            const components: number[] = [...validDaily];
            if (validUts !== null) components.push(validUts);
            if (validUas !== null) components.push(validUas);
            
            const hasAnyScores = components.length > 0;
            const finalScore = hasAnyScores ? customRound(components.reduce((a, b) => a + b, 0) / components.length) : 0;

            const rowData: any = {
              'No.': index + 1,
              'Nama Murid': student.full_name,
              'NISN/NIS': `${student.nisn || '-'} / ${student.nis || '-'}`
            };

            currentTopics.forEach((t, i) => {
              const score = studentGrades[`daily_${t.title}`];
              rowData[`T${i + 1}`] = score !== undefined ? score : '-';
            });

            rowData['UTS'] = studentGrades['uts'] !== undefined ? studentGrades['uts'] : '-';
            rowData['UAS'] = studentGrades['uas'] !== undefined ? studentGrades['uas'] : '-';
            rowData['Nilai Akhir'] = hasAnyScores ? finalScore : '-';

            dataRows.push(rowData);
          });
          
        } else {
          // General Class Teacher
          filteredRecapStudents.forEach((student, index) => {
            let totalSum = 0;
            let subjectCount = 0;
            
            const rowData: any = {
              'No.': index + 1,
              'Nama Murid': student.full_name,
              'NISN/NIS': `${student.nisn || '-'} / ${student.nis || '-'}`
            };

            displayedSubjects.forEach(sub => {
              const data = getStudentSubjectData(student, sub);
              if (data.hasData) {
                totalSum += data.finalScore;
                subjectCount++;
                rowData[sub] = data.finalScore;
              } else {
                rowData[sub] = '-';
              }
            });

            rowData['Rata-rata Kelas'] = subjectCount > 0 ? customRound(totalSum / subjectCount) : '-';
            dataRows.push(rowData);
          });
        }

        const worksheet = XLSX.utils.json_to_sheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');

        const colWidths = Object.keys(dataRows[0] || {}).map(key => {
          let maxLen = key.length;
          dataRows.forEach(row => {
            const cellVal = row[key] !== undefined && row[key] !== null ? row[key].toString() : '';
            if (cellVal.length > maxLen) {
              maxLen = cellVal.length;
            }
          });
          return { wch: Math.max(maxLen + 3, 10) };
        });
        worksheet['!cols'] = colWidths;

        const className = selectedClass?.name || 'Semua_Kelas';
        const formattedClassName = className.replace(/\s+/g, '_');
        const roleName = profile.teacher_type?.replace(/\s+/g, '_') || 'Guru';
        const fileName = `Rekap_Nilai_${formattedClassName}_Sem_${selectedSemester}_${roleName}.xlsx`;
        
        XLSX.writeFile(workbook, fileName);
        toast.success(`Berhasil mengunduh: ${fileName}`);
      } catch (error) {
        console.error('Failed to export to Excel:', error);
        toast.error('Gagal mengunduh file Excel');
      }
    };

    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-950 flex flex-col font-sans">
        <style>{`
          #recap-print-area {
            font-size: 12px !important;
          }
          #recap-print-area, #recap-print-area * {
            font-family: Arial, Helvetica, sans-serif !important;
            color: #000000 !important;
            box-sizing: border-box !important;
            font-size: 12px !important;
          }
          #recap-print-area h2.report-title, #recap-print-area h2.report-title * {
            font-size: 14px !important;
            font-weight: bold !important;
          }
          #recap-print-area table {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
            width: 100% !important;
          }
          #recap-print-area th,
          #recap-print-area td {
            border: 1px solid #000000 !important;
            box-sizing: border-box !important;
            padding: 6px 8px !important;
          }
          #recap-print-area th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .font-normal-force {
            font-weight: normal !important;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            #recap-print-area, #recap-print-area * {
              visibility: visible;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              box-sizing: border-box !important;
              font-size: 12px !important;
            }
            #recap-print-area h2.report-title, #recap-print-area h2.report-title * {
              font-size: 14px !important;
              font-weight: bold !important;
            }
            #recap-print-area {
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              background: white !important;
              line-height: 1.4 !important;
              padding: 15px 15px !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        <motion.div 
          id="recap-print-wrapper"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative bg-slate-900 overflow-hidden shadow-2xl w-full h-full flex flex-col animate-in fade-in duration-200"
        >
          {/* CONTROLS BAR (Hidden during printing) */}
          <div className="no-print bg-slate-900 text-white p-4 md:p-6 border-b border-slate-800 shadow-2xl flex flex-col gap-3 md:gap-4 w-full shrink-0 z-10 max-h-[45vh] lg:max-h-none overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 md:pb-3">
              <div className="flex items-center gap-2 md:gap-3">
                <ClipboardList className="text-amber-400" size={24} />
                <div>
                  <h3 className="font-black text-sm md:text-base text-gray-50 uppercase tracking-widest leading-none">Review Lembar Rekap Nilai</h3>
                  <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 leading-none font-normal">Asesmen Kurikulum Merdeka Terpadu & Revisi 2025</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRecapModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Signature & Location Config Group */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Guru Kelas / Pengampu:</span>
                <select
                  value={selectedRecapTeacherId}
                  onChange={(e) => setSelectedRecapTeacherId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-amber-500 transition-all font-sans cursor-pointer"
                >
                  <option value="">-- Pilih Guru --</option>
                  {allTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Tempat Rekapitulasi:</span>
                <input
                  type="text"
                  value={recapPlace}
                  onChange={(e) => setRecapPlace(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-amber-500 transition-all font-sans"
                  placeholder="Tempat"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Tanggal Rekapitulasi:</span>
                <input
                  type="text"
                  value={recapDate}
                  onChange={(e) => setRecapDate(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-amber-500 transition-all font-sans"
                  placeholder="Tanggal"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari siswa di lembar rekap..." 
                  value={recapSearchTerm}
                  onChange={(e) => setRecapSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-normal text-white outline-none focus:border-amber-500 transition-all font-sans"
                />
              </div>

              <div className="flex flex-wrap gap-2 md:gap-3 ml-auto">
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-lg shadow-emerald-950/30 font-sans"
                >
                  <Download size={14} />
                  <span>Download Excel</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all text-xs cursor-pointer shadow-lg shadow-amber-950/30 font-sans"
                >
                  <Printer size={14} />
                  <span>Cetak Rekap</span>
                </button>
                <button
                  onClick={() => setShowRecapModal(false)}
                  className="flex-1 md:flex-none px-3 md:px-5 py-2 md:py-2.5 bg-slate-800 hover:bg-slate-700 text-zinc-300 rounded-xl font-bold transition-all text-xs cursor-pointer border border-slate-700 text-center font-sans"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>

          {/* SCROLLABLE MAIN WRAPPER (Full view of print sheet) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950/45 flex flex-col items-center w-full min-h-0">
            {recapLoading ? (
              <div className="bg-white rounded-2xl p-12 max-w-5xl w-full shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="animate-spin text-amber-600 mb-3" size={40} />
                <p className="text-xs text-gray-500 font-extrabold uppercase tracking-widest text-center">SINKRONISASI DATA DAN PREDIKAT...</p>
              </div>
            ) : filteredRecapStudents.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 max-w-5xl w-full shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-sm font-bold text-gray-700 text-center">Tidak ada siswa ditemukan</p>
              </div>
            ) : isSubjectTeacher && currentTopics.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 max-w-5xl w-full shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-amber-800 font-black text-sm text-center">Belum Ada Topik Pembelajaran</p>
                <p className="text-amber-600 text-xs mt-2 leading-relaxed text-center">
                  Silakan tambahkan materi pelajaran dan beberapa topik terlebih dahulu untuk kelas ini agar kolom rekapitulasi nilai dapat ditampilkan secara otomatis.
                </p>
              </div>
            ) : (
              /* REALISTIC PRINT AREA DRAW CONTAINER */
              <div 
                id="recap-print-area"
                className="bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-2xl max-w-5xl w-full p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col font-sans text-xs leading-relaxed overflow-x-auto print:mx-0 print:my-0 print:p-0 print:border-none print:shadow-none print:rounded-none mb-12 shrink-0 animate-in fade-in zoom-in-95 duration-200"
              >
                {/* SHEET HEADER */}
                <div className="flex flex-col items-center text-center mb-6">
                  <h2 className="report-title text-gray-950 uppercase tracking-widest leading-none font-bold text-sm md:text-base">REKAPITULASI NILAI RAPOR KELAS</h2>
                  <p className="text-[10px] md:text-xs text-gray-600 mt-1.5 font-bold uppercase tracking-wide">
                    TAHUN PELAJARAN {settings?.academic_year || '2025/2026'} • SEMESTER {selectedSemester} ({selectedSemester === '1' ? 'GANJIL' : 'GENAP'})
                  </p>
                </div>

                {/* METADATA BLOCK */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 pb-4 mb-6 text-[11px]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="w-1/3 text-gray-500 font-normal">Sekolah</span>
                      <span className="w-2/3 text-gray-950 flex gap-1 font-normal">:<span>{settings?.school_name || 'SDN Karanggeger II'}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="w-1/3 text-gray-500 font-normal font-sans">Kelas / Fase</span>
                      <span className="w-2/3 text-gray-950 flex gap-1 font-normal">:<span>{selectedClass?.name || '-'}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-12 md:pl-24">
                    <div className="flex justify-between">
                      <span className="w-1/3 text-gray-500 font-normal">Guru Pengampu</span>
                      <span className="w-2/3 text-gray-950 flex gap-1 font-normal">:<span>{teacherNameDisplayed}</span></span>
                    </div>
                    {isSubjectTeacher && (
                      <div className="flex justify-between">
                        <span className="w-1/3 text-gray-500 font-normal font-sans">Mata Pelajaran</span>
                        <span className="w-2/3 text-gray-950 flex gap-1 font-normal">:<span>{formatSubjectName(selectedClass?.subject)}</span></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SHEET TABLE */}
                <div className="overflow-x-auto print:overflow-visible w-full">
                  <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                    <thead>
                      <tr className="bg-gray-100/85">
                        <th className="sticky left-0 bg-gray-100 z-10 px-4 py-3 font-bold text-gray-900 border-r border-gray-300 text-center w-48 shrink-0">
                          Nama Murid
                        </th>
                        {isSubjectTeacher ? (
                          <>
                            {currentTopics.map((topic, i) => (
                              <th key={topic.title} className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[70px]">
                                T{i + 1}
                              </th>
                            ))}
                            <th className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[80px]">
                              UTS
                            </th>
                            <th className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[80px]">
                              UAS
                            </th>
                            <th className="px-4 py-3 font-bold bg-gray-200/50 text-gray-950 text-center w-24 border-l border-gray-300">
                              Nilai Akhir
                            </th>
                          </>
                        ) : (
                          <>
                            {displayedSubjects.map(sub => (
                              <th key={sub} className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[100px] text-[10px]">
                                {formatSubjectName(sub)}
                              </th>
                            ))}
                            <th className="px-4 py-3 font-bold bg-gray-200/50 text-gray-950 text-center border-l border-gray-300 w-24">
                              Rata-rata Kelas
                            </th>
                            <th className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[70px]">
                              Peringkat
                            </th>
                            {selectedSemester === '2' && (
                              <th className="px-3 py-2.5 font-bold text-gray-950 text-center border-b border-gray-300 min-w-[140px] no-print">
                                Keputusan (Smt 2)
                              </th>
                            )}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRecapStudents.map(student => {
                        if (isSubjectTeacher) {
                          const studentGrades = grades[student.id] || {};
                          const validDaily = currentTopics
                            .map(t => studentGrades[`daily_${t.title}`])
                            .filter((score): score is number => score !== undefined && score !== null && score !== '' as any && !isNaN(Number(score)))
                            .map(Number);
                          const rawUts = studentGrades['uts'];
                          const validUts = (rawUts !== undefined && rawUts !== null && rawUts !== '' as any && !isNaN(Number(rawUts))) ? Number(rawUts) : null;
                          const rawUas = studentGrades['uas'];
                          const validUas = (rawUas !== undefined && rawUas !== null && rawUas !== '' as any && !isNaN(Number(rawUas))) ? Number(rawUas) : null;
                          
                          // Flat average of all individual active/valid scores
                          const components: number[] = [...validDaily];
                          if (validUts !== null) components.push(validUts);
                          if (validUas !== null) components.push(validUas);
                          const hasAnyScores = components.length > 0;
                          const finalScore = hasAnyScores ? customRound(components.reduce((a, b) => a + b, 0) / components.length) : 0;

                          return (
                            <tr key={student.id} className="hover:bg-gray-50 transition-all select-none">
                              <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-200 font-normal text-gray-800 z-10">
                                {student.full_name}
                                <span className="block text-[8px] font-normal text-gray-400 mt-0.5">NISN/NIS: {student.nisn || '-'} / {student.nis || '-'}</span>
                              </td>
                              {currentTopics.map(topic => {
                                const score = studentGrades[`daily_${topic.title}`];
                                return (
                                  <td key={topic.title} className="px-3 py-3 text-center font-normal text-gray-900 text-sm">
                                    {score !== undefined ? score : <span className="text-gray-300 font-normal">-</span>}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-3 text-center font-normal text-gray-900 text-sm">
                                {studentGrades['uts'] !== undefined ? studentGrades['uts'] : <span className="text-gray-300 font-normal">-</span>}
                              </td>
                              <td className="px-3 py-3 text-center font-normal text-gray-900 text-sm">
                                {studentGrades['uas'] !== undefined ? studentGrades['uas'] : <span className="text-gray-300 font-normal">-</span>}
                              </td>
                              <td className="px-4 py-3 text-center font-normal bg-gray-50 text-blue-600 text-sm border-l border-gray-300">
                                {hasAnyScores ? finalScore : '-'}
                              </td>
                            </tr>
                          );
                        } else {
                          let totalSum = 0;
                          let subjectCount = 0;

                          return (
                            <tr key={student.id} className="hover:bg-gray-50 transition-all select-none">
                              <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-200 font-normal text-gray-800 z-10">
                                {student.full_name}
                                <span className="block text-[8px] font-normal text-gray-400 mt-0.5">NISN/NIS: {student.nisn || '-'} / {student.nis || '-'}</span>
                              </td>
                              {displayedSubjects.map(sub => {
                                const data = getStudentSubjectData(student, sub);
                                if (data.hasData) {
                                  totalSum += data.finalScore;
                                  subjectCount++;
                                }
                                return (
                                  <td key={sub} className="px-3 py-3 text-center">
                                    {data.hasData ? (
                                      <span className="font-normal text-gray-900 text-sm">{data.finalScore}</span>
                                    ) : (
                                      <span className="text-gray-300 italic text-[10px] font-normal">Belum ada nilai</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center font-normal bg-gray-50 text-blue-600 text-sm border-l border-gray-300">
                                {subjectCount > 0 ? customRound(totalSum / subjectCount) : '-'}
                              </td>
                              <td className="px-3 py-3 text-center font-normal text-slate-800 text-sm">
                                {studentRanks[student.id] || '-'}
                              </td>
                              {selectedSemester === '2' && (
                                <td className="px-4 py-3 text-center text-xs no-print">
                                  <span>
                                    <select
                                      value={grades[student.id]?.['promotion_decision'] || ''}
                                      onChange={(e) => handleSavePromotionDecision(student.id, e.target.value)}
                                      className="bg-gray-50 border border-gray-150 rounded-lg py-1 px-2.5 text-xs font-normal text-gray-800 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                      <option value="">Pilih Keputusan</option>
                                      <option value="Naik Kelas">Naik Kelas</option>
                                      <option value="Tinggal Kelas">Tinggal Kelas</option>
                                    </select>
                                  </span>
                                  <span className="hidden print:inline-block font-normal text-gray-900">
                                    {grades[student.id]?.['promotion_decision'] || '-'}
                                  </span>
                                </td>
                              )}
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>

                {/* SIGNATURE SECTION */}
                <div className="mt-12 grid grid-cols-2 gap-12 text-[11px] font-sans">
                  {/* Left Signature - Principal */}
                  <div className="flex flex-col items-center text-center">
                    <span className="font-normal">Mengetahui,</span>
                    <span className="font-normal">Kepala Sekolah</span>
                    <div className="h-16" />
                    <span className="font-bold underline">{settings?.principal_name || 'Kepala Sekolah'}</span>
                    <span className="font-normal mt-0.5 font-normal-force">NIP. {settings?.principal_nip || '-'}</span>
                  </div>

                  {/* Right Signature - Class Teacher */}
                  <div className="flex flex-col items-center text-center">
                    <span className="font-normal">{recapPlace}, {recapDate}</span>
                    <span className="font-normal">Guru Kelas / Pengampu,</span>
                    <div className="h-16" />
                    <span className="font-bold underline">{teacherNameDisplayed}</span>
                    <span className="font-normal mt-0.5 font-normal-force">NIP. {teacherNipDisplayed}</span>
                  </div>
                </div>

                {/* INSTRUCTION FOOTER NOTE FOR NO-PRINT */}
                <div className="no-print border-t border-dashed border-gray-200 mt-8 pt-4">
                  <p className="text-[10px] text-zinc-400 text-center">
                    💡 <span className="font-bold text-zinc-500">Panduan Cetak:</span> Gunakan kertas <span className="font-bold text-zinc-500">A4</span>, orientasi <span className="font-bold text-zinc-500">Landscape / Portret</span> sesuai jumlah kolom, dan centang <span className="font-bold text-zinc-500">"Grafik Latar Belakang (Background Graphics)"</span> pada preferensi cetak browser anda.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const displayedSubjects = selectedClassId ? getActiveSubjectsForClass(selectedClassId) : [];

  if (loading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            {viewMode === 'recap' ? <ClipboardList className="text-indigo-600" /> : <Edit3 className="text-indigo-600" />}
            {viewMode === 'recap' ? "Rekap Nilai & Cetak Rapor" : "Input Nilai Berbasis Materi"}
          </h1>
          <p className="text-gray-500 text-sm">
            {viewMode === 'recap' 
              ? "Lihat rangkuman nilai akhir siswa secara kolektif dan cetak lembar administrasi rapor fisik."
              : "Kelola nilai siswa berdasarkan topik pelajaran, ekstrakurikuler, dan kokurikuler."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button 
              onClick={() => setSelectedSemester('1')}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                selectedSemester === '1' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Semester 1
            </button>
            <button 
              onClick={() => setSelectedSemester('2')}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                selectedSemester === '2' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Semester 2
            </button>
          </div>

          {viewMode === 'recap' ? (
            <select 
              id="select-recap-class"
              value={selectedClassId || ''} 
              onChange={(e) => {
                setSelectedClassId(e.target.value);
              }}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="" disabled>Pilih Kelas</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          ) : (
            <select 
              id="select-subject-class"
              value={selectedClassId && selectedSubject ? `${selectedClassId}|${selectedSubject}` : ''} 
              onChange={(e) => {
                const [cId, subj] = e.target.value.split('|');
                setSelectedClassId(cId);
                setSelectedSubject(subj);
              }}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="" disabled>Pilih Mapel & Kelas</option>
              {Object.entries(classSubjects.reduce((acc, item) => {
                const className = item.className;
                if (!acc[className]) acc[className] = [];
                acc[className].push(item);
                return acc;
              }, {} as Record<string, typeof classSubjects>)).map(([className, items]) => (
                <optgroup key={className} label={className}>
                  {items.map(item => (
                    <option key={`${item.classId}|${item.subject}`} value={`${item.classId}|${item.subject}`}>
                      {formatSubjectName(item.subject)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          {viewMode !== 'recap' && (
            <button 
              id="btn-save-all"
              onClick={handleSaveAll}
              disabled={isSaving || students.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none text-sm cursor-pointer"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" id="icon-save-loading" /> : <Save size={18} id="icon-save-static" />}
              Simpan Semua
            </button>
          )}

          {viewMode === 'recap' && (
            <>
              <button 
                id="btn-open-recap"
                onClick={handleOpenRecap}
                disabled={students.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-100 disabled:opacity-50 disabled:shadow-none text-sm cursor-pointer"
              >
                <ClipboardList size={18} />
                Rekap Nilai
              </button>

              {!isSubjectTeacher && (
                <button 
                  id="btn-open-report-card"
                  onClick={handleOpenReportCard}
                  disabled={students.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-100 disabled:opacity-50 disabled:shadow-none text-sm cursor-pointer"
                >
                  <FileText size={18} />
                  Lihat Rapor
                </button>
              )}
            </>
          )}

          {profile.role === 'admin' && (
            <button 
              id="btn-sync-dapodik"
              onClick={handleSyncDapodik}
              disabled={isSyncingDapodik || students.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none text-sm cursor-pointer"
            >
              {isSyncingDapodik ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
              Sinkron Dapodik
            </button>
          )}
        </div>
      </div>

      {viewMode === 'recap' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden" id="card-recap-table-wrapper">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50" id="card-recap-table-header">
            <div>
              <h3 className="font-bold text-gray-900" id="recap-title">Tabel Rekap Nilai Akhir Siswa</h3>
              <p className="text-xs text-gray-500 mt-1" id="recap-desc">Nilai di bawah ini adalah Nilai Akhir (NA) kurikulum utama yang telah dibulatkan secara otomatis.</p>
            </div>
            <div className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-bold" id="badge-total-subjects">
              {displayedSubjects.length} Mata Pelajaran Terdeteksi
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="recap-results-table">
              <thead>
                <tr className="bg-gray-50/75 select-none">
                  <th className="px-6 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest w-16 text-center border-b border-gray-100">No.</th>
                  <th className="px-6 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest min-w-[200px] border-b border-gray-100">Nama Siswa</th>
                  <th className="px-6 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest text-center border-b border-gray-100">NISN / NIS</th>
                  {displayedSubjects.map(sub => (
                    <th key={sub} className="px-4 py-4 font-black text-indigo-600 uppercase text-[9px] tracking-widest text-center bg-indigo-50/10 border-l border-indigo-50/50 border-b border-gray-100">
                      {formatSubjectName(sub)}
                    </th>
                  ))}
                  <th className="px-6 py-4 font-black text-gray-950 uppercase text-[9px] tracking-widest text-center border-l border-gray-100 bg-gray-50 border-b border-gray-100">Rata-rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recapLoading ? (
                  <tr>
                    <td colSpan={displayedSubjects.length + 4} className="p-10 text-center text-xs text-gray-400">
                      <div className="flex flex-col items-center gap-2 justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={24} />
                        <span>Memuat ringkasan rekap nilai...</span>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={displayedSubjects.length + 4} className="p-10 text-center text-xs text-gray-400 italic">
                      Tidak ada data murid di kelas ini.
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    let totalSum = 0;
                    let subjectCount = 0;
                    
                    const rowScores = displayedSubjects.map(sub => {
                      const calculations = getStudentSubjectCalculations(student, sub);
                      if (calculations.hasData) {
                        totalSum += calculations.finalScore;
                        subjectCount++;
                        return calculations.finalScore;
                      }
                      return null;
                    });
                    
                    const averageScore = subjectCount > 0 ? customRound(totalSum / subjectCount) : '-';
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-gray-400 text-center">{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="p-0.5">
                            <p className="text-xs font-black text-gray-900 capitalize">{student.full_name}</p>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-gray-500 font-mono">
                          {student.nisn || '-'} / {student.nis || '-'}
                        </td>
                        {rowScores.map((score, idx) => (
                          <td key={idx} className="px-4 py-4 text-center text-xs font-bold border-l border-indigo-50/30">
                            {score !== null ? (
                              <span className={score >= 75 ? "text-emerald-600" : "text-rose-500"}>
                                {score}
                              </span>
                            ) : (
                              <span className="text-gray-300 italic text-[10px] font-normal">Belum diinput</span>
                            )}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-center text-xs font-bold text-indigo-600 border-l border-gray-100 bg-indigo-50/10">
                          {averageScore}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Sub Mode Selector (Academic, Extracurricular, Cocurricular) */}
          <div className="flex bg-white p-2 rounded-2xl border border-gray-100 shadow-sm gap-2">
        <button
          onClick={() => setActiveMode('academic')}
          className={cn(
            "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
            activeMode === 'academic' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
          )}
        >
          <BookOpen size={16} /> Kurikulum Utama
        </button>
        {!isSubjectTeacher && (
          <>
            <button
              onClick={() => setActiveMode('extracurricular')}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                activeMode === 'extracurricular' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
              )}
            >
              <Trophy size={16} /> Ekstrakurikuler 🏆
            </button>
            <button
              onClick={() => setActiveMode('cocurricular')}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                activeMode === 'cocurricular' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
              )}
            >
              <Compass size={16} /> Kokurikuler 🧩
            </button>
          </>
        )}
      </div>

      {/* Main Grid: Materials Info & Grade Table */}
      <div className="grid grid-cols-1 gap-6">


        {/* Context Info Header */}
        {activeMode === 'academic' && (
          <div className="flex overflow-x-auto pb-2 gap-4 no-scrollbar">
             {currentTopics.length > 0 ? currentTopics.map((topic, i) => (
               <div key={i} className="min-w-[200px] bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm border-l-4 border-l-indigo-500">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Topik {i+1}</p>
                 <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{topic.title}</h4>
                 <p className="text-[10px] text-gray-400 mt-1">{topic.sub_topics?.length || 0} Sub-materi</p>
               </div>
             )) : (
               <div className="w-full bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
                 <AlertCircle className="text-amber-500" size={20} />
                 <div>
                    <p className="text-xs font-bold text-amber-900">Belum ada materi pelajaran!</p>
                    <p className="text-[10px] text-amber-700">Silakan input materi pelajaran di menu Manajemen Kelas terlebih dahulu untuk mulai memberi nilai berbasis topik.</p>
                 </div>
               </div>
             )}
          </div>
        )}

        {activeMode === 'extracurricular' && (
          <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-3">
            <Trophy className="text-indigo-600 shrink-0 mt-0.5" size={20} />
            <div>
               <p className="text-sm font-bold text-indigo-950">Penilaian Ekstrakurikuler Rapor 🏆</p>
               <p className="text-xs text-indigo-700 leading-relaxed mt-1">
                 Semua program pengembangan bakat, minat, dan kepemimpinan di sekolah otomatis terhubung di kelas Anda. Berikan nilai (skala 0 - 100) bagi siswa yang berpartisipasi dalam program tersebut.
               </p>
            </div>
          </div>
        )}

        {activeMode === 'cocurricular' && (
          <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-3">
            <Compass className="text-indigo-600 shrink-0 mt-0.5" size={20} />
            <div>
               <p className="text-sm font-bold text-indigo-950">Penilaian Kegiatan Kokurikuler 🧩</p>
               <p className="text-xs text-indigo-700 leading-relaxed mt-1">
                 Kegiatan kokurikuler yang didesain oleh admin. Masukkan nilai pencapaian proyek (skala 0 - 100) untuk setiap murid.
               </p>
            </div>
          </div>
        )}

        {/* Grade Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  {activeMode === 'academic' && <GraduationCap size={20} />}
                  {activeMode === 'extracurricular' && <Trophy size={20} />}
                  {activeMode === 'cocurricular' && <Compass size={20} />}
                </div>
                <div>
                   <h3 className="font-bold text-gray-900">Form Input Nilai {activeMode === 'academic' ? 'Kurikulum Utama' : activeMode === 'extracurricular' ? 'Ekstrakurikuler' : 'Kokurikuler'}</h3>
                   <p className="text-xs text-gray-500">
                     Kelas: <span className="font-bold text-gray-800">{selectedClass?.name || '-'}</span> 
                     {selectedSubject && ` • Mata Pelajaran: `}
                     <span className="font-bold text-indigo-600">{formatSubjectName(selectedSubject || '-')}</span> 
                     {materials.length > 0 && selectedSubject === 'Semua Mapel' && (
                       <>
                         {' • Topik Mapel Aktif: '}
                         <span className="font-bold text-teal-600">
                           {Array.from(new Set(materials.map(m => formatSubjectName(m.subject)))).join(', ') || '-'}
                         </span>
                       </>
                     )}
                     {' • Semester '}{selectedSemester}
                   </p>
                </div>
             </div>
             <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari nama siswa..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/10"
                />
             </div>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="sticky left-0 bg-gray-50/55 z-10 px-6 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest border-b border-gray-100">Daftar Siswa</th>
                  {activeMode === 'academic' && (
                    <>
                      {currentTopics.map((topic, i) => (
                        <th key={i} className="px-4 py-4 font-black text-indigo-600 uppercase text-[9px] tracking-widest text-center border-b border-indigo-50 bg-indigo-50/20">
                          T{i+1}
                        </th>
                      ))}
                      <th className="px-4 py-4 font-black text-amber-600 uppercase text-[9px] tracking-widest text-center border-b border-amber-50 bg-amber-50/20">UTS</th>
                      <th className="px-4 py-4 font-black text-amber-600 uppercase text-[9px] tracking-widest text-center border-b border-amber-50 bg-amber-50/20">UAS</th>
                      <th className="px-6 py-4 font-black text-gray-950 uppercase text-[9px] tracking-widest text-center border-b border-gray-100 bg-gray-50">Akhir</th>
                    </>
                  )}

                  {activeMode === 'extracurricular' && (
                    <>
                      {extracurriculars.length === 0 ? (
                        <th className="px-6 py-4 font-black text-gray-400 uppercase text-[9px] border-b border-gray-100">Nama Ekstrakurikuler</th>
                      ) : (
                        extracurriculars.map((ekskul) => (
                          <th key={ekskul.id} className="px-4 py-4 font-black text-indigo-600 uppercase text-[9px] tracking-widest text-center border-b border-indigo-50 bg-indigo-50/20">
                            {ekskul.name} (Penilaian)
                          </th>
                        ))
                      )}
                    </>
                  )}

                  {activeMode === 'cocurricular' && (
                    <>
                      {cocurriculars.length === 0 ? (
                        <th className="px-6 py-4 font-black text-gray-400 uppercase text-[9px] border-b border-gray-100">Topik Kokurikuler</th>
                      ) : (
                        cocurriculars.map((cok) => (
                          <th key={cok.id} className="px-4 py-4 font-black text-indigo-600 uppercase text-[9px] tracking-widest text-center border-b border-indigo-50 bg-indigo-50/20 max-w-[200px]">
                            {cok.title} (Penilaian)
                          </th>
                        ))
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={activeMode === 'academic' ? currentTopics.length + 4 : activeMode === 'extracurricular' ? Math.max(1, extracurriculars.length) + 1 : Math.max(1, cocurriculars.length) + 1} className="p-10 text-center text-xs text-gray-400">
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={activeMode === 'academic' ? currentTopics.length + 4 : activeMode === 'extracurricular' ? Math.max(1, extracurriculars.length) + 1 : Math.max(1, cocurriculars.length) + 1} className="p-10 text-center text-xs text-gray-400">
                      Tidak ada siswa ditemukan
                    </td>
                  </tr>
                ) : filteredStudents.map((student) => {
                  const finalScore = activeMode === 'academic' ? calculateTotal(student.id) : 0;
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="sticky left-0 bg-white px-6 py-4 border-r border-gray-50 z-10 shadow-sm md:shadow-none">
                        <p className="font-bold text-gray-800 text-xs">{student.full_name}</p>
                        <p className="text-[9px] text-gray-400 font-medium">NIS: {student.nis || '-'}</p>
                      </td>

                      {activeMode === 'academic' && (
                        <>
                          {currentTopics.map((topic, i) => (
                            <td key={i} className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                min="0"
                                max="100"
                                value={grades[student.id]?.[`daily_${topic.title}`] ?? ''}
                                onChange={(e) => handleGradeChange(student.id, `daily_${topic.title}`, e.target.value)}
                                className="w-12 text-center py-2 bg-gray-55 border border-transparent rounded-lg text-xs font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-100 transition-all"
                                placeholder=""
                              />
                            </td>
                          ))}
                          <td className="px-4 py-4 text-center bg-amber-50/10">
                            <input 
                              type="number" 
                              min="0"
                              max="100"
                              value={grades[student.id]?.['uts'] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, 'uts', e.target.value)}
                              className="w-12 text-center py-2 bg-amber-50/30 border border-amber-100 rounded-lg text-xs font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition-all"
                              placeholder=""
                            />
                          </td>
                          <td className="px-4 py-4 text-center bg-amber-50/10">
                            <input 
                              type="number" 
                              min="0"
                              max="100"
                              value={grades[student.id]?.['uas'] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, 'uas', e.target.value)}
                              className="w-12 text-center py-2 bg-amber-50/30 border border-amber-100 rounded-lg text-xs font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition-all"
                              placeholder=""
                            />
                          </td>
                          <td className="px-6 py-4 text-center bg-gray-50/10 font-bold text-sm">
                            <span className={cn(
                              (finalScore !== null && finalScore !== undefined && finalScore >= 75) ? "text-green-600" : "text-red-500"
                            )}>
                              {finalScore !== null && finalScore !== undefined ? finalScore : '-'}
                            </span>
                          </td>
                        </>
                      )}

                      {activeMode === 'extracurricular' && (
                        <>
                          {extracurriculars.length === 0 ? (
                            <td className="px-6 py-4 text-xs text-gray-400 italic">
                              Belum ada program ekstrakurikuler yang dibuat oleh admin.
                            </td>
                          ) : (
                            extracurriculars.map((ekskul) => (
                              <td key={ekskul.id} className="px-4 py-4 text-center min-w-[230px]">
                                <div className="flex flex-col gap-1.5 bg-gray-50/50 p-2.5 rounded-xl border border-gray-150 text-left">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold">Predikat:</span>
                                    <select
                                      value={grades[student.id]?.[`project_ekskul_${ekskul.id}_predicate`] ?? ''}
                                      onChange={(e) => handleGradeChange(student.id, `project_ekskul_${ekskul.id}_predicate`, e.target.value)}
                                      className="w-32 px-1.5 py-1 text-[11px] bg-white border border-gray-200 rounded text-gray-700 font-extrabold outline-none cursor-pointer"
                                    >
                                      <option value="">- Pilih -</option>
                                      <option value="Sangat Baik">Sangat Baik</option>
                                      <option value="Baik">Baik</option>
                                      <option value="Cukup">Cukup</option>
                                      <option value="Kurang">Kurang</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 font-bold">Deskripsi Capaian:</span>
                                    <textarea
                                      rows={1}
                                      value={grades[student.id]?.[`project_ekskul_${ekskul.id}_achievement`] ?? ''}
                                      onChange={(e) => handleGradeChange(student.id, `project_ekskul_${ekskul.id}_achievement`, e.target.value)}
                                      placeholder="Contoh: Sangat aktif mengikuti latihan..."
                                      className="w-full px-2 py-1 text-[11px] bg-white border border-gray-200 rounded outline-none h-8 resize-none font-medium text-gray-700 leading-tight"
                                    />
                                    {grades[student.id]?.[`project_ekskul_${ekskul.id}_predicate`] && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const pred = grades[student.id]?.[`project_ekskul_${ekskul.id}_predicate`];
                                          let templ = '';
                                          if (pred === 'Sangat Baik') templ = settings?.ekskul_pred_sb_desc || '';
                                          else if (pred === 'Baik') templ = settings?.ekskul_pred_b_desc || '';
                                          else if (pred === 'Cukup') templ = settings?.ekskul_pred_c_desc || '';
                                          else if (pred === 'Kurang') templ = settings?.ekskul_pred_k_desc || '';
                                          if (templ) handleGradeChange(student.id, `project_ekskul_${ekskul.id}_achievement`, templ);
                                        }}
                                        className="text-[9px] text-indigo-600 hover:text-indigo-800 font-extrabold text-left transition-all mt-0.5"
                                      >
                                        ✨ Gunakan Templat ({grades[student.id]?.[`project_ekskul_${ekskul.id}_predicate`]})
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            ))
                          )}
                        </>
                      )}

                      {activeMode === 'cocurricular' && (
                        <>
                          {cocurriculars.length === 0 ? (
                            <td className="px-6 py-4 text-xs text-gray-400 italic">
                              Belum ada proyek kokurikuler yang dibuat oleh admin.
                            </td>
                          ) : (
                            cocurriculars.map((cok) => (
                              <td key={cok.id} className="px-4 py-4 text-center min-w-[230px]">
                                <div className="flex flex-col gap-1.5 bg-gray-50/50 p-2.5 rounded-xl border border-gray-150 text-left">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold">Predikat:</span>
                                    <select
                                      value={grades[student.id]?.[`project_kokurikuler_${cok.id}_predicate`] ?? ''}
                                      onChange={(e) => handleGradeChange(student.id, `project_kokurikuler_${cok.id}_predicate`, e.target.value)}
                                      className="w-32 px-1.5 py-1 text-[11px] bg-white border border-gray-200 rounded text-gray-700 font-extrabold outline-none cursor-pointer"
                                    >
                                      <option value="">- Pilih -</option>
                                      <option value="Sangat Berkembang">Sangat Berkembang (SB)</option>
                                      <option value="Berkembang Sesuai Harapan">Berkembang Sesuai Harapan (BSH)</option>
                                      <option value="Mulai Berkembang">Mulai Berkembang (MB)</option>
                                      <option value="Belum Berkembang">Belum Berkembang (BB)</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 font-bold">Deskripsi Capaian:</span>
                                    <textarea
                                      rows={1}
                                      value={grades[student.id]?.[`project_kokurikuler_${cok.id}_achievement`] ?? ''}
                                      onChange={(e) => handleGradeChange(student.id, `project_kokurikuler_${cok.id}_achievement`, e.target.value)}
                                      placeholder="Contoh: Kreatif dalam berkolaborasi tim..."
                                      className="w-full px-2 py-1 text-[11px] bg-white border border-gray-200 rounded outline-none h-8 resize-none font-medium text-gray-700 leading-tight"
                                    />
                                    {grades[student.id]?.[`project_kokurikuler_${cok.id}_predicate`] && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const pred = grades[student.id]?.[`project_kokurikuler_${cok.id}_predicate`];
                                          let templ = '';
                                          if (pred === 'Sangat Berkembang') templ = settings?.cocurricular_pred_sb_desc || '';
                                          else if (pred === 'Berkembang Sesuai Harapan') templ = settings?.cocurricular_pred_bsh_desc || '';
                                          else if (pred === 'Mulai Berkembang') templ = settings?.cocurricular_pred_mb_desc || '';
                                          else if (pred === 'Belum Berkembang') templ = settings?.cocurricular_pred_bb_desc || '';
                                          if (templ) handleGradeChange(student.id, `project_kokurikuler_${cok.id}_achievement`, templ);
                                        }}
                                        className="text-[9px] text-indigo-600 hover:text-indigo-800 font-extrabold text-left transition-all mt-0.5"
                                      >
                                        ✨ Gunakan Templat ({grades[student.id]?.[`project_kokurikuler_${cok.id}_predicate`]})
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            ))
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="lg:hidden flex flex-col p-4 gap-4 bg-gray-50/50">
            {loading ? (
              <div className="p-10 text-center text-xs text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                Memuat data...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-xs text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                Tidak ada siswa ditemukan
              </div>
            ) : (
              filteredStudents.map((student) => {
                const finalScore = activeMode === 'academic' ? calculateTotal(student.id) : 0;
                return (
                  <div key={student.id} className="bg-white rounded-2xl shadow-[0_2px_8px_rgb(0,0,0,0.04)] border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{student.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">NIS: {student.nis || '-'}</p>
                      </div>
                      {activeMode === 'academic' && (
                        <div className="text-right">
                          <div className="font-black text-indigo-600 text-lg leading-none">{finalScore !== null && finalScore !== undefined ? finalScore : '-'}</div>
                          {finalScore !== null && finalScore !== undefined && (
                            <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 inline-block ${finalScore >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {finalScore >= 75 ? 'Tuntas' : 'Remidial'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {activeMode === 'academic' && (
                      <div className="space-y-4">
                        {currentTopics.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nilai Formatif (Topik)</p>
                            <div className="flex flex-wrap gap-2">
                              {currentTopics.map((topic, i) => (
                                <div key={i} className="flex-1 min-w-[70px] bg-indigo-50/50 rounded-xl p-2 border border-indigo-50/50">
                                  <label className="text-[9px] font-bold text-indigo-600 block text-center mb-1 line-clamp-1" title={topic.title}>T{i+1}: {topic.title}</label>
                                  <input 
                                    type="number" 
                                    min="0" max="100"
                                    value={grades[student.id]?.[`daily_${topic.title}`] ?? ''}
                                    onChange={(e) => handleGradeChange(student.id, `daily_${topic.title}`, e.target.value)}
                                    className="w-full text-center py-1.5 bg-white border border-indigo-100 rounded-lg text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="0"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-amber-50/30 rounded-xl p-2 border border-amber-100/50">
                            <label className="text-[10px] font-bold text-amber-600 block text-center mb-1">UTS</label>
                            <input 
                              type="number" min="0" max="100"
                              value={grades[student.id]?.['uts'] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, 'uts', e.target.value)}
                              className="w-full text-center py-2 bg-white border border-amber-100 rounded-lg text-sm font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20"
                              placeholder="0"
                            />
                          </div>
                          <div className="bg-amber-50/30 rounded-xl p-2 border border-amber-100/50">
                            <label className="text-[10px] font-bold text-amber-600 block text-center mb-1">UAS</label>
                            <input 
                              type="number" min="0" max="100"
                              value={grades[student.id]?.['uas'] ?? ''}
                              onChange={(e) => handleGradeChange(student.id, 'uas', e.target.value)}
                              className="w-full text-center py-2 bg-white border border-amber-100 rounded-lg text-sm font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeMode === 'extracurricular' && (
                      <div className="space-y-3">
                        {extracurriculars.map((ekskul) => (
                           <div key={ekskul.id} className="flex items-center justify-between gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                             <label className="text-xs font-bold text-gray-700 flex-1">{ekskul.name}</label>
                             <input 
                               type="number" 
                               min="0" max="100"
                               value={grades[student.id]?.[`ekskul_${ekskul.id}`] ?? ''}
                               onChange={(e) => handleGradeChange(student.id, `ekskul_${ekskul.id}`, e.target.value)}
                               className="w-20 text-center py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                               placeholder="Nilai"
                             />
                           </div>
                        ))}
                      </div>
                    )}

                    {activeMode === 'cocurricular' && (
                      <div className="space-y-3">
                        {cocurriculars.map((cok) => (
                           <div key={cok.id} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                             <label className="text-xs font-bold text-gray-700 leading-snug">{cok.title}</label>
                             <div className="flex justify-end">
                               <input 
                                 type="number" 
                                 min="0" max="100"
                                 value={grades[student.id]?.[`cokurikuler_${cok.id}`] ?? ''}
                                 onChange={(e) => handleGradeChange(student.id, `cokurikuler_${cok.id}`, e.target.value)}
                                 className="w-24 text-center py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                 placeholder="Nilai"
                               />
                             </div>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          <div className="p-6 bg-gray-50 border-t border-gray-100">
             {activeMode === 'academic' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200">
                     <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">T#</div>
                     <p className="text-[10px] text-gray-500 font-bold leading-tight">Nilai Sumatif tiap Topik/Materi Pelajaran</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200">
                     <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-black underline">UTS</div>
                     <p className="text-[10px] text-gray-500 font-bold leading-tight">Ujian Tengah Semester (Sumatif Tengah)</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200">
                     <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-black underline">UAS</div>
                     <p className="text-[10px] text-gray-500 font-bold leading-tight">Ujian Akhir Semester (Sumatif Akhir)</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200">
                     <CheckCircle2 size={16} className="text-green-500" />
                     <p className="text-[10px] text-gray-500 font-black uppercase tracking-wide">Penyimpanan Otomatis untuk Riwayat</p>
                  </div>
               </div>
             )}

             {activeMode === 'extracurricular' && (
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <Trophy size={16} className="text-indigo-600" />
                     <p className="text-xs text-gray-500">Nilai Ekstrakurikuler yang dimasukkan disimpan secara persisten dan ditampilkan pada lembar rapor minat/bakat siswa.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-extrabold text-indigo-700">
                    Skala Penilaian: 0 - 100
                  </div>
               </div>
             )}

             {activeMode === 'cocurricular' && (
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <Compass size={16} className="text-indigo-600" />
                     <p className="text-xs text-gray-500">Nilai proyek kokurikuler disimpan secara persisten dan akan diekspor dalam bentuk Laporan Proyek Kokurikuler murid.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-extrabold text-indigo-700">
                    Skala Penilaian: 0 - 100
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
      </>
      )}
      {renderRecapModal()}
      {renderReportCardModal()}
    </div>
  );
}
