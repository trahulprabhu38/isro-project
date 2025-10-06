import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [lang, setLang] = useState("en");
  const [eventSource, setEventSource] = useState(null);
  const base = process.env.REACT_APP_API_BASE || "http://localhost:4000";

  // ✅ Initialize map
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: [77.58, 12.94], // Bengaluru
      zoom: 12.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      console.log("🗺️ Map loaded successfully");

      // Initial stream
      subscribeToStream(map.getBounds());

      // Reload stream when map stops moving
      map.on("moveend", () => {
        console.log("🌀 Map moved — refreshing stream");
        subscribeToStream(map.getBounds());
      });
    });

    // Cleanup
    return () => {
      if (eventSource) eventSource.close();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ✅ Subscribe to backend live stream
  const subscribeToStream = (bounds) => {
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    const url = `${base}/api/places-stream?lang=${lang}&bbox=${bbox.join(",")}`;
    console.log("🔗 Connecting stream:", url);

    if (eventSource) eventSource.close();

    const es = new EventSource(url);
    setEventSource(es);

    es.onmessage = (event) => {
      try {
        const geojson = JSON.parse(event.data);
        if (geojson?.features?.length) {
          console.log("📡 Received streamed features:", geojson.features.length);
          updateMap(geojson);
        }
      } catch (err) {
        console.error("❌ Failed to parse streamed GeoJSON:", err);
      }
    };

    es.onerror = (err) => {
      console.error("❌ Stream error:", err);
      es.close();
    };
  };

  // ✅ Render features dynamically
  const updateMap = (geojson) => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    // Remove old layers/sources safely
    if (map.getLayer("places-labels")) map.removeLayer("places-labels");
    if (map.getSource("places")) map.removeSource("places");

    // Add new data
    map.addSource("places", { type: "geojson", data: geojson });

    map.addLayer({
      id: "places-labels",
      type: "symbol",
      source: "places",
      layout: {
        "text-field": ["coalesce", ["get", "name_kn"], ["get", "name"]],
        "text-font": ["Noto Sans Kannada Regular", "Arial Unicode MS Regular"],
        "text-size": 13,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#222",
        "text-halo-color": "#fff",
        "text-halo-width": 1.2,
      },
    });
  };

  // ✅ Toggle language live (auto refreshes stream)
  const toggleLang = () => {
    const nextLang = lang === "en" ? "kn" : "en";
    console.log(`🔄 Switching language to: ${nextLang}`);
    setLang(nextLang);

    if (mapRef.current) subscribeToStream(mapRef.current.getBounds());
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bhuvan Kannada Live Map 🌐</h1>
        <button className="btn" onClick={toggleLang}>
          {lang === "en" ? "Translate → Kannada" : "Show English"}
        </button>
      </header>

      <div ref={mapContainer} className="map-container" />

      <footer className="footer">
        Real-time Streaming Translation — Powered by PostGIS + Lingvanex
      </footer>
    </div>
  );
}
