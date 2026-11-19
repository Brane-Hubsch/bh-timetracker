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

**users** – `id, name, email (unik), avatar_url, locale (sv), timezone (Europe/Stockholm), current_organization_id, password (nullable, endast utveckling/test), google_id (nullable, unik), email_verified_at, timestamps`

**magic_links** – `id, user_id, token_hash (sha256, unik), redirect_to (nullable), expires_at, used_at, timestamps` (rensas dagligen)

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
- **Magic link**: engångslänk via e-post, giltig 15 min, endast hash av token lagras. Länken öppnar en "Fortsätt"-sida och förbrukas först vid klick (skydd mot e-postskannrar). Används för inloggning, registrering, återställning och för att bekräfta åtkomst för användare utan passkey.
- **Inbjudan**: e-posten länkar till `/invitations/{kod}`. Ny användare anger namn (eller väljer Google) → konto skapas verifierat → passkey-setup. Befintlig användare loggar in och accepterar.
- **Känsliga åtgärder** (hantera passkeys, radera konto) kräver nylig inloggning eller bekräftelse med passkey/e-postlänk.
- **Lösenordsinloggning finns bara för lokal utveckling och tester** (seedade användare, `AUTH_PASSWORD_LOGIN`), aldrig i produktion oavsett konfiguration.
- **Första ägaren** i en miljö skapas med `php artisan app:create-owner {email} {namn} {organisation}`.

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
- **Export**: CSV och XLSX (t.ex. `openspout/openspout`). PDF tillagt i efterhand (se tillägg efter Fas 6).
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

**Fas 1 – Inloggning utan lösenord** *(klar, se Status nedan)*
Google via Socialite, passkeys via Fortify, magic link för registrering/återställning, inbjudningsflöde, ta bort lösenordsflöden.
*Klart när*: en inbjuden användare kan gå med via Google eller passkey, och lösenord inte förekommer någonstans.

**Fas 2 – Kunder, projekt, medlemmar** *(klar, se Status nedan)*
CRUD + arkivering, projektmedlemmar, timpriser, RateResolver, policies, seeders.

**Fas 3 – Tidrapportering** *(klar, se Status nedan)*
Actions för tidposter, durationsparser, listvy, formulär (desktop + mobil-drawer), kalendervy (spike → implementation), dashboard.

**Fas 4 – Rapporter** *(klar, se Status nedan)*
ReportBuilder, sammanfattning, detaljerad, projektuppföljning, CSV/XLSX-export.

**Fas 5 – MCP** *(klar, se Status nedan)*
Passport + `laravel/mcp`, alla verktyg i 6.3 med tester, sidan "AI-kopplingar", test mot Claude via tunnel.

**Fas 6 – Finputs inför produktion** *(klar, se Status nedan – hostingbeslut kvar)*
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

### Status Fas 1 (2026-11-18)

Klar. Avvikelser och tillägg:

- Lösenordsinloggning behålls för lokal utveckling och tester (beslut 2026-11-18) så att Google-nycklar inte blockerar arbetet. Avstängd i produktion.
- `app:create-owner` för att skapa första ägaren (behövs eftersom registreringen är stängd).
- Ägare kan inte radera sitt konto innan organisationen är raderad (en organisation ska alltid ha en ägare).
- Accentfärg: lila (violett), definierad i `resources/css/app.css`.
- Alla shadcn/Radix-komponenter är borttagna; hela UI:t använder HeroUI.

### Status Fas 2 (2026-11-18)

Klar. Byggt: kunder (lista med sök, aktiva/arkiverade, skapa/redigera/arkivera, kundsida med projekt), projekt (lista med sök och filter på kund/status, formulär, projektsida, arkivering), projektmedlemmar med pris per medlem, medlemmars timpris och inaktivering i organisationen, `RateResolver`, policies och demo-seeder.

Avvikelser och förtydliganden:

