const express = require('express');
const axios = require('axios');
const router = express.Router();


// South Bangalore bounding box (lat,lng)
// We'll use a slightly larger box to include important POIs
const SOUTH_BANGALORE_BBOX = {
south: 12.88,
west: 77.54,
north: 12.96,
east: 77.62
};


// Overpass query: fetch amenities and tourism/facility nodes (points)
function buildOverpassQuery(bbox) {
// bbox order: south,west,north,east
const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
// We request nodes with common POI tags
const query = `[
out:json][timeout:25];(
node["amenity"](${bboxStr});
node["tourism"](${bboxStr});
node["shop"](${bboxStr});
node["leisure"](${bboxStr});
node["historic"](${bboxStr});
);out center;`;
return query;
}


// Helper to transform Overpass element to our place format
function elementToPlace(el) {
const name = el.tags && (el.tags.name || el.tags['name:en']) ? (el.tags.name || el.tags['name:en']) : null;
return {
id: `${el.type}-${el.id}`,
name: name || (el.tags && Object.values(el.tags)[0]) || 'unnamed',
lat: el.lat || (el.center && el.center.lat),
lng: el.lon || (el.center && el.center.lon),
tags: el.tags || {}
};
}


router.get('/', async (req, res) => {
try {
const overpassUrl = 'https://overpass-api.de/api/interpreter';
const query = buildOverpassQuery(SOUTH_BANGALORE_BBOX);


const response = await axios.post(overpassUrl, query, { headers: { 'Content-Type': 'text/plain' } });
const data = response.data;
if (!data.elements) return res.json({ places: [] });


const places = data.elements
.filter(el => (el.type === 'node' || el.type === 'way'))
.map(el => elementToPlace(el))
// filter out items with no coords
.filter(p => p.lat && p.lng)
// deduplicate by id
.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
// limit results so map stays responsive (you can increase this)
.slice(0, 200);


res.json({ places });
} catch (err) {
console.error('Overpass error', err.message || err);
res.status(500).json({ error: 'failed to fetch places' });
}
});


module.exports = router;