"use client";

import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { db, auth } from '@/lib/firebase';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc as docRef, collection, getDocs, query, where } from 'firebase/firestore';

export default function ClassesPage() {
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; classCode?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  // UI states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [qrModal, setQrModal] = useState<{ id: string; name: string; code: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string; code?: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await fetchClasses(user.uid);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const fetchClasses = async (uid: string) => {
    try {
      // Primary: fetch classes explicitly owned by this teacher
      const qOwned = query(collection(db, 'classes'), where('teacherUid', '==', uid));
      const snapOwned = await getDocs(qOwned);

      // Secondary: find legacy docs that may be missing teacherUid but have classCode like `${uid}_...`
      // Use range query to emulate startsWith
      const prefix = `${uid}_`;
      const qPrefix = query(
        collection(db, 'classes'),
        where('classCode', '>=', prefix),
        where('classCode', '<=', prefix + '\uf8ff')
      );
      const snapPrefix = await getDocs(qPrefix);

      // Merge docs: include owned docs and prefix-matched docs only when they belong to this teacher
      const seen = new Map<string, any>();

      const addDocIfValid = async (d: any) => {
        const data = d.data();
        if (data.migratedTo) return; // skip migrated legacy docs
        const docId = d.id;
        const name = data.name || 'Okänd';
        const teacherUidField = data.teacherUid || null;
        const classCode = data.classCode || null;

        // Dev-only debug log to help trace unexpected classes like BA26
        if (process.env.NODE_ENV !== 'production') {
          console.log('CLASSES DEBUG:', { docId, name, teacherUidField, classCode });
        }

        // If teacherUid matches current user, include
        if (teacherUidField === uid) {
          seen.set(docId, { id: docId, name, classCode });
          return;
        }

        // If teacherUid missing but classCode indicates ownership, migrate teacherUid and include
        if (!teacherUidField && classCode && typeof classCode === 'string' && classCode.startsWith(prefix)) {
          try {
            await setDoc(docRef(db, 'classes', docId), { teacherUid: uid }, { merge: true });
            seen.set(docId, { id: docId, name, classCode });
            if (process.env.NODE_ENV !== 'production') console.log(`Migrated class ${docId} -> teacherUid=${uid}`);
          } catch (e) {
            console.error('Failed to migrate teacherUid for', docId, e);
          }
          return;
        }

        // Otherwise ignore (belongs to other teacher or no evidence of ownership)
      };

      for (const d of snapOwned.docs) await addDocIfValid(d);
      for (const d of snapPrefix.docs) await addDocIfValid(d);

      setClasses(Array.from(seen.values()));
    } catch (err) {
      console.error(err);
      setClasses([]);
    }
  };

  // classCodes collection is no longer used for UI; classCode is stored on the class doc

  const handleCreate = async () => {
    setError(null);
    if (!newClassName.trim()) {
      setError('Ange ett klassnamn.');
      return;
    }
    setCreating(true);
    const teacherUid = auth.currentUser?.uid || '';
    const classId = `${teacherUid}_${newClassName.trim()}`;
    // Step 1: create class document
    try {
      await setDoc(docRef(db, 'classes', classId), {
        name: newClassName.trim(),
        teacherUid: teacherUid,
        createdAt: new Date(),
      }, { merge: true });
      // Update UI immediately
      setClasses(prev => {
        // avoid duplicates
        if (prev.find(p => p.id === classId)) return prev;
        return [...prev, { id: classId, name: newClassName.trim() }];
      });
    } catch (err) {
      console.error('Failed creating class:', err);
      setError('Kunde inte skapa klass.');
      setCreating(false);
      return;
    }

    // Step 2: set classCode on the class doc (format: teacherUid_className)
    try {
      await setDoc(docRef(db, 'classes', classId), { classCode: classId }, { merge: true });
      // Update local class entry with classCode
      setClasses(prev => prev.map(p => p.id === classId ? { ...p, classCode: classId } : p));
    } catch (err) {
      console.error('Failed saving classCode to class doc:', err);
      setError('Kunde inte generera kod. Klassen skapades dock.');
    } finally {
      setNewClassName('');
      setCreating(false);
    }
  };

  const copyCode = async (code?: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      alert('Klasskod kopierad');
    } catch {
      alert('Kunde inte kopiera klasskod');
    }
  };

  const openDelete = (cls: { id: string; name: string; classCode?: string }) => {
    setConfirmText('');
    setDeleteModal({ id: cls.id, name: cls.name, code: cls.classCode });
  };

  const performDelete = async () => {
    if (!deleteModal) return;
    const expected = deleteModal.code || deleteModal.id || deleteModal.name;
    if (confirmText.trim() !== expected) return; // guard
    setDeleting(true);
    try {
      const callable = httpsCallable(functions, 'deleteClass');
      await callable({ classId: deleteModal.id, confirm: confirmText.trim(), hardDeleteTimesheets: false });
      setClasses(prev => prev.filter(p => p.id !== deleteModal.id));
      setDeleteModal(null);
      alert('Klass borttagen');
    } catch (err: any) {
      console.error('Failed to delete class', err);
      const message = err?.message || 'Kunde inte ta bort klassen.';
      alert(message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };


  // Generate classCode for an existing class (if missing)
  const generateClassCode = async (clsId: string) => {
    try {
      await setDoc(docRef(db, 'classes', clsId), { classCode: clsId, teacherUid: auth.currentUser?.uid }, { merge: true });
      setClasses(prev => prev.map(p => p.id === clsId ? { ...p, classCode: clsId } : p));
    } catch (e) {
      console.error('Failed to generate classCode for', clsId, e);
      alert('Kunde inte generera klasskod.');
    }
  };

  // Open QR modal for class
  const openQr = (cls: { id: string; name: string; classCode?: string }) => {
    if (!cls.classCode) return;
    setQrModal({ id: cls.id, name: cls.name, code: cls.classCode });
  };

  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setQrModal(null); };
    if (qrModal) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrModal]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">Laddar...</div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-orange-600 hover:text-orange-700 font-medium">← Tillbaka</a>
          <h1 className="text-2xl font-bold">Klasser</h1>
        </div>
        <div>
          <button onClick={() => setCreateModalOpen(true)} className="w-full bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 sm:w-auto rounded-lg">Skapa klass</button>
        </div>
      </div>

      {/* Classes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-gray-500">Inga klasser skapade ännu.</div>
        )}

        {classes.map(cls => {
          const classCode = cls.classCode;
          const expanded = !!expandedCards[cls.id];
          return (
            <div key={cls.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-semibold mb-1">{cls.name}</div>
                  <div className="text-sm text-gray-500 mb-3">Klasskod</div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="max-w-full break-all font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{classCode || 'Ingen kod'}</div>
                    {classCode && (
                      <button aria-label={`Kopiera ${classCode}`} onClick={() => copyCode(classCode)} className="text-sm text-gray-600 hover:text-gray-800">Kopiera</button>
                    )}
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {classCode ? (
                    <button onClick={() => toggleExpand(cls.id)} aria-expanded={expanded} className="text-sm border border-gray-300 rounded-lg px-3 py-2">{expanded ? 'Dölj QR' : 'Visa QR'}</button>
                  ) : (
                    <button onClick={() => generateClassCode(cls.id)} className="text-sm border border-gray-300 rounded-lg px-3 py-2">Generera kod</button>
                  )}
                  <button onClick={() => openDelete(cls)} className="text-sm border border-red-300 text-red-700 rounded-lg px-3 py-2">Ta bort</button>
                </div>
              </div>

              {expanded && classCode && (
                <div className="mt-6">
                  <div className="bg-white border rounded-xl p-4 flex flex-col items-center">
                    <QRCode value={classCode} size={160} />
                    <div className="text-sm text-gray-600 mt-3">Skanna i appen</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateModalOpen(false)} />
          <div className="relative bg-white rounded-lg p-6 z-10 w-full max-w-md mx-4" role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold mb-4">Skapa klass</h3>
            <div className="mb-3">
              <label className="block text-sm text-gray-700 mb-1">Klassnamn</label>
              <input value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Ex: BA22A" />
            </div>
            {error && <div className="text-red-600 mb-3">{error}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setCreateModalOpen(false)} disabled={creating} className="border border-gray-300 bg-white px-4 py-2 rounded">Avbryt</button>
              <button onClick={async () => { await handleCreate(); setCreateModalOpen(false); }} disabled={creating || !newClassName.trim()} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2">{creating ? 'Skapar...' : 'Skapa & generera kod'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal (danger) */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-lg p-6 z-10 w-full max-w-md mx-4" role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold mb-4">Ta bort klass?</h3>
            <p className="text-sm text-gray-700 mb-4">Detta tar bort klassen, elever, overrides och ALLA tidkort kopplade till klassen.</p>
            <div className="mb-3">
              <label className="block text-sm text-gray-700 mb-1">Skriv klasskoden för att bekräfta</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder={deleteModal.code || deleteModal.id} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => { if (!deleting) setDeleteModal(null); }} className="border border-gray-300 bg-white px-4 py-2 rounded">Avbryt</button>
              <button onClick={performDelete} disabled={deleting || confirmText.trim() !== (deleteModal.code || deleteModal.id || deleteModal.name)} className="border border-red-300 text-red-700 px-4 py-2 rounded">{deleting ? 'Tar bort...' : 'Ta bort permanent'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
