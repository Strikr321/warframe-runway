# WARF▲ME Runway

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
| 5c | Refactor: feature folders, split the poster generator, ToastService, comment cleanup | ⏳ |
| 5d | Show frame images, fix favorites, 404 + unsaved-changes guard | — |
| 5e | Tests (Vitest), ESLint, GitHub Actions CI | — |
| 6 | Spring Boot + PostgreSQL: entities, REST API, DTOs, validation, JUnit + Testcontainers | — |
| 7 | Connect Angular to the API (HttpClient, interceptor, import existing localStorage loadouts) | — |
| 8 | OAuth2 login (Discord / Google) with Spring Security | — |
| 9 | S3 pre-signed image uploads (DB stores keys/URLs only) | — |
| 10 | Sharing: public gallery, share links, QR code on posters | — |
| 11 | Deploy on AWS (RDS, S3 + CloudFront, Elastic Beanstalk/ECS) with CI/CD | — |

## Run locally

```bash
npm install
ng serve
# open http://localhost:4200
```

## Architecture

```
Angular components → LoadoutService → HTTP/REST → Spring Boot
(Controller → Service → JPA Repository) → PostgreSQL

Images: Angular → pre-signed URL from Spring Boot → direct upload to S3
(PostgreSQL stores only the object key / URL)
```

---

*Not affiliated with Digital Extremes. Warframe and all related names are property of Digital Extremes Ltd.*
