'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

//Force dynamic rendering
export const dynamic = 'force-dynamic';

function PdfViewerContent() {
  const searchParams = useSearchParams();
  const pdfUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Dokument';
  const [isValidUrl, setIsValidUrl] = useState(false);

  useEffect(() => {
    if (pdfUrl) {
      try {
        // Validera att det är en valid URL
        new URL(pdfUrl);
        setIsValidUrl(true);
      } catch (e) {
        console.error('Invalid URL:', e);
      }
    }
  }, [pdfUrl]);

  if (!pdfUrl || !isValidUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Fel</h1>
          <p className="text-gray-700">Ingen giltigt dokument-URL angavs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-800 truncate">{decodeURIComponent(title)}</h1>
            </div>
            <div className="flex gap-2">
              <a
                href={pdfUrl}
                download
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Ladda ner
              </a>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Tillbaka
              </button>
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="p-4">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
              width="100%"
              height="800"
              className="w-full border-0"
              style={{ minHeight: '800px' }}
              title={decodeURIComponent(title)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViewPdfPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Laddar dokument...</div>}>
      <PdfViewerContent />
    </Suspense>
  );
}
