const defaultApiUrl = "https://eggs-api.onrender.com";

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, "");
  return `${baseUrl}${normalizedPath}`;
}
