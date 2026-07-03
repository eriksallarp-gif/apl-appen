'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { usePathname } from 'next/navigation';
import { Building2, School, ShieldCheck, Calendar, AlertTriangle, HardHat, Paperclip, FileText } from 'lucide-react';
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
  classId?: string;
}

interface ContactCounts {
  companies: number;
  schoolContacts: number;
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

export default function DocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<AplDocument[]>([]);
  const [contactCounts, setContactCounts] = useState<ContactCounts>({
    companies: 0,
    schoolContacts: 0,
  });
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      // Check user role and scope data
      const userDocSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDocSnapshot.exists() ? userDocSnapshot.data() : null;
      const role = userData?.role || 'student';
      const schoolId = userData?.school || '';
      const studentTeacherId = userData?.teacherId || '';

      if (!schoolId) {
        alert('Kunde inte hitta schoolId för användaren. Kontakta administratör.');
        router.push('/login');
        return;
      }

      setUserRole(role);
      setUserProfile({
        role,
        schoolId: schoolId,
        teacherId: studentTeacherId,
        classId: (userData?.classId || '').toString(),
      });

      if (role !== 'teacher' && role !== 'admin' && role !== 'student') {
        router.push('/login');
        return;
      }

      await fetchDocuments(currentUser.uid, role, schoolId, studentTeacherId);
      await fetchContactCounts(
        currentUser.uid,
        role,
        schoolId,
        studentTeacherId,
        (userData?.classId || '').toString(),
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);


