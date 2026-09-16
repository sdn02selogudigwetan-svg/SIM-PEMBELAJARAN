export type UserRole = 'teacher' | 'student' | 'admin';

export type TeacherType = 
  | 'Guru Kelas 1' 
  | 'Guru Kelas 2' 
  | 'Guru Kelas 3' 
  | 'Guru Kelas 4' 
  | 'Guru Kelas 5' 
  | 'Guru Kelas 6' 
  | 'Guru PAI' 
  | 'Guru PJOK';

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  nickname?: string;
  gender?: 'L' | 'P';
  is_approved?: boolean;
  nis?: string;
  nisn?: string;
  birth_place?: string;
  birth_date?: string;
  father_name?: string;
  mother_name?: string;
  role: UserRole;
  api_key?: string;
  password?: string;
  teacher_type?: TeacherType;
  class_id?: string;
  last_education?: string;
  golongan?: string;
  pangkat?: string;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  code?: string;
  subject?: string;
  semester?: '1' | '2';
  academic_year?: string;
  teacher_id: string;
  created_at: string;
}

export interface Topic {
  title: string;
  sub_topics: string[];
}

export interface LessonMaterial {
  id: string;
  class_id: string;
  semester: '1' | '2';
  subject: string;
  topics: Topic[];
  description?: string;
  file_url?: string;
  created_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  nickname?: string;
  class_id: string;
  gender?: 'L' | 'P';
  parent_contact?: string;
  nisn?: string;
  nis?: string;
  birth_place?: string;
  birth_date?: string;
  father_name?: string;
  mother_name?: string;
}

export interface Subject {
  id: string;
  name: string;
  class_id: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'sick';
  notes?: string;
}

export interface Grade {
  id: string;
  student_id: string;
  class_id: string;
  score: number;
  type: 'daily' | 'midterm' | 'final' | 'project' | 'attendance';
  topic_title?: string;
  semester: number;
  academic_year: string;
  created_at?: any;
  predicate?: string;
  achievement?: string;
}

export interface Schedule {
  id: string;
  class_id: string;
  subject_id: string;
  day: number; // 0-6
  start_time: string;
  end_time: string;
}

export interface TeachingDocument {
  id: string;
  teacher_id: string;
  type: 'ATP' | 'PROTA' | 'PROMES' | 'MODUL_AJAR' | 'SUMATIF' | 'KKTP';
  title: string;
  content: any; // JSON structure for document details
  created_at: string;
}

export interface SystemSettings {
  academic_year: string;
  semester: 'Ganjil' | 'Genap';
  school_name?: string;
  school_level?: string;
  school_address?: string;
  principal_name?: string;
  principal_nip?: string;
  school_description?: string;
  academic_pred_a_desc?: string;
  academic_pred_b_desc?: string;
  academic_pred_c_desc?: string;
  academic_pred_d_desc?: string;
  ekskul_pred_sb_desc?: string;
  ekskul_pred_b_desc?: string;
  ekskul_pred_c_desc?: string;
  ekskul_pred_k_desc?: string;
  cocurricular_pred_sb_desc?: string;
  cocurricular_pred_bsh_desc?: string;
  cocurricular_pred_mb_desc?: string;
  cocurricular_pred_bb_desc?: string;
  academic_rules?: { min: number; pred: string }[];
  ekskul_rules?: { min: number; pred: string }[];
  coc_rules?: { min: number; pred: string }[];
  updated_at: any;
}

export interface Extracurricular {
  id: string;
  name: string;
  coach_name?: string;
  schedule?: string;
  description?: string;
  created_at: any;
}

export interface Cocurricular {
  id: string;
  title: string;
  class_level?: string;
  semester: '1' | '2';
  description?: string;
  created_at: any;
}
