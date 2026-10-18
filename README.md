# Leads Colombia · v2

Monorepo con una API en Node.js + TypeScript y un frontend en React Router. La API, con solo el nombre de una ciudad, busca negocios en **cinco fuentes públicas y gratuitas**, los cruza, elimina duplicados y los guarda en **PostgreSQL**.

| Fuente | Qué aporta | Cuándo se consulta |
|---|---|---|
| **DANE** – Registro Estadístico de Empresas | Empresas jurídicas activas: NIT, razón social, dirección, CIIU, coordenadas. **Sin teléfono ni correo** | Siempre |
| **OpenStreetMap** (Overpass) | Nombre comercial, coordenadas del local y, a veces, teléfono, WhatsApp, web, redes | Siempre |
| **RNT** – Registro Nacional de Turismo | NIT, dirección, celular, teléfono y correo de prestadores turísticos | Categorías turísticas (hotel, restaurante, bar, agencia de viajes, transporte) o sin categoría |
| **SECOP II** – Proveedores Registrados | NIT, teléfono, correo y sitio web de empresas que le venden al Estado | Categorías con código UNSPSC equivalente o sin categoría |
| **REPS** – Prestadores de salud | NIT, dirección, teléfono y correo de cada sede | Salud y odontología o sin categoría |

Cuando un negocio aparece en varias fuentes, queda **un solo lead** con el NIT de una y el contacto de otra.

