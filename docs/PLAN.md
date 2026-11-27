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
uppgifter (tasks), integrationer med externa kalendrar, native-app. (Taggar lades till i efterhand, se tilläggen efter Fas 6.)

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
| Produktion | Postgres 17. Docker Compose med serversideup/php (FrankenPHP) och Laravel Octane, se "Tillägg efter Fas 6: drift med Docker". |
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

**clients** – `id, organization_id, name, website (nullable), organization_number (nullable), email (nullable), notes (nullable), archived_at, timestamps`

**projects** – `id, organization_id, client_id (nullable), name, code (nullable), color, is_billable (default true), hourly_rate (nullable), estimate_seconds (nullable), visibility (public|private), starts_on/ends_on (nullable), archived_at, timestamps`

**project_members** – `id, project_id, user_id, hourly_rate (nullable), timestamps`

**time_entries** – `id, organization_id, user_id, project_id, description (nullable), started_at, ended_at, duration_seconds (beräknad), is_billable, hourly_rate (snapshot, nullable), source (web|mcp|import), timestamps, deleted_at (soft delete)`

Index: `time_entries(organization_id, user_id, started_at)`, `time_entries(organization_id, project_id, started_at)`.

### Affärsregler

- Varje tidpost **måste** ha ett projekt. Projektet måste tillhöra samma organisation och vara aktivt (ej arkiverat).
- `ended_at > started_at`, max 24 h per post. Poster får gå över midnatt; de räknas till startdagen i rapporter.
- Överlappande poster tillåts.
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
- **Webbsession**: varje webbförfrågan förnyar en aktiv session. Inloggningen upphör efter 14 dagars inaktivitet som standard (`SESSION_LIFETIME` i minuter).
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
- Organisationsväljaren används för att skapa en organisation, byta aktiv organisation och öppna den aktiva organisationens inställningar (namn, valuta, standardpris, veckostart, tidszon).
- Bjuda in via e-post med roll; acceptera inbjudan som ny eller befintlig användare.
- Ändra roll, sätta medlemmens timpris, inaktivera medlem (behåll historik).

### 4.3 Kunder

- Lista med sök, skapa/redigera/arkivera. Fält: namn, hemsida, org.nr, e-post, anteckning. Hemsidan är valfri och kan användas för att hämta en logga till formuläret.
- På mobil går kundlistan kant i kant. Sökning och status finns i ett bottenark, och valda filter visas i den fasta rubrikraden. Den runda plusknappen i rubrikraden öppnar formuläret för ny kund.
- Kundsida: kundens projekt + summerad tid för vald period, inklusive sedan start.

### 4.4 Projekt

- Lista med sök och filter (kund, debitering, aktiva/arkiverade), skapa/redigera/arkivera. På mobil ligger filtren i ett bottenark. Valda filter visas i den fasta rubrikraden, där ägare och administratörer också kan skapa projekt med en rund plusknapp.
- Fält: namn, kund (valfri), kod, färg, debiterbart, timpris, **estimat i timmar**, synlighet, start/slut (valfritt), medlemmar (+ ev. pris per medlem).
- Projektsida: förbrukat vs estimat (progress, varning vid 80 % och 100 %), tid per medlem, tid per vecka, debiterbart belopp.

### 4.5 Tidrapportering

**Snabbinmatning (formulär)** – datum, start–slut *eller* start + varaktighet ("1,5", "1:30", "90m" ska alla fungera), projekt (sökbar väljare med senast använda först; sökningen matchar även kundnamnet, så en kund listar sina projekt), beskrivning, debiterbar. Smarta förval: start = slut på dagens senaste post.

**Lista** – egen post i sidomenyn och under Mer på mobil. Poster för vald vecka grupperas per dag med dagssumma och veckosumma, redigera inline eller i drawer, duplicera post, ta bort med ångra.

- På mobil delar Lista kalenderns fasta sidhuvud med veckosumma, periodväljare och personavatar. Listan går kant till kant och dagrubrikerna ligger kvar under sidhuvudet när man scrollar genom dagen. Tidsposterna delar radlayout med den detaljerade rapporten och visar projekt och varaktighet överst, följt av beskrivning, taggar och klockslag med kundnamn. Svep i sidled för att byta vecka. Plusknappen och, när den är tillgänglig, Kopiera föregående vecka ligger nere till höger.
- Helgdagar visas direkt under dagrubriken på både mobil och desktop, även när dagen saknar tidsposter och frånvaro.

**Kalendervy** (veckovy är standard)
- Plusknappen förifyller starttiden med början av den aktuella timmen i användarens tidszon. Varaktigheten hämtas från den senaste tidsposten som användaren sparade via plusknappen i den aktuella organisationen och webbläsaren. Sluttiden räknas ut från starttiden och varaktigheten. Samma förval gäller på dator och mobil.
- På breda skärmar delar kalenderrubriken och periodens totalsumma rad med personväljaren, periodväljaren och plusknappen. Periodväljaren använder samma komponent som i rapporterna och visar periodens namn bredvid datumen. Pilarna stegar en dag eller vecka enligt vald vy.
- Väljaren visar vald period i huvudet. Idag visas i huvudet när ett annat datum är valt i dagvyn. I veckovyn används snabbvalet Denna vecka. Byt mellan Dag och Vecka i väljaren. I läget Dag väljs ett enskilt datum och i läget Vecka väljs hela veckor. Veckan börjar enligt organisationens inställning. Lista använder samma veckoväljare.
- I mobilens kalenderhuvud visas bara namnet för de relativa dagarna och veckorna. För övriga perioder visas även datumet.
- På mobil ligger Igår, Idag och I morgon på en rad i dagväljaren. Svep åt vänster över månadsrutnätet för nästa månad och åt höger för föregående, eller använd månadspilarna.
- Ett sidledes svep över kalendern på mobil byter dag i dagvyn och vecka i veckovyn.
- Dra i tom yta för att skapa post → öppnar formulär förifyllt med tid.
- På pekskärm skapar ett långtryck i tom tidsyta ett entimmesblock. Flytta blocket i 15-minuterssteg och släpp för att öppna Rapportera tid med vald dag, start- och sluttid.
- Dra för att flytta, dra i kant för att ändra längd, klicka för att redigera.
- Poster färgas efter projekt. Dagssummor i kolumnhuvud, veckosumma i toppen. ISO-veckonumret visas centrerat i en dämpad ton ovanför timskalan i veckovyn.
- "Kopiera föregående vecka" (som utkast som användaren bekräftar).
- Admin kan växla till att se/rapportera åt en annan medlem.
- Bibliotek: **FullCalendar** (React, endast MIT-delarna `timegrid` + `interaction`), stylat med HeroUI:s CSS-variabler. Gör en kort spike först; om det blir för tungt att styla, bygg en egen enkel veckovy.

### 4.6 Rapporter

- **Sammanfattning**: period (förval: denna vecka, förra veckan, denna månad, förra månaden, i år, sedan start, anpassad), filter (medlemmar, kunder, projekt, taggar, debitering), gruppering i två nivåer (t.ex. Kund → Projekt, Projekt → Medlem, Medlem → Dag). Visar timmar, debiterbara timmar och belopp. Stapeldiagram per dag/vecka och fördelning per projekt. För hela kalenderår kan diagrammet växla mellan vecka och månad.
  I uppdelningstabellen med andelsstaplar kan användaren flytta måttkolumner med drag och släpp eller via kolumnrubrikens meny. Ordningen sparas per användare i webbläsaren.
- **Detaljerad**: lista med alla poster enligt filter, sortering, summering.
- **Projektuppföljning**: alla aktiva projekt med estimat, förbrukat, kvar och procent.
- **Export**: CSV och XLSX (t.ex. `openspout/openspout`). PDF tillagt i efterhand (se tillägg efter Fas 6).
- Rapportens filter ligger i URL:en så att den går att bokmärka och dela internt.
- I tabeller med flyttbara kolumner kan användaren dra i handtagen eller använda flyttmenyn med tangentbord eller pekskärm. Ordningen sparas lokalt per tabell och användare. Identitets- och åtgärdskolumner ligger fast där de behövs.
- Medlemmar ser endast sin egen tid. Belopp visas endast för ägare/admin.
- På mobil ligger diagrammet först och går kant i kant. Svep på staplarna eller välj period i rubrikraden. Summorna visas i en rad med snitt per rapportdag. Uppdelning, frånvaro, detaljer och projektuppföljning visas som listor. Filter öppnas som bottenark och export ligger sist på sidan.
- Sammanfattningens diagram har teckenförklaringen under staplarna. För hela kalenderår visas rubriken ”Timmar över tid” med en meny för vecka och månad. För övriga perioder finns diagramrubriken för skärmläsare.

### 4.7 Startsida (dashboard)

*Pausad: kalendern är startsidan, se "Ändring efter Fas 6: kalendern är startsidan".*

