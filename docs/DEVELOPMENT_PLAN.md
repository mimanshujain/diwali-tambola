# Development plan

| Milestone | Deliverable | Status |
|---|---|---|
| M1 | ARM64 Docker foundation, NestJS API, PostgreSQL, health checks | In progress |
| M2 | Prisma schema/migrations, game domain, ticket generator, number sequence and restart-safe scheduler | Planned |
| M3 | Player registration, device/mobile identity, ticket submission and audited reissue | Planned |
| M4 | Winning categories, eligibility evaluation, claims and outcome resolution | Planned |
| M5 | Player superpower and category-specific priority window | Planned |
| M6 | TV, player and admin web experiences with real-time updates | Planned |
| M7 | Ticket PDF/printing, operational runbook, security and party-scale tests | Planned |

## Engineering approach

- Keep `main` deployable; use feature branches for substantial changes.
- Add automated tests with each domain feature.
- Treat number calls and winner resolution as audited transactions.
- Keep game rules/configuration explicit and snapshot rule decisions in resolved outcomes.
- Test on ARM64 Docker, not only on an x86 development machine.
