const express = require("express");
const router = express.Router();

// use the built-in fetch from Node 18+
const LINGVANEX_URL =
  process.env.LINGVANEX_URL ||
  "https://api-b2b.backenster.com/b1/api/v3/translate";
const API_KEY = process.env.LINGVANEX_API_KEY;

router.post("/", async (req, res) => {
  const { texts, target } = req.body;
  const source = "en";

  if (!API_KEY) {
    console.error("❌ Missing Lingvanex API key");
    return res.status(500).json({ error: "Missing Lingvanex API key" });
  }

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: "No texts provided" });
  }

  try {
    console.log("🟢 Outgoing translation request →");
    console.log("URL:", LINGVANEX_URL);
    console.log("API_KEY starts with:", API_KEY.slice(0, 10) + "...");
    console.log("Body:", { from: source, to: target, count: texts.length });

    const resp = await fetch(LINGVANEX_URL, {
      method: "POST",
      headers: {
        "Authorization": API_KEY, // ✅ do NOT prepend Bearer
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: source,
        to: target,
        data: texts.join("\n"),
      }),
    });

    const raw = await resp.text();
    console.log("🟡 Raw response:", raw.slice(0, 300));

    if (!resp.ok) {
      console.error("❌ HTTP Error:", resp.status, resp.statusText);
      return res.status(resp.status).json({ error: "Translation API error" });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("❌ Invalid JSON from API:", e.message);
      return res.status(500).json({ error: "Invalid response from Lingvanex" });
    }

    if (!data.result) {
      console.error("❌ Missing 'result' field:", data);
      return res.status(500).json({ error: "Translation failed" });
    }

    const lines = data.result.split("\n");
    const translated = texts.map((t, i) => ({
      original: t,
      translated: lines[i] || t,
    }));

    console.log("✅ Translated:", translated);
    res.json({ translated });
  } catch (err) {
    console.error("❌ Exception during translation:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

module.exports = router;