- Min tid idag / denna vecka (mot ev. veckomål senare), senaste poster, snabbinmatning.
- För admin: teamets timmar denna vecka, projekt som närmar sig estimat.

### 4.8 AI / MCP

Se avsnitt 6.

### 4.9 Mobil och desktop

- Responsiv layout: sidomeny på desktop. Mobilens bottennavigering visar de fyra första synliga menylänkarna i kontots ordning, följda av Mer. Övriga länkar, sök, profil och organisationsbyte finns i Mer-panelen.
- Bottennavigeringen har 16 px luft på sidorna och minst 20 px under flikarna, med safe area inräknad. Bottenark har samma nederkant och knapparna i footern ligger 24 px från skärmens sidor.
- Stor "+"-knapp för ny post på mobil. Rapportdialogen fyller skärmen med rubriken och stängkrysset högst upp och Avbryt och Spara längst ned. Datum ligger på en egen rad, följt av Start, Slut och Tid på samma rad. När tangentbordet visas minskar avståndet under knapparna. Kalenderns bakgrund i mörkt läge fortsätter bakom innehållet vid överskrollning.
- Aktiva Spara- och Avbryt-knappar i överlägg ger samma lätta haptiska återkoppling vid tryck på mobil som Spara i tidrapporteringen.
- Tidrapporteringens listvy följer kalenderns mobilmönster med fast sidhuvud, periodväljare, flytande knappar och sidledes svep mellan veckor.
- Kund-, projekt-, tagg- och teamlistorna har fast rubrikrad, lista kant i kant och runda ikonknappar på mobil. Kunder, projekt och Team har filter i bottenark. Taggar har ett bottenark för sökning.
- Under 768 px följer bottenarket den synliga skärmytan i Safari och i webbappen från hemskärmen. När tangentbordet visas ligger sidan bakom stilla, handtag och rubrik ligger överst och eventuella åtgärder ligger ovanför tangentbordet. Innehållet scrollar och visar fältet med fokus även vid Nästa/Föregående. Arket återtar sin vanliga höjd när tangentbordet stängs.
- Rapporter under 768 px har en fast rubrikrad med rapporttyp och, där det finns, periodväljare och filterbottenark. Listor och diagram går kant i kant och exporten ligger sist.
- Touchvänliga tidsväljare, inga hover-beroende funktioner.
- PWA-manifest + ikon så att appen kan läggas på hemskärmen (ingen offline-funktion i v1).
- I den inloggade mobilwebbläsaren visas ett installationsförslag i ett bottenark ovanpå flikraden högst en gång per 30 dagar. ”Påminn mig senare” skjuter upp nästa förslag i 30 dagar. Installationsknappen öppnar webbläsarens dialog när den finns och visar annars instruktioner. Den installerade webbappen visar inget installationsförslag.
- Webbappens namn och sidtitlarna hämtas från `APP_NAME`. Sidtitlarna börjar med appnamnet, till exempel ”TimeTracker | Kalender”.
- Nypzoom är avstängd i den installerade webbappen. Scroll fungerar som vanligt i båda lägena och nypzoom fungerar i webbläsaren.
- Sid- och flikbyten visas direkt. Dialoger, bottenark och andra överlägg behåller sin rörelse. Vid kallstart på mobil börjar flikarnas kod och siddata förladdas under splash-skärmen. Splash-skärmen tonas ut när startvyn är redo och skärmen har visats i minst 1,5 sekunder. Inertia sparar flikdata i minnet i upp till 30 sekunder. Versionsmärkta byggfiler och publik grafik återanvänds mellan starter via webbläsarens HTTP-cache.

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

### 5.6 Produktion

Postgres, köer (database-driver räcker initialt), e-post för inbjudningar/magic links och HTTPS. Driften sker med Docker Compose på en egen server, se "Tillägg efter Fas 6: drift med Docker". Backup är byggd, se "Tillägg efter Fas 6: nattlig backup". CI/CD-deploy beslutas senare.

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

**Fas 6 – Finputs inför produktion** *(klar, se Status nedan)*
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
- Formulär: modal på desktop, drawer på mobil. Projektväljaren visar senast använda först och starttiden föreslås smart.
- Listvy med dags- och veckosummor, och kalendervy med FullCalendar 7 (vecka/dag). I kalendern kan man dra för att skapa, flytta och ändra längd. Poster färgas efter projekt och dagssummor står i kolumnhuvudet.
- Kopiera föregående period som utkast med kryssrutor. Dagsvyn kopierar föregående dag. Vecko- och listvyn kopierar föregående vecka. Ikonknappen visas när den valda perioden är tom och föregående period har tidsposter för den valda personen. På mobil ligger den ovanför plusknappen i kalendern och listan. På desktop visas den i kalenderns nedre högra hörn och i listans verktygsrad. En tooltip beskriver åtgärden.
- Ägare/admin kan se och rapportera åt andra medlemmar: via personväljaren i kalendern och via medlemmens avatar längst ner till vänster i formuläret (även snabbinmatningen på startsidan). Avataren visar profilbilden eller medlemmens initialer.
- Duplicera post, och ta bort med ångra i toasten.
- Startsida: min tid idag och denna vecka, senaste poster och snabbinmatning. För ägare/admin även teamets vecka och projekt som närmar sig estimatet (≥ 80 %).
- Projektsidan visar förbrukad tid mot estimatet.

Avvikelser och förtydliganden:

- FullCalendar-spiken gick bra, så ingen egen veckovy behövs. Kalendern är stylad med HeroUI:s CSS-variabler.
- Standardvy: vecka på desktop och dag på mobil. På mobil rullas kalenderns dag- och veckovy mellan den fasta rubrikraden och bottennavigeringen. Rullningsindikatorn håller sig inom samma yta. Sidledes svep byter dag eller vecka, även när svepet börjar på en tidspost. Vid överskrollning fortsätter dagvyns bakgrund och timskalans lodräta linje både uppåt och nedåt. Dag och Vecka kan väljas i kalenderns periodväljare. Lista nås via mobilnavigeringen.
- På mobil ger ett direkt tryck ett lätt haptiskt klick vid flikbyte, öppning av Mer eller kalenderns datumväljare och vid tryck på Spara i tidrapporteringen där enheten stöder det. Den aktiva fliken ger ingen puls. Android med stöd för vibration ger också en kort puls när en flytt eller längdändring snäpper till ett nytt giltigt 15-minutersläge.
- På iPhone med stöd för Safaris inbyggda reglage kan man känna ett klick vid varje nytt giltigt 15-minutersläge när man flyttar en sparad tidspost, ändrar start eller slut med handtagen, eller flyttar förhandsvisningen vid långtryck på en tom tid. Börja mitt på posten eller mitt i dagkolumnen vid långtryck. Ytan på tom tid är högst 44 px bred och täcker högst en tredjedel av kolumnen.
- Listvyn redigerar i modal/drawer, inte inline: samma formulär överallt och enklare på mobil.
- "Duplicera" öppnar ett förifyllt formulär för idag i stället för att skapa en kopia direkt.
- Datum och tider matas in med webbläsarens inbyggda fält. De följer enhetens språk, vilket ger bra tangentbord på mobil.
- Tider matas in och visas i användarens tidszon och lagras i UTC.
- En sluttid före starttiden tolkas som nästa dag. En post får vara högst 24 timmar.
- Timpriset snapshottas när posten skapas och räknas om bara om projekt eller medlem ändras.
- Admin kan rätta poster för inaktiverade medlemmar men inte skapa nya åt dem.
- Projektsidans tid per medlem/vecka och belopp, samt kundsidans summerade tid, byggs med rapporterna i Fas 4.

### Status Fas 4 (2026-11-18)

Klar. Byggt:

- `ReportBuilder` (`app/Services/Reports`) med filter (period, medlemmar, kunder, projekt, debiterbar) och gruppering i två nivåer: kund, projekt, medlem, dag, vecka eller månad. Samma builder ska användas av MCP-verktyget `get_report` i Fas 5.
- **Sammanfattning** visar först stapeldiagram per dag, vecka eller månad, med teckenförklaringen under, sedan timmar, debiterbara timmar och belopp. Summorna visas som kort på desktop och i en rad på mobil. Uppdelningen med andelsstaplar visas som tabell på desktop och som lista på mobil. Vid gruppering per projekt visas varje projekts andel av tiden i projektets färg.
- **Detaljerad** rapport är sorterbar på datum, tid, projekt och medlem, med 50 poster per sida och summor.
- **Projektuppföljning** visar alla aktiva projekt med estimat, förbrukat, kvar och procent.
- **Export** till CSV och XLSX med `openspout/openspout`, både för sammanfattningen och den detaljerade rapporten.
- **Projektlistan** visar på desktop kod, kund, debitering, timpris (bara för den som får se priser), synlighet, budget i timmar och rapporterad tid. Budgeten visar också förbrukad andel och ett streck om estimat saknas. På mobil ligger listan kant i kant direkt under rubrikraden. Varje rad visar projektnamn med lås för privata projekt, kund och kod, rapporterad tid och en budgetstapel när det finns ett estimat. Listan filtreras på sök, kund, debitering (`billable=1/0`) och aktiva/arkiverade. Filtren ligger i URL:en. MCP-verktyget `list_projects` tar samma filter (`billable`).
- **Projektsidan** visar debiterbara timmar och belopp, tid per medlem och timmar per vecka för de senaste 12 veckorna. **Kundsidan** visar tid och belopp per projekt för en vald period. Båda har en länk till rapporten.
- "Rapporter" finns i sidomenyn. På mobil avgör sidomenyns ordning och synlighet om Rapporter visas som flik eller i Mer-panelen.

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

