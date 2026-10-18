# Leads Colombia · v2

Monorepo with a Node.js + TypeScript API and a React Router frontend. Given just the name of a city, the API searches businesses in **five free public sources**, matches them, removes duplicates and stores them in **PostgreSQL**.

| Source | What it provides | When it is queried |
|---|---|---|
| **DANE** – Registro Estadístico de Empresas | Active legal entities: NIT, legal name, address, CIIU, coordinates. **No phone or email** | Always |
| **OpenStreetMap** (Overpass) | Trade name, coordinates of the place and, sometimes, phone, WhatsApp, website, social links | Always |
| **RNT** – Registro Nacional de Turismo | NIT, address, mobile, phone and email of tourism providers | Tourism categories (hotel, restaurant, bar, travel agency, transport) or no category |
| **SECOP II** – Proveedores Registrados | NIT, phone, email and website of companies that sell to the State | Categories with an equivalent UNSPSC code, or no category |
| **REPS** – Health providers | NIT, address, phone and email of each site | Health and dentistry, or no category |

When a business shows up in several sources, it becomes **a single lead** with the NIT from one and the contact data from another.

Then the team **contacts** the leads from the platform (email through SMTP; WhatsApp messages and calls are recorded), notes **who replied** and how, and everything is kept in each lead's history (see [Lead outreach](#lead-outreach)). With the cost of each channel, the platform calculates the **CPL** per source and per channel ([Measure](#measure-cpl-per-channel)), and **Dapta** qualifies each lead so channels can be compared by cost and by quality ([Qualify with Dapta](#qualify-with-dapta)).

> The code (folders, files, endpoints, identifiers, database) is in English. Everything the sales team sees — screens, error messages, emails, the template placeholders (`{{nombre}}`…) and the CSV headers — stays in Spanish.


## Monorepo (pnpm workspaces)

```
leads-colombia/
  package.json            global scripts (pnpm dev, build, test…)
  pnpm-workspace.yaml     apps/*
  docker-compose.yml      local Postgres (leads and leads_test databases)
  docker/init.sql
  apps/
    api/                  @leads-colombia/api — Express + Prisma
    web/                  @leads-colombia/web — React Router v8
```

### API (`apps/api`)

Layered architecture with one module per domain: `Router → Controller → Domain → Repository → Prisma/PostgreSQL`. The external sources live in `services/sources` and are used by the searches domain.

```
apps/api/
  src/
    index.ts                   startup: loads .env, validates the environment, starts the server
    config/
      app.ts                   middlewares, routes, errorHandler; in production it serves apps/web/build/client
      environment.ts           environment variables (fails fast if DATABASE_URL or JWT_SECRET is missing)
      db/client.ts             single PrismaClient instance
      helpers/response/        HttpCode, AppError, handleSuccess / handleError / handleFile, handleValidator
      logger/                  pino
      swagger.ts               shared OpenAPI definition (picks up modules/**/docs)
      catalog/categories.ts    category ↔ CIIU ↔ OSM tags ↔ RNT ↔ UNSPSC ↔ REPS
    middlewares/               verifyAuth (JWT session) + requireRole, and errorHandler
    modules/                   auth · users · searches · leads · catalog · outreach · templates · costs · metrics · qualifications
      router.ts · controller/ · domain/ · repository/ · types/ · validator/ · docs/
    services/sources/          dane, osm, rnt, secop, reps, datos.gov.co client
    services/mail/             SMTP sending (nodemailer); simulated in development without SMTP_HOST
    services/dapta/            sends leads to the Dapta flow (Flow Studio); simulated in development without DAPTA_FLOW_URL
    types/ · utils/
  prisma/                      schema.prisma (source of truth), migrations and seed.ts (initial users and templates)
  __test__/                    tests, mirroring src/
```

### Web (`apps/web`) — Screaming Architecture

React Router v8 in framework mode, `appDirectory: "src"`, SPA pre-rendered at build time (`/`, `/login`, `/contacted`, `/templates`, `/metrics`, `/sources`, `/robots.txt`). Data is loaded in the browser (`clientLoader` and hooks) because it depends on the user's session and the database.

