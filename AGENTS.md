# Rewindarr

Self-hosted Next.js 16 app (App Router, React 19, Tailwind 4, TypeScript) that shows Plex and Jellyfin statistics from Tautulli or Tracearr (Jellyfin only through Tracearr). It ships as a Docker image (`ghcr.io/raunot/rewindarr`, `raunoot/rewindarr`, also published under the old `plex-rewind` names) that listens on port 8383.

Contributor setup is in [CONTRIBUTING.md](CONTRIBUTING.md). Use pnpm (pinned in `package.json`) and Node 24.

## Commands

- `pnpm dev`: dev server with Turbopack at `http://localhost:3000`. `.env.local` (from `.env.example`) is optional; without `NEXTAUTH_SECRET` a secret is created in `config/auth-secret`.
- `pnpm lint:all`: ESLint, `tsc --noEmit`, Stylelint and a Prettier check. `pnpm lint:all:fix` fixes what it can.
- `pnpm test`: Vitest unit tests, kept next to the code they test as `*.test.ts`.
- `pnpm build`: `next build` followed by `serwist build`, which generates the service worker in `public/sw.js`.
- `pnpm commit`: guided Conventional Commits prompt (commitizen).

Run `pnpm lint:all` and `pnpm test` before every PR. CI also runs `pnpm build`.

## Checking UI changes

- A git worktree starts without `.env.local` and the files in `config/`. Copy them from the main checkout, or the proxy redirects to the setup pages. Copying `config/play-history.json.gz` too saves reading the whole play history again.
- Run `pnpm dev` and check the change in a browser at phone (about 390px) and desktop widths. When port 3000 is taken, Next uses the next free port.
- Plex login returns to `NEXT_PUBLIC_SITE_URL`, or without it to the address it was started from. Cookies are not scoped by port, so with the same secret (`NEXTAUTH_SECRET` or `config/auth-secret`) a login on 3000 also works on the other ports.
- Loading skeletons copy the layout of what they stand in for, so nothing moves once the data arrives: `DashboardLoader.tsx`, `HistorySkeleton.tsx`, `ActivitiesSkeleton.tsx`, `OverviewSkeleton` in `Overview.tsx` and the `loading.tsx` files. When a change moves, adds or removes anything in a card, row or page that has a skeleton, update the skeleton in the same change and compare the two at phone and desktop widths. To see a skeleton, throttle the network in the browser, or open a page with nothing to show (such as `/history?q=` with a search that matches nothing), where `SkeletonSized` keeps an invisible copy you can unhide.
- Take before and after screenshots of what changed, with the same URL, width and state, at phone and desktop widths where the layout differs. Take the before ones before you edit, or from a `develop` worktree on another port.
- When the change moves or needs interaction (animations, transitions, gestures, multi-step flows), also record a short video, MP4 or WebM under 10 MB. Record the before too when the difference is in the motion.
- Save the media outside the repository. Show it in your final message with the file paths, and point out any real names or watch history in it, as PR media is public.
- End with how to check the change: the URL paths to open, what to click and any settings it needs.

## Branches, commits and PRs

- Open PRs against `develop`, never `main`.
- Commits and PR titles follow Conventional Commits: `type(scope): description`. Types are enforced by `commitlint.config.ts`: `feat`, `fix`, `ui` (custom, for UI changes), `perf`, `docs`, `revert`, `chore`, `refactor`, `build`, `ci`, `style`, `test`.
- Branch names follow `type(scope)/short-description`, for example `feat(dashboard)/new-widget` or `fix/null-pointer`.
- PR descriptions follow `.github/pull_request_template.md`: a summary, a test plan with the URL paths to check, and for UI changes a before/after table. `gh` can't upload files, so name each file in the table's cells; the user drags them in on GitHub.
- Releases are automated by semantic-release: pre-releases from `develop`, releases from `main`, with a backmerge from `main` to `develop`. `feat` bumps minor; `fix`, `ui`, `perf`, `build`, `ci`, `revert` and `refactor` bump patch; `docs`, `chore`, `style` and `test` do not release. Never edit versions or changelogs by hand.
- Husky runs lint-staged on commit and commitlint on the message. Do not skip the hooks.

## Architecture

