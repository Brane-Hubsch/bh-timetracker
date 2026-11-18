# BH Timetracker – Produkt- och teknisk plan (v1)

> Levande dokument. Uppdatera när beslut fattas. Senast uppdaterad: 2026-11-18 (efter Fas 0).

## 1. Vision och avgränsning

Ett eget, enkelt webbverktyg för tidrapportering i stil med Clockify/Toggl, byggt för oss.
Kärnan är: **rapportera tid på projekt → följ upp mot estimat → ta ut rapporter**, och att allt
detta också ska gå att göra via en **AI-assistent över MCP**.

**Principer**

- Hellre få funktioner som är bra än många halvbra. Bygg inget "för säkerhets skull".
- Mobil först för inmatning, desktop först för rapporter och administration.
- Allt som går att göra i UI:t ska gå via samma domänlager som MCP-verktygen använder.
- Lös produktionsmiljön sent. Håll koden databasagnostisk (SQLite lokalt, Postgres i produktion).

**Uttryckligen INTE i v1**: live-timer (start/stopp), fakturering, attestflöden, kostnadspriser/lönsamhet,
uppgifter (tasks) och taggar, integrationer med externa kalendrar, native-app.

## 2. Beslut som är tagna

| Område | Beslut |
|---|---|
| Arkitektur | Laravel-monolit med Inertia + React (officiella React-startkitet) |
| Ramverk | Laravel 13, Inertia 3, React 19, TypeScript (strict), Tailwind CSS 4, PHP 8.5 (senaste stabila) |
| UI-bibliotek | HeroUI v3 (`@heroui/react`), ersätter startkitets shadcn/ui |
| AI-utveckling | Laravel Boost (guidelines, skills, MCP) + HeroUI MCP-server |
| Inloggning | Passkeys (Fortify `Features::passkeys()` / `laravel/passkeys`) + Google via Laravel Socialite. **Inga lösenord.** |
| Tidsinmatning | Endast manuell: formulär, listvy och kalendervy (ingen timer) |
| Ekonomi | Estimat i timmar, debiterbar/ej debiterbar, timpris → belopp i rapporter. Ingen fakturering. |
| Roller | Ägare / Admin / Medlem per organisation |
| Multi-tenant | Organisationer; en användare kan tillhöra flera och byter aktiv organisation |
| AI-integration | Egen MCP-server med `laravel/mcp`, OAuth 2.1 via Laravel Passport |
| Lokal miljö | Laravel Herd, SQLite |
| Produktion | Postgres. Hosting/deploy beslutas senare. |
| Språk | Kod/identifierare på engelska. UI på svenska först, förberett för engelska (i18n från start). |
| Organisation i URL | Tenant-sidor ligger under `/{organisationens-slug}/...`; slugen sätter aktiv organisation. `current_organization_id` minns senast använda (redirect efter inloggning, standard för MCP). |
| Personliga organisationer | Finns inte. Användare utan organisation hamnar på `/onboarding` (acceptera inbjudan eller skapa organisation). |
| i18n | Laravels `lang/{locale}.json` är enda källan (engelska källsträngar som nycklar), delas med React via `t()` i `resources/js/lib/i18n`. Svenska valideringsmeddelanden i `lang/sv/*.php` (från Laravel-Lang). Ett test kräver svensk översättning för varje nyckel. |
| Frontend-lint | Vite+ (`vp check` = Oxlint + Oxfmt) från startkitet i stället för ESLint + Prettier. |

## 3. Domänmodell

Alla tider lagras i **UTC**. Pengar lagras som **heltal i minsta valutaenhet** (öre). Varaktighet i **sekunder**.

```
User ──< OrganizationMember >── Organization
                                   │
                                   ├──< Client
                                   ├──< Project >── Client (valfri)
                                   │      └──< ProjectMember >── User
                                   ├──< TimeEntry >── User, Project
                                   └──< Invitation
```

### Tabeller (förslag)

**users** – `id, name, email (unik), avatar_url, locale (sv), timezone (Europe/Stockholm), current_organization_id, password (nullable, används ej), google_id (nullable), email_verified_at, timestamps`