Klar. Byggt:

- **PWA:**
  - Egen ikon (vitt T med klockvisare på lila botten) som SVG, ICO (16, 32, 48 px), Apple Touch (120, 152, 167, 180 px) och PWA-ikoner (192 och 512 px, även maskbara).
  - Apple Touch- och PWA-ikonerna genereras från `public/favicon.svg` och får nya filnamn när grafiken ändras.
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

Hosting är beslutad: Docker Compose, i Coolify (se "Tillägg efter Fas 6: drift med Docker" och "Tillägg efter Fas 6: Coolify"). Backup är byggd (se nedan). Kvar att besluta: CI/CD-deploy.

### Tillägg efter Fas 6: kommandomeny (⌘K) (2026-11-19)

Beställt i efterhand (inte i ursprungsplanen). Kommandomenyn öppnas med ⌘K / Ctrl+K, eller med Sök i sidomenyn eller mobilens Mer-panel när Sök är synlig. Byggd med HeroUI (Modal, `Autocomplete.Filter`, SearchField, ListBox).

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
- **Diagram:** timmar per dag (per vecka för långa perioder) i båda rapporterna, och tid per projekt i sammanfattningen. Diagrammen byggs i HTML/CSS och visar namn och värde på varje stapel, så att färgen aldrig är det enda som skiljer projekten åt.
- **Behörighet:** samma regler som CSV/XLSX. Medlemmar får bara sin egen tid och inga belopp.
- **Kod:** `ReportExporter` (format `pdf`) renderar Blade-vyerna i `resources/views/reports/pdf`.

### Tillägg efter Fas 6: taggar och projektanteckningar (2026-11-19)

Beställt i efterhand (taggar stod tidigare under "Senare").

**Taggar** per organisation, på tidsposter:

- **Skapa:** alla som rapporterar tid kan skapa taggar direkt i tidsformuläret. Fältet föreslår befintliga taggar och har "Skapa taggen …"; Enter eller komma lägger till. Namn jämförs utan hänsyn till versaler, så "möte" återanvänder "Möte".
- **Gränser:** högst 10 taggar per post, högst 50 tecken per tagg.
- **Hantera:** ägare och admin (rättigheten `ManageTags`) lägger till, byter namn på och tar bort taggar på sidan Taggar (`/{organisation}/tags`, i huvudmenyn efter Kunder och i ⌘K). Byter man namn till en befintlig taggs namn slås taggarna ihop. Att ta bort en tagg tar inte bort några poster.
- **Sidan Taggar** (tillägg 2026-11-23, flyttad från organisationsinställningarna): varje tagg visas med antal poster, rapporterade timmar och dagen den senast användes, i användarens tidszon. Listan går att söka i. På mobil går listan kant i kant och rubrikraden har en rund plusknapp för nya taggar och en sökknapp som öppnar ett bottenark. Dialogen Byt namn visar en förvarning när det nya namnet skulle slå ihop två taggar. Medlemmar ser inte sidan.
- **Sidan Team** visar aktiva och inaktiverade medlemmar med sök och rollfilter. På mobil visas listan kant i kant, med en rund Bjud in-knapp i rubrikraden och bottenark för sök, status och roll, inbjudan och medlemspanelen. På mobil och desktop visas ett tips om att bjuda in när du är ensam aktiv medlem och listan är ofiltrerad. Team visas i sidomenyn när organisationen fått en andra medlem och ligger sedan kvar. Första inbjudan görs via organisationsinställningarna. Ägare och admin kan bjuda in, se timpris och hantera medlemskap. Arbetsschemat lagras per medlemskap och kalendern använder den valda medlemmens veckostart. Profilbilder uppladdade från Team gäller i den aktuella organisationen.
- **Tidsposter:** taggarna visas i listvyn. "Kopiera förra veckan" kopierar dem.
- **Rapporter:**
  - Filter "någon av taggarna".
  - Gruppering per tagg. En post med flera taggar räknas under varje tagg och poster utan tagg under "Utan tagg"; det framgår på sidan och i PDF:en. Totalen påverkas inte.
  - Taggarna visas i den detaljerade rapporten, i CSV/XLSX (egen kolumn) och i PDF.
- **MCP:**
  - `create_time_entries` och `update_time_entry` tar emot taggnamn. Vid uppdatering ersätter en lista alla taggar, `[]` tar bort dem och utelämnat behåller dem.
  - `get_report` filtrerar och grupperar på taggar.
  - `get_context` listar taggarna.
  - Alla poster i svaren har sina taggar.
- **Kod:**
  - Tabellerna `tags` och `tag_time_entry`.
  - Actions i `app/Actions/Tags` (`ResolveTags`, `CreateTag`, `RenameTag`, `DeleteTag`).
  - `TagPolicy`.

**Projektanteckningar:** ett fritextfält (`projects.notes`, högst 10 000 tecken) i projektpanelen. Anteckningarna visas på projektsidan för alla som kan se projektet.

### Tillägg efter Fas 6: fler MCP-verktyg (2026-11-19)

Beställt i efterhand. Verktygen utökar tabellen i 6.3. De återanvänder befintliga actions och policies och har samma behörigheter som webben.

| Verktyg | Typ | Beskrivning |
|---|---|---|
| `list_members` | läs | Medlemmar (roll, aktiv/inaktiverad) och väntande inbjudningar. Timpriser visas bara för ägare och admin. |
| `invite_member` | skriv | Bjud in via e-post som medlem eller admin (inte ägare). |
| `cancel_invitation` | skriv (destruktiv) | Avbryt en väntande inbjudan. |
| `update_member` | skriv | Ändra roll, timpris eller aktiv status. Ägarens roll kan inte ändras och ägaren kan inte inaktiveras. |
| `remove_member` | skriv (destruktiv) | Ta bort en medlem, aldrig ägaren. |
| `rename_tag` | skriv | Byt namn på en tagg. Namnet på en befintlig tagg slår ihop dem. |
| `delete_tag` | skriv (destruktiv) | Ta bort en tagg. Posterna finns kvar. |
| `update_client` / `update_project` | skriv | Ändra bara angivna fält. `null` rensar ett valfritt fält. |
| `archive_client` / `archive_project` | skriv | Arkivera, eller återställ med `archived=false`. |
| `export_report` | läs | Länk till exporten (PDF, XLSX eller CSV) med samma filter som `get_report`. |

- **Hantering:** medlemmar, taggar, kunder och projekt kräver samma rättigheter som i webben (`UpdateMember`, `ManageTags`, `ManageClients`, `ManageProjects` m.fl.).
- **Export:** `export_report` returnerar en nedladdningslänk till webbappens befintliga export och en länk till samma rapport i appen. Användaren öppnar länken inloggad, så appen kontrollerar behörigheten igen. Ingen ny publik väg och inga delade länkar. AI:n kan inte läsa filen själv och använder `get_report` för siffrorna.
- **Projektanteckningar:** `create_project` och `update_project` tar emot `notes`.
- **Avbryta inbjudan:** gick tidigare direkt i controllern. Nu är det en egen action, `CancelOrganizationInvitation`, som både webben och MCP använder.
- **Verktygslistan:** servern listar alla verktyg på en sida (`defaultPaginationLength = 50`), så klienter som inte följer pagineringen ser allt.

### Tillägg efter Fas 6: import från Clockify (2026-11-19)

Beställt i efterhand (import från Clockify stod under "Senare"). Ägare och admin, dvs. den som får hantera kunder, projekt och teamets tid, kan importera en CSV-export från Clockify till organisationen. Det görs under Organisationsinställningar → Import, eller via ⌘K.