- `src/app`: routes (`(home)`, `dashboard`, `rewind`, `activity`, `history`, `settings`, `api`, and `~offline` for the PWA). Components and server actions sit next to their route in `_components` and `_actions`; shared ones are in `src/components` and `src/hooks`.
- `src/proxy.ts`: the Next 16 proxy (formerly middleware), wrapped in next-auth's `withAuth`. It sets the Content Security Policy with a script nonce (`src/utils/csp.ts`) and redirects to the setup pages while required settings (`REQUIRED_SETTINGS` in `src/utils/helpers.ts`) are missing.
- Settings live in `config/settings.json`, read and written by `src/utils/getSettings.ts`. The file is created from `DEFAULT_SETTINGS` in `src/utils/constants.ts` and merged with it when read. Types are in `src/types/settings.d.ts`. `config/` also holds the saved play history, the source snapshot and uploaded Rewind music. In Docker it is a volume at `/app/config`.
- Statistics source: `settings.connection.statisticsSource` is `tautulli` or `tracearr`. Both implement the `StatsSource` interface in `src/types/statsSource.d.ts`: Tautulli in `tautulliSource.ts` (HTTP client `fetchTautulli.ts`), Tracearr in `tracearrSource.ts` (HTTP client `fetchTracearr.ts`), which maps Tracearr data onto the shared types in `statsSource.d.ts` (`ItemRow`, `Library`, `Activity` and the rest, which keep Tautulli's field names). Types for one source's own API stay in `src/types/tautulli.d.ts` and `src/types/tracearr.d.ts`. `getStatsSource()` in `src/utils/statsSource.ts` picks one; the data utils and pages call it instead of branching on the source. A new statistic goes into the interface and both implementations. The media server is `settings.connection.mediaServerType` (`plex` or `jellyfin`); Tautulli only tracks Plex, and Tracearr's is the type of the server picked in the connection settings. Plex IDs are numbers in the shared types and Jellyfin IDs are hex strings, so compare IDs as strings.
- Play history: most statistics are computed from the source's play history. `playHistory.ts` reads it page by page from server start (`src/instrumentation.ts`), keeps it topped up and saves it to `config/play-history.json.gz` through `playHistoryFile.ts` (raise its `VERSION` when saved plays gain a field, so older files are read again). `playStats.ts` computes the statistics, and pages wait for the read with `getHistoryProgress()`. `sourceSnapshot.ts` saves the source's other answers, such as libraries and users, so pages still work while the source is down.
- Other data utils: `getDashboard.ts`, `getRewind.ts`, `getHistory.ts`, `getUsersTop.ts`, `fetchSeerr.ts`, `fetchTmdb.ts`. Login goes through next-auth (`src/lib/auth.ts`): Plex with a plex.tv PIN, Jellyfin with a username and password or Quick Connect (`src/lib/jellyfinAuth.ts`).
- Translations: `messages/*.json` (`en-GB`, `en-US`, `et`, `fr`, `de`, `it`, `es`), loaded by `src/i18n/request.ts`. The locale list is `LOCALES` in `src/utils/constants.ts`. `en-GB` is the reference and `en-US` only changes the spelling. `messages/messages.test.ts` checks that every locale has the same keys and placeholders, and `react/jsx-no-literals` flags hardcoded strings in JSX, so use next-intl.
- PWA: the service worker source is `src/lib/sw.ts`; `public/manifest.json` is the web manifest. `next.config.ts` uses `output: 'standalone'`, which the `Dockerfile` relies on.
- `docker-compose.yml` is for local development: it builds the image, maps `3000:8383` and reads `.env.local`.

## Code style

Prettier (no semicolons, single quotes) and ESLint decide formatting; ESLint also requires blank lines around `return`, `if` and variable declarations. CSS classes are kebab-case. Run `pnpm lint:all:fix` instead of formatting by hand.

## Rules

- Never commit secrets or user data: `.env*.local`, the files in `config/`, API keys, tokens or `NEXTAUTH_SECRET`. Do not paste them into issues, logs or PR text either.
- Do not add AI attribution to commits or PRs: no `Co-Authored-By` trailers and no "generated with" lines.
- Keep commit messages, PR descriptions and docs plain and concise.
- Do not hand-edit `pnpm-lock.yaml`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
