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

function proxyImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `${window.location.origin}/api/pdf-image?src=${encodeURIComponent(url)}`;
  }
  return url;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function isImageLikeUrl(url: string): boolean {
  const source = String(url || '').trim().toLowerCase();
  if (!source) return false;

  const extMatch = source.match(/\.([a-z0-9]+)(\?|$)/i);
  if (extMatch?.[1]) {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(extMatch[1].toLowerCase());
  }

  return source.includes('image') || source.includes('firebasestorage');
}

async function normalizeImageForPdf(url: string): Promise<string> {
  const proxiedUrl = proxyImageUrl(url);
  if (!proxiedUrl || typeof window === 'undefined') {
    return url;
  }

  try {
    const image = await loadImage(proxiedUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return proxiedUrl;
    }

    // Browser-decoded image applies EXIF orientation, canvas output keeps that orientation.
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return proxiedUrl;
  }
}

async function normalizeStudentImagesForPdf(student: PdfStudent): Promise<PdfStudent> {
  const normalizedAssessments = await Promise.all(
    student.assessments.map(async (assessment) => {
      const images = await Promise.all(
        assessment.images.map(async (image) => ({
          ...image,
          url: await normalizeImageForPdf(image.url),
        })),
      );

      return {
        ...assessment,
        images,
      };
    }),
  );

  const normalizedApprovedAssignments = await Promise.all(
    student.approvedAssignments.map(async (assignment) => ({
      ...assignment,
      mediaUrls: await Promise.all(
        assignment.mediaUrls.map(async (url) => (isImageLikeUrl(url) ? normalizeImageForPdf(url) : url)),
      ),
    })),
  );

  return {
    ...student,
    assessments: normalizedAssessments,
    approvedAssignments: normalizedApprovedAssignments,
  };
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
 * Generates and downloads a full PDF report for a single student, including
 * the complete assessment form data.
 */
export async function downloadStudentPdfFull(student: PdfStudent, generatedAt = new Date()): Promise<void> {
  const normalizedStudent = await normalizeStudentImagesForPdf(student);
  const doc = React.createElement(StudentReport, {
    student: normalizedStudent,
    generatedAt,
    includeFullAssessment: true,
  }) as React.ReactElement;
  const blob = await pdf(doc).toBlob();
  const safeName = student.name.replace(/[^a-zA-ZåäöÅÄÖ0-9 _-]/g, '').trim();
  triggerDownload(blob, `apl_rapport_fullstandig_${safeName}_${generatedAt.toISOString().slice(0, 10)}.pdf`);
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