**organizations** – `id, name, slug (unik), currency (SEK), default_hourly_rate (int, nullable), week_starts_on (1 = måndag), timezone, timestamps, deleted_at (soft delete, från startkitet)`

**organization_members** (pivot) – `id, organization_id, user_id, role (owner|admin|member), hourly_rate (nullable), deactivated_at (nullable), timestamps` – unik på (organization_id, user_id)

**organization_invitations** – `id, organization_id, email, role, code (unik, 64 tecken), invited_by, expires_at, accepted_at, timestamps` (från startkitet; inbjudan gäller 3 dagar och kan aldrig ge ägarroll)

**clients** – `id, organization_id, name, organization_number (nullable), email (nullable), notes (nullable), archived_at, timestamps`

**projects** – `id, organization_id, client_id (nullable), name, code (nullable), color, is_billable (default true), hourly_rate (nullable), estimate_seconds (nullable), visibility (public|private), starts_on/ends_on (nullable), archived_at, timestamps`

**project_members** – `id, project_id, user_id, hourly_rate (nullable), timestamps`

**time_entries** – `id, organization_id, user_id, project_id, description (nullable), started_at, ended_at, duration_seconds (beräknad), is_billable, hourly_rate (snapshot, nullable), source (web|mcp|import), timestamps, deleted_at (soft delete)`

Index: `time_entries(organization_id, user_id, started_at)`, `time_entries(organization_id, project_id, started_at)`.

### Affärsregler

- Varje tidpost **måste** ha ett projekt. Projektet måste tillhöra samma organisation och vara aktivt (ej arkiverat).
- `ended_at > started_at`, max 24 h per post. Poster får gå över midnatt; de räknas till startdagen i rapporter.
- Överlappande poster tillåts men UI:t varnar.
- **Timpris** löses upp i ordningen: projektmedlemmens pris → projektets pris → medlemmens pris i organisationen → organisationens standardpris. Priset **snapshotas** på tidposten när den sparas (så att ändrade priser inte skriver om historiken). Admin kan senare få en "räkna om priser"-åtgärd.
- `is_billable` ärvs från projektet vid skapande men kan ändras per post.
- Projekt med `visibility = public` är öppna för alla medlemmar; `private` endast för tilldelade medlemmar.
- Arkiverade kunder/projekt döljs i väljare men finns kvar i rapporter.
- Organisationen måste alltid ha minst en ägare. Ägarens roll kan inte ändras och ägaren kan inte tas bort eller lämna; ägarskap kan inte ges via inbjudan eller rollbyte (överlåtelse byggs separat).

### Behörigheter (Policies)

| Åtgärd | Ägare | Admin | Medlem |
|---|---|---|---|
| Egen tid: skapa/ändra/ta bort | ✓ | ✓ | ✓ |
| Andras tid: se | ✓ | ✓ | – |
| Andras tid: ändra/ta bort/skapa åt | ✓ | ✓ | – |
| Kunder & projekt: hantera | ✓ | ✓ | – (endast se de projekt hen har åtkomst till) |
| Se timpriser och belopp | ✓ | ✓ | – |
| Rapporter | Alla | Alla | Endast egen tid |
| Medlemmar & inbjudningar | ✓ | ✓ | – |
| Organisationsinställningar | ✓ | ✓ (ej radera org / ändra ägare) | – |
| Radera organisation, överlåta ägarskap | ✓ | – | – |

All åtkomst scopas till **aktiv organisation**. Ingen query mot tenant-data utan organisationsscope – testa detta explicit.

## 4. Funktioner i v1

### 4.1 Inloggning och konto (inga lösenord)

- **Fortsätt med Google** (Socialite). Matcha på verifierad e-post; koppla `google_id`.
- **Passkey**: logga in med passkey (gärna med autofill/conditional UI). Hantera passkeys under Inställningar → Säkerhet (lägga till, döpa om, ta bort).
- **Registrering utan Google**: namn + e-post → verifieringslänk (magic link) → skapa passkey.
- **Återställning**: "Jag har tappat min passkey" → magic link till e-post → registrera ny passkey.
- Stäng av Fortifys lösenordsfunktioner (registrering med lösenord, reset, 2FA/TOTP – passkeys ersätter det).
- Öppen självregistrering är **avstängd som standard** (se öppna frågor); konton skapas via inbjudan. Styrs med en config-flagga.

