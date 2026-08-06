const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function apiUrl(path: string) {
  return `${configuredApiUrl.replace(/\/$/, "")}${path}`;
}
