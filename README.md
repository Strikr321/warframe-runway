# WARF▲ME Runway

[![CI](https://github.com/Strikr321/warframe-runway/actions/workflows/ci.yml/badge.svg)](https://github.com/Strikr321/warframe-runway/actions/workflows/ci.yml)

A full-stack fashion frame studio for Warframe — build color loadouts, generate shareable poster cards, and track your styled collection.

**Stack:** Angular · Spring Boot · PostgreSQL

## Features (in progress)

- 🗂 **Collection** — every Warframe as a card grid with stats, search, filters, and favorites; the frame list syncs live from the community WFCD dataset
- 🎨 **Builder** — per-channel color picker with real in-game palettes, attachment loadout form
- 🖼 **Poster generator** — canvas-rendered loadout posters in 4 layouts, with green-screen background removal and an auto-colored background, downloadable as PNG
- 💾 Persistent loadouts (localStorage now → Spring Boot REST API + PostgreSQL)
- ☁️ Image storage on AWS S3 via pre-signed uploads — the database stores links, not image bytes (planned)
- 🔐 User accounts with OAuth2 login (planned)

## Roadmap

✅ done · ⏳ in progress · — not started

| Step | What | Status |
|------|------|--------|
| 1 | Angular shell & routing | ✅ |
| 2 | Collection page (stats banner, controls bar, tilt cards) | ✅ |
| 3 | LoadoutService + localStorage persistence | ✅ |
| 4a | Builder: loadout form, palette color picker | ✅ |
| 4b | Poster generator: 4 layouts, transparent-cutout render engine | ✅ |
| 4c | Green-screen keying, chroma unmixing, island-aware crop | ✅ |
| 4d | Move photo mode (no cutout) onto the new engine; remove the old one | — |
| 4e | Background v2: silhouette back-glow, loadout-driven colors, smoke & grain | — |
| 4f | No-green-screen path: opt-in in-browser AI background removal, photo-mode edge fades | — |
| 5a | Hover fan-out, Recently Edited linking, 6-loadout cap | ✅ |
| 5b | Live frame catalog from WFCD (cached daily) | ✅ |
| 5c | Refactor: feature folders, split the poster generator, ToastService, comment cleanup | ✅ |
| 5d | Show frame images, fix favorites, 404 + unsaved-changes guard | ✅ |
| 5e | Tests (Vitest), ESLint, Prettier, GitHub Actions CI | ✅ |
| 6 | Spring Boot + PostgreSQL: entities, REST API, DTOs, validation, JUnit + Testcontainers | ✅ |
| 7 | Connect Angular to the API (HttpClient, interceptor, import existing localStorage loadouts) | — |
| 8 | OAuth2 login (Discord / Google) with Spring Security | — |
| 9 | S3 pre-signed image uploads (DB stores keys/URLs only) | — |
| 10 | Sharing: public gallery, share links, QR code on posters | — |
| 11 | Deploy on AWS (RDS, S3 + CloudFront, Elastic Beanstalk/ECS) with CI/CD | — |

## Repository layout

```
frontend/            Angular app
backend/             Spring Boot API (Java 25, Maven)
docker-compose.yml   Local PostgreSQL
.env.example         Environment variables (copy to .env)
```

## Run locally

**Prerequisites:** Node 24, Java 25, Docker Desktop.

```bash
# 1. Database
docker compose up -d

# 2. API on http://localhost:8080
cd backend
./mvnw spring-boot:run

# 3. Web app on http://localhost:4200
cd frontend
npm install
npm start
```

Checks (the same ones CI runs on every pull request):

```bash
# frontend/
npm run lint && npm run format:check && npm run test:ci && npm run build

# backend/ (needs Docker running for the Testcontainers tests)
./mvnw verify          # tests + format check
./mvnw spotless:apply  # fix Java formatting
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/loadouts?frame=` | List loadouts, newest first; optional frame filter |
| `GET` | `/api/loadouts/{id}` | One loadout |
| `POST` | `/api/loadouts` | Create (`201` + `Location`); `409` past 6 per frame |
| `PUT` | `/api/loadouts/{id}` | Replace name, frame, attachments and colors |
| `PUT` | `/api/loadouts/{id}/favorite` | `{"favorite": true}` |
| `DELETE` | `/api/loadouts/{id}` | Delete (`204`) |
| `GET` | `/actuator/health` | Health check |

Errors use [RFC 9457 problem details](https://www.rfc-editor.org/rfc/rfc9457) (`application/problem+json`); validation errors list each failing field.

## Architecture

```
Angular components → LoadoutService → HTTP/REST → Spring Boot
(Controller → Service → JPA Repository) → PostgreSQL (schema managed by Flyway)

Images: Angular → pre-signed URL from Spring Boot → direct upload to S3
(PostgreSQL stores only the object key / URL)
```

---

*Not affiliated with Digital Extremes. Warframe and all related names are property of Digital Extremes Ltd.*
