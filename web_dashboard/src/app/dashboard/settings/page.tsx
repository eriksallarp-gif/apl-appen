"use client";

import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import PageHeader from "@/components/PageHeader";

type TeacherSettingsForm = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  school: string;
  program: string;
};

const EMPTY_FORM: TeacherSettingsForm = {
  firstName: "",
  lastName: "",
  email: "",
  mobileNumber: "",
  school: "",
  program: "",
};

function authErrorMessage(errorCode: string): string {
  if (errorCode === "auth/wrong-password" || errorCode === "auth/invalid-credential") {
    return "Fel: Du har angivit fel nuvarande lösenord.";
  }
  if (errorCode === "auth/weak-password") {
    return "Det nya lösenordet är för svagt.";
  }
  return `Fel: ${errorCode}`;
}

export default function SettingsPage() {
  const [form, setForm] = useState<TeacherSettingsForm>(EMPTY_FORM);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const data = userSnap.exists() ? userSnap.data() : {};

        const firstName = String(data.firstName ?? "").trim();
        const lastName = String(data.lastName ?? "").trim();
        const email = String(data.email ?? user.email ?? "").trim();
        const mobileNumber = String(data.mobileNumber ?? "").trim();
        const school = String(data.school ?? "").trim();
        const assignedPrograms = Array.isArray(data.assignedPrograms)
          ? data.assignedPrograms
          : [];
        const programFromAssigned = assignedPrograms.length > 0 ? String(assignedPrograms[0] ?? "").trim() : "";
        const program = programFromAssigned || String(data.program ?? "").trim();

        const nextForm: TeacherSettingsForm = {
          firstName,
          lastName,
          email,
          mobileNumber,
          school,
          program,
        };

        setForm(nextForm);
      } catch (loadError) {
        console.error("Settings load error:", loadError);
        setMessageType("error");
        setMessage("Kunde inte läsa dina inställningar just nu.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    setMessage("");

    const user = auth.currentUser;
    if (!user) {
      setMessageType("error");
      setMessage("Ingen användare inloggad.");
      return;
    }

    const wantsPasswordChange = newPassword.trim().length > 0;

    if (!wantsPasswordChange) {
      setMessageType("success");
      setMessage("Inga lösenordsändringar att spara.");
      return;
    }

    if (wantsPasswordChange && !currentPassword.trim()) {
      setMessageType("error");
      setMessage("Ange nuvarande lösenord för att byta lösenord.");
      return;
    }

    setSaving(true);

    try {
      const email = user.email ?? form.email;
      const credential = EmailAuthProvider.credential(email, currentPassword.trim());
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword.trim());
      setCurrentPassword("");
      setNewPassword("");

      setMessageType("success");
      setMessage("Lösenordet är uppdaterat.");
    } catch (err) {
      console.error("Settings save error:", err);
      setMessageType("error");

      if (err && typeof err === "object" && "code" in err && typeof err.code === "string") {
        setMessage(authErrorMessage(err.code));
      } else {
        setMessage("Ett fel uppstod när inställningarna skulle sparas.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Konto"
        title="Inställningar"
        subtitle="Hantera dina kontouppgifter och uppdatera lösenordet för inloggning."
      />

      <form className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]" autoComplete="on">
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/12 dark:text-orange-200">
          För att ändra mobilnummer, e-post, skola eller program kontaktar du support på support@aplappen.com.
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Namn</label>
          <input
            type="text"
            value={form.firstName}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="Förnamn"
            autoComplete="given-name"
            disabled
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Efternamn</label>
          <input
            type="text"
            value={form.lastName}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="Efternamn"
            autoComplete="family-name"
            disabled
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">E-post</label>
          <input
            type="email"
            value={form.email}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="din@email.se"
            disabled
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Mobilnummer</label>
          <input
            type="tel"
            value={form.mobileNumber}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="070-123 45 67"
            autoComplete="tel"
            disabled
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Skola</label>
          <input
            type="text"
            value={form.school}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="Din skola"
            disabled
            autoComplete="organization"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Program</label>
          <input
            type="text"
            value={form.program}
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-500"
            placeholder="Ditt program"
            autoComplete="organization-title"
            disabled
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Nuvarande lösenord</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-100"
            placeholder="Nuvarande lösenord"
            autoComplete="current-password"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">Nytt lösenord</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500 dark:border-white/10 dark:bg-[#1A1A1A] dark:text-zinc-100"
            placeholder="Nytt lösenord"
            autoComplete="new-password"
            disabled={loadingProfile || saving}
          />
        </div>

        <button
          type="button"
          className="w-full rounded-xl bg-orange-600 py-2 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSave}
          disabled={loadingProfile || saving}
        >
          {saving ? "Sparar..." : "Spara ändringar"}
        </button>

        {message && (
          <div className={`mt-4 ${messageType === "error" ? "text-red-600" : "text-green-600"}`}>
            {message}
          </div>
        )}
      </form>
    </>
  );
}