### 4.2 Organisationer och medlemmar

- Använd startkitets **teams-stöd** som grund och döp om till *Organization* i både kod och UI tidigt (fas 0), innan något byggs ovanpå.
- Skapa organisation, byta aktiv organisation (växlare i sidomenyn), inställningar (namn, valuta, standardpris, veckostart, tidszon).
- Bjuda in via e-post med roll; acceptera inbjudan som ny eller befintlig användare.
- Ändra roll, sätta medlemmens timpris, inaktivera medlem (behåll historik).

### 4.3 Kunder

- Lista med sök, skapa/redigera/arkivera. Fält: namn, org.nr, e-post, anteckning.
- Kundsida: kundens projekt + summerad tid (period).

### 4.4 Projekt

- Lista med sök och filter (kund, aktiva/arkiverade), skapa/redigera/arkivera.
- Fält: namn, kund (valfri), kod, färg, debiterbart, timpris, **estimat i timmar**, synlighet, start/slut (valfritt), medlemmar (+ ev. pris per medlem).
- Projektsida: förbrukat vs estimat (progress, varning vid 80 % och 100 %), tid per medlem, tid per vecka, debiterbart belopp.

### 4.5 Tidrapportering

**Snabbinmatning (formulär)** – datum, start–slut *eller* start + varaktighet ("1,5", "1:30", "90m" ska alla fungera), projekt (sökbar väljare med senast använda först), beskrivning, debiterbar. Smarta förval: start = slut på dagens senaste post.

**Listvy** (standard på mobil) – poster grupperade per dag med dagssumma och veckosumma, redigera inline eller i drawer, duplicera post, ta bort med ångra.

**Kalendervy** (standard på desktop)
- Veckovy och dagvy (dagvy är standard på mobil). Veckan börjar enligt organisationens inställning.
- Dra i tom yta för att skapa post → öppnar formulär förifyllt med tid.
- Dra för att flytta, dra i kant för att ändra längd, klicka för att redigera.
- Poster färgas efter projekt. Dagssummor i kolumnhuvud, veckosumma i toppen.
- "Kopiera föregående vecka" (som utkast som användaren bekräftar).
- Admin kan växla till att se/rapportera åt en annan medlem.
- Bibliotek: **FullCalendar** (React, endast MIT-delarna `timegrid` + `interaction`), stylat med HeroUI:s CSS-variabler. Gör en kort spike först; om det blir för tungt att styla, bygg en egen enkel veckovy.

### 4.6 Rapporter

- **Sammanfattning**: period (förval: denna vecka, förra veckan, denna månad, förra månaden, i år, anpassad), filter (medlemmar, kunder, projekt, debiterbar), gruppering i två nivåer (t.ex. Kund → Projekt, Projekt → Medlem, Medlem → Dag). Visar timmar, debiterbara timmar och belopp. Stapeldiagram per dag/vecka och fördelning per projekt.
- **Detaljerad**: lista med alla poster enligt filter, sortering, summering.
- **Projektuppföljning**: alla aktiva projekt med estimat, förbrukat, kvar och procent.
- **Export**: CSV och XLSX (t.ex. `openspout/openspout`). PDF senare.
- Rapportens filter ligger i URL:en så att den går att bokmärka och dela internt.
- Medlemmar ser endast sin egen tid. Belopp visas endast för ägare/admin.

### 4.7 Startsida (dashboard)

- Min tid idag / denna vecka (mot ev. veckomål senare), senaste poster, snabbinmatning.
- För admin: teamets timmar denna vecka, projekt som närmar sig estimat.

### 4.8 AI / MCP

Se avsnitt 6.

### 4.9 Mobil och desktop