```
apps/web/src/
  root.tsx                     <html>, container, ErrorBoundary
  routes.ts                    the only place where URLs are defined
  seo/robots.ts                /robots.txt (noindex: internal tool)
  modules/
    auth/                      "/login" and the layout that protects the other pages (header with the user, logout)
      components/ hooks/ services/ types.ts login-route.tsx protected-layout.tsx index.ts
    searches/                  "/" — form, summary per source, POST /api/searches
      components/ hooks/ services/ store/ types.ts route.tsx index.ts
    leads/                     paginated table, CSV; "/contacted" route (by member and by status)
      components/ hooks/ services/ types.ts contacted-route.tsx index.ts
    contact/                   side panel to contact a lead: email, WhatsApp, call, reply, history
      components/ hooks/ services/ types.ts statuses.ts index.ts
    templates/                 "/templates" — create and edit reusable messages
      components/ route.tsx
    metrics/                   "/metrics" — CPL per source and channel, cost vs. quality chart, costs of the period
      components/ services/ types.ts format.ts route.tsx
    sources/                   "/sources" — turn each source on or off
    catalog/                   categories, departments, municipalities (no route of its own)
      hooks/ services/ types.ts index.ts
  shared/
    ui/ layout/ seo/ lib/ (http.ts, session-store.ts…) hooks/ styles/
```

Rules (enforced by `oxlint`, see `apps/web/.oxlintrc.json`):

1. Outside a module, import only from `@/modules/<name>` (its `index.ts`), never deep paths.
2. `shared/` does not import from `modules/`, `seo/` or `root`.
3. `root.tsx`, `routes.ts` and `seo/` only compose.
4. New domain = new folder in `modules/` with its `route.tsx`, registered in `routes.ts`.
5. A component used by one module → its `components/`; by two or more → `shared/ui/`.
6. HTTP calls live in each module's `services/` and use `shared/lib/http.ts` (`VITE_API_URL`, empty = same origin).

## Requirements

- Node.js **22.22 or later**
- pnpm (`corepack enable` uses the version pinned in `packageManager`)
- PostgreSQL 14+ (or Docker to start one with `docker compose`)

## Getting started

```bash
corepack enable                          # once: enables pnpm
pnpm install                             # the whole monorepo; it also generates the Prisma client
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and JWT_SECRET
pnpm db:up                               # optional: local Postgres with the leads and leads_test databases
pnpm db:deploy                           # creates the tables
pnpm db:seed                             # creates the initial users and templates
pnpm dev                                 # API on :3000 and web on :5173 (Vite proxies /api)
```

- Frontend in development: <http://localhost:5173>
- Interactive documentation (Swagger): <http://localhost:3000/api/docs>

