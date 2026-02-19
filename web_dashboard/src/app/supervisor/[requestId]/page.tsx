'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';

const CRITERIA = [
  'Engagemang',
  'Initiativtagande',
  'Samarbetsförmåga',
  'Problemlösning',
  'Kvalitet på arbete',
];

export default function SupervisorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const requestId = params.requestId as string;
  const token = searchParams.get('token');

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState(''); // För valideringsfel som blockerar hela sidan
  const [success, setSuccess] = useState(false);

  const [ratings, setRatings] = useState<{ [key: string]: number }>({});
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [imageComments, setImageComments] = useState<{ [key: number]: string }>({});
  const [company, setCompany] = useState('');
  const [showCustomCompany, setShowCustomCompany] = useState(false);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lunchApproved, setLunchApproved] = useState(0);
  const [travelApproved, setTravelApproved] = useState(0);

  useEffect(() => {
    validateAndLoadRequest();
    fetchCompanies();
  }, [requestId, token]);

  const fetchCompanies = async () => {
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setCompanies(companiesData);
    } catch (err) {
      console.error('Error loading companies:', err);
      // Continue without companies - user can still enter manually
    }
  };

  const validateAndLoadRequest = async () => {
    if (!token) {
      setValidationError('Ogiltig länk - token saknas');
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, 'assessmentRequests', requestId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setValidationError('Bedömningsförfrågan hittades inte');
        setLoading(false);
        return;
      }

      const data = docSnap.data();

      if (data.status !== 'pending' || data.token !== token) {
        setValidationError('Ogiltig eller använd länk');
        setLoading(false);
        return;
      }

      const expiresAt = data.expiresAt.toDate();
      if (expiresAt < new Date()) {
        setValidationError('Denna länk har gått ut');
        setLoading(false);
        return;
      }

      setRequest(data);
      setLunchApproved(data.lunchCount || 0);
      setTravelApproved(data.travelCount || 0);
      setLoading(false);
    } catch (err) {
      console.error('Error loading request:', err);
      setValidationError('Ett fel uppstod vid laddning av bedömningen');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const allRated = CRITERIA.every(c => ratings[c] > 0);
    if (!allRated) {
      setError('Vänligen betygsätt alla kriterier (1-5) innan du skickar in.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!company.trim() || !name.trim() || !phone.trim()) {
      setError('Vänligen fyll i alla signaturfält (företag, namn, telefon).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (lunchApproved > (request?.lunchCount || 0)) {
      setError(`Antal godkända luncher kan inte vara mer än begärt (${request?.lunchCount}).`);
      return;
    }

    if (travelApproved > (request?.travelCount || 0)) {
      setError(`Antal godkända kilometer kan inte vara mer än begärt (${request?.travelCount}).`);
      return;
    }

    try {
      const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / CRITERIA.length;
      const averageRating = avg.toFixed(1);

      const assessmentData: any = {};
      CRITERIA.forEach(criterion => {
        assessmentData[criterion] = {
          rating: ratings[criterion],
          comment: comments[criterion] || '',
        };
      });

      // Använd batch för att uppdatera både bedömningen och godkänna tidkorten
      const batch = writeBatch(db);

      // Uppdatera bedömningen
      const docRef = doc(db, 'assessmentRequests', requestId);
      batch.update(docRef, {
        status: 'submitted',
        submittedAt: Timestamp.now(),
        supervisorCompany: company,
        supervisorName: name,
        supervisorPhone: phone,
        lunchApproved,
        travelApproved,
        assessmentData,
        averageRating,
        imageComments,
      });

      // Godkänn och lås automatiskt alla tidkort som är kopplade till bedömningen
      if (request?.timesheetIds && Array.isArray(request.timesheetIds)) {
        console.log('Uppdaterar tidkort:', request.timesheetIds);
        for (const timesheetId of request.timesheetIds) {
          const timesheetRef = doc(db, 'timesheets', timesheetId);
          // Använd set med merge för att skapa dokumentet om det inte finns
          batch.set(timesheetRef, { 
            approved: true,
            locked: true  // Låser tidkorten så att eleven inte kan ändra dem
          }, { merge: true });
        }
      }

      console.log('Committing batch...');
      await batch.commit();
      console.log('Batch committed successfully');

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error submitting assessment:', err);
      // Visa mer detaljerat felmeddelande
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel';
      setError(`Ett fel uppstod vid sparande av bedömningen: ${errorMessage}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 font-medium">Laddar bedömning...</p>
        </div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-rose-50 px-4">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Ogiltig bedömning</h1>
          <p className="text-gray-600 text-lg mb-6">{validationError}</p>
          <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
            <p className="text-sm text-red-800">
              Kontakta läraren för en ny länk om denna har gått ut
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Tack för din bedömning!</h1>
          <p className="text-gray-600 mb-6 text-lg">
            Bedömningen har skickats till läraren och eleven.
          </p>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <p className="text-sm text-green-800">
              ✓ Din bedömning är nu registrerad i systemet
            </p>
          </div>
          <div className="mt-8">
            <p className="text-sm text-gray-500">APL-appen • Bedömningssystem</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Logo */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-orange-600 mb-2">APL-appen</h1>
          <p className="text-gray-600">Handledarbedömning</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bedömning av APL-elev</h2>
            <div className="h-1 w-20 bg-orange-600 rounded"></div>
          </div>

          {/* Student info */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg mb-8 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">{request?.studentName}</h3>
                <p className="text-orange-100">
                  📅 Veckor: {request?.weeks.join(', ')}
                </p>
                <p className="text-orange-100">
                  ⏰ Total arbetstid: {request?.totalHours} timmar
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                <p className="text-sm text-orange-100">APL-period</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Bifogade bilder */}
            {request?.images && request.images.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Bifogade bilder</h3>
                  <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">
                    {request.images.length} {request.images.length === 1 ? 'bild' : 'bilder'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-6 bg-orange-50 p-3 rounded border-l-4 border-orange-500">
                  📸 Eleven har bifogat följande bilder från APL-platsen
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {request.images.map((image: any, index: number) => (
                    <div key={index} className="relative group bg-white rounded-lg border-2 border-gray-200 p-3 hover:border-orange-400 transition">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-3">
                        <img
                          src={image.url}
                          alt={`Bild ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute top-5 right-5 bg-black/60 text-white px-2 py-1 rounded text-xs font-semibold">
                        {index + 1}/{request.images.length}
                      </div>
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-3 left-3 right-3 bottom-[100px] flex items-center justify-center bg-black/0 hover:bg-black/50 transition opacity-0 group-hover:opacity-100 rounded-lg"
                      >
                        <span className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg">
                          🔍 Visa fullstorlek
                        </span>
                      </a>
                      
                      {/* Kommentarsfält för bilden */}
                      <div className="mt-2">
                        <label className="block text-sm font-semibold mb-1 text-gray-700">
                          💬 Kommentar till bild {index + 1}
                        </label>
                        <textarea
                          placeholder="Lägg till kommentar om bilden (valfritt)..."
                          value={imageComments[index] || ''}
                          onChange={(e) => setImageComments({ ...imageComments, [index]: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bedömningskriterier */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Bedömningskriterier</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded border-l-4 border-orange-500">
                💡 Betygsätt eleven från <strong>1 (dåligt)</strong> till <strong>5 (utmärkt)</strong> för varje kriterium
              </p>

              {CRITERIA.map(criterion => (
                <div key={criterion} className="mb-6 p-5 border-2 rounded-lg hover:border-orange-300 transition bg-gray-50">
                  <label className="block font-semibold mb-3 text-gray-800 text-lg">{criterion}</label>
                  <div className="flex gap-3 mb-4">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setRatings({ ...ratings, [criterion]: rating })}
                        className={`flex-1 h-14 rounded-lg font-bold text-lg transition-all transform hover:scale-105 ${
                          ratings[criterion] === rating
                            ? 'bg-orange-600 text-white shadow-lg scale-105'
                            : 'bg-white border-2 border-gray-300 hover:border-orange-400 text-gray-700'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Kommentar (valfritt) - beskriv elevens styrkor eller utvecklingsområden..."
                    value={comments[criterion] || ''}
                    onChange={(e) => setComments({ ...comments, [criterion]: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            {/* Ersättning */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Godkänd ersättning</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6 bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
                ⚠️ Godkänn den ersättning som eleven faktiskt har rätt till
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-orange-50 p-5 rounded-lg border-2 border-orange-200">
                  <label className="block text-sm font-semibold mb-2 text-gray-800">
                    🍽️ Godkända luncher
                  </label>
                  <p className="text-xs text-gray-600 mb-3">Eleven begärde: <strong>{request?.lunchCount}</strong> luncher</p>
                  <input
                    type="number"
                    min="0"
                    max={request?.lunchCount}
                    value={lunchApproved}
                    onChange={(e) => setLunchApproved(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg font-semibold focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition"
                    required
                  />
                </div>
                <div className="bg-green-50 p-5 rounded-lg border-2 border-green-200">
                  <label className="block text-sm font-semibold mb-2 text-gray-800">
                    🚗 Godkända kilometer (km)
                  </label>
                  <p className="text-xs text-gray-600 mb-3">Eleven begärde: <strong>{request?.travelCount}</strong> km</p>
                  <input
                    type="number"
                    min="0"
                    max={request?.travelCount}
                    value={travelApproved}
                    onChange={(e) => setTravelApproved(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-green-300 rounded-lg text-lg font-semibold focus:border-green-500 focus:ring-2 focus:ring-green-200 transition"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Signatur */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Signatur</h3>
              </div>
              <div className="space-y-4 bg-gray-50 p-5 rounded-lg border-2 border-gray-200">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-800">
                    Företag / Organisation <span className="text-red-500">*</span>
                  </label>
                  {!showCustomCompany && companies.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={company}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__custom__') {
                            setShowCustomCompany(true);
                            setCompany('');
                          } else {
                            setCompany(value);
                          }
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                        required
                      >
                        <option value="">Välj företag</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        <option value="__custom__">➕ Annat företag (skriv själv)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="T.ex. Acme AB"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                        required
                      />
                      {companies.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomCompany(false);
                            setCompany('');
                          }}
                          className="text-sm text-purple-600 hover:text-purple-700 underline"
                        >
                          ← Välj från befintliga företag
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-800">
                    Handledare (ditt namn) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="För- och efternamn"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-800">
                    Telefonnummer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="T.ex. 070-123 45 67"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Telefonnummer *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-lg mb-6 flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
            >
              ✓ Skicka bedömning till lärare
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              🔒 Din bedömning skickas säkert till läraren och eleven
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>© APL-appen • Säker bedömningshantering</p>
        </div>
      </div>
    </div>
  );
}
