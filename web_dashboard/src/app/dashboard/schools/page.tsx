"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

export default function SchoolsPage() {
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchSchools = async () => {
    setLoading(true);
    const q = query(collection(db, "schools"), orderBy("name"));
    const snap = await getDocs(q);
    setSchools(
      snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name ?? "", // fallback till tom sträng om name saknas
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    await addDoc(collection(db, "schools"), {
      name: schoolName.trim(),
      createdAt: new Date(),
    });
    setSchoolName("");
    setMsg("Skola tillagd!");
    fetchSchools();
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <h2 className="text-2xl font-bold mb-6 text-orange-600">Skolor</h2>
      <form onSubmit={handleAddSchool} className="mb-8 flex gap-2">
        <input
          type="text"
          value={schoolName}
          onChange={e => setSchoolName(e.target.value)}
          placeholder="Skolans namn"
          className="border rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded font-semibold">Lägg till</button>
      </form>
      {msg && <div className="mb-4 text-green-600">{msg}</div>}
      {loading ? (
        <div>Laddar...</div>
      ) : (
        <ul className="space-y-2">
          {schools.map(school => (
            <li key={school.id} className="border rounded px-3 py-2 bg-orange-50">{school.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
