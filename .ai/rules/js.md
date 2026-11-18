---
paths:
  - 'resources/js/**'
---

# Js

## All UI text goes through t()
Use `t()`/`tc()` from `@/lib/i18n` with the English source string as key and add the Swedish translation to lang/sv.json. TranslationsTest fails on missing keys. Build UI with HeroUI v3; do not use resources/js/components/ui (legacy shadcn, removed in phase 1).
