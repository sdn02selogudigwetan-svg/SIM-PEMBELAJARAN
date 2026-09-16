import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';
import { Profile, UserRole } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const path = `users/${userId}`;
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Profile doesn't exist yet, create one
        const userEmail = (auth.currentUser?.email || '').toLowerCase();
        const isAdminEmail = userEmail === 'sdnkaranggeger2@gmail.com' || userEmail === 'sdn02selogudigwetan@gmail.com';
        const newProfileData: Profile = {
          id: userId,
          email: auth.currentUser?.email || undefined,
          full_name: auth.currentUser?.displayName || 'User Baru',
          role: (isAdminEmail ? 'admin' : 'student') as UserRole,
          is_approved: isAdminEmail, // Admin automatically approved
          created_at: new Date().toISOString(),
        };

        try {
          await setDoc(docRef, {
            ...newProfileData,
            created_at: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        
        setProfile(newProfileData);
      } else {
        const data = docSnap.data();
        let currentProfile = {
          ...data,
          id: docSnap.id,
          created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
        } as Profile;

        // Force admin role and approval for the master email
        const userEmail = (auth.currentUser?.email || '').toLowerCase();
        if (userEmail === 'sdnkaranggeger2@gmail.com' || userEmail === 'sdn02selogudigwetan@gmail.com') {
          if (currentProfile.role !== 'admin' || !currentProfile.is_approved) {
            try {
              await setDoc(docRef, { role: 'admin', is_approved: true }, { merge: true });
              currentProfile.role = 'admin';
              currentProfile.is_approved = true;
              toast.success('Hak akses Admin diaktifkan');
            } catch (error) {
              console.error('Failed to elevate to admin:', error);
            }
          }
        }

        setProfile(currentProfile);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      if (error.message.includes('{')) {
        // Already handled and stringified JSON
        toast.error('Firestore Error. Check console.');
      } else {
        toast.error('Error loading profile: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900 font-sans relative">
      <Toaster position="top-right" />
      
      {!user ? (
        <Login />
      ) : profile ? (
        profile.role === 'admin' || profile.is_approved ? (
          <Dashboard profile={profile} />
        ) : (
          <div className="flex items-center justify-center min-h-[100dvh] p-4">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Menunggu Persetujuan</h1>
                <p className="text-gray-500 mt-2">Akun Anda sedang ditinjau oleh administrator. Silakan hubungi admin sekolah untuk mempercepat proses aktivasi.</p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all uppercase text-xs tracking-widest"
              >
                Keluar
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center min-h-[100dvh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 text-sm">Mempersiapkan profil Anda...</p>
          </div>
        </div>
      )}
    </div>
  );
}
