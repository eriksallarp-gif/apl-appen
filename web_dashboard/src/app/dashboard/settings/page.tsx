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
    </>
  );
}
