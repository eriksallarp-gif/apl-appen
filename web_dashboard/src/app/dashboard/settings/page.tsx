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
    <div className="min-h-screen bg-white">
      <aside className="fixed left-0 top-0 h-screen w-56 bg-gradient-to-br from-orange-50 to-white border-r border-orange-100/50 flex flex-col py-8 px-6 z-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-orange-600">APL-appen</h1>
          <p className="text-xs text-orange-400 mt-1">Hem</p>
        </div>
        <nav className="flex-1 space-y-4">
          <a href="/dashboard" className={`block font-semibold rounded-lg px-3 py-2 transition ${typeof window !== 'undefined' && window.location.pathname === '/dashboard' ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Hem</a>
          <a href="/dashboard/students" className={`block font-medium rounded-lg px-3 py-2 transition ${typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/students') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Elever</a>
          <a href="/dashboard/companies" className={`block font-medium rounded-lg px-3 py-2 transition ${typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/companies') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Företag</a>
          <a href="/dashboard/documents" className={`block font-medium rounded-lg px-3 py-2 transition ${typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/documents') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Dokument</a>
          <a href="/dashboard/settings" className={`block font-medium rounded-lg px-3 py-2 transition ${typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/settings') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Inställningar</a>
        </nav>
        <div className="mt-auto pt-8">
          <button
            onClick={async () => { const { signOut } = await import('firebase/auth'); signOut(); window.location.href = '/login'; }}
            className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition"
          >
            Logga ut
          </button>
        </div>
      </aside>
      <main className="ml-56 max-w-xl mx-auto py-12">
        <h1 className="text-2xl font-bold mb-8 text-orange-600">Inställningar</h1>
        <form className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Namn</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ditt namn"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">E-post</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="din@email.se"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nuvarande lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nuvarande lösenord"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nytt lösenord</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nytt lösenord"
              autoComplete="new-password"
            />
          </div>
          <button
            type="button"
            className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition"
            onClick={handleSave}
          >
            Spara ändringar
          </button>
          {message && <div className="text-green-600 mt-4">{message}</div>}
        </form>
      </main>
    </div>
  );
}
