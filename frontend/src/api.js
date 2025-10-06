const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";

// Fetch PostGIS places
export async function fetchPostGISPlaces(lang = "en") {
  const resp = await fetch(`${API_BASE}/api/places-postgis?lang=${lang}`);
  if (!resp.ok) throw new Error("Failed to fetch PostGIS places");
  return resp.json();
}

// Fetch live places (if any Overpass integration)
export async function fetchLivePlaces() {
  const res = await fetch(`${API_BASE}/api/places-live`);
  if (!res.ok) throw new Error("Failed to fetch live places");
  return res.json();
}

// Send text for translation
export async function translateTexts(texts, target = "kn") {
  const resp = await fetch(`${API_BASE}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });

  if (!resp.ok) throw new Error("Translation failed");
  return await resp.json();
}
