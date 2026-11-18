---
paths:
  - 'app/Http/Controllers/**'
---

# Controllers

## Never send rates to viewers without ViewRates
Hourly rates and amounts are only included in Inertia props when the user can(viewRates, organization) (owners/admins). Members get null. Test it for every page that shows money.
