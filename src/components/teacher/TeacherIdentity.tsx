import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Profile } from '../../types';
import { User, Shield, GraduationCap, Save, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface TeacherIdentityProps {
  profile: Profile;
}

const pnsGolonganOptions = [
  'Ia', 'Ib', 'Ic', 'Id',
  'IIa', 'IIb', 'IIc', 'IId',
  'IIIa', 'IIIb', 'IIIc', 'IIId',
  'IVa', 'IVb', 'IVc', 'IVd', 'IVe'
];

const pppkGolonganOptions = [
  'Golongan I', 'Golongan II', 'Golongan III', 'Golongan IV',
  'Golongan V', 'Golongan VI', 'Golongan VII', 'Golongan VIII',
  'Golongan IX', 'Golongan X', 'Golongan XI', 'Golongan XII',
  'Golongan XIII', 'Golongan XIV', 'Golongan XV', 'Golongan XVI',
  'Golongan XVII'
];

const mapPNSGolonganToPangkat = (gol_v: string): string => {
  const mapping: Record<string, string> = {
    'Ia': 'Juru Muda',
    'Ib': 'Juru Muda Tingkat I',
    'Ic': 'Juru',
    'Id': 'Juru Tingkat I',
    'IIa': 'Pengatur Muda',
    'IIb': 'Pengatur Muda Tingkat I',
    'IIc': 'Pengatur',
    'IId': 'Pengatur Tingkat I',
    'IIIa': 'Penata Muda',
    'IIIb': 'Penata Muda Tingkat I',
    'IIIc': 'Penata',
    'IIId': 'Penata Tingkat I',
    'IVa': 'Pembina',
    'IVb': 'Pembina Tingkat I',
    'IVc': 'Pembina Utama Muda',
    'IVd': 'Pembina Utama Madya',
    'IVe': 'Pembina Utama'
  };
  return mapping[gol_v] || '';
};

export default function TeacherIdentity({ profile }: TeacherIdentityProps) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [nip, setNip] = useState(profile.nis || '');
  const [lastEducation, setLastEducation] = useState(profile.last_education || '');
  const [employeeType, setEmployeeType] = useState<'PNS' | 'PPPK'>('PNS');
  const [golongan, setGolongan] = useState(profile.golongan || '');
  const [pangkat, setPangkat] = useState(profile.pangkat || '');
  const [apiKey, setApiKey] = useState(profile.api_key || '');
  const [showApiKey, setShowApiKey] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Determine Kepegawaian type from the current profile.golongan on mount or profile updates
  useEffect(() => {
    if (profile.golongan) {
      if (profile.golongan.startsWith('Golongan')) {
        setEmployeeType('PPPK');
      } else {
        setEmployeeType('PNS');
      }
    }
  }, [profile.golongan]);

  // Synchronize pangkat automatically when PNS Golongan changes
  useEffect(() => {
    if (employeeType === 'PNS') {
      const p = mapPNSGolonganToPangkat(golongan);
      setPangkat(p);
    }
  }, [golongan, employeeType]);

  const handleEmployeeTypeChange = (type: 'PNS' | 'PPPK') => {
    setEmployeeType(type);
    setGolongan('');
    setPangkat('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Nama Lengkap tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan perubahan identitas...');

    try {
      const userRef = doc(db, 'users', profile.id);
      const updateData = {
        full_name: fullName,
        nis: nip, // Map NIP to the 'nis' field in firestore to stay fully backwards compatible
        last_education: lastEducation,
        golongan: golongan,
        pangkat: employeeType === 'PNS' ? mapPNSGolonganToPangkat(golongan) : pangkat,
        api_key: apiKey,
      };

      await updateDoc(userRef, updateData);
      toast.success('Identitas guru berhasil diperbarui!', { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}`);
      toast.error('Gagal memperbarui identitas guru', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Identitas Guru</h1>
        <p className="text-sm text-gray-500">
          Ubah dan lengkapi detail data identitas kepegawaian Anda di bawah ini secara persisten.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Nama Lengkap
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 focus:bg-white transition-all duration-205"
                  placeholder="Masukkan nama lengkap beserta gelar"
                />
              </div>
            </div>

            {/* NIP */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                NIP (Nomor Induk Pegawai)
              </label>
              <div className="relative">
                <Shield size={18} className="absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 focus:bg-white transition-all duration-205"
                  placeholder="Masukkan nomor NIP"
                />
              </div>
            </div>

            {/* Pendidikan Terakhir */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Pendidikan Terakhir
              </label>
              <div className="relative">
                <GraduationCap size={18} className="absolute left-3.5 top-3 text-gray-400" />
                <select
                  value={lastEducation}
                  onChange={(e) => setLastEducation(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 focus:bg-white transition-all duration-205 appearance-none"
                >
                  <option value="">Pilih Pendidikan Terakhir</option>
                  <option value="D1">Sertifikat/Diploma I (D1)</option>
                  <option value="D2">Diploma II (D2)</option>
                  <option value="D3">Diploma III (D3)</option>
                  <option value="S1 Kependidikan">Sarjana Pendidikan (S1 Kependidikan)</option>
                  <option value="S1 Non-Kependidikan">Sarjana (S1 Non-Kependidikan)</option>
                  <option value="S2 Kependidikan">Magister Pendidikan (S2 Kependidikan)</option>
                  <option value="S2 Non-Kependidikan">Magister (S2 Non-Kependidikan)</option>
                  <option value="S3">Doktor (S3)</option>
                </select>
              </div>
            </div>

            {/* Status Kepegawaian */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Status Kepegawaian
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleEmployeeTypeChange('PNS')}
                  className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    employeeType === 'PNS'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-650 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  Pegawai Negeri Sipil (PNS)
                </button>
                <button
                  type="button"
                  onClick={() => handleEmployeeTypeChange('PPPK')}
                  className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    employeeType === 'PPPK'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-650 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  P3K / PPPK
                </button>
              </div>
            </div>

            {/* Pilihan Golongan */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Golongan / Ruang
              </label>
              <select
                value={golongan}
                onChange={(e) => setGolongan(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 focus:bg-white transition-all duration-205 appearance-none"
              >
                <option value="">Pilih Golongan</option>
                {employeeType === 'PNS'
                  ? pnsGolonganOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        Golongan {opt}
                      </option>
                    ))
                  : pppkGolonganOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
              </select>
            </div>

            {/* Pangkat */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Pangkat {employeeType === 'PNS' && '(Otomatis)'}
              </label>
              <input
                type="text"
                value={pangkat}
                disabled={employeeType === 'PNS'}
                onChange={(e) => setPangkat(e.target.value)}
                className={`w-full border rounded-xl py-2.5 px-4 text-sm font-semibold outline-none transition-all duration-205 ${
                  employeeType === 'PNS'
                    ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500 focus:bg-white'
                }`}
                placeholder={employeeType === 'PNS' ? 'Terisi otomatis berdasarkan golongan' : 'Masukkan Pangkat (cth: Ahli Pratama)'}
              />
            </div>
            
            {/* API Key */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">
                Gemini API Key (Untuk Generate Modul & KKTP)
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-3.5 top-3 text-gray-400" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-12 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 focus:bg-white transition-all duration-205 font-mono"
                  placeholder="Masukkan API Key Gemini Anda (AIzaSy...)"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title={showApiKey ? 'Sembunyikan API Key' : 'Tampilkan API Key'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                API Key diperlukan untuk menggunakan fitur AI pada halaman perangkat pembelajaran. Kunci ini akan disimpan dengan aman.{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                  Dapatkan API Key di sini
                </a>.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none text-sm cursor-pointer"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Simpan Identitas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
