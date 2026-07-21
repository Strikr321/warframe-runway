# WARF▲ME Runway

A full-stack fashion frame studio for Warframe — build color loadouts, generate shareable poster cards, and track your styled collection.

**Stack:** Angular · Spring Boot · PostgreSQL

## Features (in progress)

- 🗂 **Collection** — every Warframe as a card grid with stats, search, filters, and favorites
- 🎨 **Builder** — per-channel color picker with real in-game palettes, attachment loadout form
- 🖼 **Poster generator** — canvas-rendered loadout cards with custom layouts, downloadable as PNG
- 💾 Persistent loadouts (localStorage now → Spring Boot REST API + PostgreSQL)
- 🔐 User accounts with JWT auth (planned)

## Roadmap

| # | Step | Status |
|---|------|--------|
| 1 | Angular shell & routing | ✅ |
| 2 | Collection page components | ⏳ |
| 3 | LoadoutService + localStorage | — |
| 4 | Builder page + poster canvas | — |
| 5 | Polish & deploy front end | — |
| 6 | Spring Boot REST API | — |
| 7 | Connect front to back (HttpClient) | — |
| 8 | Auth (Spring Security + JWT) & full deploy | — |

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
```

---

*Not affiliated with Digital Extremes. Warframe and all related names are property of Digital Extremes Ltd.*
