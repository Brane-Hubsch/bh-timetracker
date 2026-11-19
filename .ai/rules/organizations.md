---
paths:
  - 'app/Actions/Organizations/**'
---

# Organizations

## An organization always keeps its owner
Actions must never remove the owner, change the owner role, or grant the owner role (invitations or role changes) — they throw AuthorizationException. Ownership transfer will be a separate owner-only action.
