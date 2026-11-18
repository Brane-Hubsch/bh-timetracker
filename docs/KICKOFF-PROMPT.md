# Kickoff-prompt för Claude Code

Klona repot, öppna Claude Code i den mappen och klistra in texten nedan som första meddelande.

---

Vi ska bygga **BH Timetracker**, ett eget webbverktyg för tidrapportering i stil med Clockify/Toggl. Hela produkt- och tekniska planen finns i `docs/PLAN.md` – läs den noga innan du gör något, och behandla den som källan till sanning. Om du ser något i planen som är fel, föråldrat eller motsägelsefullt: säg till innan du bygger vidare, i stället för att tyst avvika.

**Stack (sammanfattning, detaljer i planen):** Laravel 13 + Inertia 3 + React 19 + TypeScript + Tailwind 4, HeroUI v3 i stället för shadcn/ui, Laravel Boost, Pest. Inloggning endast med passkeys (Fortify) och Google (Socialite), inga lösenord. MCP-server med `laravel/mcp` + Passport (OAuth 2.1). Lokalt: Laravel Herd + SQLite. Produktion: Postgres (hosting bestäms senare).

**Repo:** `git@github.com:Brane-Hubsch/bh-timetracker.git` – du står i en klon av det. Repot innehåller redan `docs/` (planen och den här prompten). `laravel new` kräver en tom mapp, så skapa appen i en temporär mapp och flytta in den här (behåll `.git` och `docs/`). Använd **inte** `--force`, eftersom det raderar målmappen.

**Så här vill jag att du jobbar**

1. Börja med **Fas 0** i planen och gå inte vidare till nästa fas förrän jag har godkänt. Avsluta varje fas med en kort sammanfattning: vad som gjorts, vad som avvek från planen och varför, och vad jag behöver göra manuellt (t.ex. Google OAuth-nycklar, `herd secure`).
2. Innan du börjar en fas: skriv en kort, konkret checklista för fasen och vänta på mitt OK om något är oklart.
3. Använd Laravel Boosts MCP-verktyg (Search Docs, Database Schema, Last Error m.fl.) och HeroUI:s MCP-server för aktuell dokumentation, i stället för att gissa API:er. Versionerna är nyare än mycket av din träningsdata.
4. Följ konventionerna i planens avsnitt 5.2. Lägg dem i `.ai/guidelines/project.md` (så att `boost:install`/`boost:update` inte skriver över dem) och spela in nya beslut som project rules via Boost.
5. All affärslogik i `app/Actions`, som både controllers och MCP-verktyg använder. Tenant-scope (aktiv organisation) och policies på allt.
6. Skriv Pest-tester för varje Action, policy och MCP-verktyg, inklusive tester som visar att man inte kommer åt en annan organisations data. Testsviten ska gå grönt mot både SQLite och Postgres.
7. Små commits med tydliga meddelanden i feature-branches. Pusha inte till `main` och skapa inga PR:er utan att fråga.
8. Håll det enkelt. Bygg inget som inte står i planen; föreslå hellre tillägg och låt mig avgöra.

Börja med att läsa `docs/PLAN.md`, ställ eventuella frågor, och lägg sedan fram din checklista för Fas 0.