- Kundsidans summerade tid och projektsidans förbrukat/estimat, tid per medlem/vecka och belopp kräver tidposter och byggs i Fas 3–4.
- Kunder hanteras och listas bara av ägare/admin (medlemmar ser kundnamn via sina projekt).
- Arkivering är inte kaskaderande: en arkiverad kund arkiverar inte sina projekt. Väljare i Fas 3 döljer projekt vars kund är arkiverad.
- Ingen radering av kunder/projekt i v1, bara arkivering (historik och rapporter bevaras).
- Projektkod är unik per organisation (valfri).
- Inaktiverad medlem: ingen åtkomst, ingen roll, kan inte väljas; historik och projekttilldelningar finns kvar. Ägaren kan inte inaktiveras.
- Listorna pagineras inte i v1 (små volymer).

### Status Fas 3 (2026-11-18)

Klar. Byggt:

- Tidposter (`time_entries`) med actions, policy och durationsparser ("1,5", "1:30", "90m", "1h 30m").
- Formulär: modal på desktop, drawer på mobil. Projektväljaren visar senast använda först, starttiden föreslås smart och överlapp ger en varning.
- Listvy med dags- och veckosummor, och kalendervy med FullCalendar 7 (vecka/dag). I kalendern kan man dra för att skapa, flytta och ändra längd. Poster färgas efter projekt och dagssummor står i kolumnhuvudet.
- "Kopiera förra veckan" som utkast med kryssrutor.
- Ägare/admin kan se och rapportera åt andra medlemmar: via personväljaren i kalendern och via fältet "Medlem" i formuläret (även snabbinmatningen på startsidan).
- Duplicera post, och ta bort med ångra i toasten.
- Startsida: min tid idag och denna vecka, senaste poster och snabbinmatning. För ägare/admin även teamets vecka och projekt som närmar sig estimatet (≥ 80 %).
- Projektsidan visar förbrukad tid mot estimatet.

Avvikelser och förtydliganden:

- FullCalendar-spiken gick bra, så ingen egen veckovy behövs. Kalendern är stylad med HeroUI:s CSS-variabler.
- Standardvy: vecka på desktop och lista på mobil. Dagvyn finns som flik.
- Listvyn redigerar i modal/drawer, inte inline: samma formulär överallt och enklare på mobil.
- "Duplicera" öppnar ett förifyllt formulär för idag i stället för att skapa en kopia direkt.
- Datum och tider matas in med webbläsarens inbyggda fält. De följer enhetens språk, vilket ger bra tangentbord på mobil.
- Tider matas in och visas i användarens tidszon och lagras i UTC.
- En sluttid före starttiden tolkas som nästa dag. En post får vara högst 24 timmar.
- Överlapp ger bara en varning; det blockeras inte.
- Timpriset snapshottas när posten skapas och räknas om bara om projekt eller medlem ändras.
- Admin kan rätta poster för inaktiverade medlemmar men inte skapa nya åt dem.
- Projektsidans tid per medlem/vecka och belopp, samt kundsidans summerade tid, byggs med rapporterna i Fas 4.

### Status Fas 4 (2026-11-18)

Klar. Byggt:

- `ReportBuilder` (`app/Services/Reports`) med filter (period, medlemmar, kunder, projekt, debiterbar) och gruppering i två nivåer: kund, projekt, medlem, dag, vecka eller månad. Samma builder ska användas av MCP-verktyget `get_report` i Fas 5.
- **Sammanfattning** visar summakort (timmar, debiterbara timmar, belopp), stapeldiagram per dag eller vecka, fördelning per projekt och en grupperad tabell.
- **Detaljerad** rapport är sorterbar på datum, tid, projekt och medlem, med 50 poster per sida och summor.
- **Projektuppföljning** visar alla aktiva projekt med estimat, förbrukat, kvar och procent.
- **Export** till CSV och XLSX med `openspout/openspout`, både för sammanfattningen och den detaljerade rapporten.
- **Projektsidan** visar debiterbara timmar och belopp, tid per medlem och timmar per vecka för de senaste 12 veckorna. **Kundsidan** visar tid och belopp per projekt för en vald period. Båda har en länk till rapporten.
- "Rapporter" finns i sidomenyn och i mobilens bottennavigering (Idag / Kalender / Rapporter / Mer).

Avvikelser och förtydliganden:

