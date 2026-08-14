# Design reference

`Title CRM (original).html` is the Claude Design **Title CRM 897** export — the
visual source of truth this application was built from. It is kept here so the
implementation and the design it came from live in one repository.

It is a reference, not a dependency: nothing in `src/` imports it, and it is not
part of the build. Open it directly in a browser to compare a screen against the
design.

## What was taken from it

- **The stylesheet**, ported verbatim into [`src/styles/design.css`](../src/styles/design.css).
  Every colour, radius, shadow, font size and breakpoint in the application is the
  design's own value.
- **The seed data**, extracted by running the design's own script and serialising
  its structures into [`src/data/`](../src/data). It was not re-typed, so the
  figures on screen match the design exactly.
- **The rules** — the assignment engine, SLA checkpoints, payroll structure and
  coverage levels — ported into [`src/lib/`](../src/lib).

## What was left behind

The original export also contained `Title CRM - standalone.html`, two byte-identical
copies of the app under `uploads/`, and `titleflow.html` (a separate linked
prototype). Those are duplicates or out of scope, so only the original is kept.

`DESIGN-PACKAGE.md` is the README that shipped inside the export.
