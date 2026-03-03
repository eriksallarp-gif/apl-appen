"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");


  // Firebase imports (dynamic to avoid SSR issues)
  const handleSave = async () => {
    setMessage("");
    if (!newPassword) {
      setMessage("Ange ett nytt lösenord.");
      return;
    }
    try {
      const { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) {
        setMessage("Ingen användare inloggad.");
        return;
      }
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      // Update password
      await updatePassword(user, newPassword);
      setMessage("Lösenordet är uppdaterat!");
      setPassword("");
      setNewPassword("");
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) {
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          setMessage("Fel: Du har angivit fel nuvarande lösenord.");
        } else if (err.code === "auth/weak-password") {
          setMessage("Det nya lösenordet är för svagt.");
        } else {
          setMessage("Fel: " + err.code);
        }
      } else {
        setMessage("Ett fel uppstod.");
      }
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-8 text-white">Inställningar</h1>
      <div className="bg-[#1E293B] rounded-xl shadow-2xl border border-gray-800 p-8">
        <form className="space-y-6" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Namn</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F172A] border border-[#FF6A00]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent transition"
              placeholder="Ditt namn"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">E-post</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F172A] border border-gray-700 rounded-lg text-gray-500 placeholder-gray-500 cursor-not-allowed"
              placeholder="din@email.se"
              disabled
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nuvarande lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F172A] border border-[#FF6A00]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent transition"
              placeholder="Nuvarande lösenord"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nytt lösenord</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F172A] border border-[#FF6A00]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent transition"
              placeholder="Nytt lösenord"
              autoComplete="new-password"
            />
          </div>
          <button
            type="button"
            className="w-full bg-[#FF6A00] text-white rounded-lg py-3 font-semibold hover:bg-[#FF6A00]/90 transition shadow-[0_0_20px_rgba(255,106,0,0.3)] hover:shadow-[0_0_30px_rgba(255,106,0,0.5)]"
            onClick={handleSave}
          >
            Spara ändringar
          </button>
          {message && <div className="text-emerald-400 mt-4 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg">{message}</div>}
        </form>
      </div>
    </>
  );
}
