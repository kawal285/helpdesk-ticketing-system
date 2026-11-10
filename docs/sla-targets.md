# Response and resolution targets (SLA)

## Status of the numbers

**These are provisional defaults, not the IT desk's confirmed targets.**
We asked the IT desk which response and resolution times it uses for P1–P4.
Until it answers, the system uses the common industry defaults below. When
the real times arrive, an admin updates them in **Settings → Response and
resolution targets**. No code change or redeploy is needed.

| Priority | Desk level | First response | Resolution |
|----------|-----------|----------------|------------|
| Critical | P1 | 15 minutes | 4 hours |
| High | P2 | 1 hour | 8 hours |
| Medium | P3 | 4 hours | 24 hours |
| Low | P4 | 8 hours | 72 hours |
| Trivial | (below P4) | 24 hours | 120 hours |

The resolution times are the same ones the system used before the targets
table existed, so existing tickets keep the same deadlines.

## Where the targets live

- Table: `sla_targets` (`priority`, `responseMinutes`, `resolutionMinutes`)
- Seeded by `seeders/20261110000000-sla-targets.js`. The seeder only fills
  in missing priorities and never overwrites an admin's changes.
- Fallback: if a priority has no row, `DEFAULT_SLA_TARGETS` in
  `src/utils/sla.js` is used.
