---
paths:
  - 'routes/**'
---

# Routes

## Tenant routes live under the organization slug
Pages that show organization data are registered inside the `{current_organization}` prefix group with EnsureOrganizationMembership, which checks membership and sets CurrentOrganization. Never read users.current_organization_id directly to pick the tenant.