- Responsiv layout: sidomeny på desktop, bottennavigering (Idag / Kalender / Rapporter / Mer) på mobil.
- Stor "+"-knapp för ny post på mobil; formulär i HeroUI Drawer (bottom sheet).
- Touchvänliga tidsväljare, inga hover-beroende funktioner.
- PWA-manifest + ikon så att appen kan läggas på hemskärmen (ingen offline-funktion i v1).

## 5. Teknisk arkitektur

### 5.1 Struktur

```
app/
  Actions/            # En klass per affärsoperation, t.ex. CreateTimeEntry, ArchiveProject.
                      # Används av både HTTP-controllers och MCP-verktyg.
  Data/ eller DTOs    # Indata/utdata för actions (valfritt: spatie/laravel-data)
  Http/Controllers/   # Tunna; validera → anropa Action → Inertia-svar
  Http/Requests/      # Form requests
  Mcp/Servers/        # TimetrackerServer
  Mcp/Tools/          # Ett verktyg per operation
  Models/
  Policies/
  Services/Reports/   # ReportBuilder: filter + gruppering → aggregerat resultat
  Support/            # Duration-parser, RateResolver, CurrentOrganization
resources/js/
  components/         # Egna komponenter byggda på HeroUI
  features/           # time-entries/, calendar/, reports/, projects/, clients/ ...
  layouts/
  pages/
  lib/i18n/
```

### 5.2 Viktiga konventioner (lägg även i `.ai/guidelines/project.md` så att Boost tar med dem)

- **Ett domänlager**: all skrivlogik i `app/Actions`. Controllers och MCP-verktyg får inte innehålla affärslogik.
- **Tenant-scope**: aktiv organisation hämtas via en `CurrentOrganization`-tjänst. Modeller med `organization_id` får ett scope/trait; policies kontrollerar alltid medlemskap.
- **Tid**: lagra UTC, visa i användarens tidszon. Varaktighet i sekunder. Använd CarbonImmutable.
- **Pengar**: heltal i öre, formatera i frontend med `Intl.NumberFormat`.
- **Databasagnostiskt**: ingen SQLite- eller Postgres-specifik SQL (t.ex. `strftime`/`date_trunc`). Rapportaggregering per dag/vecka görs i PHP i `ReportBuilder` i v1 (räcker gott för vår volym).
- **Typer**: Wayfinder för typade routes. Delade TS-typer för Inertia-props.
- **i18n**: inga hårdkodade UI-strängar; svenska som standard.
- **Tester**: Pest. Varje Action och varje MCP-verktyg har tester, inklusive behörighets- och tenant-tester.

### 5.3 Frontend

- Starta från Laravels React-startkit (med teams), byt ut shadcn/ui mot HeroUI v3 steg för steg: layout, navigering, auth-sidor, inställningar. Ta bort shadcn-komponenter när de inte längre används.
- HeroUI-komponenter att utgå från: Button, Input, Select/Autocomplete (projektväljare), DatePicker/TimeField, Drawer (mobilformulär), Modal, Table, Tabs, Badge, Toast, Avatar.
- Formulär via Inertias `useForm`/`<Form>`; optimistisk uppdatering i kalendern vid drag.
- Diagram: ett lättviktigt bibliotek (t.ex. Recharts) – välj ett och håll dig till det.

### 5.4 Kvalitet och CI

- Pest 5, Larastan nivå 9, Pint, Vite+ (`vp check`: Oxlint + Oxfmt), `tsc --noEmit`. Allt körs med `composer ci:check`.
- GitHub Actions: kör testsviten mot **både SQLite och Postgres** (Postgres som service) så att produktionsdatabasen täcks från dag ett.
- Seeder med en demo-organisation, några kunder, projekt och några veckors tidposter.

### 5.5 Lokal utveckling (Herd)

- Passkeys kräver säker kontext: kör `herd secure` för `.test`-domänen.
- Google OAuth godkänner normalt inte `.test` som redirect-URI. Använd `localhost` eller en tunnel (t.ex. `herd share`) för att testa Google-inloggning lokalt. Kontrollera i Google Cloud Console.
- MCP via OAuth från claude.ai kräver en publik HTTPS-URL. Lokalt: tunnel, eller testa med Claude Code/MCP Inspector mot lokal URL.

