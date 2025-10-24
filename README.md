# ISRO Project – Maps + Translation (EN → KN)

This repo is a small full‑stack mapping app wired to a PostGIS database, a Node/Express backend, and a React/Leaflet frontend. It already exposes a translation API that currently calls a third‑party service (Lingvanex). You want to add your own Python model for English → Kannada and feed translated names into the map.

This README explains what’s here, where to plug in your Python translator, the API contracts to follow, and a concrete plan to ship it. It also includes an architecture diagram and a ready‑to‑copy prompt to generate a high‑res diagram.


## What’s in this project

- Database: PostGIS (PostgreSQL + GIS extensions), initialized via `init-sql/` and persisted under `data/postgres/`.
- Backend: Node.js + Express in `backend/`
	- Key routes registered in `backend/index.js`:
		- GET `/api/places-postgis?lang=en|kn&bbox=minLon,minLat,maxLon,maxLat` – returns places from PostGIS; if `lang=kn`, it translates names before returning.
		- GET `/api/places-stream` – stream/live placeholder (Server‑Sent Events) for places.
		- POST `/api/translate` – translate arbitrary text; currently calls Lingvanex.
	- Current translation implementation: `backend/routes/translate.js` calls the Lingvanex REST API using the API key from env.
	- Note: `backend/routes/places-postgis.js` also contains a helper that translates names when `lang=kn` is requested.
- Frontend: React app in `frontend/` using Leaflet (`src/components/MapView.js`).
	- API calls are centralized in `frontend/src/api.js`.
	- It calls `POST /api/translate` with `{ texts: string[], target: 'kn' }` when you need translations.
- Orchestration: `docker-compose.yml` brings up PostGIS, backend (port 4000), and frontend (port 3000).


## Where to add the Python translation code

You have two viable integration patterns. The recommended approach is a small Python microservice the Node backend calls internally. This keeps your frontend unchanged and centralizes translation logic server‑side.

1) Python microservice (recommended)
- Create a new service (e.g., `translator/`) with FastAPI or Flask.
- Expose `POST /translate` that accepts the same payload the Node backend already uses:
	- Request body: `{ texts: string[], target: 'kn' }` (source is always English)
	- Response body: `{ translated: Array<{ original: string, translated: string }> }`
- Update the Node backend to call `http://translator:8000/translate` instead of Lingvanex. You can gate this with an env variable like `TRANSLATOR_URL`. If unset, fall back to Lingvanex.
- Bonus: Also have `places-postgis.js` use the same internal translator for batch translations when `lang=kn`.

2) In‑process Python via child process (not recommended here)
- You could spawn Python from Node and communicate over stdio, but this complicates Docker images and scaling. A networked microservice is cleaner with Docker Compose and easier to scale independently.

Summary: Put your model code under a new `translator/` folder as a FastAPI app and add a Docker Compose service `translator`. The Node backend will forward translation requests to it and return the same JSON shape to the frontend.


## API contracts to keep stable

These contracts already exist in the app; keep them stable to avoid frontend changes.

- Backend translate endpoint (public):
	- Method: POST `/api/translate`
	- Request JSON: `{ texts: string[], target: 'kn' }`
	- Response JSON: `{ translated: Array<{ original: string, translated: string }> }`
	- Behavior: Batch translate. Order of outputs matches the order of `texts`.

- Python translator (internal):
	- Method: POST `/translate`
	- Request JSON: `{ texts: string[], target: 'kn' }`
	- Response JSON: `{ translated: Array<{ original: string, translated: string }> }`
	- The backend just passes this through (or reshapes if needed) so the frontend response remains identical.

- Places from PostGIS (public):
	- Method: GET `/api/places-postgis?lang=en|kn&bbox=minLon,minLat,maxLon,maxLat`
	- Response: GeoJSON FeatureCollection
		- Each Feature has `properties` like `{ id, name, category, [name_kn] }`.
		- When `lang=kn`, backend can supply `properties.name_kn` using the translator.


## Step‑by‑step plan to add English → Kannada model

1) Stand up the Python service
- Create `translator/` with a FastAPI app. Use a simple stub first, then swap in your model.
- Example FastAPI app (stub):

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()

class TranslateRequest(BaseModel):
		texts: List[str]
		target: str = "kn"

@app.post("/translate")
def translate(req: TranslateRequest):
		# TODO: replace with real model inference
		out = [{"original": t, "translated": t} for t in req.texts]
		return {"translated": out}
```

- Minimal `requirements.txt`: `fastapi\nuvicorn`
- Dockerfile example:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

2) Wire it into Docker Compose
- Add a new service to `docker-compose.yml`:

```yaml
	translator:
		build:
			context: ./translator
		container_name: translator
		restart: always
		ports:
			- "8000:8000"  # internal use; can be omitted if only the backend calls it
		networks:
			- bhuvan-net
```

3) Point the backend at the Python service
- In the backend, set an env var like `TRANSLATOR_URL=http://translator:8000/translate`.
- Update `backend/routes/translate.js` to call `TRANSLATOR_URL` if set; otherwise use Lingvanex (already implemented). The request/response shape should match the contract above so the frontend doesn’t need any changes.
- Also update the helper in `backend/routes/places-postgis.js` to use the same translator for `lang=kn` (batch by joining with `\n`, keep index order).

