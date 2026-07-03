'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

interface ContactSection {
  heading: string;
  content: string;
}

interface SchoolContact {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  teacherUid: string;
  school?: string;
  studentId?: string;
  studentIds?: string[];
  classIds?: string[];
  contactSections?: ContactSection[];
  createdAt?: any;
}

interface StudentData {
  id: string;
  name: string;
  email?: string;
  teacherUid?: string;
  school?: string;
  classId?: string;
  className?: string;
}

interface ClassData {
  id: string;
  name: string;
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

export default function SchoolContactsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userSchoolId, setUserSchoolId] = useState('');
  const [contacts, setContacts] = useState<SchoolContact[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<SchoolContact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    studentIds: [] as string[],
    classIds: [] as string[],
    contactSections: [createEmptyContactSection()] as ContactSection[],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const role = (userData?.role || '').toString();
      const school = (userData?.school || '').toString();

      if (role !== 'teacher' && role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      if (!school) {
        alert('Din användare saknar skolkoppling. Kontakta administratör.');
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setUserRole(role);
      setUserSchoolId(school);
      await fetchStudents(currentUser.uid, role, school);
      await fetchContacts(currentUser.uid, role, school);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchContacts = async (uid: string, role: string, school: string) => {
    try {
      const contactsQuery =
        role === 'teacher'
          ? query(
              collection(db, 'schoolContacts'),
              where('teacherUid', '==', uid),
              where('school', '==', school),
            )
          : school
            ? query(collection(db, 'schoolContacts'), where('school', '==', school))
            : collection(db, 'schoolContacts');
      const snapshot = await getDocs(contactsQuery);
      const loaded = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as SchoolContact))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));
      setContacts(loaded);
    } catch (error) {
      console.error('Error fetching school contacts:', error);
      alert('Kunde inte hämta kontaktpersoner för skolan.');
    }
  };

  const fetchStudents = async (uid: string, role: string, school: string) => {
    try {
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const classDocs = role === 'teacher'
        ? classesSnapshot.docs.filter((item) => (item.data().teacherUid || '').toString() === uid)
        : classesSnapshot.docs.filter((item) => {
            const data = item.data();
            const schoolValue = (data.school || '').toString();
            return !schoolValue || schoolValue === school;
          });

      const loadedClasses = classDocs
        .map((item) => ({
          id: item.id,
          name: (item.data().name || 'Okänd klass').toString(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));
      setClasses(loadedClasses);
      const classNameById = new Map(loadedClasses.map((item) => [item.id, item.name]));

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const studentDocs = usersSnapshot.docs.filter((item) => item.data().role === 'student');

      const scopedStudents = role === 'teacher'
        ? studentDocs.filter((item) => (item.data().teacherUid || '').toString() === uid)
        : studentDocs.filter((item) => (item.data().school || '').toString() === school);

      const loaded = scopedStudents
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: (data.displayName || data.email || 'Okänd elev').toString(),
            email: (data.email || '').toString(),
            teacherUid: (data.teacherUid || '').toString(),
            school: (data.school || '').toString(),
            classId: (data.classId || '').toString(),
            className: classNameById.get((data.classId || '').toString()) || 'Ingen klass',
          } as StudentData;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

      setStudents(loaded);
    } catch (error) {
      console.error('Error fetching students for school contacts:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      studentIds: [],
      classIds: [],
      contactSections: [createEmptyContactSection()],
    });
    setStudentSearchTerm('');
    setClassSearchTerm('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContact(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Namn är obligatoriskt');
      return;
    }
    if (!userSchoolId) {
      alert('Din användare saknar skolkoppling. Kontakta administratör.');
      return;
    }

    const normalizedSections = normalizeContactSections(formData.contactSections);
    const studentsFromClasses = students
      .filter((student) => {
        const classId = (student.classId || '').trim();
        return classId && formData.classIds.includes(classId);
      })
      .map((student) => student.id);
    const normalizedStudentIds = normalizeStudentIds(undefined, [
      ...formData.studentIds,
      ...studentsFromClasses,
    ]);

    try {
      if (editingContact) {
        await updateDoc(doc(db, 'schoolContacts', editingContact.id), {
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          studentId: normalizedStudentIds[0] || null,
          studentIds: normalizedStudentIds,
          classIds: formData.classIds,
          contactSections: normalizedSections,
        });
      } else {
        await addDoc(collection(db, 'schoolContacts'), {
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          studentId: normalizedStudentIds[0] || null,
          studentIds: normalizedStudentIds,
          classIds: formData.classIds,
          contactSections: normalizedSections,
          teacherUid: user.uid,
          school: userSchoolId,
          createdAt: Timestamp.now(),
        });
      }

      closeModal();
      await fetchContacts(user.uid, userRole || 'teacher', userSchoolId);
    } catch (error) {
      console.error('Error saving school contact:', error);
      alert('Ett fel uppstod när kontakten skulle sparas');
    }
  };

  const handleEdit = (contact: SchoolContact) => {
    const sections = normalizeContactSections(contact.contactSections || []);
    const normalizedStudentIds = normalizeStudentIds(contact.studentId, contact.studentIds);
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      address: contact.address || '',
      phone: contact.phone || '',
      email: contact.email || '',
      studentIds: normalizedStudentIds,
      classIds: Array.isArray(contact.classIds)
        ? contact.classIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [],
      contactSections: sections.length > 0 ? sections : [createEmptyContactSection()],
    });
    setStudentSearchTerm('');
    setClassSearchTerm('');
    setShowModal(true);
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna kontakt?')) return;
    try {
      await deleteDoc(doc(db, 'schoolContacts', contactId));
      await fetchContacts(user.uid, userRole || 'teacher', userSchoolId);
    } catch (error) {
      console.error('Error deleting school contact:', error);
      alert('Ett fel uppstod när kontakten skulle tas bort');
    }
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

  const toggleExpanded = (contactId: string) => {
    setExpandedContactId((current) => (current === contactId ? null : contactId));
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

  const filteredStudents = students.filter((student) => {
    if (!studentSearchTerm.trim()) return true;
    const search = studentSearchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(search) ||
      (student.email || '').toLowerCase().includes(search)
    );
  });

  const toggleClassSelection = (classId: string) => {
    setFormData((current) => {
      const isSelected = current.classIds.includes(classId);
      return {
        ...current,
        classIds: isSelected
          ? current.classIds.filter((id) => id !== classId)
          : [...current.classIds, classId],
      };
    });
  };

  const filteredClasses = classes.filter((c) => {
    if (!classSearchTerm.trim()) return true;
    return c.name.toLowerCase().includes(classSearchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kontakt skola</h1>
            <p className="mt-1 text-gray-600">Hantera kontaktpersoner som eleverna ska nå</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/documents')}
            className="px-4 py-2 text-gray-600 transition hover:text-gray-900"
          >
            ← Tillbaka till dokument
          </button>
        </div>

        <button
          onClick={() => {
            setEditingContact(null);
            resetForm();
            setShowModal(true);
          }}
          className="rounded-lg bg-orange-600 px-6 py-3 text-white shadow-md transition hover:bg-orange-700"
        >
          + Lägg till kontaktperson
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Totalt antal kontakter</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{contacts.length}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-xl font-semibold">Alla kontakter</h2>
        </div>

        {contacts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mb-4 text-5xl text-gray-400">🏫</div>
            <p className="mb-2 text-gray-600">Inga kontakter har lagts till ännu</p>
            <p className="text-sm text-gray-500">Klicka på "Lägg till kontaktperson" för att komma igång</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {contacts.map((contact) => {
              const isExpanded = expandedContactId === contact.id;
              const contactSections = normalizeContactSections(contact.contactSections || []);
              const contactStudentIds = normalizeStudentIds(contact.studentId, contact.studentIds);
              const contactClassIds = Array.isArray(contact.classIds)
                ? contact.classIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
              const linkedClasses = contactClassIds
                .map((classId) => classes.find((item) => item.id === classId))
                .filter((item): item is ClassData => !!item);
              const linkedStudents = contactStudentIds
                .map((studentId) => students.find((student) => student.id === studentId))
                .filter((student): student is StudentData => !!student);

              return (
                <div key={contact.id}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(contact.id)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-gray-50"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-lg font-semibold text-gray-900">{contact.name}</span>
                    <span className="text-sm font-medium text-gray-500">
                      {isExpanded ? '▲ Dölj info' : '▼ Visa info'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 pb-6 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Kontaktinfo
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                        {contact.address && (
                          <div className="flex items-center text-gray-600">
                            <span className="mr-2">📍</span>
                            {contact.address}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center text-gray-600">
                            <span className="mr-2">📞</span>
                            {contact.phone}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center text-gray-600">
                            <span className="mr-2">✉️</span>
                            {contact.email}
                          </div>
                        )}
                      </div>

                      {contactSections.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Roller och ansvar
                          </p>
                          {contactSections.map((section, index) => (
                            <div key={`${contact.id}-section-${index}`} className="mb-2">
                              {section.heading && (
                                <p className="text-sm font-semibold text-gray-700">{section.heading}</p>
                              )}
                              {section.content && (
                                <p className="whitespace-pre-line text-sm text-gray-600">{section.content}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {linkedStudents.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Gäller elever
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {linkedStudents.map((student) => (
                              <span
                                key={student.id}
                                className="inline-block rounded bg-green-100 px-2 py-1 text-xs text-green-800"
                              >
                                Elev: {student.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {linkedClasses.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Gäller klasser
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {linkedClasses.map((item) => (
                              <span
                                key={item.id}
                                className="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-800"
                              >
                                Klass: {item.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-200"
                        >
                          Redigera
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 transition hover:bg-red-200"
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold">
                {editingContact ? 'Redigera kontaktperson' : 'Lägg till kontaktperson'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Grundinformation
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Namn / avdelning <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                      placeholder="t.ex. Skolledning eller Administration"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Adress
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                      placeholder="t.ex. Skolgatan 1"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        placeholder="t.ex. 08-123 45 67"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        E-post
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        placeholder="t.ex. info@skola.se"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lärare, rektor och övriga roller
                </label>
                <div className="space-y-3">
                  {formData.contactSections.map((section, index) => (
                    <div key={`school-contact-section-${index}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Roll {index + 1}
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
                        placeholder="t.ex. Rektor, Mentor, Studie- och yrkesvägledare"
                      />

                      <textarea
                        value={section.content}
                        onChange={(e) => updateContactSection(index, 'content', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        rows={3}
                        placeholder={'t.ex. Anna Andersson\nanna@skola.se\n070-123 45 67'}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Lägg till en eller flera kontaktroller.</p>
                  <button
                    type="button"
                    onClick={addContactSection}
                    className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
                  >
                    + Lägg till roll
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Koppla till hela klasser (valfritt)
                </label>
                <input
                  type="text"
                  value={classSearchTerm}
                  onChange={(e) => setClassSearchTerm(e.target.value)}
                  placeholder="Sök klass..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                  {filteredClasses.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-gray-500">Inga klasser matchar sökningen</p>
                  ) : (
                    filteredClasses.map((classItem) => {
                      const checked = formData.classIds.includes(classItem.id);
                      return (
                        <label
                          key={classItem.id}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleClassSelection(classItem.id)}
                          />
                          <span>{classItem.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {formData.classIds.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    {formData.classIds.length} klass
                    {formData.classIds.length > 1 ? 'er' : ''} vald
                    {formData.classIds.length > 1 ? 'a' : ''}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Alla elever i valda klasser kopplas automatiskt till kontakten.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Koppla till specifika elever (valfritt)
                </label>
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Sök elev (namn eller e-post)..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                  {filteredStudents.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-gray-500">Inga elever matchar sökningen</p>
                  ) : (
                    filteredStudents.map((student) => {
                      const checked = formData.studentIds.includes(student.id);
                      return (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudentSelection(student.id)}
                          />
                          <span>
                            {student.name}
                            {student.email ? ` (${student.email})` : ''}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {formData.studentIds.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    {formData.studentIds.length} elev
                    {formData.studentIds.length > 1 ? 'er' : ''} vald
                    {formData.studentIds.length > 1 ? 'a' : ''}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Om inga elever väljs visas kontakten för alla elever kopplade till läraren.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-orange-600 px-6 py-3 font-medium text-white transition hover:bg-orange-700"
                >
                  {editingContact ? 'Spara ändringar' : 'Lägg till kontakt'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-gray-100 px-6 py-3 text-gray-700 transition hover:bg-gray-200"
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
