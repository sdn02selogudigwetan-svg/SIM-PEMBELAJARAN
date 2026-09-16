import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSchoolName(str: string): string {
  const romanRegex = /^[IVX]+$/i;
  const levelRegex = /^(SD|SDN|SMP|SMA|SMK|MI|MTS|MA|UPT|UPT\.)$/i;

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
}

export function formatSubjectName(subject: string | undefined): string {
  if (!subject) return '-';
  const s = subject.toUpperCase();
  if (s === 'PJOK') return 'Pendidikan Jasmani, Olahraga, dan Kesehatan';
  if (s === 'IPAS') return 'Ilmu Pengetahuan Alam dan Sosial';
  if (s === 'PAI' || s.includes('PAI') || s.includes('AGAMA') || s.includes('BUDI PEKERTI')) return 'Pendidikan Agama Islam dan Budi Pekerti';
  return subject;
}
