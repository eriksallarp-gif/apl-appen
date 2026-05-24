'use client';

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { StudentReport } from './StudentReport';
import { ClassReport } from './ClassReport';
import type { PdfStudent, PdfDataset } from './types';

/**
 * Triggers a browser download of a Blob as a named file.
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a PDF report for a single student.
 */
export async function downloadStudentPdf(student: PdfStudent, generatedAt = new Date()): Promise<void> {
  const doc = React.createElement(StudentReport, { student, generatedAt }) as React.ReactElement;
  const blob = await pdf(doc).toBlob();
  const safeName = student.name.replace(/[^a-zA-ZåäöÅÄÖ0-9 _-]/g, '').trim();
  triggerDownload(blob, `apl_rapport_${safeName}_${generatedAt.toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generates and downloads a PDF report for a whole class (or all classes).
 * Pass `className` to filter to a single class, omit to include all students.
 */
export async function downloadClassPdf(dataset: PdfDataset, className?: string): Promise<void> {
  const doc = React.createElement(ClassReport, { dataset, className }) as React.ReactElement;
  const blob = await pdf(doc).toBlob();
  const label = className ? `klass_${className}` : 'alla_klasser';
  triggerDownload(blob, `apl_rapport_${label}_${dataset.generatedAt.toISOString().slice(0, 10)}.pdf`);
}