Production: `pnpm build && pnpm start`. The API serves the built frontend from the root (<http://localhost:3000>) and the API under `/api`.

For a single app: `pnpm dev:api`, `pnpm dev:web`, or `pnpm --filter @leads-colombia/web <script>`. To add a dependency: `pnpm --filter @leads-colombia/web add <package>`.

> **Coming from the Spanish version?** The database schema changed (tables, columns and enums are now in English) and there is a single new initial migration. Start from an empty database: drop it (or run `pnpm --filter @leads-colombia/api exec prisma migrate reset`), then `pnpm db:deploy` and `pnpm db:seed`. The environment variables were renamed too (see `apps/api/.env.example`).

## Users and login

The whole app and the whole API (except `POST /api/auth/login`) require a session. The seed (`pnpm db:seed`) creates:

| Email | Name | Role |
|---|---|---|
| `andres@gmail.com` | Andres Saray | `SERVICE` |
| `camila@gmail.com` | Camila Rojas | `SERVICE` |
| `admin@gmail.com` | Administrador | `ADMIN` |

All three with the password `Andres1234*` (stored only as a bcrypt hash). Change it with `SEED_PASSWORD` before running the seed if the server is not only yours. The seed can be repeated: it updates name and role, but does not touch the password of an existing user.

- **Contact**: the lead is assigned to whoever writes to it or calls it first (`contactedById`, `contactedAt`). From then on only that person (or an `ADMIN`) writes to it and records its replies; the rest get 409 with their name. Details in [Lead outreach](#lead-outreach).
- **Contacted** page: a status selector (no reply, replied, interested, not interested, bounced; `?status=` in the URL) and a members selector filter the list. The members one filters by person (`GET /api/users/members`: active users without the `ADMIN` role, with how many leads each one contacted) or shows the whole team. A `SERVICE` user starts with their own; an `ADMIN`, with the whole team. The choice stays in the URL (`?member=<id>` or `?member=all`).
- **ADMIN**: in addition to all of the above, can see the full list of users (`GET /api/users`). They do not appear in the members selector.

From the terminal:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"andres@gmail.com","password":"Andres1234*"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
```

and on every request: `-H "Authorization: Bearer $TOKEN"`. The session lasts `JWT_EXPIRES_IN` (12 h by default).

## Usage

### Search a city's leads

```bash
curl -X POST http://localhost:3000/api/searches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"city": "Rionegro", "department": "Antioquia", "category": "hotel"}'
```

| Field | Example | Note |
|---|---|---|
| `city` | `"Medellín"`, `"bogota"`, `"cali"` | Required if you do not send `code` |
| `department` | `"Meta"`, `"50"` | Needed when the name repeats (Granada is in 3 departments) |
| `code` | `"05615"` | DIVIPOLA code, instead of `city` |
| `category` | `"hardware"`, `"restaurant"` | See `GET /api/catalog/categories`. Without a category it returns every business |
| `ciiu` / `osm` | `["4752"]` / `["shop=hardware"]` | Extra filters for DANE and OpenStreetMap |
| `sources` | `["rnt","secop"]` | All of them by default |
| `includeIndividuals` | `true` | `false` by default. See "Personal data" |
| `leadsLimit` | `500` | Leads included in the response (200 by default) |
| `async` | `true` | Responds right away (202) with the `searchId` and processes in the background. See below |
| `refresh` | `true` | Ignores the cache and queries every source again |

Every response uses the same envelope:

```jsonc
// success
{ "status": 201, "data": { "searchId": 1, "status": "complete", "summary": { ... }, "leadsTotal": 34, "leads": [ ... ] } }
// error (messages are in Spanish: they are shown to the sales team)
{ "status": 409, "error": "Hay 3 municipios llamados \"Granada\"...", "details": { "candidates": [ ... ] } }
```

`summary.bySource` tells, for each source, how many records it brought, how many new leads it created, how many it completed (`enriched`), how long it took and whether it failed (`status: error`) or did not apply to the category (`status: skipped`). If a source fails, the rest are stored anyway (`status: partial`); if every source fails, it responds 502.

### Background search (recommended)

With `"async": true` the API does not wait for the slowest source:

```bash
curl -X POST http://localhost:3000/api/searches -H "Content-Type: application/json" \
  -d '{"code": "05615", "category": "hotel", "async": true}'
# → 202 { "data": { "searchId": 12, "status": "in_progress", "queued": 0, ... } }

curl http://localhost:3000/api/searches/12   # repeat until status ≠ "in_progress"
```

The web app uses this mode and polls the status every 2 s. If the server restarts in the middle of a search, it is marked as `failed` at startup.

### Other endpoints

| Route | Purpose |
|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` | Log in (returns the token) and see the current user |
| `GET /api/users` | List of users (`ADMIN` only) |
| `GET /api/users/members` | Team members (active, no `ADMIN`) with their number of contacted leads. Any user with a session |
| `GET /api/leads` | Stored leads. Filters: `search`, `municipality`, `department`, `category`, `source`, `contactable`, `contacted`, `status` (one or more, comma separated), `quality`, `mine` (only the ones I contacted), `contacted_by` (user id), `in_both`, `individuals`, `q`, `limit`, `page` |
| `POST /api/leads/:id/mark-contacted` | Marks the lead as contacted outside the platform, without a message (409 if someone else already contacted it). The web app no longer uses it: it was replaced by the contact panel |
| `GET /api/leads/export.csv` | The same as CSV (opens in Excel with accents; headers in Spanish) |
| `GET /api/leads/:id` | A lead with each occurrence in each source and how it was matched |
| `GET /api/leads/stats` | Leads, contactable and attributed leads per source (input for the CPL per channel) |
| `GET /api/searches` · `GET /api/searches/:id` | History and detail per source |
| `GET /api/catalog/categories` · `departments` · `municipalities` · `sources` | Catalogs |

## Lead outreach

From a search table or from **Contacted**, the **Contactar** (or **Ver**) button opens a panel with everything about the lead:

| Channel | What the platform does |
|---|---|
| **Email** | **Sends** it through SMTP with the chosen template already filled (editable). It only adds a footer with who is writing and how to unsubscribe. Replies go to the salesperson's email (`Reply-To`). |
| **WhatsApp** | Opens `wa.me` with the message written and **records** it. It does not use the WhatsApp Business API (which requires templates approved by Meta and charges per conversation). |
| **Call** | Button to dial (`tel:`), the template script and a note; the call is **recorded**. |

Then **how it replied** is recorded: *Respondió*, *Interesado*, *No interesado* or *Rebotó*. Each lead has its funnel status:

```
PENDING → CONTACTED (no reply) → REPLIED / INTERESTED / NOT_INTERESTED / BOUNCED
```

Besides the status, `lastContactedAt`, `repliedAt` (first reply; a bounce does not count) and the full **history** (`interactions`) are stored: channel, direction (outbound/inbound), who, to which email or number, subject, message, note, result and the error if the email did not go out. The reply rate and the CPL per channel (point 3) are calculated from this.

**Templates** (`/templates`): reusable messages per channel with the variables `{{nombre}}`, `{{municipio}}`, `{{departamento}}`, `{{categoria}}`, `{{remitente}}` and `{{empresa}}` (in Spanish, because the team types them in its messages). A misspelled variable is rejected on save. They are edited by whoever created them or an `ADMIN`; they are not deleted, they are deactivated (the history keeps which one was used).

### Rules

- **Ley 2300 de 2023** (`CONTACT_LEGAL_HOURS=true` by default), while the lead has not replied:
  - only **Monday to Friday from 7 a.m. to 7 p.m. and Saturdays from 8 a.m. to 3 p.m.**, never on Sundays or holidays (Colombian holidays are calculated, including Ley Emiliani), always in Colombia time;
  - **one contact per day**;
  - **a single channel per week** (Monday to Sunday): if you emailed this week, keep using email or wait until Monday.

  Once the lead replies (*Respondió* or *Interesado*), the lead asked for the conversation and these rules no longer limit it. The panel explains why it cannot be contacted and disables the button; the API responds **422** with `details.rule`.
- **Do not contact again** (Ley 1581 and art. 5 of Ley 2300): each email carries a signed link (`/api/unsubscribe/<token>`, no session) and the `List-Unsubscribe` headers for the "Unsubscribe" button in Gmail and Outlook. If the lead asks through another channel, it is marked by hand in the panel. A marked or *No interesado* lead cannot be contacted again (**409**). Without `PUBLIC_URL`, the footer asks the recipient to reply BAJA and it has to be marked by hand.
- **One lead, one owner**: it is worked by whoever contacted it first; an `ADMIN` can write to it without taking it over.
- If SMTP rejects the email, the API responds **502**, it is recorded in the history as *Falló* and it does not count as a contact.

> Ley 2300 protects consumers; its scope for businesses (B2B) is not entirely clear. The platform applies it anyway, to be safe. Confirm it with someone from legal before turning it off.

### Email setup

Variables in `apps/api/.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Mail server. Without `SMTP_HOST`, in development emails are **simulated** (recorded, not sent, and the panel says so); in production they are not sent. |
| `EMAIL_FROM` | `"Ventas Mi Empresa <ventas@miempresa.co>"`. Use your own domain with SPF and DKIM, or emails will end up in spam. |
| `EMAIL_REPLY_TO` | Where replies arrive (the salesperson's email by default). |
| `COMPANY_NAME` | Signature of the messages and the `{{empresa}}` variable. |
| `PUBLIC_URL` | Public URL of the API, for the unsubscribe link. |
| `CONTACT_LEGAL_HOURS` | `false` only to test outside legal hours in development. |

### Endpoints

| Route | Purpose |
|---|---|
| `GET /api/leads/:id/contact` | Contact sheet: status, history, emails and numbers per channel, and whether it can be contacted now (`permission.reason`, `permission.byChannel`) |
| `POST /api/leads/:id/contact/preview` | Fills a template (`templateId`) or a text with the lead's data |
| `POST /api/leads/:id/email` | Sends an email (`to`, `subject`, `message`, `templateId`) |
| `POST /api/leads/:id/interactions` | Records a WhatsApp message, a call or another contact (`channel`, `destination`, `message`, `note`) |
| `POST /api/leads/:id/reply` | Records the reply (`channel`, `result`: `REPLIED` · `INTERESTED` · `NOT_INTERESTED` · `BOUNCED`, `note`) |
| `POST /api/leads/:id/do-not-contact` | The lead asked not to be contacted again |
| `GET·POST /api/unsubscribe/:token` | Public unsubscribe link of the emails (GET shows the button; POST unsubscribes) |
| `GET·POST /api/templates` · `GET·PATCH /api/templates/:id` · `GET /api/templates/variables` | Templates |

**Not yet:** reading email replies automatically (IMAP or provider webhooks) or the bounces that arrive after sending. For now they are recorded by hand from the panel.

## Measure: CPL per channel

The **Métricas** page shows, for a period (the current month by default), how much each lead cost according to the **source** where it was found (DANE, OSM, RNT, SECOP, REPS) and the **channel** it was contacted through (email, WhatsApp, calls, Dapta), along with the funnel (contacted, replied) and the quality.

**Costs.** An `ADMIN` records them on the same page (`/api/costs`): what they are charged to (a source, a contact channel or `general`), the period they cover and the amount. They can also be **team hours** (hours × hourly rate). Examples: the server → `general`; the Brevo plan → `email`; Dapta minutes → `dapta`; hours reviewing the RNT → `rnt`.

**How it is split** (all in `apps/api/src/modules/metrics/domain/metrics.calculation.ts`, with tests):

- Each cost is prorated by days: if it covers a month and the period takes 10 days, it counts a third.
- **Cost of a source** = what was charged to it + the `general` costs split according to how many new leads each source brought + the cost of each contact channel split according to how many of its leads were contacted through that channel.
- **CPL of a source** = its cost / its new leads of the period (attributed to the first source that brought them, `originSource`).
- **Per contact channel**: channel cost / contacted leads, / leads that replied and / high-quality leads.
- What cannot be split (a channel with cost but no contacts in the period) is added to the total cost and reported.

| Route | Purpose |
|---|---|
| `GET /api/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Totals, `bySource`, `byChannel` and costs of the period |
| `GET /api/costs` · `POST /api/costs` · `PATCH·DELETE /api/costs/:id` | Costs (read: everyone; write: `ADMIN` only) |

## Qualify with Dapta

Dapta qualifies each lead, and the **Métricas** page compares sources and channels **by cost and by quality** (cost per lead vs. quality chart: the best ones end up top left).

```
Platform ── POST (lead + reference) ──▶ Dapta flow (Flow Studio)
                                            │  the voice agent calls the lead and qualifies it
Platform ◀── POST /api/dapta/webhook ───────┘  (qualification + reference)
```

**Send.** From a lead's panel (**Enviar a Dapta**) or in batch from **Contacted** (filter "Sin calificar" and **Enviar a Dapta**: it sends the page's leads, up to 100). The platform makes a `POST` to `DAPTA_FLOW_URL` with:

```json
{ "reference": "8f1c…", "lead_id": 12, "contact_name": "Hotel Ejemplo", "contact_phone": "+573001112233",
  "contact_email": "hola@hotel.co", "municipality": "RIONEGRO", "department": "Antioquia",
  "category": "Hoteles y alojamiento", "source": "rnt", "contact_status": "CONTACTED",
  "callback_url": "https://your-domain/api/dapta/webhook" }
```

**Receive.** At the end of the flow, an HTTP node sends the result to `POST /api/dapta/webhook` with the secret (`x-dapta-secret: <DAPTA_WEBHOOK_SECRET>`, or `?token=` in the URL if the node does not allow headers):

```json
{ "reference": "8f1c…", "quality": "high", "score": 82, "summary": "Quiere una demo el jueves",
  "variables": { "demo_booked": true }, "call_id": "abc123" }
```

- `quality`: `high`, `medium`, `low` or `discarded` (it also accepts `alta/media/baja/descartado` and `hot/warm/cold`). If only `score` (0–100) comes: ≥70 high, ≥40 medium, otherwise low.
- If there was no conversation, send `"call_status": "no_answer"` (or `voicemail`, `busy`…) without a quality: it is recorded as *Dapta no logró hablar con el lead*.
- Spanish field names are also accepted (`referencia`, `calificacion`/`calidad`, `puntaje`, `resumen`, `estado_llamada`, `llamada_id`), as well as `call_summary`, to map Dapta's variables directly.

**Rules.**

- If the flow **calls** the lead (`DAPTA_CALLS=true`, the default), the dispatch counts as a call: the same rules as any contact apply (do not contact, lead owner and Ley 2300; for the "one channel per week" rule a Dapta call is a call), and it is recorded in the history with the *Agente de Dapta* channel. If the agent talks to the lead, the funnel advances (high quality → *Interesado*; medium or low → *Respondió*).
- If the flow only qualifies with the data (`DAPTA_CALLS=false`), the contact rules do not apply and the funnel does not change.
- A dispatched lead is not sent again while it waits for its result (72 h at most). If Dapta does not receive the lead, it is recorded as *No se pudo enviar* and it does not count as a contact.
- A lead can also be **qualified manually** from the panel (whoever works the lead or an `ADMIN`).
- The lead keeps its latest qualification (`quality`, `score`); in Contacted it can be filtered by quality (`?quality=HIGH`, `NONE` = not qualified).

**Quality index** (0–100) to compare: the score; without a score, high = 85, medium = 60, low = 30, discarded = 0.

| Variable | Purpose |
|---|---|
| `DAPTA_FLOW_URL` | Flow trigger URL (Public Route, with the authentication in the URL). Without it, in development dispatches are **simulated**. |
| `DAPTA_WEBHOOK_SECRET` | Webhook secret. Without it, the webhook accepts nothing (503). |
| `DAPTA_CALLS` | `true` if the flow calls the lead (default). |
| `PUBLIC_URL` | To send Dapta the `callback_url`. |

| Route | Purpose |
|---|---|
| `POST /api/leads/:id/dapta` | Sends a lead to Dapta |
| `POST /api/dapta/dispatches` | Sends several (`{ "leadIds": [1, 2, 3] }`): returns sent and skipped with their reason |
| `POST /api/dapta/webhook` | Flow result (no session, with secret) |
| `GET /api/leads/:id/qualifications` · `POST /api/leads/:id/qualification` | Qualification history · qualify manually |
| `GET /api/dapta/status` | Whether the integration is active, simulated or disabled |

> Dapta does not publish a fixed schema for its call results: whoever configures the flow builds it. That is why the webhook accepts several field names. When setting up the flow, use Dapta's **Test with last call** to check that the result arrives correctly.

## How it avoids duplicates

Each incoming business is compared with what is already stored **in the same municipality**, in this order:

1. **Same record from the same source** (repeated searches).
2. **Same NIT.** DANE, RNT, SECOP and REPS include the NIT: matching between them is exact.
3. **Same phone, email or web domain**, if the name or location is compatible (so businesses that share a number are not merged).
4. **Same street number** across different sources: `KR 51 47 25` = `Carrera 51 # 47-25` = `CR 51 CL 47 25`. This merges different legal and trade names. Only if there is a single business with that street number in the municipality (a shopping mall does not count).
5. **Similar name** and proximity on the map; without coordinates, 2+ distinctive words in common and a single candidate. Suffixes (S.A.S., Ltda.), generic words ("hotel", "ferretería") and the municipality name are ignored.

If it matches, the lead is **completed** (data is never deleted). Phones are normalized to `+57` and 10 digits (old 7-digit landlines are completed with the department's area code; extensions are dropped). `originSource` stores the first source that brought the lead, to attribute the CPL.

Processing order within a search: DANE → RNT → REPS → SECOP → OSM.

## Personal data

RNT, SECOP and REPS include individuals (tourist homes, contractors, independent professionals). Their email and mobile number are **personal data** under Ley 1581 de 2012. That is why, by default, the server only stores companies:

- REPS: `tipoid = NI`
- SECOP: excludes `PERSONA NATURAL`
- RNT: only 9-digit NITs starting with 8 or 9

With `includeIndividuals: true` it stores them too, marked with `isIndividual: true`. Before contacting them, check with someone from legal how you will comply with the law.

## Timing and limits

- **Cache:** each source's result is kept in memory per municipality + filters for `SOURCE_CACHE_MINUTES` (1440 = 24 h; `0` turns it off; at most `SOURCE_CACHE_MAX` entries). Repeating a search takes seconds; `meta.cache: true` says so. It is cleared when the server restarts. Failing sources are not cached.
- **Per-source limit:** no source can delay the search more than `SOURCE_MAX_MS` (150 s); after that it is marked as `error` and the rest are stored.
- OpenStreetMap takes 20–60 s per search. Each Overpass server has `OSM_TIMEOUT_MS` (60 s) and the whole source, with retries and the radius search, `OSM_BUDGET_MS` (100 s). If a server responds 429/504, it tries the next one while there is time left.
- DANE queries the category's CIIU codes `DANE_PARALLEL_QUERIES` (3) at a time and retries once if it responds 5xx.
- Login accepts `LOGIN_PER_MINUTE` attempts per IP (10 by default).
- Searches are served **one at a time** (at most 5 queued) and there is a per-IP limit (`SEARCHES_PER_MINUTE`).
- datos.gov.co is paged 5,000 rows at a time up to `DATOS_GOV_MAX_RECORDS` (20,000 by default); `meta.truncated` says if it was cut. With `DATOS_GOV_APP_TOKEN` (free) the query limit goes up.
- Without a category in large cities, DANE can return too many records; the server stops at 60 MB and asks for a filter.

## Tests

```bash
cp apps/api/.env.test.example apps/api/.env.test   # points to a disposable database
pnpm db:test:deploy              # creates the tables in the test database
pnpm test                        # API and web (repository tests are skipped without .env.test)
pnpm test:unit                   # without a database (API unit tests + web)
pnpm test:web                    # frontend only (Vitest)
pnpm --filter @leads-colombia/web test:watch      # web in watch mode
pnpm --filter @leads-colombia/web test:coverage   # web with coverage (apps/web/coverage)
pnpm typecheck && pnpm lint      # types of both apps and the frontend architecture rules
```

`apps/api/__test__/` mirrors `src/`:

- `modules/<module>/domain`: business rules with in-memory repositories (`__test__/mocks`).
- `modules/<module>/controller`: HTTP with supertest and the simulated domain.
- `modules/<module>/repository` and `e2e/`: against real PostgreSQL.
- `services/sources`: each source with responses that have the real shape of each service.

`apps/web/__test__/` also mirrors `src/` (Vitest + Testing Library + jsdom, config in `apps/web/vitest.config.ts`):

- `shared/`: HTTP client, session, utilities and UI components.
- `modules/<module>/`: services, stores, hooks, components and pages, with a simulated `fetch` (`__test__/helpers/http.ts`) that responds with the API's `{ status, data }` envelope.
- Pages that use the router are mounted with React Router's `createRoutesStub`.
- Tests can import a module's internals (in `.oxlintrc.json` the public-imports rule is turned off only in `__test__/`).

## Warnings

- The DANE service is the one behind its [public geoviewer](https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/), but **it is not a documented API**: if it changes, `apps/api/src/services/sources/dane.ts` has to be adjusted. Only validated numeric codes are sent to it.
- OpenStreetMap data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright) license. If you share the data, give that attribution.
- RNT, SECOP II and REPS: [datos.gov.co](https://www.datos.gov.co) (datasets `thwd-ivmp`, `qmzu-gj57`, `c36g-9fc2`).

## Adding a source or a category

- **Category:** an entry in `apps/api/src/config/catalog/categories.ts`.
- **Source:** a file in `apps/api/src/services/sources/` that implements `LeadSource` (`~types/source.types`), registered in `services/sources/index.ts`; add its name to `BUILT_IN_SOURCES` and its place in `PROCESS_ORDER` (`modules/searches/domain/searches.domain.ts`).
