'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { usePathname } from 'next/navigation';

interface Company {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  teacherUid: string;
  classId?: string;
  studentId?: string;
  createdAt?: any;
}

interface ClassData {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  name: string;
  email?: string;
}

export default function CompaniesPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    classId: '',
    studentId: '',
  });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        setUserRole(role);
        
        if (role !== 'teacher' && role !== 'admin') {
          router.push('/dashboard');
          return;
        }
      }
      
      setUser(currentUser);
      await fetchData(currentUser.uid, userDoc.data()?.role);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchData = async (currentUserId: string, role?: string) => {
    try {
      // Fetch classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const isTeacher = role === 'teacher';
      const classDocs = isTeacher
        ? classesSnapshot.docs.filter(c => c.data().teacherUid === currentUserId)
        : classesSnapshot.docs;
      const classIds = new Set(classDocs.map(doc => doc.id));
      
      const classesData = classDocs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Okänd klass',
      }));
      setClasses(classesData);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const studentDocs = usersSnapshot.docs.filter(doc => doc.data().role === 'student');
      const scopedStudents = isTeacher
        ? studentDocs.filter(doc => {
            const data = doc.data();
            const teacherUid = (data.teacherUid || '').toString();
            const classId = (data.classId || '').toString();
            return teacherUid === currentUserId || (classId && classIds.has(classId));
          })
        : studentDocs;
      const studentsData = scopedStudents.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.displayName || data.email || 'Okänd elev',
          email: data.email || '',
        } as StudentData;
      });
      setStudents(studentsData);

      // Fetch companies for this teacher
      const companiesQuery = isTeacher
        ? query(collection(db, 'companies'), where('teacherUid', '==', currentUserId))
        : collection(db, 'companies');
      
      const companiesSnapshot = await getDocs(companiesQuery);
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Company));
      
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Företagsnamn är obligatoriskt');
      return;
    }

    try {
      if (editingCompany) {
        // Update existing company
        await updateDoc(doc(db, 'companies', editingCompany.id), {
          name: formData.name,
          address: formData.address,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          classId: formData.classId,
          studentId: formData.studentId || null,
        });
      } else {
        // Add new company
        await addDoc(collection(db, 'companies'), {
          name: formData.name,
          address: formData.address,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          teacherUid: user.uid,
          classId: formData.classId,
          studentId: formData.studentId || null,
          createdAt: Timestamp.now(),
        });
      }

      // Reset form and refresh data
      setFormData({
        name: '',
        address: '',
        contactPerson: '',
        phone: '',
        email: '',
        classId: '',
        studentId: '',
      });
      setShowAddModal(false);
      setEditingCompany(null);
      await fetchData(user.uid, userRole || undefined);
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Ett fel uppstod när företaget skulle sparas');
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      contactPerson: company.contactPerson || '',
      phone: company.phone || '',
      email: company.email || '',
      classId: company.classId || '',
      studentId: company.studentId || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta företag?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'companies', companyId));
      await fetchData(user.uid, userRole || undefined);
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Ett fel uppstod när företaget skulle tas bort');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingCompany(null);
    setFormData({
      name: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      classId: '',
      studentId: '',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed left-0 top-0 h-screen w-56 bg-gradient-to-br from-orange-50 to-white border-r border-orange-100/50 flex flex-col py-8 px-6 z-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-orange-600">APL-appen</h1>
          <p className="text-xs text-orange-400 mt-1">Hem</p>
        </div>
        <nav className="flex-1 space-y-4">
          <a href="/dashboard" className={`block font-semibold rounded-lg px-3 py-2 transition ${pathname === '/dashboard' ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Hem</a>
          <a href="/dashboard/students" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/students') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Elever</a>
          <a href="/dashboard/companies" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/companies') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Företag</a>
          <a href="/dashboard/documents" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/documents') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Dokument</a>
          <a href="/dashboard/settings" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/settings') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Inställningar</a>
        </nav>
        <div className="mt-auto pt-8">
          <button
            onClick={async () => { await import('firebase/auth').then(({ signOut }) => signOut(auth)); router.push('/login'); }}
            className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition"
          >
            Logga ut
          </button>
        </div>
      </aside>
      <main className="ml-56 max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">APL-Företag</h1>
              <p className="text-gray-600 mt-1">Hantera företag där eleverna har APL</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
            >
              ← Tillbaka till översikt
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition shadow-md"
          >
            + Lägg till nytt företag
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Totalt antal företag</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{companies.length}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Dina klasser</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{classes.length}</p>
          </div>
        </div>

        {/* Companies List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Alla företag</h2>
          </div>

          {companies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">🏢</div>
              <p className="text-gray-600 mb-2">Inga företag har lagts till ännu</p>
              <p className="text-sm text-gray-500">Klicka på "Lägg till nytt företag" för att komma igång</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {companies.map((company) => {
                const companyClass = classes.find(c => c.id === company.classId);
                const linkedStudent = students.find(s => s.id === company.studentId);
                return (
                  <div key={company.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {company.name}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {company.address && (
                            <div className="flex items-center text-gray-600">
                              <span className="mr-2">📍</span>
                              {company.address}
                            </div>
                          )}
                          
                          {company.contactPerson && (
                            <div className="flex items-center text-gray-600">
                              <span className="mr-2">👤</span>
                              {company.contactPerson}
                            </div>
                          )}
                          
                          {company.phone && (
                            <div className="flex items-center text-gray-600">
                              <span className="mr-2">📞</span>
                              {company.phone}
                            </div>
                          )}
                          
                          {company.email && (
                            <div className="flex items-center text-gray-600">
                              <span className="mr-2">✉️</span>
                              {company.email}
                            </div>
                          )}
                        </div>

                        {companyClass && (
                          <div className="mt-2">
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              {companyClass.name}
                            </span>
                          </div>
                        )}

                        {linkedStudent && (
                          <div className="mt-2">
                            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                              Elev: {linkedStudent.name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(company)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                        >
                          Redigera
                        </button>
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingCompany ? 'Redigera företag' : 'Lägg till nytt företag'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Företagsnamn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="t.ex. ABC AB"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adress
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="t.ex. Storgatan 1, 123 45 Stockholm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontaktperson
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="t.ex. Anna Andersson"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="t.ex. 070-123 45 67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-post
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="t.ex. info@foretag.se"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kopplad till klass (valfritt)
                </label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Ingen specifik klass</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Välj en klass om företaget är specifikt för den klassen
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Koppla till elev (valfritt)
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Ingen elev kopplad</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}{student.email ? ` (${student.email})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Välj en elev om företaget ska visas som kontaktinformation i appen
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-medium"
                >
                  {editingCompany ? 'Spara ändringar' : 'Lägg till företag'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Avbryt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
