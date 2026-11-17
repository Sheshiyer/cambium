const BANNED_KEY = /^(password|passwd|secret|credential|credentials|cookie|cookies|set-cookie|authorization|api_key|apikey|api-key|private_key|birth|birthdate|birth_date|date_of_birth|dob|ssn)$/i;

export function findSensitive(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSensitive(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_KEY.test(key)) return key.toLowerCase();
    const found = findSensitive(child);
    if (found) return found;
  }
  return null;
}
