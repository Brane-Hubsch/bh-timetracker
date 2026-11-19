---
paths:
  - 'app/Models/**'
---

# Models

## Archive instead of delete for clients and projects
Clients and projects are archived (archived_at, Archivable trait), never deleted, so history and reports stay intact. Archiving a client does not archive its projects; pickers must hide projects whose client is archived.
