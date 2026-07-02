'use client';

import { useEffect, useMemo, useState } from 'react';
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
  contactHeading?: string;
  contactPerson?: string;
  contactSections?: ContactSection[];
  phone?: string;
  email?: string;
  teacherUid: string;
  classId?: string;
  studentId?: string;
  studentIds?: string[];
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
  classId?: string;
  className?: string;
}

interface ContactSection {
  heading: string;
  content: string;
}

function normalizeStudentIds(singleStudentId?: string | null, multipleStudentIds?: unknown): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushValue = (value: unknown) => {
    const id = String(value ?? '').trim();
    if (!id) return;
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
  };

  pushValue(singleStudentId);
  if (Array.isArray(multipleStudentIds)) {
    multipleStudentIds.forEach((value) => pushValue(value));
  }

  return result;
}

function createEmptyContactSection(): ContactSection {
  return { heading: '', content: '' };
}

function normalizeContactSections(sections: ContactSection[]): ContactSection[] {
  return sections
    .map((section) => ({
      heading: (section.heading || '').trim(),
      content: (section.content || '').trim(),
    }))
    .filter((section) => section.heading.length > 0 || section.content.length > 0);
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
    contactHeading: '',
    contactPerson: '',
    contactSections: [createEmptyContactSection()] as ContactSection[],
    phone: '',
    email: '',
    classId: '',
    studentIds: [] as string[],
  });
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
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
      const classNameById = new Map(classesData.map((entry) => [entry.id, entry.name]));
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
        const classId = (data.classId || '').toString();
        return {
          id: doc.id,
          name: data.displayName || data.email || 'Okänd elev',
          email: data.email || '',
          classId,
          className: classNameById.get(classId) || 'Ingen klass',
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
      const normalizedStudentIds = normalizeStudentIds(undefined, formData.studentIds);
      const normalizedContactSections = normalizeContactSections(formData.contactSections);
      const primaryContactSection = normalizedContactSections[0] || null;
      if (editingCompany) {
        // Update existing company
        await updateDoc(doc(db, 'companies', editingCompany.id), {
          name: formData.name,
          address: formData.address,
          contactHeading: primaryContactSection?.heading || '',
          contactPerson: primaryContactSection?.content || '',
          contactSections: normalizedContactSections,
          phone: formData.phone,
          email: formData.email,
          classId: formData.classId,
          studentId: normalizedStudentIds[0] || null,
          studentIds: normalizedStudentIds,
        });
      } else {
        // Add new company
        await addDoc(collection(db, 'companies'), {
          name: formData.name,
          address: formData.address,
          contactHeading: primaryContactSection?.heading || '',
          contactPerson: primaryContactSection?.content || '',
          contactSections: normalizedContactSections,
          phone: formData.phone,
          email: formData.email,
          teacherUid: user.uid,
          classId: formData.classId,
          studentId: normalizedStudentIds[0] || null,
          studentIds: normalizedStudentIds,
          createdAt: Timestamp.now(),
        });
      }

      // Reset form and refresh data
      setFormData({
        name: '',
        address: '',
        contactHeading: '',
        contactPerson: '',
        contactSections: [createEmptyContactSection()],
        phone: '',
        email: '',
        classId: '',
        studentIds: [],
      });
      setStudentSearchTerm('');
      setShowAddModal(false);
      setEditingCompany(null);
      await fetchData(user.uid, userRole || undefined);
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Ett fel uppstod när företaget skulle sparas');
    }
  };

  const handleEdit = (company: Company) => {
    const normalizedStudentIds = normalizeStudentIds(company.studentId, company.studentIds);
    const sectionsFromCompany = Array.isArray(company.contactSections)
      ? normalizeContactSections(company.contactSections)
      : [];
    const fallbackSections =
      sectionsFromCompany.length > 0
        ? sectionsFromCompany
        : normalizeContactSections([
            {
              heading: company.contactHeading || '',
              content: company.contactPerson || '',
            },
          ]);
    setEditingCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      contactHeading: company.contactHeading || '',
      contactPerson: company.contactPerson || '',
      contactSections:
        fallbackSections.length > 0
          ? fallbackSections
          : [createEmptyContactSection()],
      phone: company.phone || '',
      email: company.email || '',
      classId: company.classId || '',
      studentIds: normalizedStudentIds,
    });
    setStudentSearchTerm('');
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
      contactHeading: '',
      contactPerson: '',
      contactSections: [createEmptyContactSection()],
      phone: '',
      email: '',
      classId: '',
      studentIds: [],
    });
    setStudentSearchTerm('');
  };

  const toggleStudentSelection = (studentId: string) => {
    setFormData((current) => {
      const isSelected = current.studentIds.includes(studentId);
      return {
        ...current,
        studentIds: isSelected
          ? current.studentIds.filter((id) => id !== studentId)
          : [...current.studentIds, studentId],
      };
    });
  };

  const updateContactSection = (
    index: number,
    field: 'heading' | 'content',
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      contactSections: current.contactSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [field]: value } : section,
      ),
    }));
  };

  const addContactSection = () => {
    setFormData((current) => ({
      ...current,
      contactSections: [...current.contactSections, createEmptyContactSection()],
    }));
  };

  const removeContactSection = (index: number) => {
    setFormData((current) => {
      const nextSections = current.contactSections.filter((_, i) => i !== index);
      return {
        ...current,
        contactSections:
          nextSections.length > 0 ? nextSections : [createEmptyContactSection()],
      };
    });
  };

  const filteredStudents = students.filter((student) => {
    if (!studentSearchTerm.trim()) return true;
    const search = studentSearchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(search) ||
      (student.email || '').toLowerCase().includes(search)
    );
  });

  const groupedFilteredStudents = useMemo(() => {
    const grouped = new Map<string, StudentData[]>();

    for (const student of filteredStudents) {
      const className = student.className || 'Ingen klass';
      const current = grouped.get(className) || [];
      current.push(student);
      grouped.set(className, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'sv-SE'))
      .map(([className, studentsInClass]) => ({
        className,
        students: [...studentsInClass].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')),
      }));
  }, [filteredStudents]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
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
              const companyStudentIds = normalizeStudentIds(company.studentId, company.studentIds);
              const companyContactSections = normalizeContactSections(
                Array.isArray(company.contactSections)
                  ? company.contactSections
                  : [
                      {
                        heading: company.contactHeading || '',
                        content: company.contactPerson || '',
                      },
                    ],
              );
              const linkedStudents = companyStudentIds
                .map((studentId) => students.find((student) => student.id === studentId))
                .filter((student): student is StudentData => !!student);
              return (
                <div key={company.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {company.name}
                      </h3>

                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Företagsinfo
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {company.address && (
                          <div className="flex items-center text-gray-600">
                            <span className="mr-2">📍</span>
                            {company.address}
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

                      {companyContactSections.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Kontaktsektioner
                          </p>
                          {companyContactSections.map((section, index) => (
                            <div key={`${company.id}-section-${index}`} className="mb-2">
                              {section.heading && (
                                <p className="text-sm font-semibold text-gray-700">{section.heading}</p>
                              )}
                              {section.content && (
                                <div className="flex items-start text-gray-600 text-sm">
                                  <span className="mr-2">👤</span>
                                  <span className="whitespace-pre-line">{section.content}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {companyClass && (
                        <div className="mt-2">
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {companyClass.name}
                          </span>
                        </div>
                      )}
                      {linkedStudents.length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-2">
                            {linkedStudents.map((student) => (
                              <span key={student.id} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                Elev: {student.name}
                              </span>
                            ))}
                          </div>
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
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Företagsinfo
                </p>
                <div className="space-y-4">
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
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontaktsektioner och övriga rubriker
                </label>
                <div className="space-y-3">
                  {formData.contactSections.map((section, index) => (
                    <div key={`contact-section-${index}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rubrik {index + 1}
                        </p>
                        {formData.contactSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContactSection(index)}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Ta bort
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => updateContactSection(index, 'heading', e.target.value)}
                        className="mb-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        placeholder="t.ex. Handledare"
                      />
                      <textarea
                        value={section.content}
                        onChange={(e) => updateContactSection(index, 'content', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        rows={3}
                        placeholder={"t.ex. Anna Andersson\n070-123 45 67"}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Lägg till en eller flera rubriker med tillhörande information.
                  </p>
                  <button
                    type="button"
                    onClick={addContactSection}
                    className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
                  >
                    + Lägg till rubrik
                  </button>
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
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Sök elev (namn eller e-post)..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 space-y-1">
                  {groupedFilteredStudents.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-gray-500">Inga elever matchar sökningen</p>
                  ) : (
                    groupedFilteredStudents.map((group) => (
                      <div key={group.className} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {group.className}
                        </p>
                        <div className="space-y-1">
                          {group.students.map((student) => {
                            const checked = formData.studentIds.includes(student.id);
                            return (
                              <label key={student.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleStudentSelection(student.id)}
                                />
                                <span>{student.name}{student.email ? ` (${student.email})` : ''}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {formData.studentIds.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    {formData.studentIds.length} elev{formData.studentIds.length > 1 ? 'er' : ''} kopplad{formData.studentIds.length > 1 ? 'e' : ''}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Du kan koppla en eller flera elever till samma företag
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
    </main>
  );
}
