export function setBoundedJson(key, value, maxItems = 200) {
  const nextValue = Array.isArray(value) ? value.slice(-maxItems) : value;
  localStorage.setItem(key, JSON.stringify(nextValue));
}

export function getJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}