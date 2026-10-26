export const environment = {
  production: true,
  apiUrl: 'http://localhost:8000',
  termsUrl: '/terms',
  privacyPolicyUrl: '/privacy',
  // Multipart API contract documented in docs/api/online-tips.md.
  tipSubmission: {
    endpoint: '/api/v1/tips' as string | null,
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxFiles: 5,
    maxTotalSizeBytes: 100 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ],
  },
  apiBaseUrl: '/bringthemhome',
} as const;