1. **Ladda upp** CSV-filen (högst 5 MB och 20 000 rader). Filen sparas i cachen i två timmar och kan bara läsas av den som laddade upp den, i samma organisation.
2. **Förhandsvisning:** inget sparas förrän man importerar.
   - **Personer:** matchas mot aktiva medlemmar på e-post. Övriga kopplas till en vald medlem eller hoppas över. Konton skapas inte, de kommer från inbjudningar.
   - **Inbjudna** (tillägg 2026-11-23): personer med en giltig inbjudan går att välja, som "e-post (inbjuden)", och matchas på den inbjudna adressen. Vid importen läggs de till som medlemmar med inbjudans roll (`AddInvitedMember`): kontot skapas med namnet från filen, om det inte redan finns, så att tiden kan läggas på dem direkt. Inbjudan förblir öppen. Personen loggar in via den som vanligt, och när den accepteras ligger medlemskapet kvar. E-postadressen verifieras vid första inloggningen. Inbjudna med rollen medlem får bara tid på publika projekt, eftersom de inte är tilldelade några privata. I förhandsvisningen används ett negativt id som ställföreträdare (`ClockifyImportPlan::invitationMemberId()`), och inget sparas förrän importen körs.
   - **Kunder och projekt:** matchas på namn utan hänsyn till versaler. Saknade skapas, nya projekt som publika. Debiterbart väljs per nytt projekt; befintliga behåller sin inställning.
   - **Timpris** (tillägg 2026-11-20): under varje debiterbart projekt listas personerna med tid där, med timmar och ett prisfält. Fältet är förifyllt med det pris prisordningen ger: personens pris i projektet, projektets pris, personens pris i organisationen och sist organisationens standardpris. För nya projekt används personens pris i organisationen eller standardpriset. Olika personer kan ha olika pris i samma projekt. Ett ändrat pris sparas som personens pris i projektet (`AssignProjectMember`), så att tid som rapporteras senare får samma pris. Tomt fält följer prisordningen. Icke-debiterbara projekt har inga prisfält. Priserna visas och tas emot bara för den som får se priser (`viewRates`).
   - **Poster längre än 24 h** (tillägg 2026-11-23), t.ex. en hel veckas tid inlagd som en post, delas vid midnatt i importörens tidszon upp i en post per dag, med Clockifys start- och sluttid. 32 h från 22 juni 08:30 till 23 juni 16:30 blir 15,5 h och 16,5 h. Totalen behålls och ingen del blir längre än 24 h, inte heller dagen då vintertiden börjar. Förhandsvisningen visar hur många rader som delas upp. Poster under 24 h som går över midnatt delas inte.
   - **Rader som hoppas över** listas med orsak: saknar projekt (om inget projekt valts för dem), slutar före start, ingen medlem vald, privat projekt som medlemmen inte är tilldelad, dubblett i filen eller posten finns redan (rapporterad i appen). Därför kan samma fil importeras igen utan dubbletter.
   - **Arkiverade projekt** (tillägg 2026-11-23) får importerad tid, eftersom gammal historik mest hör till arkiverade projekt. Det gäller bara importen (`CreateTimeEntry` med `source = import`); i webben och via MCP kan arkiverade projekt fortfarande inte få ny tid.
   - **Rader utan projekt** (tillägg 2026-11-23) hoppas över, om man inte i förhandsvisningen väljer ett befintligt projekt att lägga dem på (t.ex. ett internt projekt).
   - **Redan importerade poster:** rader som en tidigare import skapade (samma medlem, projekt och tider, `source = import`) räknas separat. Med kryssrutan *Uppdatera timpris och debiterbart på N redan importerade poster* får de det pris som nu gäller och debiterbart enligt raden eller projektet (`RepriceTimeEntry`). Tid som rapporterats i appen ändras aldrig. Så rättas en import som gjordes innan priserna var satta.
3. **Import:** först sparas ändrade priser som projektmedlemspriser, sedan skapas poster genom `CreateTimeEntry` med samma regler som webben och `source = import`, så att prisordningen ger varje post rätt pris. Resultatet visar antal skapade och uppdaterade poster, nya kunder och projekt, överhoppade rader och en länk till rapporten för perioden.

- **Projektexporten** (tillägg 2026-11-23): Clockifys projektexport (Projects → Export → CSV, aktiva och arkiverade var för sig) laddas upp på samma ställe och känns igen på kolumnerna (`ClockifyProjectsCsv`). Förhandsvisningen (`ClockifyProjectPlan`) visar per kund vilka projekt som skapas och hur befintliga ändras, och importen görs av `ImportClockifyProjects`:
  - Nya projekt får Clockifys status (arkiverat), synlighet (privat), notering, estimat och medlemmar (matchas på namn bland aktiva medlemmar, utan projektpris). Debiterbart väljs per nytt projekt.
  - Befintliga projekt ändras bara åt ett håll: de arkiveras och blir privata om de är det i Clockify, får notering och estimat om de saknar dem och får Clockifys medlemmar som inte redan är tilldelade. Inget återställs, görs publikt, töms eller skrivs över, och befintliga projektpriser behålls.
  - Namn som inte matchar någon medlem listas. Projektexporten har ingen kolumn för debiterbart eller timpris.
  - För historik: importera projektexporten först och sedan tiden ett år i taget, äldst först. Då hamnar tiden på projekt med rätt status och medlemmar.
- **Filformat:** kolumnerna hittas på rubrik och kan komma i valfri ordning, med komma eller semikolon som avgränsare. Datumformatet känns igen från hela filen (MM-DD-YYYY, DD/MM/YYYY, YYYY-MM-DD m.fl.), tider kan vara 24- eller 12-timmars, och poster får gå över midnatt.
- **Tider:** tolkas i den importerande användarens tidszon.
- **Task:** Clockify-uppgiften läggs först i beskrivningen ("Utveckling – installer app"), eftersom appen inte har uppgifter.
- **Taggar och debiterbart:** Clockify-taggar blir taggar. Har exporten en Billable-kolumn används den per post.
- **Kod:**
  - `App\Services\Imports\ClockifyCsv` (läser filen).
  - `ClockifyImportPlan` (förhandsvisning och beslut).
  - `App\Actions\Imports\ImportClockifyEntries`.
  - `OrganizationImportController`.
  - `OrganizationPolicy::import`.

### Tillägg efter Fas 6: profilbilder och loggor (2026-11-19)

Beställt i efterhand. Designen finns i Figma-filen TimeReport på sidan "Bilder · Profil, organisation och kund", med komponenterna `TimeReport / Bilduppladdning` och `TimeReport / Logga`.

- **Profilbild:** laddas upp under Inställningar → Profil. Visas i appen för kollegor, t.ex. i användarmenyn och medlemslistor. Utan uppladdad bild visas Google-bilden, annars initialer. Bilden tas bort med kontot.
- **Organisationslogga:** laddas upp under Organisationsinställningar av den som får ändra organisationen (ägare/admin). Visas i organisationslistan, i organisationsväljaren, i ⌘K och i PDF-rapporternas huvud. Organisationslistan visar en initial när logga saknas.
- **Kundlogga:** sätts i kundens sidopanel och sparas med formuläret. Visas i kundlistan, på kundsidan och på projektsidor. När loggans korta sida är minst 95 % av den långa fyller bilden den rundade rutan med centrerad beskärning och bibehållna proportioner. Övriga loggor visas i sin helhet med marginal. I PDF-huvudet visas loggan när rapporten gäller en enda kund.
- **Hämta logga:** söker efter Apple Touch-ikoner och favicons på kundens hemsida. En stor Apple Touch-ikon fyller ytan, en stor favicon får marginal och en liten ikon centreras på en neutral kvadrat. Den hämtade bilden förhandsvisas och sparas via samma flöde som en uppladdad bild.
- **Bildbehandling** med `intervention/image` (godkänt beroende, GD-drivrutin):
  - Varje uppladdning sparas som WebP i 64, 128, 256 och 512 px.
  - Profilbilder och organisationsloggor beskärs kvadratiskt runt mitten så att de fyller bildytan. Kundloggor skalas för att passa utan beskärning eller förstoring. Transparens bevaras.
  - EXIF-rotation tillämpas. Animationer reduceras till första bilden, och metadata (t.ex. GPS-position) försvinner vid omkodningen.
- **Uppladdningsregler:**
  - JPG, PNG, WebP eller GIF.
  - Högst 5 MB och högst 6000 px per sida.
  - Ingen SVG, eftersom SVG kan innehålla skript.
- **Lagring:**
  - Disken `config/images.php` (`IMAGES_DISK`, standard `public`) under `images/{avatars|logos}/{uuid}/{storlek}.webp`, med publika men ogissningsbara URL:er.
  - I produktion: kör `php artisan storage:link` för den lokala disken, eller använd en S3-kompatibel bucket med publik läsning.
- **Kod:**
  - `App\Services\Images\ImageStorage` (lagra, URL, PNG-data för PDF, ta bort).
  - Actions `App\Actions\Images\UpdateUserAvatar`, `UpdateOrganizationLogo` och `UpdateClientLogo`. Den nya bilden sparas först, sedan uppdateras kolumnen, sedan tas den gamla bort.
  - Kolumnerna `users.avatar_path`, `organizations.logo_path` och `clients.logo_path`.

