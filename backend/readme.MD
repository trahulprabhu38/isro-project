# Backend (Express) — Dynamic Overpass Prototype


1. cd backend
2. cp .env.example .env (add MAPTILER_API_KEY if you want but backend doesn't need it)
3. npm install
4. npm run dev


Endpoints:
- GET /api/health
- GET /api/places-live -> queries Overpass API for South Bangalore POIs
- POST /api/translate -> body: { texts: [], target: 'kn' }