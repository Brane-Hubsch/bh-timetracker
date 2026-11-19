---
paths:
  - 'resources/js/**'
---

# Js

## All UI text goes through t()
Use `t()`/`tc()` from `@/lib/i18n` with the English source string as key and add the Swedish translation to lang/sv.json. TranslationsTest fails on missing keys. Build UI with HeroUI v3; do not use resources/js/components/ui (legacy shadcn, removed in phase 1).

## Forms in dialogs are responsive
Open data-entry forms with `ResponsiveDialog` (`@/components/responsive-dialog`): a HeroUI Modal on desktop and a bottom Drawer on mobile. Use `useIsDesktop()` from `@/hooks/use-media-query` instead of CSS-only hiding when the behaviour differs, and keep mobile actions reachable without hover.

## Larger forms open in a side drawer
Create/edit forms with many fields (projects) use `SideDrawer` (`@/components/side-drawer`): a right-hand panel on desktop and a bottom sheet on mobile, with the actions pinned in the footer. Open it on the page the form belongs to (create on the list, edit on the detail page) and link to it from elsewhere with `?new=1` via `useOpenFromQuery`; do not add separate create/edit pages.