### Tillägg efter Fas 6: nattlig backup (2026-11-19)

Beställt i efterhand. Backup till en S3-kompatibel bucket, i första hand Cloudflare R2, med `spatie/laravel-backup` och `league/flysystem-aws-s3-v3` (godkända beroenden). Lösningen är inte bunden till någon hosting; den kräver bara att schemaläggaren körs. Väljs senare hosting med hanterad Postgres blir detta en extra, oberoende kopia.

- **Innehåll:** en Postgres-dump (`pg_dump`, gzip, utan ägare och rättigheter så att den går att läsa in med valfri databasanvändare) och de uppladdade bilderna (`storage/app/public/images`). Allt annat finns i git eller kan byggas om. Ligger bilderna själva i en bucket (`IMAGES_DISK=s3`) tas bara databasen med, och bild-bucketen skyddas med versionshantering.
- **Inte med:** `.env`, `APP_KEY`, Passport-nycklarna och arkivlösenordet. De förvaras separat, t.ex. i en lösenordshanterare.
- **Schema** (`routes/console.php`, svensk tid, bara i produktion, `onOneServer`):
  - 02:30 `backup:run`
  - 03:15 `backup:clean`
  - 08:00 `backup:monitor`
- **Gallring:** alla backuper i 7 dagar, en per dag fram till 30 dagar, en per vecka i 8 veckor till och en per månad i 12 månader till. Högst 5 GB; den senaste tas aldrig bort.
- **Säkerhet:**
  - Arkiven krypteras med AES-256 (`BACKUP_ARCHIVE_PASSWORD`).
  - Egen privat bucket och egna nycklar (`BACKUP_AWS_*`), skilda från bilderna.
  - API-token begränsad till bucketen.
  - Rekommenderat: en låsregel (R2 bucket lock / S3 Object Lock) så att en kapad server inte kan radera backuperna.
- **Larm:** e-post till `BACKUP_NOTIFICATION_EMAIL` när en backup eller gallring misslyckas, och när morgonkontrollen hittar att senaste backupen saknas, är äldre än ett dygn, är under hälften så stor som den förra (`App\Support\Backups\NewestBackupIsNotMuchSmaller`) eller att backuperna tar mer än 5 GB. Ett misslyckat försök görs om efter 5 minuter. Lyckade körningar loggas men mejlas inte. Mejlen är på engelska (paketets texter).
- **Valfritt (tillägg 2026-11-24, beslutat av beställaren):** backuperna körs bara när `backup.enabled` är sant. `BACKUP_ENABLED=true/false` avgör; utan värde (eller tomt, som `compose.yaml` skickar det) är de på när `BACKUP_AWS_BUCKET` är satt. Andra installationer kan alltså köra utan bucket utan att få felmejl varje natt. `php artisan backup:run` för hand fungerar oavsett.
- **Återställning:** beskriven i `docs/self-hosting.md`. Provas mot en tom databas en gång per kvartal.

### Tillägg efter Fas 6: drift med Docker (2026-11-19)