### 5.6 Produktion (avvaktas)

Det enda som bestäms nu: Postgres, köer (database-driver räcker initialt), e-post för inbjudningar/magic links, HTTPS. Hosting, CI/CD-deploy och backup beslutas när v1 närmar sig klart.

## 6. MCP-server (AI-integration)

### 6.1 Mål

Användaren ska kunna koppla t.ex. Claude (claude.ai/Claude Desktop/Claude Code) eller annan MCP-klient och säga saker som:

- "Lägg in 3 timmar på Acme webbshop igår eftermiddag, felsökning av checkout."
- "Fyll i min vecka utifrån det här: …"
- "Hur mycket har vi kvar av estimatet på projekt X?"
- "Ta fram en rapport per kund för oktober."
- "Vad jobbade jag med förra torsdagen?"

### 6.2 Teknik

- `laravel/mcp`, en server `TimetrackerServer` registrerad som web-server i `routes/ai.php`, t.ex. `Mcp::web('/mcp', TimetrackerServer::class)->middleware('auth:api')`.
- Autentisering: **OAuth 2.1 via Laravel Passport** (`Mcp::oauthRoutes()` ger discovery, metadata och dynamisk klientregistrering). Inloggningssteget i OAuth-flödet använder vår vanliga inloggning (passkey/Google).
- Inställningar → "AI-kopplingar": visa MCP-URL, instruktioner per klient, lista och återkalla anslutna klienter/tokens.
- Verktyg agerar alltid **som den inloggade användaren** med samma policies som UI:t. Ingen superanvändare.
- Organisation: verktyg tar valfri `organization` (slug); utan den används användarens aktiva organisation.
- Märk verktyg som läsande (`#[IsReadOnly]`) eller ändrande; destruktiva verktyg (ta bort) tydligt beskrivna.
- Alla poster skapade via MCP får `source = mcp`. Logga MCP-anrop (verktyg, användare, tid) för felsökning.
- Rate limiting på MCP-routen.

### 6.3 Verktyg (v1)

| Verktyg | Typ | Beskrivning |
|---|---|---|
| `get_context` | läs | Vem är jag, mina organisationer, aktiv organisation, tidszon, dagens datum |
| `list_clients` | läs | Sök/lista kunder |
| `create_client` | skriv | Skapa kund (admin) |
| `list_projects` | läs | Sök projekt (namn, kund, aktiv), inkl. estimat och förbrukat |
| `create_project` | skriv | Skapa projekt (admin) |
| `list_time_entries` | läs | Filtrera på period, medlem, projekt, kund |
| `create_time_entries` | skriv | Skapa **en eller flera** poster i ett anrop (för "fyll i min vecka") |
| `update_time_entry` | skriv | Ändra post |
| `delete_time_entry` | skriv (destruktiv) | Ta bort post |
| `get_report` | läs | Samma ReportBuilder som UI:t: period, filter, gruppering → summerad JSON |
| `get_project_status` | läs | Estimat vs förbrukat för ett eller alla projekt |

- Verktygen ska returnera kompakt, strukturerad JSON med tider i användarens tidszon och tydliga felmeddelanden (t.ex. "Projektet 'Acme' matchar 2 projekt: …").
- Projekt ska kunna anges med id **eller** namn (fuzzy match med tydlig flertydighetshantering).
- Server-instruktioner (`#[Instructions]`) som förklarar domänen, datumtolkning ("igår" = användarens tidszon) och att AI:n ska bekräfta med användaren innan större ändringar.
- Prompts (valfritt i v1): `weekly_summary`, `fill_week_from_notes`.

## 7. Faser

Varje fas avslutas med gröna tester, uppdaterad PLAN.md vid behov och en kort sammanfattning för granskning. Arbeta i feature-branches och små commits.