- **Diagram:** egna enkla komponenter (staplar i en serie) i stället för ett diagrambibliotek. Ett ord och värde står alltid bredvid färgen, och den grupperade tabellen fungerar som tabellvy.
- **Tidslinje:** per dag för perioder upp till 31 dagar, annars per vecka.
- **Standardgruppering** är Kund → Projekt. Gruppering per vecka och månad har lagts till utöver planens exempel.
- **Perioder** räknas i användarens tidszon, och en post räknas till den dag den startar.
- **Behörighet:**
  - Medlemmar ser bara sin egen tid i sammanfattning, detaljerad rapport och export, oavsett filter i URL:en. Belopp och timpriser visas bara för ägare/admin.
  - Projektuppföljningen visar summerad tid för alla medlemmar på de projekt man har åtkomst till, på samma sätt som projektsidans förbrukning sedan Fas 3. Ingen per-person-uppdelning visas för medlemmar.
  - Tid per medlem och vecka på projektsidan visas bara för ägare/admin.
- **Medlemsfiltret** innehåller även inaktiverade medlemmar (märkta "inaktiv"), eftersom deras historik finns kvar i rapporterna.
- **Export:**
  - CSV använder semikolon, decimalkomma och BOM så att svenska Excel öppnar filen direkt.
  - XLSX har riktiga tal: timmar som decimaltal och belopp i kronor.
  - Filnamnet innehåller organisation, rapporttyp och period.
- **Kundsidans** periodval har bara förvalen. Anpassad period finns i rapporten.
- **Rättningar:** nyskapade organisationer får databasens standardvärden direkt (veckostart, valuta, tidszon). Tidigare började veckan på söndag tills organisationen lästes om. Dessutom ersätter `t()` nu längsta platshållaren först, som Laravel gör.

### Status Fas 5 (2026-11-18)

Klar. Byggt:

- **MCP-server:** `TimetrackerServer` på `/mcp`, skyddad med OAuth 2.1 via Passport.
  - `Mcp::oauthRoutes()` ger discovery, metadata och dynamisk klientregistrering.
  - Rate limits: 120 anrop/min per användare på `/mcp`, och 10/min per IP på de publika OAuth-routerna.
- **Alla elva verktyg i 6.3:**
  - Verktygen agerar som den inloggade användaren via samma Actions, policies och `ReportBuilder` som webben.
  - Poster som skapas via MCP får `source = mcp`.
  - Projekt, kunder och medlemmar kan anges med id eller namn. När ett namn matchar flera listas kandidaterna med id, så att AI:n kan fråga användaren.
  - Läsverktyg är märkta `IsReadOnly`, `delete_time_entry` är märkt `IsDestructive`.
- **Serverinstruktioner** beskriver domänen, datumtolkning i användarens tidszon och att AI:n ska bekräfta innan den skapar många poster eller ändrar och tar bort.
- **Godkännandesida för OAuth** (`auth/oauth-authorize`), i appens utseende och på svenska.
- **Inställningar → AI-kopplingar:**
  - MCP-adress med kopieringsknapp.
  - Instruktioner för Claude (webb, desktop, mobil), Claude Code och andra klienter.
  - Lista över anslutna assistenter med "Koppla från" (återkallar access- och refresh-tokens).
- **Loggning:** varje MCP-anrop loggas med metod, verktyg, användare, status och tid. Argumenten loggas inte eftersom de kan innehålla beskrivningar.
- **Verifierat lokalt hela vägen:** dynamisk registrering → inloggning → godkännande → PKCE-tokenutbyte → `initialize` → verktygsanrop.

Avvikelser och förtydliganden:

