'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  ArrowLeft,
  Building2,
  School,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  HardHat,
  Paperclip,
  FileText,
} from 'lucide-react';
import sharedCategories from '@/lib/aplDocumentCategories.json';

interface AplDocument {
  id: string;
  title: string;
  category: string;
  url: string;
  fileType: string;
  fileName: string;
  uploadedBy: string;
  schoolId: string;
  teacherId: string;
  createdAt: any;
  uploadedAt: any;
}

interface UserProfile {
  role: string;
  schoolId: string;
  teacherId?: string;
}

const CATEGORY_VISUALS = {
  kontakt_foretag: { icon: Building2, emoji: '🏢' },
  kontakt_skola: { icon: School, emoji: '🏫' },
  forsakringar: { icon: ShieldCheck, emoji: '🛡️' },
  apl_tider: { icon: Calendar, emoji: '📅' },
  skadeanmalan: { icon: AlertTriangle, emoji: '⚠️' },
  arbetsmiljoverket: { icon: HardHat, emoji: '🏗️' },
  ovrigt: { icon: Paperclip, emoji: '📎' },
} as const;

const CATEGORIES = sharedCategories.map((category) => ({
  ...category,
  displayName: category.id === 'kontakt_foretag' ? 'APL-företag' : category.name,
  icon: CATEGORY_VISUALS[category.id as keyof typeof CATEGORY_VISUALS]?.icon ?? FileText,
  emoji: CATEGORY_VISUALS[category.id as keyof typeof CATEGORY_VISUALS]?.emoji ?? '📄',
}));

export default function DocumentCategoryPage() {
  const params = useParams<{ categoryId: string }>();
  const categoryId = Array.isArray(params?.categoryId)
    ? params?.categoryId[0]
    : params?.categoryId;

  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<AplDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');

  const category = useMemo(
    () => CATEGORIES.find((c) => c.id === categoryId),
    [categoryId],
  );

  useEffect(() => {
    if (categoryId === 'kontakt_foretag') {
      router.replace('/dashboard/companies');
      return;
    }
    if (categoryId === 'kontakt_skola') {
      router.replace('/dashboard/school-contacts');
    }
  }, [categoryId, router]);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      const userDocSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDocSnapshot.exists() ? userDocSnapshot.data() : null;
      const role = userData?.role || 'student';
      const schoolId = userData?.school || '';
      const studentTeacherId = userData?.teacherId || '';

      if (!schoolId) {
        alert('Kunde inte hitta schoolId för användaren. Kontakta administratör.');
        router.push('/dashboard/documents');
        return;
      }

      setUserRole(role);
      setUserProfile({
        role,
        schoolId,
        teacherId: studentTeacherId,
      });

      if (role !== 'teacher' && role !== 'admin' && role !== 'student') {
        router.push('/login');
        return;
      }

      await fetchDocuments(currentUser.uid, role, schoolId, studentTeacherId, categoryId);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [categoryId, router]);

  const fetchDocuments = async (
    uid: string,
    role: string,
    schoolId: string,
    studentTeacherId: string | undefined,
    targetCategoryId: string,
  ) => {
    try {
      const constraints: any[] = [
        where('school', '==', schoolId),
        where('category', '==', targetCategoryId),
      ];

      if (role === 'student' && studentTeacherId) {
        constraints.push(where('teacherId', '==', studentTeacherId));
      }

      if (role === 'teacher') {
        constraints.push(where('teacherId', '==', uid));
      }

      constraints.push(orderBy('uploadedAt', 'desc'));
      const q = query(collection(db, 'aplDocuments'), ...constraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AplDocument);

      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching category documents:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!documentTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setDocumentTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!categoryId || !selectedFile || !documentTitle.trim() || !user || !userProfile?.schoolId) {
      alert('Fyll i alla fält och välj en fil');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, `apl-documents/${categoryId}/${fileName}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'aplDocuments'), {
        title: documentTitle.trim(),
        category: categoryId,
        url: downloadURL,
        fileType: selectedFile.type,
        fileName,
        uploadedBy: user.uid,
        school: userProfile.schoolId,
        teacherId: user.uid,
        createdAt: Timestamp.now(),
        uploadedAt: Timestamp.now(),
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setDocumentTitle('');

      await fetchDocuments(
        user.uid,
        userRole || 'student',
        userProfile.schoolId,
        userProfile.teacherId,
        categoryId,
      );
      alert('Dokument uppladdat!');
    } catch (error) {
      console.error('Error uploading category document:', error);
      alert('Fel vid uppladdning: ' + error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentToDelete: AplDocument) => {
    if (!confirm(`Är du säker på att du vill radera "${documentToDelete.title}"?`)) {
      return;
    }

    try {
      const storageRef = ref(
        storage,
        `apl-documents/${documentToDelete.category}/${documentToDelete.fileName}`,
      );
      try {
        await deleteObject(storageRef);
      } catch (storageError) {
        console.warn('File might already be deleted from storage:', storageError);
      }

      await deleteDoc(doc(db, 'aplDocuments', documentToDelete.id));

      if (userProfile?.schoolId && categoryId) {
        await fetchDocuments(
          user.uid,
          userRole || 'student',
          userProfile.schoolId,
          userProfile.teacherId,
          categoryId,
        );
      }
      alert('Dokument raderat!');
    } catch (error) {
      console.error('Error deleting category document:', error);
      alert('Fel vid radering: ' + error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('word') || fileType.includes('doc')) return '📘';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📗';
    if (fileType.includes('image')) return '🖼️';
    return '📄';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  if (categoryId === 'kontakt_foretag') {
    return null;
  }

  if (!categoryId || !category) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Kunde inte hitta kategorin</h1>
          <p className="mt-2 text-red-700">Den här dokumentkategorin finns inte.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/documents')}
            className="mt-4 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
          >
            Tillbaka till APL-dokument
          </button>
        </div>
      </main>
    );
  }

  const CategoryIcon = category.icon;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/documents')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till alla kategorier
          </button>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
            <CategoryIcon className="h-6 w-6 text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{category.displayName}</h1>
          <p className="mt-2 text-gray-600">
            Dokument i kategorin {category.displayName.toLowerCase()}.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700 sm:w-auto"
        >
          <span className="text-xl">+</span>
          Ladda upp dokument
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Dokument i {category.displayName}
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mb-4 text-6xl">📁</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Inga dokument i den här kategorin ännu</h3>
            <p className="mb-6 text-gray-600">Ladda upp ett dokument för att komma igång.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Ladda upp dokument
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((docItem) => (
              <div key={docItem.id} className="p-6 transition-colors hover:bg-gray-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <div className="text-4xl">{getFileIcon(docItem.fileType)}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{docItem.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 sm:gap-3">
                        <span>{formatDate(docItem.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    <a
                      href={docItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 sm:px-4"
                    >
                      Öppna
                    </a>
                    <button
                      onClick={() => handleDelete(docItem)}
                      className="rounded-lg px-3 py-2 font-medium text-red-600 transition-colors hover:bg-red-50 sm:px-4"
                    >
                      Radera
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              Ladda upp dokument i {category.displayName}
            </h2>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Dokumenttitel *</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="T.ex. Försäkringsinformation 2025"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Kategori</label>
                <input
                  type="text"
                  value={category.displayName}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Fil *</label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Vald fil: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setDocumentTitle('');
                }}
                disabled={uploading}
                className="flex-1 rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !documentTitle.trim()}
                className="flex-1 rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Laddar upp...' : 'Ladda upp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