4) Make the map show Kannada
- Option A (zero frontend changes): The backend sets `properties.name_kn` when `lang=kn`. Frontend requests `/api/places-postgis?lang=kn` and renders `name_kn`.
- Option B (frontend transforms): Frontend fetches English places, then calls `POST /api/translate` with the list of names, and renders the translated names.
- The codebase already leans towards Option A (backend translation when `lang=kn`).

5) Add caching (optional but recommended)
- Add a `name_kn` column in the `places` table and backfill as translations happen to avoid repeated model calls.
- In the translation path: check for existing `name_kn` first; only translate and write back if missing.

6) Replace the stub with your real model
- Integrate your chosen EN→KN model (e.g., IndicTrans2 or a fine‑tuned seq2seq). Keep the batch API contract. Ensure deterministic ordering of outputs.
- Preload weights on service start and batch inputs to reduce latency.

7) Observability and safety
- Log request counts, latencies, and errors in the Python service.
- Add basic input sanitization and maximum batch size to prevent abuse (e.g., max 100 texts per request).


## How data flows today (and after your change)

```mermaid
flowchart LR
	subgraph Client
		FE[React/Leaflet Frontend]
	end

	subgraph Backend
		BE[Node/Express]
	end

	DB[(PostGIS)]
	TG[3rd‑party Translator\n(Lingvanex)]
	PY[(Python Translator\nFastAPI – you add this)]

	FE -- HTTP --> BE
	BE -- SQL --> DB
	BE -- POST /api/translate --> TG

	%% After change (preferred)
	BE -. POST /translate .-> PY

	%% Places flow
	FE -->|GET /api/places-postgis?lang=kn| BE
	BE -->|translate batch names| PY
	BE --> FE
```


## Exact places and translation touchpoints

- Frontend API calls: `frontend/src/api.js`
	- `translateTexts(texts, target = 'kn')` POSTs to `/api/translate`.
	- `fetchPostGISPlaces(lang = 'en')` GETs `/api/places-postgis?lang=...`.
- Backend routes: `backend/index.js`
	- Registers `/api/places-postgis`, `/api/places-stream`, `/api/translate`.
- Translation logic (Node):
	- Public endpoint: `backend/routes/translate.js` (currently calls Lingvanex; switch to Python via `TRANSLATOR_URL`).
	- Places translation: `backend/routes/places-postgis.js` (batch translate names when `lang=kn`).


## Run locally

Prerequisites:
- Docker Desktop (Compose v2 recommended).

Start the stack:

```powershell
# from the repo root
docker compose up -d

# or if your Docker uses the hyphenated command
docker-compose up -d
```

Open:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000 (health page shows a banner message at `/`)

Environment variables (backend):
- `PORT` (default 4000)
- `PG*` vars are provided by Compose (host `postgis`).
- `LINGVANEX_API_KEY` for the current external translation path.
- `LINGVANEX_URL` for the current external translation path (already set in code/compose).
- `TRANSLATOR_URL` (new, optional): when set, the backend should prefer your Python service over Lingvanex.


## Prompt to generate a polished diagram

Use this prompt in Excalidraw, tldraw, Mermaid Live Editor, or any diagram tool:

> Draw a system diagram for a three‑service app: (1) React/Leaflet frontend on port 3000, (2) Node/Express backend on port 4000 exposing GET /api/places-postgis and POST /api/translate, (3) PostGIS database. Add a fourth service: Python FastAPI translator on port 8000, which the backend calls instead of an external Lingvanex API. Show the frontend calling the backend; the backend querying PostGIS and calling the translator; and the backend returning either GeoJSON features with name or name_kn, or translation results. Include notes for batching translations and optional DB caching of name_kn.


## Edge cases and guardrails

- Empty input: reject `POST /api/translate` when `texts` is empty or not an array.
- Batch size: cap at a reasonable max (e.g., 100 names) to avoid OOM on the model.
- Ordering: maintain order of inputs in outputs.
- Timeouts: set per‑request timeouts between backend and Python service; surface 504‑style errors cleanly.
- Fallback: if Python service is down, you can fall back to Lingvanex (if the key is present) or return a clear 503.


## Next steps

1) Scaffold `translator/` with FastAPI, build and add to Docker Compose.
2) Add `TRANSLATOR_URL` to backend env and update translation code to call it.
3) Switch `places-postgis.js` to the same translator for `lang=kn`.
4) Optionally add `name_kn` to the DB and cache translations.
5) Load test translation batches and measure latency; tune batch sizes and model footprint.


---

Completion summary:
- Documented stack architecture, endpoints, and data flow.
- Defined stable translation API contracts and where to plug in Python.
- Provided a stepwise plan with code snippets and Docker hints.
- Included a Mermaid diagram and an external prompt for a polished diagram.

Quality gates: This change modifies documentation only. Build/Lint/Tests unaffected (PASS).