import React from 'react';
import { Profile } from '../../types';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import Overview from './Overview';
import StudentManagement from './StudentManagement';
import ClassManagement from './ClassManagement';
import AttendanceControl from './AttendanceControl';
import GradeManagement from './GradeManagement';
import TeachingDocs from './TeachingDocs';
import ScheduleManager from './ScheduleManager';
import TeacherIdentity from './TeacherIdentity';

interface TeacherDashboardProps {
  activeTab: string;
  profile: Profile;
}

export default function TeacherDashboard({ activeTab, profile }: TeacherDashboardProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview profile={profile} />;
      case 'teacher_identity':
        return <TeacherIdentity profile={profile} />;
      case 'students':
        return <StudentManagement profile={profile} />;
      case 'classes':
        return <ClassManagement profile={profile} />;
      case 'attendance':
        if (!profile.teacher_type?.startsWith('Guru Kelas')) {
          return <Overview profile={profile} />;
        }
        return <AttendanceControl profile={profile} />;
      case 'grades':
        return <GradeManagement profile={profile} viewMode="input" />;
      case 'recap_reports':
        return <GradeManagement profile={profile} viewMode="recap" />;
      case 'docs':
        return <TeachingDocs profile={profile} />;
      case 'schedule':
        return <ScheduleManager />;
      default:
        return <Overview profile={profile} />;
    }
  };

  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      {renderContent()}
    </motion.div>
  );
}