- **Test mot Claude via tunnel återstår.** Det kräver en publik HTTPS-adress och görs manuellt (se README).
- **Prompts** (`weekly_summary`, `fill_week_from_notes`) är valfria i planen och är inte byggda. Verktygen och instruktionerna räcker för de exemplen.
- **Token-livslängd:** access-token 1 dag och refresh-token 60 dagar (Passports standard är ett år). Gamla tokens rensas dagligen med `passport:purge`. Device-flödet är avstängt.
- **Verktygens svar och felmeddelanden är på engelska**, eftersom de läses av AI:n och inte är UI. AI:n svarar på användarens språk.
- **Gränser:** `create_time_entries` tar högst 50 poster per anrop (allt eller inget). `list_time_entries` returnerar högst 500 poster och säger till när listan är avkortad.
- **Ta bort** kan inte ångras via MCP; ångra finns bara i webbens notis.
- **`get_project_status`** visar förbrukad tid för alla på projekt man har åtkomst till, på samma sätt som projektuppföljningen.
- **Rättning av inloggningsflödet:** om en användare loggar in mitt i en OAuth-godkännande (även via passkey-förslaget efter inloggning) kommer hen tillbaka till godkännandesidan. Den sidan laddas alltid som en hel sida, eftersom Passport skickar vidare till klientens domän.
- **Tidstolkning:** webbformuläret och MCP använder samma klass (`LocalTimes`) för att tolka lokal tid.

### Status Fas 6 (2026-11-18)

Klar, förutom beslut om hosting. Byggt:

- **PWA:**
  - Egen ikon (lila klocka) som favicon, SVG, apple-touch-icon och PNG 192/512/maskable.
  - `site.webmanifest` på svenska, `theme-color` och fristående läge.
  - Ingen offline-funktion, enligt planen.
- **Felhantering:**
  - Egna felsidor (`error`) för 403/404/429/500/503 när debug är av, även för utloggade.
  - JSON-klienter (MCP, OAuth) får JSON-fel.
  - En utgången session (419) skickar tillbaka med en notis.
  - Nätverksfel visas som notis i stället för att sidan låser sig.
- **Tomlägen:** genomgångna med en ny, tom organisation. Formuläret förklarar när det saknas projekt (med länk "Skapa ett projekt" för ägare/admin).
- **Tillgänglighet:** axe-core kördes mot alla huvudsidor i ljust och mörkt läge, och fynden är åtgärdade:
  - Kontrasten på dämpad text och på knappar i mörkt läge.
  - En `h1` per sida.
  - `<main>` på inloggningssidorna.
  - Vyväxlare och statusfilter är nu en knappgrupp (`SegmentedControl`) i stället för flikar utan paneler.
  - Rapportflikarna har riktiga flikpaneler.
  - Knappar utan synlig text har namn.
  - Kvar: FullCalendars interna skrollyta i dag/veckovyn (tredjepart; listvyn är fullt tangentbordsnavigerbar) och ett tomt `role="img"` i React Arias skärmläsarannonsering.
- **Prestanda:**
  - Lazy loading är blockerat utanför produktion så att N+1 fångas i tester och lokalt; en träff åtgärdad.
  - Behörigheter slås upp en gång per rapport/MCP-anrop i stället för per rad: detaljerad rapport gick från 75 till 20 frågor.
  - Index för vanliga uppslag som Postgres inte skapar själv: medlemskap per användare, projekt per kund, teamets tid per period m.fl.
- **E-post:** egen layout med logotyp, lila knapp och svensk ram ("Hej …!", "Hälsningar,") för inloggningslänk och inbjudan.
- **Produktionskonfig:**
  - Tvingad HTTPS i produktion.
  - `TRUSTED_PROXIES` för lastbalanserare.
  - `.env.production.example` (Postgres med SSL, databaskö, krypterade och säkra sessionscookies, SMTP, Passport-nycklar).
  - Driftchecklista i README.

Kvar att besluta: **hosting** (se förslag i sammanfattningen till beställaren). Backup och CI/CD-deploy beslutas samtidigt.

### Tillägg efter Fas 6: kommandomeny (⌘K) (2026-11-19)

Beställt i efterhand (inte i ursprungsplanen). Kommandomenyn öppnas med ⌘K / Ctrl+K, eller med sökknappen i sidomenyn eller i mobilens toppfält. Byggd med HeroUI (Modal, `Autocomplete.Filter`, SearchField, ListBox).

