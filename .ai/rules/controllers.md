---
paths:
  - 'app/Http/Controllers/**'
---

# Controllers

## Never send rates to viewers without ViewRates
Hourly rates and amounts are only included in Inertia props when the user can(viewRates, organization) (owners/admins). Members get null. Test it for every page that shows money.

## Read reported time through ReportBuilder
Pages and exports that aggregate time entries build a `ReportFilters` and call `App\Services\Reports\ReportBuilder` instead of querying `TimeEntry` sums themselves. The filters restrict members to their own time and null amounts without ViewRates, so visibility rules live in one place.