**Fas 0 – Grund** *(klar, se Status nedan)*
1. `laravel new` med React-startkitet och teams-stöd, Pest. Initiera repot `Brane-Hubsch/bh-timetracker`.
2. Installera Laravel Boost (`composer require laravel/boost --dev && php artisan boost:install`) och HeroUI MCP-servern. Lägg projektkonventionerna i `.ai/guidelines/project.md`.
3. Döp om Team → Organization (modell, tabeller, routes, UI), roller owner/admin/member.
4. Installera HeroUI v3, sätt upp tema (ljust/mörkt), byt layout/navigering till HeroUI, mobilnavigering.
5. i18n-lager (sv), Larastan, Pint, ESLint/Prettier, GitHub Actions med SQLite + Postgres.
*Klart när*: man kan logga in med startkitets standardflöde, skapa/byta organisation i ny HeroUI-layout, CI är grön.

**Fas 1 – Inloggning utan lösenord**
Google via Socialite, passkeys via Fortify, magic link för registrering/återställning, inbjudningsflöde, ta bort lösenordsflöden.
*Klart när*: en inbjuden användare kan gå med via Google eller passkey, och lösenord inte förekommer någonstans.

**Fas 2 – Kunder, projekt, medlemmar**
CRUD + arkivering, projektmedlemmar, timpriser, RateResolver, policies, seeders.

**Fas 3 – Tidrapportering**
Actions för tidposter, durationsparser, listvy, formulär (desktop + mobil-drawer), kalendervy (spike → implementation), dashboard.

**Fas 4 – Rapporter**
ReportBuilder, sammanfattning, detaljerad, projektuppföljning, CSV/XLSX-export.

**Fas 5 – MCP**
Passport + `laravel/mcp`, alla verktyg i 6.3 med tester, sidan "AI-kopplingar", test mot Claude via tunnel.

**Fas 6 – Finputs inför produktion**
PWA-manifest, tomlägen och felhantering, tillgänglighet, prestanda (N+1, index), e-postmallar, produktionskonfig för Postgres. Beslut om hosting.

### Status Fas 0 (2026-11-18)

Klar. Avvikelser från ursprungsplanen:

- PHP 8.5 och Pest 5 (i stället för Pest 4), eftersom vi kör senaste PHP.
- Vite+ (`vp check`) i stället för ESLint + Prettier, enligt startkitet.
- Personliga organisationer borttagna; onboarding-sida för användare utan organisation.
- Organisationens slug ligger i URL:en (startkitets modell).
- Admin får hantera medlemmar (startkitet gav bara ägaren det), i linje med behörighetstabellen.
- Organisationslogiken (skapa, ändra, radera, ta bort medlem, roll, inbjudningar) flyttad till `app/Actions/Organizations`.
- Kvar från startkitet till Fas 1: lösenordsinloggning, glömt/återställ lösenord, bekräfta lösenord, e-postverifiering och 2FA. Dessa skärmar använder fortfarande äldre shadcn-komponenter i `resources/js/components/ui`, som tas bort i Fas 1.
- `BelongsToOrganization`-traiten och `OrganizationScope` finns och är testade, men används av en riktig modell först i Fas 2 (Client).

## 8. Senare (medvetet bortvalt i v1)

Live-timer · uppgifter och taggar · låsta perioder och attest · veckomål/heltidsnorm · kostnadspriser och lönsamhet · fakturaunderlag/integration med ekonomisystem · sparade och delade rapporter (publika länkar) · Microsoft/Entra SSO · import från Clockify/Toggl (CSV) · kalenderintegration (Google/Outlook) · aktivitetslogg/audit · native-app.

## 9. Öppna frågor

1. Ska vem som helst kunna registrera sig och skapa en organisation, eller är det endast inbjudan (vi bygger internt först)? *Antagande: endast inbjudan, styrt av config-flagga.*
2. Ska en tidpost kunna sakna projekt (t.ex. "intern tid")? *Antagande: nej, skapa ett internt projekt i stället.*
3. Behövs avrundning i rapporter (t.ex. till närmaste 15 min) redan i v1? *Antagande: nej.*
4. Behöver vi fler SSO-leverantörer än Google snart (Microsoft)? Påverkar inte v1 men Socialite-upplägget bör vara generellt.
5. Ska medlemmar kunna se sina egna belopp (timpris × tid)? *Antagande: nej, endast ägare/admin.*