  const fetchDocuments = async (uid: string, role: string, schoolId: string, studentTeacherId?: string) => {
    try {
      const constraints: any[] = [
        where('school', '==', schoolId),
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
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AplDocument));

      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchContactCounts = async (
    uid: string,
    role: string,
    schoolId: string,
    studentTeacherId?: string,
    studentClassId?: string,
  ) => {
    try {
      let companiesCount = 0;
      let schoolContactsCount = 0;

      if (role === 'teacher') {
        const companiesSnapshot = await getDocs(
          query(collection(db, 'companies'), where('teacherUid', '==', uid)),
        );
        companiesCount = companiesSnapshot.size;

        const schoolContactsSnapshot = await getDocs(
          query(
            collection(db, 'schoolContacts'),
            where('teacherUid', '==', uid),
            where('school', '==', schoolId),
          ),
        );
        schoolContactsCount = schoolContactsSnapshot.size;
      } else if (role === 'admin') {
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        companiesCount = companiesSnapshot.size;

        const schoolContactsSnapshot = await getDocs(
          query(collection(db, 'schoolContacts'), where('school', '==', schoolId)),
        );
        schoolContactsCount = schoolContactsSnapshot.size;
      } else {
        const companyIds = new Set<string>();

        const byStudentIdSnapshot = await getDocs(
          query(collection(db, 'companies'), where('studentId', '==', uid)),
        );
        byStudentIdSnapshot.docs.forEach((item) => companyIds.add(item.id));

        try {
          const byStudentIdsSnapshot = await getDocs(
            query(collection(db, 'companies'), where('studentIds', 'array-contains', uid)),
          );
          byStudentIdsSnapshot.docs.forEach((item) => companyIds.add(item.id));
        } catch (_) {
          // Ignore if array-contains query is blocked by current rules.
        }
        companiesCount = companyIds.size;

        if (studentTeacherId) {
          const schoolContactsSnapshot = await getDocs(
            query(
              collection(db, 'schoolContacts'),
              where('school', '==', schoolId),
              where('teacherUid', '==', studentTeacherId),
            ),
          );

          schoolContactsCount = schoolContactsSnapshot.docs.filter((item) => {
            const data = item.data();
            const studentId = String(data.studentId || '').trim();
            const studentIds = Array.isArray(data.studentIds)
              ? data.studentIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
              : [];
            const classIds = Array.isArray(data.classIds)
              ? data.classIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
              : [];

            if (!studentId && studentIds.length === 0 && classIds.length === 0) {
              return true;
            }
            if (studentId === uid || studentIds.includes(uid)) {
              return true;
            }
            return !!studentClassId && classIds.includes(studentClassId);
          }).length;
        }
      }

      setContactCounts({
        companies: companiesCount,
        schoolContacts: schoolContactsCount,
      });
    } catch (error) {
      console.error('Error fetching contact counts:', error);
      setContactCounts({
        companies: 0,
        schoolContacts: 0,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-fill title with filename
      if (!documentTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setDocumentTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCategory || !documentTitle.trim() || !user || !userProfile?.schoolId) {
      alert('Fyll i alla fält och välj en fil');
      return;
    }

    setUploading(true);
    try {
      // Upload file to Firebase Storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, `apl-documents/${selectedCategory}/${fileName}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      // Save document metadata to Firestore
      await addDoc(collection(db, 'aplDocuments'), {
        title: documentTitle.trim(),
        category: selectedCategory,
        url: downloadURL,
        fileType: selectedFile.type,
        fileName: fileName,
        uploadedBy: user.uid,
        school: userProfile.schoolId,
        teacherId: user.uid,
        createdAt: Timestamp.now(),
        uploadedAt: Timestamp.now()
      });

      // Reset form
      setShowUploadModal(false);
      setSelectedFile(null);
      setDocumentTitle('');
      setSelectedCategory('');
      
      // Refresh documents list
      await fetchDocuments(
        user.uid,
        userRole || 'student',
        userProfile.schoolId,
        userProfile.teacherId
      );
      alert('Dokument uppladdat!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Fel vid uppladdning: ' + error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document: AplDocument) => {
    if (!confirm(`Är du säker på att du vill radera "${document.title}"?`)) {
      return;
    }

    try {
      // Delete from Storage
      const storageRef = ref(storage, `apl-documents/${document.category}/${document.fileName}`);
      try {
        await deleteObject(storageRef);
      } catch (storageError) {
        console.warn('File might already be deleted from storage:', storageError);
      }

      // Delete from Firestore
      await deleteDoc(doc(db, 'aplDocuments', document.id));
      
      // Refresh list
      if (userProfile?.schoolId) {
        await fetchDocuments(
          user.uid,
          userRole || 'student',
          userProfile.schoolId,
          userProfile.teacherId
        );
      }
      alert('Dokument raderat!');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Fel vid radering: ' + error);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId)?.displayName || categoryId;
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (!category) return FileText;
    return category.icon;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">APL-dokument</h1>
          <p className="text-gray-600 mt-2">
            Hantera viktiga dokument som delas med eleverna
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

        {/* Category overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {CATEGORIES.map(cat => {
            const documentCount = documents.filter(d => d.category === cat.id).length;
            const isContactCategory = cat.id === 'kontakt_foretag' || cat.id === 'kontakt_skola';
            const categoryCount =
              cat.id === 'kontakt_foretag'
                ? contactCounts.companies
                : cat.id === 'kontakt_skola'
                  ? contactCounts.schoolContacts
                  : documentCount;
            const IconComponent = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  router.push(
                    cat.id === 'kontakt_foretag'
                      ? '/dashboard/companies'
                      : cat.id === 'kontakt_skola'
                        ? '/dashboard/school-contacts'
                      : `/dashboard/documents/${cat.id}`,
                  )
                }
                className="bg-white p-6 rounded-lg border-2 border-gray-200 text-left transition-all hover:border-orange-300"
              >
                <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <IconComponent className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{cat.displayName}</h3>
                {isContactCategory ? (
                  <div className="mt-1 text-sm text-gray-600">
                    <p>
                      {categoryCount} {categoryCount === 1 ? 'kontakt' : 'kontakter'}
                    </p>
                    <p>
                      {documentCount} {documentCount === 1 ? 'dokument' : 'dokument'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mt-1">
                    {documentCount} {documentCount === 1 ? 'dokument' : 'dokument'}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Documents list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setIsDocumentsExpanded((current) => !current)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={isDocumentsExpanded}
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Alla dokument ({documents.length})
              </h2>
              <span className="text-sm font-medium text-gray-500">
                {isDocumentsExpanded ? '▲ Dölj' : '▼ Visa'}
              </span>
            </button>
          </div>

          {isDocumentsExpanded && documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inga dokument ännu
              </h3>
              <p className="text-gray-600 mb-6">
                Ladda upp ditt första dokument för att komma igång
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Ladda upp dokument
              </button>
            </div>
          ) : isDocumentsExpanded ? (
            <div className="divide-y divide-gray-200">
              {documents.map(doc => (
                <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{getFileIcon(doc.fileType)}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {doc.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 sm:gap-3">
                          <span className="flex items-center gap-1.5">
                            {(() => {
                              const IconComponent = getCategoryIcon(doc.category);
                              return <IconComponent className="h-4 w-4 text-orange-600" />;
                            })()}
                            {getCategoryName(doc.category)}
                          </span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 sm:px-4"
                      >
                        Öppna
                      </a>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="rounded-lg px-3 py-2 font-medium text-red-600 transition-colors hover:bg-red-50 sm:px-4"
                      >
                        Radera
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Ladda upp dokument
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dokumenttitel *
                  </label>
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="T.ex. Försäkringsinformation 2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Välj kategori...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fil *
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      Vald fil: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setDocumentTitle('');
                    setSelectedCategory('');
                  }}
                  disabled={uploading}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !selectedCategory || !documentTitle.trim()}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
