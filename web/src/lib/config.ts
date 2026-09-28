/**
 * Safe API URL resolver with strict production validation
 */
export const getApiUrl = (): string => {
  const raw = import.meta.env.VITE_API_URL;
  const apiUrl = raw ? raw.replace(/^\ufeff/, '').replace(/[^\x20-\x7E]/g, '').trim() : '';
  const isProd = import.meta.env.PROD;

  if (isProd) {
    if (!apiUrl) {
      throw new Error(
        'Production configuration error: VITE_API_URL is missing. In production builds, a valid remote API URL must be configured.'
      );
    }
    const lower = apiUrl.toLowerCase();
    if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
      throw new Error(
        `Production configuration error: VITE_API_URL must not point to localhost in a production build (currently: "${apiUrl}").`
      );
    }
  }

  return apiUrl || 'http://localhost:8000';
};
