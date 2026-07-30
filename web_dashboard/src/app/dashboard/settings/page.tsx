"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  const [initialForm, setInitialForm] = useState<TeacherSettingsForm>(EMPTY_FORM);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const fullName = useMemo(
    () => `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    [form.firstName, form.lastName],
  );

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
        setInitialForm(nextForm);
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

    const hasProfileChange =
      form.firstName.trim() !== initialForm.firstName ||
      form.lastName.trim() !== initialForm.lastName ||
      form.mobileNumber.trim() !== initialForm.mobileNumber ||
      form.program.trim() !== initialForm.program;

    const wantsPasswordChange = newPassword.trim().length > 0;

    if (!hasProfileChange && !wantsPasswordChange) {
      setMessageType("success");
      setMessage("Inga ändringar att spara.");
      return;
    }

    if (wantsPasswordChange && !currentPassword.trim()) {
      setMessageType("error");
      setMessage("Ange nuvarande lösenord för att byta lösenord.");
      return;
    }

    setSaving(true);

    try {
      if (hasProfileChange) {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const mobileNumber = form.mobileNumber.trim();
        const program = form.program.trim();
        const nextFullName = `${firstName} ${lastName}`.trim();

        await updateDoc(doc(db, "users", user.uid), {
          firstName,
          lastName,
          name: nextFullName,
          displayName: nextFullName,
          mobileNumber,
          program,
          assignedPrograms: program ? [program] : [],
        });

        await updateProfile(user, { displayName: nextFullName });

        const updatedForm: TeacherSettingsForm = {
          ...form,
          firstName,
          lastName,
          mobileNumber,
          program,
        };
        setForm(updatedForm);
        setInitialForm(updatedForm);
      }

      if (wantsPasswordChange) {
        const email = user.email ?? form.email;
        const credential = EmailAuthProvider.credential(email, currentPassword.trim());
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword.trim());
        setCurrentPassword("");
        setNewPassword("");
      }

      setMessageType("success");
      setMessage("Inställningarna är sparade.");
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
      <h1 className="text-2xl font-bold mb-8 text-orange-600">Inställningar</h1>

      <form className="space-y-8" autoComplete="on">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Namn</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Förnamn"
            autoComplete="given-name"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Efternamn</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Efternamn"
            autoComplete="family-name"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">E-post</label>
          <input
            type="email"
            value={form.email}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="din@email.se"
            disabled
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mobilnummer</label>
          <input
            type="tel"
            value={form.mobileNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="070-123 45 67"
            autoComplete="tel"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Skola</label>
          <input
            type="text"
            value={form.school}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Din skola"
            disabled
            autoComplete="organization"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Program</label>
          <input
            type="text"
            value={form.program}
            onChange={(e) => setForm((prev) => ({ ...prev, program: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Ditt program"
            autoComplete="organization-title"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nuvarande lösenord</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Nuvarande lösenord"
            autoComplete="current-password"
            disabled={loadingProfile || saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nytt lösenord</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Nytt lösenord"
            autoComplete="new-password"
            disabled={loadingProfile || saving}
          />
        </div>

        <button
          type="button"
          className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition disabled:cursor-not-allowed disabled:opacity-60"
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
