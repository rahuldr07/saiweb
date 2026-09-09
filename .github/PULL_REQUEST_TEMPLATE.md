## What this changes

<!-- What it does and why. If it fixes something, say what was wrong. -->

## Checks

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass
- [ ] Screenshots below, if anything visual changed — light and dark
- [ ] `src/styles/design.css` untouched, or the reason it had to change is in the
      description (corrections normally go in `src/styles/index.css` with a
      comment saying why)
- [ ] Any new time read goes through `now()` from `@/lib/clock`
- [ ] If this touches `server/db/`, `eslint.config.js`, `tsconfig*.json` or
      `.github/`, the description says what changed and why — these break
      quietly: a row-level-security policy that stops applying still looks
      healthy, a relaxed lint rule lets wall-clock reads back in, a `tsconfig`
      that emits shadows the source Vite serves, and CI is what every other
      review is checked against

## Screenshots

<!-- Before and after. Delete this section if nothing visual changed. -->
