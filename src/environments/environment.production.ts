export const environment = {
  production: true,
  apiUrl: 'http://localhost:8000',
  termsUrl: '/terms',
  privacyPolicyUrl: '/privacy',
  // Future verified tip API; no request is sent until a contract adapter is implemented.
  tipSubmission: {
    endpoint: null as string | null,
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  apiBaseUrl: '/bringthemhome',
} as const;
