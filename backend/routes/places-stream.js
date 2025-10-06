const express = require("express");
const router = express.Router();
const pool = require("../db");
const fetch = require("node-fetch");
require("dotenv").config();

const LINGVANEX_URL = process.env.LINGVANEX_URL;
const API_KEY = process.env.LINGVANEX_API_KEY;

router.get("/", async (req, res) => {
  const { bbox, lang } = req.query;

  if (!bbox) {
    return res.status(400).send("Missing bbox parameter");
  }

  const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);

  console.log("🌍 Streaming live data for bbox:", [minLon, minLat, maxLon, maxLat]);

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // 1️⃣ Query PostGIS for all visible features
    const { rows } = await pool.query(
      `
      SELECT id, name, category,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM places
      WHERE ST_Intersects(
        geom,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
      `,
      [minLon, minLat, maxLon, maxLat]
    );

    console.log(`📍 Found ${rows.length} visible features`);

    if (!rows.length) {
      res.write(`data: ${JSON.stringify({ type: "FeatureCollection", features: [] })}\n\n`);
      return;
    }

    // 2️⃣ Build GeoJSON structure
    let features = rows.map((r) => ({
      type: "Feature",
      geometry: r.geometry,
      properties: { id: r.id, name: r.name, category: r.category },
    }));

    // 3️⃣ Translate if Kannada mode
    if (lang === "kn") {
      console.log("🈂️ Translating visible labels to Kannada...");
      const texts = rows.map((r) => r.name);

      const resp = await fetch(LINGVANEX_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "en",
          to: "kn",
          data: texts.join("\n"),
        }),
      });

      const data = await resp.json();
      if (data.result) {
        const lines = data.result.split("\n");
        features = features.map((f, i) => ({
          ...f,
          properties: {
            ...f.properties,
            name_kn: lines[i] || f.properties.name,
          },
        }));
      }
    }

    // 4️⃣ Stream back to frontend
    const geojson = { type: "FeatureCollection", features };
    res.write(`data: ${JSON.stringify(geojson)}\n\n`);

    // Send ping every 10 seconds
    const interval = setInterval(() => {
      res.write(`event: ping\ndata: {}\n\n`);
    }, 10000);

    req.on("close", () => {
      console.log("❌ Client disconnected from stream");
      clearInterval(interval);
      res.end();
    });
  } catch (err) {
    console.error("🔥 Streaming error:", err);
    res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
    res.end();
  }
});

module.exports = router;