Beslutat av beställaren: produktion körs med Docker och Docker Compose, med [serversideup/php](https://serversideup.net/open-source/docker-php/docs/image-variations/frankenphp) i FrankenPHP-varianten.

- **Image** (`Dockerfile`, flerstegsbygge):
  - Bas `serversideup/php:8.5-frankenphp-trixie`, med tilläggen `gd` och `exif` (bilder), `intl` (formatering i exporter) och `postgresql-client` (`pg_dump` 17 för backup).
  - Composer-beroenden utan dev-paket.
  - Frontendbygget kör Node och PHP i samma steg, eftersom Wayfinders Vite-plugin kör `php artisan`.
  - Inga hemligheter i imagen; allt kommer från miljövariabler vid körning.
  - FrankenPHP körs i workerläge via Laravel Octane, se "Tillägg efter Fas 6: workerläge med Octane".
- **Tjänster** (`compose.yaml`), alla från samma image:
  - `web`: Octane på FrankenPHP. På egen server på 80/443 med automatisk HTTPS (Let's Encrypt för värden i `APP_URL`), och port 80 omdirigerar. I Coolify HTTP på 8080 bakom Coolifys proxy (se "Tillägg efter Fas 6: Coolify"). Vid start körs `storage:link`, migreringar och `optimize` (serversideups automationer, bara i den här tjänsten). Hälsokontrollen går mot `/up`, så den startar Laravel.
  - `queue`: `queue:work --tries=3`.
  - `scheduler`: `schedule:work`, inklusive nattlig backup. Startar först när `web` är frisk, alltså efter migreringarna.
  - `postgres`: PostgreSQL 17, bara nåbar inne i stacken.
- **Data** i namngivna volymer:
  - `postgres`
  - `storage` (uppladdade bilder, Passport-nycklar, dompdf-typsnitt)
  - `caddy_data`/`caddy_config` (certifikat, så att Let's Encrypts gränser inte nås vid omstarter)
- **Loggar** går till containrarnas utdata (`LOG_CHANNEL=stderr`).
- **Klientens IP:** besökaren ansluter direkt till FrankenPHP, så `TRUSTED_PROXIES` är tomt på egen server. Bakom Cloudflare ser Laravel Cloudflares adress, om inte Cloudflares adressintervall läggs i `TRUSTED_PROXIES` (se "Tillägg efter Fas 6: Coolify").
- **Deploy:** `git pull && docker compose up -d --build`. Ger några sekunders avbrott, eftersom FrankenPHP själv binder portarna. Nollavbrott skulle kräva en proxy framför; det ingår inte nu.
- **Dokumentation:** `docs/self-hosting.md` (guide för egen drift, på engelska) och `.env.production.example`. README länkar dit.
- **Verifierat lokalt:**
  - hela stacken: migreringar, HTTPS-omdirigering, `/up`, statiska filer och `/storage`
  - inloggning med magisk länk via kön
  - backup med `pg_dump` i schemaläggaren
  - omstart med kvarvarande data
  - återställning enligt README
- **Rättat:** paketet för backup validerade larmadresserna vid uppstart, så tomma `BACKUP_NOTIFICATION_EMAIL`/`MAIL_FROM_ADDRESS` stoppade alla artisan-kommandon. Nu används en giltig reservadress.

### Tillägg efter Fas 6: takt mot estimatet på projektsidan (2026-11-23)

Beställt i efterhand. Under förloppet "Rapporterad tid" på projektsidan visas, för projekt med estimat:

- **Kvar till estimatet:** estimat minus all rapporterad tid. Är projektet över estimatet visas "Över estimatet" i varningsfärg.
- **Arbetsdagar kvar:** från i dag (eller projektets startdatum om det är senare) till och med slutdatumet, i användarens tidszon. Arbetsdagar är måndag–fredag utom organisationens helgdagar (se nedan, `App\Support\WorkingDays`).
- **Behövs per arbetsdag:** återstående timmar delat med antal arbetsdagar, avrundat uppåt till hel sekund.
- Utan slutdatum visas bara timmarna som återstår, med "Ange ett slutdatum". Efter perioden, eller när estimatet är nått, visas inget dagsbehov.
- Uträkningen görs i `App\Support\EstimatePace` och skickas som `estimatePace` till alla som ser projektet, precis som estimatet och den rapporterade tiden.
- MCP: `get_project_status` ger samma sak (`working_days_left`, `hours_per_working_day`) tillsammans med projektets start- och slutdatum.

### Tillägg efter Fas 6: helgdagar per organisation (2026-11-23)

Beställt i efterhand. Helgdagarna ligger i databasen per organisation (`holidays`: datum och namn, en per datum) i stället för att vara inbyggda.

- **Hantera:** ägare och admin (rättigheten `UpdateOrganization`) ser avsnittet Helgdagar i organisationsinställningarna. Där listas dagarna från innevarande år, grupperade per år. Man kan lägga till egna dagar (datum och namn, t.ex. en kick-off), ta bort dagar och fylla på med svenska helgdagar för ett valt år (i år och två år framåt). Påfyllningen hoppar över datum som redan finns, även om de har ett annat namn.
- **Svenska helgdagar** (`App\Support\SwedishHolidays`): de helgdagar som kan infalla på en vardag samt midsommar-, jul- och nyårsafton. Påsken räknas fram utan calendar-tillägget. Namnen sparas på svenska.
- **Från start:** nya organisationer får svenska helgdagar för innevarande och nästa år (`CreateOrganization`). Migreringen gav befintliga organisationer 2026 och 2027.
- **Kalender:** sparade helgdagar visas med namn som röda taggar överst i rätt dagskolumn i vecko- och dagvyn. Taggarna ligger kvar när tiderna scrollas, med 12 px marginal under mobilens fasta rubrik. Den första tidsrutan vid 00:00 går att markera när man scrollar hela vägen upp.
- I kalenderns veckovy visas förväntad arbetstid under veckonumret ovanför timskalan. En tooltip förklarar att tiden utgår från den valda medlemmens arbetsschema och att helgdagar på schemalagda arbetsdagar räknas bort. Förklaringen går även att öppna med ett tryck.
- **Används** av projektsidans arbetsdagar (`EstimatePace`) och av frånvaro (se nedan). Lördag och söndag räknas aldrig som arbetsdagar.
- **Kod:** `App\Actions\Holidays` (`CreateHoliday`, `DeleteHoliday`, `AddSwedishHolidays`) och `OrganizationHolidayController`. Andra organisationers helgdagar ger 404.

### Tillägg efter Fas 6: frånvaro (2026-11-23)

Beställt i efterhand. Semester, VAB och annan frånvaro registreras som egna poster (`absences`), skilda från tidsposter, så att rapporterad arbetstid och belopp inte påverkas.

- **Typer** (`App\Enums\AbsenceType`): semester, VAB, sjuk, föräldraledig, tjänstledig och annan frånvaro.
- **Period:** första och sista dag (högst 366 dagar), antingen hela arbetsdagar eller ett antal timmar per dag (t.ex. 4 h VAB). Lördag, söndag och organisationens helgdagar räknas inte. En period utan arbetsdagar och överlappande frånvaro för samma person avvisas. Valfri notering.
- **Arbetsdagens längd** är en organisationsinställning (`organizations.workday_seconds`, standard 8 h, "Arbetsdagens längd (timmar)" i organisationsinställningarna). En hel frånvarodag räknas som så många timmar.
- **Behörighet** (`AbsencePolicy`): medlemmar hanterar sin egen frånvaro; ägare och admin (`ManageTeamTime`) hanterar allas. Andra organisationers frånvaro ger 404.
- **Kalendern:** heldagsraden visas i vecko- och dagvyn när den visade perioden innehåller frånvaro för den valda personen eller en kollega. Radens kalenderikon visar "Frånvaro" vid hovring och tangentbordsfokus. Den visade personens frånvaro syns med typ (och timmar per dag) och öppnar dialogen vid klick; drar man över dagar i raden registreras ny frånvaro. Kollegors frånvaro syns som "Ledig · namn", utan typ eller notering. Listvyn visar samma sak per dag. Frånvaro kan registreras via plusknappen genom att växla läge i dialogrubriken, eller direkt med ⌘K-kommandot "Registrera frånvaro". Formuläret räknar arbetsdagar och timmar medan man fyller i.
- **Rapporter:** sammanfattningen får ett avsnitt Frånvaro med dagar per person och typ i perioden (frånvarotimmar delat med arbetsdagens längd). Bara periodens och medlemsfiltrets urval gäller, med samma synlighet som för tid: medlemmar ser bara sin egen rad (`ReportBuilder::absences`). Frånvaron ingår inte i exporten.
- **Rapportera tid eller frånvaro:** för en ny post visas flikarna ”tid” och ”frånvaro” i dialogrubriken. Den valda fliken är lila understruken och det motsvarande formuläret visas. Den andra fliken är nedtonad.
- **MCP:** `list_absences` (egen frånvaro som standard; `all` ger alla, där medlemmar bara ser kollegor som lediga utan typ eller notering), `create_absence`, `update_absence` (bara angivna fält; `hours_per_day: null` ger hela dagar) och `delete_absence` (destruktiv). `get_report` får `absence` med dagar per medlem och typ, och `get_context` arbetsdagens längd och frånvarotyperna. Serverns instruktioner säger att frånvaro aldrig ska rapporteras som tid på ett projekt.
- **Inget saldo** (semesterdagar kvar) och inget attestflöde i den här versionen.
- **Kod:** `App\Actions\Absences` (`CreateAbsence`, `UpdateAbsence`, `DeleteAbsence`, gemensamma regler i `ValidatesAbsences`), `App\Support\AbsenceTime`, `AbsencePresenter` och `AbsenceController`.

### Tillägg efter Fas 6: spara med ⌘↵ (2026-11-26)

Beställt i efterhand. I dialogerna *Rapportera tid* (även i läget för frånvaro och för den pågående timern) och *Registrera frånvaro* sparar ⌘+Enter (Ctrl+Enter utanför Mac) formuläret, var fokus än är. `ResponsiveDialog` tar emot formulärets id (`submitFormId`). Spara-knappen (och Stoppa i den pågående timern, där ⌘↵ stoppar timern) har `aria-keyshortcuts` och, på dator, en liten hint ("⌘↵" eller "Ctrl ↵", `SubmitShortcutHint`).

### Tillägg efter Fas 6: teman, accentfärg och kontrast (2026-11-27)

Beställt i efterhand. Under *Inställningar → Utseende* väljer var och en hur appen ser ut. Standardutseendet är oförändrat. Designen finns i Figma på sidan "Utseende · Teman (förslag)".

- **Läge:** ljust, mörkt eller enhetens läge, som tidigare. Valet sparas per enhet (cookie och webbläsarens lagring).
- **Tema** (`users.theme`, `App\Enums\Theme`): Standard (dagens utseende och förval), Sand (varma toner, rundare hörn), Skiffer (svala blågrå toner) och Grafit (neutralt grått, stramare hörn). Varje tema har en ljus och en mörk variant. Dessutom två roliga teman med egen accentfärg (accentvalet gäller inte då): Terminal (grönt på svart, systemets monospace-typsnitt, skarpa hörn, alltid mörkt oavsett läge) och Barbie (rosa i ljust och mörkt läge, rundade hörn).
- **Accentfärg** (`users.accent`, `App\Enums\Accent`): violett, blå, turkos, grön, orange, rosa eller neutral. Tomt värde betyder organisationens färg.
- **Varumärkesfärg per organisation** (`organizations.accent`): ägare och administratörer väljer den i organisationsinställningarna (samma behörighet som övriga inställningar). Den gäller alla medlemmar som inte valt en egen färg. Tomt värde betyder violett.
- **Kontrast** (`users.contrast`, `App\Enums\ContrastPreference`): enhetens inställning (`prefers-contrast: more`, förval), normal eller hög. Hög kontrast ger tydligare ramar och mörkare dämpad text.
- **Tillgänglighet:** alla kombinationer är kontrastkontrollerade. Text och dämpad text klarar WCAG AA på alla ytor i båda lägena, och med hög kontrast 7:1 för text och 3:1 för ramar. Knapptext på accentfärgen klarar AA.
- **Teknik:** färgerna är CSS-variabler i `app.css`, styrda av `data-palette`, `data-accent` och `data-contrast` på `<html>`. Servern sätter attributen i `app.blade.php` från den delade propen `theme` (`App\Support\ThemePreferences`), så sidan inte blinkar vid laddning. Webbläsarens temafärg (`theme-color`) följer accentfärgen. Tema, accentfärg och kontrast sparas på kontot med `App\Actions\Settings\UpdateAppearance` och följer med mellan enheter.
- **Oförändrat:** PDF-exporter, e-post, logotypen och projektfärgerna behåller sina färger.
- **Säsongseffekter:** snö i december och fyrverkerier från nyårsafton till och med den 7 januari, efter webbläsarens datum. De ritas på en canvas över sidan men under dialoger, tar aldrig emot klick, pausar när fliken är dold och visas inte om enheten begär mindre rörelse. De kan stängas av under Utseende. Valet sparas bara i webbläsaren (localStorage), inte i databasen (`components/seasonal-effects.tsx`, `@/lib/seasonal-effects`). På enheter med mus lägger sig snön som ett snötäcke längst ner (högst cirka 44 px, `@/lib/snow-drift`). En skyffel står lutad i nedre högra hörnet: klick på den gör markören till en skyffel, och då skottar man undan snön genom att dra musen genom täcket. Snön kastas åt det håll man rör sig. Klick igen eller Esc ställer tillbaka skyffeln. Bredvid skyffeln står en snöslunga. Klick på den, och sedan kör man den längs nederkanten med ← och →. Den äter snön framför sig ner till marken och sprutar den högt bakåt genom tornet. Medan den körs tar den piltangenterna före sidans egna kortkommandon, utom när man skriver i ett fält. Klick igen eller Esc parkerar den. Snötäcket finns kvar när man byter sida men inte efter omladdning.

### Tillägg efter Fas 6: kortkommandon (2026-11-26)

Beställt i efterhand, i samma omgång som ⌘↵. Enkla tangenter för det man gör ofta, på dator:

- **Överallt:** N rapporterar tid (öppnar dialogen i kalendern, från andra sidor går den dit), T startar timern eller stoppar den som går, ⌘K söker och ? visar listan över kortkommandon.
- **Kalender och rapporter:** ← och → stegar till föregående eller nästa period (vecka eller dag i kalendern, samma längd i rapporterna), I går till idag eller motsvarande period som innehåller idag. L, V och D byter vy i kalendern (lista, vecka, dag).
- **Regler:** tangenterna gäller inte när man skriver i ett fält, när en dialog eller meny är öppen (toasts räknas inte) eller med ⌘/Ctrl/Alt nedtryckt. Pilarna lämnas åt komponenter som själva använder dem (listor, menyer, rutnät). ? läses som tecken, så den fungerar på svenskt tangentbord (Shift + +).
- **Hittbarhet:** listan öppnas med ?, från användarmenyn ("Kortkommandon") och från ⌘K. ⌘K visar tangenten bredvid kommandon som har en.
- **Kod:** `@/lib/shortcuts` (tangenter och `useShortcut`, som sidorna använder för sina egna åtgärder) och `components/keyboard-shortcuts.tsx` (den globala lyssnaren och listan). Designen finns i Figma på sidan "Kortkommandon".

### Tillägg efter Fas 6: timer (2026-11-25)

Beställt i efterhand. Utöver att fylla i tider i efterhand kan man starta och stoppa en timer. Designen finns i Figma på sidan "Timer (förslag)".

- **Data:** `running_timers` (organisation, användare, projekt som kan vara tomt, beskrivning, debiterbart, taggnamn, starttid), högst en per person i någon av ens organisationer (`RunningTimer::runningFor`). Den hålls skild från `time_entries`, som alltid har en sluttid, så rapporter, export och priser påverkas inte förrän timern stoppas.
- **Inställning:** `organizations.timer_enabled` ("Tillåt timer" i organisationsinställningarna), på som standard. Avstängd går det inte att starta nya timers, varken i webben eller via MCP, men en timer som redan går kan stoppas eller slängas.
- **Actions** (`app/Actions/Timers`, gemensamma regler i `ValidatesTimers`):
  - `StartTimer`: projektet är valfritt vid start. Starttiden får inte ligga i framtiden eller mer än 24 h bakåt. En timer som redan går sparas först och slutar där den nya börjar, som när man byter uppgift. Saknar den projekt måste den stoppas eller slängas först.
  - `UpdateTimer` ändrar projekt, beskrivning, taggar, debiterbart och starttid.
  - `StopTimer` kräver projekt och skapar posten genom `CreateTimeEntry`, med samma regler som all annan tid. Tiderna avrundas nedåt till hel minut, och en post är minst en minut. Ingen annan avrundning görs.
  - `DiscardTimer` slänger timern utan att spara tid.
- **Behörighet** (`RunningTimerPolicy`): var och en hanterar bara sin egen timer.
- **Webb:**
  - `TimerController` (`timer.start`, `timer.update`, `timer.stop`, `timer.discard`). Den pågående timern delas till alla sidor som `timer` (`TimerPresenter`), och klockan räknas upp i webbläsaren.
  - Kortet i sidomenyn och raden ovanför bottenmenyn på mobilen visar projekt, kund och klocka med en stoppknapp. Flikens titel visar "▶ 1:23 · Projekt". Kalendern visar den pågående posten från start till nu, streckad.
  - På dator öppnar plusknappen ovanför profilen och kalenderns plusknapp samma snabbmeny. Starta timer startar direkt. Rapportera tid och Rapportera frånvaro öppnar rapportdialogen med motsvarande flik vald. En pågående timer ersätter plusknappen i sidomenyn, och kalenderns meny erbjuder fortfarande båda rapporteringsvalen. På mobil öppnar kalenderns och listans flytande plusknapp rapportdialogen direkt med tid vald. Frånvaro kan väljas i dialogrubriken. Timern kan också startas med "Fortsätt med timer" på en post och med ⌘K.
  - Dialogen *Pågående timer* (tidsdialogen i timerläge) sparar, stoppar (sluttid valfri, annars nu) eller slänger. Stoppknappen sparar direkt, men öppnar dialogen när projekt saknas eller när timern gått minst 10 timmar (`RunningTimer::LONG_SECONDS`), så att man kontrollerar sluttiden.
  - Sidomenyns plusknapp öppnar rapportdialogen ovanpå den aktuella sidan. När timern startas eller en rapport sparas behålls sidan och dess filter.
- **MCP:**
  - `start_timer`, `stop_timer` (kan ange projekt och sluttid) och `discard_timer` (destruktiv).
  - `get_context` visar en pågående timer och `timer_enabled`.

### Tillägg efter Fas 6: inställningar för sidomenyn

I **Inställningar → Sidomeny** går det att visa eller dölja Sök, de menylänkar som är tillgängliga för den aktuella organisationen och genvägen Lägg till. Reglaget Lägg till styr plusknappen i sidomenyn. Menylänkarna kan ordnas om med mus, pekskärm och tangentbord. Synlighet och ordning gäller direkt i sidomenyn på desktop och i mobilens bottennavigering och Mer-panel. Båda sparas på användarkontot, gemensamt för webbläsare, enheter och organisationer. Om kontot saknar en sparad inställning importeras den från den aktiva organisationens lokala inställningar när den först hittas. En pågående timer kan alltid öppnas och stoppas från sidomenyn.

### Tillägg efter Fas 6: uppdatering när man kommer tillbaka (2026-11-24)

Beställt i efterhand. När man kommer tillbaka till appen (fliken blir synlig eller fönstret får fokus) efter minst 30 sekunder borta laddas sidans data om i bakgrunden (`useRefreshOnReturn` i `AppLayout`). Då syns tid som rapporterats på en annan enhet eller via MCP utan att man laddar om sidan. Uppdateringen behåller sidans tillstånd och scrollposition, inklusive den period som visas i kalendern och listan. Den visar ingen förloppsindikator och rensar förhämtade sidor (`router.flushAll()`). Om fliken är offline väntar uppdateringen tills anslutningen är tillbaka och appen är aktiv.

### Tillägg efter Fas 6: Coolify (2026-11-20)

Beställt i efterhand: produktionsstacken ska fungera i [Coolify](https://coolify.io) som en applikation med byggpaketet Docker Compose. Samma `compose.yaml` används i Coolify och på egen server.

- **Ingen TLS och inga publicerade portar i `compose.yaml`:** Coolifys proxy routar domänen till `web` på port 8080 och sköter certifikatet. Webbtjänsten kör därför HTTP (`SSL_MODE=off`). Domänen sätts på tjänsten `web` i Coolify, t.ex. `https://tid.example.se:8080`.
- **Miljövariabler:** Coolify skickar bara variabler som står under en tjänsts `environment:`. Därför listas alla inställningar i `x-app-environment` som `${VAR:-standard}`, och `env_file` används inte längre. Coolify visar dem under Environment Variables. `APP_KEY`, `APP_URL`, `DB_PASSWORD` och `MAIL_FROM_ADDRESS` är obligatoriska (`${VAR:?}`), så en deploy stoppas om de saknas. En ny inställning måste läggas till i listan.
- **HTTPS bakom proxyn:** `OCTANE_HTTPS=true` gör att varje anrop räknas som HTTPS. Det behövs för korrekta länkar och säkra cookies när TLS avslutas framför containern.
- **Klientens IP:** FrankenPHP skickar proxyns adress till Laravel, inte besökarens. Därför litar Laravel på `X-Forwarded-For` från privata nät, där Coolifys proxy finns (`TRUSTED_PROXIES` är som standard `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`). Annars skulle alla besökare dela proxyns IP i spärrarna, t.ex. för inloggningslänkar. Med Cloudflare framför läggs Cloudflares adressintervall till. `compose.standalone.yaml` lämnar listan tom, eftersom besökarna där ansluter direkt.
- **Bygge:** `web`, `queue` och `scheduler` bygger samma image. Därför beror ingen tjänst på att en annan byggt den först, och byggena efter det första kommer från cachen. `APP_NAME` läses vid körning.
- **Egen server utan Coolify:** `compose.standalone.yaml` lägger till FrankenPHP:s TLS med Let's Encrypt på port 80/443 och volymerna för certifikat. `.env.production.example` sätter `COMPOSE_FILE=compose.yaml:compose.standalone.yaml`, så vanliga `docker compose` fungerar som förut.
- **Dokumentation:** README (Production: Coolify och egen server) och `.env.production.example`.
- **Verifierat lokalt:**
  - Hela stacken byggd med `docker compose build`, som Coolify gör, och startad bakom en TLS-proxy som ersatte Coolifys: `/up`, omdirigering till `/login`, HTTPS-länkar till tillgångar, statiska filer, kön (inloggningsmejl) och hälsokontrollerna.
  - Klientens IP i sessionerna är besökarens, och en förfalskad `X-Forwarded-For` från besökaren ignoreras.
  - Kommandona för Coolifys terminal (`passport:keys`, `app:create-owner`).
  - Samma volymer med `compose.standalone.yaml`: HTTP omdirigeras till HTTPS och data finns kvar.

### Tillägg efter Fas 6: workerläge med Octane (2026-11-19)

Beställt i efterhand. `laravel/octane` är ett godkänt beroende. Webbtjänsten kör FrankenPHP i workerläge: appen startar en gång per worker och hanterar många förfrågningar, i stället för att starta om för varje förfrågan.

- **Start:** `php artisan octane:start --server=frankenphp --port=8080 --caddyfile=/etc/frankenphp/Caddyfile`.
  - Imagens egen `frankenphp` och Caddyfile används, så SSL-lägen, automatisk HTTPS, betrodda proxyer, säkerhetsheaders och hälsokontrollen fungerar som förut.
  - `octane:install` körs inte, eftersom det skulle ladda ner ännu en FrankenPHP-binär och gitignorera worker-filen. I stället finns `config/octane.php` (standardserver `frankenphp`) och `public/frankenphp-worker.php` incheckade.
- **Inställningar** (env):
  - `OCTANE_WORKERS` (standard `auto`)
  - `OCTANE_MAX_REQUESTS` (500; en worker ersätts efter så många förfrågningar, som skydd mot minnesläckor)
  - `OCTANE_MAX_EXECUTION_TIME` (120 sekunder; höjt från Octanes 30 så att stora Clockify-importer och PDF-exporter får samma marginal som i klassiskt läge)
- **Kodgranskning för långlivade workers:** inga ändringar behövdes.
  - `CurrentOrganization` är `scoped` och nollställs mellan förfrågningar.
  - `OrganizationScope` hämtar den aktiva organisationen vid varje fråga.
  - Appen har inga statiska variabler och läser inga superglobaler.
  - Controllrar med konstruktorinjektion rensas av Octane efter varje förfrågan, och policies skapas på nytt.
  - Fortifys svarsklasser har inget tillstånd.
  - Riktlinjen har fått regeln att data som hör till en förfrågan aldrig får ligga i singletons eller statiska variabler.
- **Lokal utveckling och testsviten** körs som förut utan Octane (Herd respektive Pest).
- **Verifierat lokalt i Docker:**
  - Hela stacken frisk.
  - 100 omväxlande sidladdningar för två användare i olika organisationer på två delade workers visade aldrig fel organisations data; den andra organisationens URL gav 403.
  - `octane:reload` och omstart fungerar.
  - Inloggningssidan svarar på median 9 ms mot 20 ms i klassiskt läge.

### Ändring efter Fas 6: kalendern är startsidan (2026-11-20)

Beslutat av beställaren: kalendern är det alla använder för att rapportera tid, så den är startsidan. Idag-sidan (dashboard, avsnitt 4.7) är pausad.

- **Var man hamnar:** efter inloggning (passkey, Google, magisk länk, e-postverifiering), på `/`, efter onboarding och efter att ha tackat ja eller nej till en inbjudan hamnar man i kalendern (`/{organisation}/calendar`).
  - Startsidan styrs på ett ställe: `fortify.home` (`/calendar`).
  - Listvyn finns på `/{organisation}/list`. Gamla länkar till `/{organisation}/time` leder vidare till kalendern eller listvyn beroende på `view`.
- **Menyer:** Idag är borttagen ur sidomenyn, mobilens bottennavigering och ⌘K. Mobilens bottennavigering visar upp till fyra synliga menylänkar i användarens ordning och alltid Mer sist.
- **Kvar i koden:** `DashboardController`, sidan `dashboard` och deras tester. Sidan nås fortfarande på `/{organisation}/dashboard`.
- **Slå på igen:** lägg tillbaka menyposten i `resources/js/lib/navigation.ts` och ⌘K-kommandot, och sätt `fortify.home` till `/dashboard`.

### Tillägg efter Fas 6: enklare rapportfilter (2026-11-20)

Beställt i efterhand: filtret ovanför rapporterna var sju formulärfält (period, från, till, medlemmar, kunder, projekt, debiterbart). Det är omgjort till en verktygsrad, designad i Figma (sidan "Rapporter · Filter", komponenten "TimeReport / Filterknapp").

- **Period:** en kontroll med pilar för föregående och nästa period.
  - Hela månader stegar per månad, andra perioder med sin längd.
  - Knappen visar periodens namn och datum, t.ex. "Denna månad 1–30 nov.", "Oktober 2026 1–31 okt." eller "Vecka 48 23–29 nov.".
  - Den öppnar [periodväljaren i Figma](https://www.figma.com/design/KpKv5XyY4IdFjW63GlbyRi/TimeReport?node-id=168-887) med två månader bredvid snabbvalen på större skärmar och en månad under snabbvalen i en bottenpanel på mindre skärmar.
  - Snabbvalen är Idag, Igår, Denna vecka, Förra veckan, Senaste 14 dagarna (inklusive idag), Denna månad, Förra månaden, I år och Förra året. Ett snabbval uppdaterar rapporten direkt.
  - Kalendern använder organisationens första veckodag. Första datumet startar ett eget intervall, som förhandsvisas fram till datumet under pekaren eller i fokus. Det andra datumvalet uppdaterar rapporten. Escape stänger väljaren och återställer fokus till periodknappen.
- **Filter som knappar:** Medlemmar (avatarer), Kunder (loggor), Projekt (färgprickar, kund som undertext), Taggar och Debitering.
  - Förhandsvisningarnas behållare är transparenta och visar de rundade konturerna hela, även när filtret är valt.
  - Utan val visar knappen filtrets namn och ett smakprov.
  - Med val visar den valen i accentfärg, t.ex. "Alex Lind, Sam Ek".
  - Varje knapp öppnar en lista med flerval (Debitering: ett val). Listor med fler än sju alternativ får sökning.
  - Escape stänger listan utan att rensa valet.
- **Rensa filter** visas när något filter är valt.
- **Mobil:** perioden tar hela bredden och filterknapparna går att svepa i sidled.
- **Data:** filteralternativen innehåller nu medlemmarnas bild och om de är inaktiva, kundernas logga samt projektens namn, kund och färg.
- **URL:** filtren ligger kvar i URL:en som förut, så rapporter går att bokmärka.

### Tillägg efter Fas 6: besöksstatistik med Umami (2026-11-21)

- **Produktion:** Time Tracker ligger under teamet Bräne Hübsch i den egna Umami-instansen på `analytics.bh.studio`. Spåraren laddas på `timetrack.bh.studio` och mäter sidvisningar vid sidladdning och navigering i Inertia, inklusive bakåt och framåt.
- **Konfiguration:** skriptets adress, webbplats-id och domän sätts med `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID` och `UMAMI_DOMAIN` (inte i koden, så att andra installationer kan använda en egen instans eller låta bli). Utan alla tre laddas ingen spårare.
- **Insamling:** Umami sammanställer sin vanliga besöksstatistik. Sidadresser skickas utan frågeparametrar och fragment. Inloggnings- och inbjudningstoken tas bort från sökvägarna. Externa hänvisningar begränsas till ursprunget och sidtitlar utelämnas eftersom de kan innehålla kund- och projektnamn.

### Tillägg efter Fas 6: läsbara kund- och projektadresser

- Kund- och projektsidor använder en slug som skapas från namnet. Slugen är unik per organisation och resurstyp och ligger kvar vid namnbyte, arkivering och byte av kund på ett projekt.
- Befintliga kunder och projekt får en slug vid migrering. Äldre sidlänkar med ID skickas vidare till slugadressen efter behörighetskontroll, med frågeparametrarna kvar. Skrivåtgärder accepterar fortfarande ID och sparade rapportfilter behåller sina parametrar.
- Umami maskerar kund- och projektsegmentet i sökvägar och interna hänvisningar.

## 8. Senare (medvetet bortvalt i v1)

Live-timer · uppgifter · låsta perioder och attest · veckomål/heltidsnorm · kostnadspriser och lönsamhet · fakturaunderlag/integration med ekonomisystem · sparade och delade rapporter (publika länkar) · Microsoft/Entra SSO · import från Toggl (CSV) · kalenderintegration (Google/Outlook) · aktivitetslogg/audit · native-app.

## 9. Öppna frågor

1. Ska vem som helst kunna registrera sig och skapa en organisation, eller är det endast inbjudan (vi bygger internt först)? *Antagande: endast inbjudan, styrt av config-flagga.*
2. Ska en tidpost kunna sakna projekt (t.ex. "intern tid")? *Antagande: nej, skapa ett internt projekt i stället.*
3. Behövs avrundning i rapporter (t.ex. till närmaste 15 min) redan i v1? *Antagande: nej.*
4. Behöver vi fler SSO-leverantörer än Google snart (Microsoft)? Påverkar inte v1 men Socialite-upplägget bör vara generellt.
5. Ska medlemmar kunna se sina egna belopp (timpris × tid)? *Antagande: nej, endast ägare/admin.*
