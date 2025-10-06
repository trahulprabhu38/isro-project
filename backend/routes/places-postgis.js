const express = require("express");
const router = express.Router();
const pool = require("../db");
// const fetch = require("node-fetch");

const LINGVANEX_URL = process.env.LINGVANEX_URL;
const API_KEY = process.env.LINGVANEX_API_KEY;

// Helper: translate array of texts
async function translateTexts(texts, target = "kn") {
  const resp = await fetch(LINGVANEX_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "en", to: target, data: texts.join("\n") }),
  });

  const data = await resp.json();
  return data.result ? data.result.split("\n") : texts;
}

// ✅ Live stream endpoint (SSE)
router.get("/", async (req, res) => {
  const lang = req.query.lang || "en";
  const bbox = req.query.bbox?.split(",").map(Number);

  if (!bbox || bbox.length !== 4)
    return res.status(400).json({ error: "bbox required" });

  // SSE setup
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  console.log("🌍 Streaming live data for bbox:", bbox);

  const query = `
    SELECT id, name, category,
           ST_AsGeoJSON(geom)::json AS geometry
    FROM places
    WHERE ST_Intersects(
      geom,
      ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)
    );
  `;
  const { rows } = await pool.query(query);

  let features = rows.map((r) => ({
    type: "Feature",
    geometry: r.geometry,
    properties: { id: r.id, name: r.name, category: r.category },
  }));

  if (lang === "kn") {
    const translated = await translateTexts(rows.map((r) => r.name), "kn");
    features = features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, name_kn: translated[i] },
    }));
  }

  const geojson = JSON.stringify({
    type: "FeatureCollection",
    features,
  });

  // Send event stream (frontend will listen)
  res.write(`data: ${geojson}\n\n`);

  // Stream update every 10s (simulate live refresh)
  const interval = setInterval(async () => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 10000);

  req.on("close", () => {
    clearInterval(interval);
    console.log("❌ Client disconnected from stream");
  });
});

module.exports = router;
