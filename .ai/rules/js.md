---
paths:
  - 'resources/js/**'
---

# Js

## All UI text goes through t()
Use `t()`/`tc()` from `@/lib/i18n` with the English source string as key and add the Swedish translation to lang/sv.json. TranslationsTest fails on missing keys. Build UI with HeroUI v3; do not use resources/js/components/ui (legacy shadcn, removed in phase 1).

## Forms in dialogs are responsive
Open quick data-entry forms (time entries) with `ResponsiveDialog` (`@/components/responsive-dialog`): a HeroUI Modal on desktop and a bottom Drawer on mobile. Use `useIsDesktop()` from `@/hooks/use-media-query` instead of CSS-only hiding when the behaviour differs, and keep mobile actions reachable without hover.

## Create/edit forms for records open in a side drawer
Create/edit forms for clients and projects use `SideDrawer` (`@/components/side-drawer`): a right-hand panel on desktop and a bottom sheet on mobile. Compose it from `SideDrawerBody` and `SideDrawerFooter` (actions pinned at the bottom) and wrap both in the form element with `sideDrawerFormClass`. Open it on the page the record belongs to (create on the list, edit on the detail page) and link to it from elsewhere with `?new=1` via `useOpenFromQuery`; do not add separate create/edit pages. Quick data entry (time entries) and confirmations stay in `ResponsiveDialog`/`Modal`.

## Dates and times use HeroUI fields
Use `DatePickerField` and `TimeInputField` (`@/components/form/...`, HeroUI DatePicker/TimeField) with `YYYY-MM-DD` / `HH:mm` strings instead of native `<input type="date|time">`: they follow the app locale (24-hour times and Monday-first calendars in Swedish) and match the height of other fields. Dialog actions go in the dialog footer (`footer` prop, submit button with `form=`), so they stay reachable on mobile.

## Scroll regions fade towards fixed bars
Dialog and drawer bodies (HeroUI `Modal.Body`/`Drawer.Body`) fade their content out towards the header and footer and span the full dialog width so the scrollbar sits at the outer edge (see `app.css`). Other scrollable lists below or above a fixed bar (a search field, a footer) get the `scroll-fade-y` class instead of a hard clip.
