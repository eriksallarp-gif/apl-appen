'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface AplDocument {
  id: string;
  title: string;
  category: string;
  url: string;
  fileType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: any;
}

const CATEGORIES = [
  { id: 'kontakt_foretag', name: 'Kontakt företag', icon: '🏢' },
  { id: 'forsakringar', name: 'Försäkringar', icon: '🛡️' },
  { id: 'apl_tider', name: 'APL-tider för läsår', icon: '📅' },
  { id: 'skadeanmalan', name: 'Skadeanmälan', icon: '⚠️' },
  { id: 'arbetsmiljoverket', name: 'Arbetsmiljöverket', icon: '🏗️' },
];

export default function DocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AplDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);
      
      // Check user role
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDocs(query(collection(db, 'users')));
      const userData = userDoc.docs.find(d => d.id === currentUser.uid)?.data();
      const role = userData?.role || 'student';
      
      setUserRole(role);

      if (role !== 'teacher' && role !== 'admin') {
        router.push('/login');
        return;
      }

      await fetchDocuments();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchDocuments = async () => {
    try {
      const q = query(collection(db, 'aplDocuments'), orderBy('uploadedAt', 'desc'));
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
    if (!selectedFile || !selectedCategory || !documentTitle.trim() || !user) {
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
        uploadedAt: Timestamp.now()
      });

      // Reset form
      setShowUploadModal(false);
      setSelectedFile(null);
      setDocumentTitle('');
      setSelectedCategory('');
      
      // Refresh documents list
      await fetchDocuments();
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
      await fetchDocuments();
      alert('Dokument raderat!');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Fel vid radering: ' + error);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
  };

  const getCategoryIcon = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId)?.icon || '📄';
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">APL-dokument</h1>
          <p className="text-gray-600 mt-2">
            Hantera viktiga dokument som delas med eleverna
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Ladda upp dokument
        </button>
      </div>

      {/* Category overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {CATEGORIES.map(cat => {
          const count = documents.filter(d => d.category === cat.id).length;
          return (
            <div key={cat.id} className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <div className="text-4xl mb-2">{cat.icon}</div>
              <h3 className="font-semibold text-gray-900">{cat.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {count} {count === 1 ? 'dokument' : 'dokument'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Alla dokument</h2>
        </div>
        
        {documents.length === 0 ? (
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
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map(doc => (
              <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{getFileIcon(doc.fileType)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          {getCategoryIcon(doc.category)}
                          {getCategoryName(doc.category)}
                        </span>
                        <span>•</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      Öppna
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
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
                      {cat.icon} {cat.name}
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
    </div>
  );
}