- **Snabbåtgärder:** Rapportera tid och Kopiera förra veckan. Nytt projekt, Ny kund och Bjud in medlem visas efter behörighet.
- **Gå till:** alla sidor och inställningar.
- **Rapporter:** denna vecka, förra veckan, denna månad, förra månaden, i år.
- **När man söker visas även:**
  - projekt (öppna eller "Rapportera tid på X" med projektet förvalt),
  - kunder (ägare/admin),
  - "Visa tid för X" för medlemmar (ägare/admin).
- **Övrigt:** byt organisation, tema (ljust/mörkt/system) och logga ut.
- **Data:** projekt, kunder och medlemmar hämtas från `GET /{org}/command-palette` första gången menyn öppnas, med samma behörigheter som resten av appen.
- **Direktöppning:** sidor öppnar formulär och dialoger via URL-parametrar (`?new=1`, `?copy=1`, `?invite=1`), som tas bort ur adressen efteråt.

### Tillägg efter Fas 6: sidopaneler (side drawers) (2026-11-19)

Beställt i efterhand. Formulär för att skapa och redigera projekt och kunder öppnas i en sidopanel i stället för på en egen sida eller i en modal: från höger på desktop och som bottenark på mobil (HeroUI Drawer, komponenten `SideDrawer`). Tidposter ligger kvar i modal/bottenark eftersom de registreras snabbt och ofta.

- **Projekt:** "Nytt projekt" öppnar panelen på projektlistan och på kundsidan (med kunden förvald). "Redigera" öppnar den på projektsidan. Ett nytt projekt öppnar projektsidan efter sparande; en ändring stänger panelen.
- Sidorna `projects/create` och `projects/{project}/edit` är borttagna. Kommandomenyn och länken i tidformuläret öppnar panelen via `projekt?new=1`.
- Formulärets val (kunder, färger, valuta) skickas bara till användare som får skapa eller ändra projekt.
- **Kunder:** "Ny kund" öppnar panelen på kundlistan (även via kommandomenyn) och "Redigera" på kundsidan.

### Tillägg efter Fas 6: PDF-export av rapporter (2026-11-19)

Beställt i efterhand (planen sa "PDF senare"). Sammanfattningen och den detaljerade rapporten kan exporteras som PDF, med samma filter som på skärmen.

- **Motor:** `barryvdh/laravel-dompdf` (godkänt beroende). Ren PHP, ingen webbläsare eller extern tjänst på servern, så den fungerar oavsett hosting.
- **Innehåll:** organisation, rubrik, period och aktiva filter (namn slås upp inom organisationen), nyckeltal (timmar, debiterbara timmar och belopp), tabell och sidfot med skapad tid, användare och sidnummer.
  - Sammanfattningen är stående A4 med grupper och undergrupper.
  - Den detaljerade rapporten är liggande A4 med en rad per post.
- **Behörighet:** samma regler som CSV/XLSX. Medlemmar får bara sin egen tid och inga belopp.
- **Kod:** `ReportExporter` (format `pdf`) renderar Blade-vyerna i `resources/views/reports/pdf`.

## 8. Senare (medvetet bortvalt i v1)

Live-timer · uppgifter och taggar · låsta perioder och attest · veckomål/heltidsnorm · kostnadspriser och lönsamhet · fakturaunderlag/integration med ekonomisystem · sparade och delade rapporter (publika länkar) · Microsoft/Entra SSO · import från Clockify/Toggl (CSV) · kalenderintegration (Google/Outlook) · aktivitetslogg/audit · native-app.

## 9. Öppna frågor

1. Ska vem som helst kunna registrera sig och skapa en organisation, eller är det endast inbjudan (vi bygger internt först)? *Antagande: endast inbjudan, styrt av config-flagga.*
2. Ska en tidpost kunna sakna projekt (t.ex. "intern tid")? *Antagande: nej, skapa ett internt projekt i stället.*
3. Behövs avrundning i rapporter (t.ex. till närmaste 15 min) redan i v1? *Antagande: nej.*
4. Behöver vi fler SSO-leverantörer än Google snart (Microsoft)? Påverkar inte v1 men Socialite-upplägget bör vara generellt.
5. Ska medlemmar kunna se sina egna belopp (timpris × tid)? *Antagande: nej, endast ägare/admin.*