Después, el equipo **contacta** los leads desde la plataforma (correo por SMTP; WhatsApp y llamadas registrados), anota **quién respondió** y cómo, y todo queda en el historial de cada lead (ver [Contactar leads](#contactar-leads)). Con los costos de cada canal la plataforma calcula el **CPL** por fuente y por canal ([Medir](#medir-cpl-por-canal)), y **Dapta** califica cada lead para comparar los canales por costo y por calidad ([Calificar con Dapta](#calificar-con-dapta)).


## Monorepo (pnpm workspaces)

```
leads-colombia/
  package.json            scripts globales (pnpm dev, build, test…)
  pnpm-workspace.yaml     apps/*
  docker-compose.yml      Postgres local (bases leads y leads_test)
  docker/init.sql
  apps/
    api/                  @leads-colombia/api — Express + Prisma (antes en la raíz)
    web/                  @leads-colombia/web — React Router v8 (reemplaza public/index.html)
```

### API (`apps/api`)

Arquitectura por capas con módulos por dominio: `Router → Controller → Domain → Repository → Prisma/PostgreSQL`. Las fuentes externas viven en `services/fuentes` y las usa el dominio de búsquedas.

```
apps/api/
  src/
    index.ts                   arranque: carga .env, valida el entorno, levanta el servidor
    config/
      app.ts                   middlewares, rutas, errorHandler; en producción sirve apps/web/build/client
      environment.ts           variables de entorno (falla rápido si falta DATABASE_URL o JWT_SECRET)
      db/client.ts             única instancia de PrismaClient
      helpers/response/        HttpCode, AppError, handleSuccess / handleError / handleFile, handleValidator
      logger/                  pino
      swagger.ts               definición OpenAPI compartida (recoge modules/**/dosc)
      catalogo/categorias.ts   categoría ↔ CIIU ↔ etiquetas OSM ↔ RNT ↔ UNSPSC ↔ REPS
    middlewares/               verifyAuth (sesión JWT) + requireRol, y errorHandler
    modules/                   auth · usuarios · busquedas · leads · catalogo · contactos · plantillas · costos · metricas · calificaciones
      router.ts · controller/ · domain/ · repository/ · types/ · validator/ · dosc/
    services/fuentes/          dane, osm, rnt, secop, reps, cliente de datos.gov.co
    services/correo/           envío por SMTP (nodemailer); simulado en desarrollo si no hay SMTP_HOST
    services/dapta/            envío de leads al flujo de Dapta (Flow Studio); simulado en desarrollo si no hay DAPTA_FLOW_URL
    types/ · utils/
  prisma/                      schema.prisma (fuente de verdad), migraciones y seed.ts (usuarios y plantillas iniciales)
  __test__/                    pruebas, espejo de src/
```

### Web (`apps/web`) — Screaming Architecture

React Router v8 en framework mode, `appDirectory: "src"`, SPA con pre-render en build (`/`, `/login`, `/contactados`, `/plantillas`, `/metricas`, `/robots.txt`). Los datos se cargan en el navegador (`clientLoader` y hooks) porque dependen de la sesión del usuario y de la base.

```
apps/web/src/
  root.tsx                     <html>, contenedor, ErrorBoundary
  routes.ts                    único lugar donde se definen las URLs
  seo/robots.ts                /robots.txt (noindex: herramienta interna)
  modules/
    auth/                      "/login" y el layout que protege las demás páginas (encabezado con el usuario, cerrar sesión)
      components/ services/ types.ts login-route.tsx protected-layout.tsx index.ts
    busquedas/                 "/" — formulario, resumen por fuente, POST /api/busquedas
      components/ hooks/ services/ types.ts route.tsx index.ts
    leads/                     tabla paginada, CSV; ruta "/contactados" (por miembro y por estado)
      components/ hooks/ services/ types.ts contactados-route.tsx index.ts
    contacto/                  panel lateral para contactar un lead: correo, WhatsApp, llamada, respuesta, historial
      components/ hooks/ services/ types.ts estados.ts index.ts
    plantillas/                "/plantillas" — crear y editar los mensajes reutilizables
      components/ route.tsx
    metricas/                  "/metricas" — CPL por fuente y canal, gráfico costo vs. calidad, costos del periodo
      components/ services/ types.ts formato.ts route.tsx
    catalogo/                  categorías, departamentos, municipios (sin ruta propia)
      hooks/ services/ types.ts index.ts
  shared/
    ui/ layout/ seo/ lib/ (http.ts, session-store.ts…) hooks/ styles/
```

Reglas (las hace cumplir `oxlint`, ver `apps/web/.oxlintrc.json`):

1. Fuera de un módulo se importa solo desde `@/modules/<nombre>` (su `index.ts`), nunca rutas profundas.
2. `shared/` no importa de `modules/`, `seo/` ni `root`.
3. `root.tsx`, `routes.ts` y `seo/` solo componen.
4. Nuevo dominio = nueva carpeta en `modules/` con su `route.tsx`, registrada en `routes.ts`.
5. Componente usado por un módulo → su `components/`; por dos o más → `shared/ui/`.
6. Las llamadas HTTP viven en `services/` de cada módulo y usan `shared/lib/http.ts` (`VITE_API_URL`, vacía = mismo origen).

## Requisitos

- Node.js **22.22 o superior**
- pnpm (`corepack enable` usa la versión fijada en `packageManager`)
- PostgreSQL 14+ (o Docker para levantar uno con `docker compose`)

## Puesta en marcha

```bash
corepack enable                          # una vez: activa pnpm
pnpm install                             # todo el monorepo; también genera el cliente de Prisma
cp apps/api/.env.example apps/api/.env   # ajusta DATABASE_URL y JWT_SECRET
pnpm db:up                               # opcional: Postgres local con las bases leads y leads_test
pnpm db:deploy                           # crea las tablas
pnpm db:seed                             # crea los usuarios y las plantillas iniciales
pnpm dev                                 # API en :3000 y web en :5173 (Vite hace proxy de /api)
```

- Frontend en desarrollo: <http://localhost:5173>
- Documentación interactiva (Swagger): <http://localhost:3000/api/docs>

Producción: `pnpm build && pnpm start`. La API sirve el frontend compilado desde la raíz (<http://localhost:3000>) y la API en `/api`.

Para una sola app: `pnpm dev:api`, `pnpm dev:web`, o `pnpm --filter @leads-colombia/web <script>`. Para agregar una dependencia: `pnpm --filter @leads-colombia/web add <paquete>`.

> La migración inicial se escribió y verificó contra PostgreSQL 16. Si `pnpm db:migrate` te propone una migración nueva justo después de instalar, acéptala: es solo un ajuste de formato de Prisma.

## Usuarios y login

Toda la app y toda la API (salvo `POST /api/auth/login`) piden sesión. El seed (`pnpm db:seed`) crea:

| Correo | Nombre | Rol |
|---|---|---|
| `andres@gmail.com` | Andres Saray | `SERVICE` |
| `camila@gmail.com` | Camila Rojas | `SERVICE` |
| `admin@gmail.com` | Administrador | `ADMIN` |

Los tres con la contraseña `Andres1234*` (guardada solo como hash bcrypt). Cámbiala con `SEED_PASSWORD` antes de correr el seed si el servidor no es solo tuyo. El seed se puede repetir: actualiza nombre y rol, pero no toca la contraseña de un usuario que ya existe.

- **Contactar**: el lead queda asignado a quien le escribe o lo llama primero (`contactadoPorId`, `contactadoEn`). Desde ahí solo esa persona (o un `ADMIN`) le escribe y registra sus respuestas; los demás reciben 409 con su nombre. Detalle en [Contactar leads](#contactar-leads).
- **Contactados**: un selector de estado (sin respuesta, respondieron, interesados, no interesados, rebotaron; `?estado=` en la URL) y uno de miembros filtran la lista. El de miembros filtra por persona (`GET /api/usuarios/miembros`: usuarios activos sin rol `ADMIN`, con cuántos leads contactó cada uno) o muestra todo el equipo. Si tu rol es `SERVICE` arranca en los tuyos; si es `ADMIN`, en todo el equipo. La elección queda en la URL (`?miembro=<id>` o `?miembro=todos`).
- **ADMIN**: además de todo lo anterior, puede ver la lista completa de usuarios (`GET /api/usuarios`). No aparece en el selector de miembros.

Desde la terminal:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"andres@gmail.com","password":"Andres1234*"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
```

y en cada petición: `-H "Authorization: Bearer $TOKEN"`. La sesión dura `JWT_EXPIRES_IN` (12 h por defecto).

## Uso

### Buscar leads de una ciudad

```bash
curl -X POST http://localhost:3000/api/busquedas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ciudad": "Rionegro", "departamento": "Antioquia", "categoria": "hoteles"}'
```

| Campo | Ejemplo | Nota |
|---|---|---|
| `ciudad` | `"Medellín"`, `"bogota"`, `"cali"` | Obligatorio si no envías `codigo` |
| `departamento` | `"Meta"`, `"50"` | Necesario si el nombre se repite (Granada está en 3 departamentos) |
| `codigo` | `"05615"` | Código DIVIPOLA, en lugar de `ciudad` |
| `categoria` | `"ferreteria"`, `"restaurantes"` | Ver `GET /api/catalogo/categorias`. Sin categoría trae todos los negocios |
| `ciiu` / `osm` | `["4752"]` / `["shop=hardware"]` | Filtros extra para el DANE y OpenStreetMap |
| `fuentes` | `["rnt","secop"]` | Por defecto, todas |
| `incluirPersonasNaturales` | `true` | Por defecto `false`. Ver "Datos personales" |
| `limiteLeads` | `500` | Leads incluidos en la respuesta (por defecto 200) |
| `asincrona` | `true` | Responde de inmediato (202) con el `busquedaId` y procesa en segundo plano. Ver abajo |
| `refrescar` | `true` | Ignora la caché y vuelve a consultar todas las fuentes |

Todas las respuestas usan el mismo sobre:

```jsonc
// éxito
{ "status": 201, "data": { "busquedaId": 1, "estado": "completa", "resumen": { ... }, "leadsTotal": 34, "leads": [ ... ] } }
// error
{ "status": 409, "error": "Hay 3 municipios llamados \"Granada\"...", "details": { "candidatos": [ ... ] } }
```

`resumen.porFuente` dice, para cada fuente, cuántos registros trajo, cuántos leads nuevos creó, cuántos completó (`enriquecidos`), cuánto tardó y si falló (`estado: error`) o no aplicaba a la categoría (`estado: omitida`). Si una fuente falla, las demás igual se guardan (`estado: parcial`); si fallan todas, responde 502.

### Búsqueda en segundo plano (recomendado)

Con `"asincrona": true` la API no se queda esperando a la fuente más lenta:

```bash
curl -X POST http://localhost:3000/api/busquedas -H "Content-Type: application/json" \
  -d '{"codigo": "05615", "categoria": "hoteles", "asincrona": true}'
# → 202 { "data": { "busquedaId": 12, "estado": "en_curso", "enCola": 0, ... } }

curl http://localhost:3000/api/busquedas/12   # repetir hasta que estado ≠ "en_curso"
```

La web usa este modo y consulta el estado cada 2 s. Si el servidor se reinicia a mitad de una búsqueda, al arrancar la marca como `fallida`.

### Otros endpoints

| Ruta | Para qué |
|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` | Iniciar sesión (devuelve el token) y ver el usuario actual |
| `GET /api/usuarios` | Lista de usuarios (solo `ADMIN`) |
| `GET /api/usuarios/miembros` | Miembros del equipo (activos, sin `ADMIN`) con su número de leads contactados. Cualquier usuario con sesión |
| `GET /api/leads` | Leads guardados. Filtros: `busqueda`, `municipio`, `departamento`, `categoria`, `fuente`, `contactable`, `contactado`, `estado` (uno o varios separados por coma), `mios` (solo los que contacté), `contactado_por` (id de usuario), `en_ambas`, `personas_naturales`, `q`, `limite`, `pagina` |
| `POST /api/leads/:id/contactar` | Marca el lead como contactado por fuera de la plataforma, sin mensaje (409 si ya lo contactó otra persona). La web ya no lo usa: se reemplazó por el panel de contacto |
| `GET /api/leads/export.csv` | Lo mismo en CSV (abre en Excel con tildes) |
| `GET /api/leads/:id` | Un lead con cada aparición en cada fuente y cómo se cruzó |
| `GET /api/leads/estadisticas` | Leads, contactables y atribuidos por fuente (insumo del CPL por canal) |
| `GET /api/busquedas` · `GET /api/busquedas/:id` | Historial y detalle por fuente |
| `GET /api/catalogo/categorias` · `municipios` · `fuentes` | Catálogos |

## Contactar leads

Desde la tabla de una búsqueda o desde **Contactados**, el botón **Contactar** (o **Ver**) abre un panel con todo lo del lead:

| Canal | Qué hace la plataforma |
|---|---|
| **Correo** | Lo **envía** por SMTP con la plantilla elegida ya rellenada (editable). Agrega solo un pie con quién escribe y cómo darse de baja. Las respuestas llegan al correo del vendedor (`Reply-To`). |
| **WhatsApp** | Abre `wa.me` con el mensaje escrito y lo **registra**. No usa la API de WhatsApp Business (que exige plantillas aprobadas por Meta y cobra por conversación). |
| **Llamada** | Botón para marcar (`tel:`), el guion de la plantilla y una nota; la llamada queda **registrada**. |

Luego se registra **cómo respondió**: *Respondió*, *Interesado*, *No interesado* o *Rebotó*. Cada lead tiene su estado en el embudo:

```
PENDIENTE → CONTACTADO (sin respuesta) → RESPONDIO / INTERESADO / NO_INTERESADO / REBOTADO
```

Además del estado se guarda `ultimoContactoEn`, `respondioEn` (primera respuesta; un rebote no cuenta) y el **historial** completo (`interacciones`): canal, sentido (saliente/entrante), quién, a qué correo o número, asunto, mensaje, nota, resultado y error si el correo no salió. Con eso se calcula después la tasa de respuesta y el CPL por canal (punto 3).

**Plantillas** (`/plantillas`): mensajes reutilizables por canal con variables `{{nombre}}`, `{{municipio}}`, `{{departamento}}`, `{{categoria}}`, `{{remitente}}` y `{{empresa}}`. Una variable mal escrita se rechaza al guardar. Las edita quien las creó o un `ADMIN`; no se borran, se desactivan (el historial conserva cuál se usó).

### Reglas

- **Ley 2300 de 2023** (`CONTACTO_HORARIO_LEGAL=true` por defecto), mientras el lead no haya respondido:
  - solo **lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m.**, nunca domingos ni festivos (los festivos de Colombia se calculan, incluida la Ley Emiliani), siempre en hora de Colombia;
  - **un contacto por día**;
  - **un solo canal por semana** (lunes a domingo): si esta semana le escribiste por correo, sigue por correo o espera al lunes.

  Cuando el lead responde (*Respondió* o *Interesado*), la conversación la pidió él y estas reglas ya no limitan. El panel explica por qué no se puede y deshabilita el botón; la API responde **422** con `details.regla`.
- **No volver a contactar** (Ley 1581 y art. 5 de la Ley 2300): cada correo trae un enlace firmado (`/api/bajas/<token>`, sin sesión) y las cabeceras `List-Unsubscribe` para el botón "Cancelar suscripción" de Gmail y Outlook. Si el lead lo pide por otro medio, se marca a mano en el panel. Un lead marcado o *No interesado* no se puede volver a contactar (**409**). Sin `URL_PUBLICA`, el pie pide responder BAJA y hay que marcarlo a mano.
- **Un lead, un responsable**: lo trabaja quien lo contactó primero; un `ADMIN` puede escribirle sin quitárselo.
- Si el SMTP rechaza el correo, la API responde **502**, queda en el historial como *Falló* y no cuenta como contacto.

> La Ley 2300 protege a consumidores; para negocios (B2B) su alcance no es del todo claro. La plataforma la aplica igual por prudencia. Confírmalo con alguien de legal antes de desactivarla.

### Configurar el correo

Variables en `apps/api/.env` (ver `.env.example`):

| Variable | Para qué |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Servidor de correo. Sin `SMTP_HOST`, en desarrollo los correos quedan **simulados** (se registran, no salen, y el panel lo avisa); en producción no se envían. |
| `CORREO_REMITENTE` | `"Ventas Mi Empresa <ventas@miempresa.co>"`. Usa un dominio propio con SPF y DKIM, o los correos caerán en spam. |
| `CORREO_RESPONDER_A` | A dónde llegan las respuestas (por defecto, al correo del vendedor). |
| `NOMBRE_EMPRESA` | Firma de los mensajes y la variable `{{empresa}}`. |
| `URL_PUBLICA` | URL pública de la API, para el enlace de baja. |
| `CONTACTO_HORARIO_LEGAL` | `false` solo para probar en desarrollo fuera de horario. |

### Endpoints

| Ruta | Para qué |
|---|---|
| `GET /api/leads/:id/contacto` | Ficha: estado, historial, correos y números por canal, y si se puede contactar ahora (`permiso.motivo`, `permiso.porCanal`) |
| `POST /api/leads/:id/contacto/vista-previa` | Rellena una plantilla (`plantillaId`) o un texto con los datos del lead |
| `POST /api/leads/:id/correo` | Envía un correo (`para`, `asunto`, `mensaje`, `plantillaId`) |
| `POST /api/leads/:id/interacciones` | Registra un WhatsApp, una llamada u otro contacto (`canal`, `destino`, `mensaje`, `nota`) |
| `POST /api/leads/:id/respuesta` | Registra la respuesta (`canal`, `resultado`: `RESPONDIO` · `INTERESADO` · `NO_INTERESADO` · `REBOTADO`, `nota`) |
| `POST /api/leads/:id/no-contactar` | El lead pidió no volver a ser contactado |
| `GET·POST /api/bajas/:token` | Enlace público de baja de los correos (GET muestra el botón; POST da de baja) |
| `GET·POST /api/plantillas` · `GET·PATCH /api/plantillas/:id` · `GET /api/plantillas/variables` | Plantillas |

**Todavía no:** leer las respuestas de los correos automáticamente (IMAP o webhooks del proveedor) ni los rebotes que llegan después del envío. Por ahora se registran a mano desde el panel.

## Medir: CPL por canal

La página **Métricas** muestra, para un periodo (por defecto el mes en curso), cuánto costó cada lead según la **fuente** donde se encontró (DANE, OSM, RNT, SECOP, REPS) y según el **canal** por el que se contactó (correo, WhatsApp, llamadas, Dapta), junto con el embudo (contactados, respondieron) y la calidad.

**Costos.** Un `ADMIN` los registra en la misma página (`/api/costos`): a qué se cargan (una fuente, un canal de contacto o `general`), el periodo que cubren y el monto. También pueden ser **horas del equipo** (horas × valor de la hora). Ejemplos: el servidor → `general`; el plan de Brevo → `email`; los minutos de Dapta → `dapta`; horas revisando el RNT → `rnt`.

**Cómo se reparte** (todo en `apps/api/src/modules/metricas/domain/metricas.calculo.ts`, con pruebas):

- Cada costo se prorratea por días: si cubre un mes y el periodo toma 10 días, cuenta un tercio.
- **Costo de una fuente** = lo cargado a ella + los costos `general` repartidos según cuántos leads nuevos trajo cada fuente + el costo de cada canal de contacto repartido según cuántos de sus leads se contactaron por ese canal.
- **CPL de una fuente** = su costo / sus leads nuevos del periodo (atribuidos a la primera fuente que los trajo, `fuenteOrigen`).
- **Por canal de contacto**: costo del canal / leads contactados, / leads que respondieron y / leads de calidad alta.
- Lo que no se puede repartir (un canal con costo pero sin contactos en el periodo) se suma al costo total y se avisa.

| Ruta | Para qué |
|---|---|
| `GET /api/metricas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | Totales, `porFuente`, `porCanal` y costos del periodo |
| `GET /api/costos` · `POST /api/costos` · `PATCH·DELETE /api/costos/:id` | Costos (leer: todos; escribir: solo `ADMIN`) |

## Calificar con Dapta

Dapta califica cada lead, y la página **Métricas** compara las fuentes y los canales **por costo y por calidad** (gráfico de costo por lead contra calidad: lo mejor queda arriba a la izquierda).

```
Plataforma ── POST (lead + referencia) ──▶ Flujo de Dapta (Flow Studio)
                                              │  el agente de voz llama al lead y lo califica
Plataforma ◀── POST /api/dapta/webhook ───────┘  (calificación + referencia)
```

**Enviar.** Desde el panel de un lead (**Enviar a Dapta**) o en lote desde **Contactados** (filtra "Sin calificar" y **Enviar a Dapta**: manda los de la página, hasta 100). La plataforma hace `POST` a `DAPTA_FLOW_URL` con:

```json
{ "referencia": "8f1c…", "lead_id": 12, "contact_name": "Hotel Ejemplo", "contact_phone": "+573001112233",
  "contact_email": "hola@hotel.co", "municipio": "RIONEGRO", "departamento": "Antioquia",
  "categoria": "Hoteles y alojamiento", "fuente": "rnt", "estado_contacto": "CONTACTADO",
  "callback_url": "https://tu-dominio/api/dapta/webhook" }
```

**Recibir.** Al final del flujo, un nodo HTTP manda el resultado a `POST /api/dapta/webhook` con el secreto (`x-dapta-secret: <DAPTA_WEBHOOK_SECRET>`, o `?token=` en la URL si el nodo no permite cabeceras):

```json
{ "referencia": "8f1c…", "calificacion": "alta", "puntaje": 82, "resumen": "Quiere una demo el jueves",
  "variables": { "demo_booked": true }, "call_id": "abc123" }
```

- `calificacion`: `alta`, `media`, `baja` o `descartado` (también acepta `high/medium/low`, `hot/warm/cold`). Si solo viene `puntaje` (0–100): ≥70 alta, ≥40 media, si no baja.
- Si no hubo conversación, manda `"estado_llamada": "no_answer"` (o `voicemail`, `busy`…) sin calificación: queda como *Dapta no logró hablar con el lead*.
- Se aceptan los nombres en inglés (`reference`, `score`, `call_summary`, `call_status`) para mapear directo las variables de Dapta.

**Reglas.**

- Si el flujo **llama** al lead (`DAPTA_CONTACTA=true`, por defecto), el envío cuenta como una llamada: aplican las mismas reglas que a cualquier contacto (no contactar, responsable del lead y Ley 2300; para la regla de "un canal por semana" la llamada de Dapta es una llamada), y queda en el historial con el canal *Agente de Dapta*. Si el agente habla con el lead, el embudo avanza (calidad alta → *Interesado*; media o baja → *Respondió*).
- Si el flujo solo califica con los datos (`DAPTA_CONTACTA=false`), no se aplican las reglas de contacto ni cambia el embudo.
- Un lead enviado no se vuelve a enviar mientras espera su resultado (72 h como máximo). Si Dapta no recibe el lead, queda *No se pudo enviar* y no cuenta como contacto.
- También se puede **calificar a mano** desde el panel (quien trabaja el lead o un `ADMIN`).
- El lead guarda su última calificación (`calidad`, `puntaje`); en Contactados se filtra por calidad (`?calidad=ALTA`, `SIN` = sin calificar).

**Índice de calidad** (0–100) para comparar: el puntaje; sin puntaje, alta = 85, media = 60, baja = 30, descartado = 0.

| Variable | Para qué |
|---|---|
| `DAPTA_FLOW_URL` | URL del trigger del flujo (Public Route, con la autenticación en la URL). Sin ella, en desarrollo los envíos se **simulan**. |
| `DAPTA_WEBHOOK_SECRET` | Secreto del webhook. Sin él, el webhook no acepta nada (503). |
| `DAPTA_CONTACTA` | `true` si el flujo llama al lead (por defecto). |
| `URL_PUBLICA` | Para mandarle a Dapta la `callback_url`. |

| Ruta | Para qué |
|---|---|
| `POST /api/leads/:id/dapta` | Manda un lead a Dapta |
| `POST /api/dapta/envios` | Manda varios (`{ "leadIds": [1, 2, 3] }`): devuelve enviados y omitidos con su motivo |
| `POST /api/dapta/webhook` | Resultado del flujo (sin sesión, con secreto) |
| `GET /api/leads/:id/calificaciones` · `POST /api/leads/:id/calificacion` | Historial de calificaciones · calificar a mano |
| `GET /api/dapta/estado` | Si la integración está activa, simulada o desactivada |

> Dapta no publica un esquema fijo para el resultado de sus llamadas: lo arma quien configura el flujo. Por eso el webhook acepta varios nombres de campo. Al configurar el flujo, usa **Test with last call** de Dapta para verificar que el resultado llega bien.

## Cómo evita duplicados

Cada negocio que llega se compara con lo ya guardado **en el mismo municipio**, en este orden:

1. **Mismo registro de la misma fuente** (re-búsquedas).
2. **Mismo NIT.** El DANE, el RNT, SECOP y el REPS traen NIT: el cruce entre ellos es exacto.
3. **Mismo teléfono, correo o dominio web**, si el nombre o la ubicación son compatibles (para no unir negocios que comparten número).
4. **Misma placa** entre fuentes distintas: `KR 51 47 25` = `Carrera 51 # 47-25` = `CR 51 CL 47 25`. Así se unen razón social y nombre comercial distintos. Solo si en el municipio hay un único negocio con esa placa (un centro comercial no cuenta).
5. **Nombre parecido** y cercanía en el mapa; sin coordenadas, 2+ palabras distintivas en común y un único candidato. Se ignoran sufijos (S.A.S., Ltda.), palabras genéricas ("hotel", "ferretería") y el nombre del municipio.

Si coincide, el lead se **completa** (nunca se borran datos). Los teléfonos se normalizan a `+57` y 10 dígitos (los fijos viejos de 7 dígitos se completan con el indicativo del departamento; las extensiones se descartan). `fuenteOrigen` guarda la primera fuente que trajo el lead, para atribuir el CPL.

Orden de proceso dentro de una búsqueda: DANE → RNT → REPS → SECOP → OSM.

## Datos personales

El RNT, SECOP y el REPS incluyen personas naturales (viviendas turísticas, contratistas, profesionales independientes). Su correo y celular son **datos personales** bajo la Ley 1581 de 2012. Por eso, por defecto, el servidor solo guarda empresas:

- REPS: `tipoid = NI`
- SECOP: excluye `PERSONA NATURAL`
- RNT: solo NIT de 9 dígitos que empiezan por 8 o 9

Con `incluirPersonasNaturales: true` también las guarda, marcadas con `esPersonaNatural: true`. Antes de contactarlas, revisa con alguien de legal cómo vas a cumplir la ley.

## Tiempos y límites

- **Caché:** el resultado de cada fuente se guarda en memoria por municipio + filtros durante `CACHE_FUENTES_MINUTOS` (1440 = 24 h; `0` la desactiva; máximo `CACHE_FUENTES_MAX` entradas). Repetir una búsqueda tarda segundos; `meta.cache: true` lo indica. Se borra al reiniciar el servidor. Las fuentes que fallan no se guardan.
- **Tope por fuente:** ninguna fuente puede demorar la búsqueda más de `FUENTE_MAX_MS` (150 s); pasado ese tiempo queda en `error` y las demás se guardan.
- OpenStreetMap tarda 20–60 s por búsqueda. Cada servidor de Overpass tiene `OSM_TIMEOUT_MS` (60 s) y la fuente completa, con reintentos y búsqueda por radio, `OSM_PRESUPUESTO_MS` (100 s). Si un servidor responde 429/504, prueba el siguiente mientras quede tiempo.
- El DANE consulta los CIIU de la categoría de a `DANE_CONSULTAS_EN_PARALELO` (3) y reintenta una vez si responde 5xx.
- El login acepta `LOGIN_POR_MINUTO` intentos por IP (10 por defecto).
- Las búsquedas se atienden **una a la vez** (máximo 5 en cola) y hay un límite por IP (`BUSQUEDAS_POR_MINUTO`).
- datos.gov.co se pagina de a 5.000 filas hasta `DATOS_GOV_MAX_REGISTROS` (20.000 por defecto); `meta.truncado` avisa si se cortó. Con `DATOS_GOV_APP_TOKEN` (gratis) sube el límite de consultas.
- Sin categoría en ciudades grandes, el DANE puede devolver demasiados registros; el servidor corta en 60 MB y pide filtrar.

## Pruebas

```bash
cp apps/api/.env.test.example apps/api/.env.test   # apunta a una base desechable
pnpm db:test:deploy              # crea las tablas en la base de pruebas
pnpm test                        # API y web (las de repositorio se saltan si no hay .env.test)
pnpm test:unit                   # sin base de datos (API unitarias + web)
pnpm test:web                    # solo el frontend (Vitest)
pnpm --filter @leads-colombia/web test:watch      # web en modo watch
pnpm --filter @leads-colombia/web test:coverage   # web con cobertura (apps/web/coverage)
pnpm typecheck && pnpm lint      # tipos de las dos apps y reglas de arquitectura del frontend
```

`apps/api/__test__/` es espejo de `src/`:

- `modules/<modulo>/domain`: reglas de negocio con repositorios en memoria (`__test__/mocks`).
- `modules/<modulo>/controller`: HTTP con supertest y el dominio simulado.
- `modules/<modulo>/repository` y `e2e/`: contra PostgreSQL real.
- `services/fuentes`: cada fuente con respuestas que tienen la forma real de cada servicio.

`apps/web/__test__/` también es espejo de `src/` (Vitest + Testing Library + jsdom, config en `apps/web/vitest.config.ts`):

- `shared/`: cliente HTTP, sesión, utilidades y componentes de UI.
- `modules/<modulo>/`: servicios, stores, hooks, componentes y páginas, con `fetch` simulado (`__test__/helpers/http.ts`) que responde con el sobre `{ status, data }` de la API.
- Las páginas que usan el router se montan con `createRoutesStub` de React Router.
- Los tests pueden importar internos de un módulo (en `.oxlintrc.json` la regla de imports públicos se apaga solo en `__test__/`).

## Advertencias

- El servicio del DANE es el que alimenta su [geovisor público](https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/), pero **no es una API documentada**: si cambia, hay que ajustar `apps/api/src/services/fuentes/dane.ts`. Solo se le envían códigos numéricos validados.
- Datos de OpenStreetMap © colaboradores de OpenStreetMap, licencia [ODbL](https://www.openstreetmap.org/copyright). Si compartes los datos, da esa atribución.
- RNT, SECOP II y REPS: [datos.gov.co](https://www.datos.gov.co) (datasets `thwd-ivmp`, `qmzu-gj57`, `c36g-9fc2`).

## Agregar una fuente o una categoría

- **Categoría:** una entrada en `apps/api/src/config/catalogo/categorias.ts`.
- **Fuente:** un archivo en `apps/api/src/services/fuentes/` que implemente `FuenteLeads` (`~types/fuente.types`), registrado en `services/fuentes/index.ts`; agrega su nombre a `FUENTES` y su lugar en `ORDEN_PROCESO` (`modules/busquedas/domain/busquedas.domain.ts`).
