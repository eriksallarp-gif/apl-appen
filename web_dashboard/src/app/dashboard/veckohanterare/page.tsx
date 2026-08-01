"use client";

import React from 'react';
import WeekAccessManager from '../students/WeekAccessManager';

export default function WeekManagerPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <a href="/dashboard" className="text-orange-600 hover:text-orange-700 font-medium">← Tillbaka</a>
        <h1 className="text-2xl font-bold">Veckohanterare</h1>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <WeekAccessManager />
      </div>
    </div>
  );
}
