# Contributing to Rewindarr

Contributions are welcome and greatly appreciated! Please follow the guidelines below.

## Development

### Tools

- [Git](https://git-scm.com) for source control
- [Node.js](https://nodejs.org) 24 or higher (see `.node-version`)
- [pnpm](https://pnpm.io) as a package manager. The version is pinned in `package.json`, so enabling it with `corepack enable pnpm` picks the right one.
- [VS Code](https://code.visualstudio.com) is recommended as an editor. It suggests the extensions in `.vscode/extensions.json` when you open the project.
- A [Plex](https://plex.tv) or [Jellyfin](https://jellyfin.org) server and either a [Tautulli](https://tautulli.com) or a [Tracearr](https://github.com/connorgallopo/Tracearr) instance (Jellyfin needs Tracearr), if you want to work with real data. [Seerr](https://seerr.dev) is optional. You enter their URLs and API keys under _Settings → Connection_ once the app is running. Without them, you can use the [mock data](#mock-data).

### Getting started

1. [Fork](https://help.github.com/articles/fork-a-repo/) the repository to your own GitHub account and [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device:

   ```bash
   git clone https://github.com/YOUR_USERNAME/rewindarr.git
   cd rewindarr
   ```

2. Create `.env.local` from `.env.example`. Everything in it is optional: the app creates a secret in `config/auth-secret` on first start and uses the address it's opened at.

   ```bash
   cp .env.example .env.local
   ```

3. Install the project dependencies:

   ```bash
   pnpm i
   ```

4. Create a branch from `develop`, named as described in the [code guidelines](#code-guidelines):

   ```bash
   git checkout -b <YOUR_BRANCH_NAME> develop
   ```

5. Run the development environment. The app is available at `http://localhost:3000`:

   ```bash
   pnpm dev
   ```

6. Make your changes and test them, following the [code guidelines](#code-guidelines).

7. Should you need to update your fork, you can do so by rebasing from `upstream`. Add the remote once:

   ```bash
   git remote add upstream https://github.com/RaunoT/rewindarr.git
   ```

   Then fetch and rebase whenever you need to:

   ```bash
   git fetch upstream
   git rebase upstream/develop
   git push origin BRANCH_NAME -f
   ```

### Running with Docker

To try your changes in the production image, run `docker compose up --build`. The `docker-compose.yml` in the repository builds the image from the `Dockerfile`, reads its environment from `.env.local` and mounts `./config` for the settings. It maps port `3000` on your machine to the container's `8383`, so the app is available at `http://localhost:3000`.

### Mock data

`.github/scripts/mock-server.mjs` stands in for Tautulli and Seerr with a made-up 15-person server, so you can work without a media server and take screenshots that don't show anyone's real history. Its users have stock portraits from randomuser.me as avatars, and the app still fetches real posters, ratings and links for its titles. The README screenshots in `.github/screenshots` are taken with it.

1. Start the mock with your own Plex account as one of its users, so you can sign in. Your ID, name, email and avatar URL are under `user` at `/api/auth/session` while you're signed in to your dev server:

   ```bash
   MOCK_USER_ID=… MOCK_USER_NAME='…' MOCK_USER_EMAIL=… MOCK_USER_THUMB=… node .github/scripts/mock-server.mjs
   ```

2. Run a second copy of the app, so your own settings stay untouched. Settings are read from the folder the app runs in, so a worktree gets its own:

   ```bash
   git worktree add ../rewindarr-mock
   cp .env.local ../rewindarr-mock/
   cd ../rewindarr-mock && pnpm install
   ```

   Save this as `config/settings.json` there, then start it with `pnpm dev -p 3001` and sign in. If your `.env.local` sets `NEXTAUTH_URL` or `NEXT_PUBLIC_SITE_URL`, remove them from the copy:

   ```json
   {
     "connection": {
       "statisticsSource": "tautulli",
       "tautulliUrl": "http://localhost:8787",
       "tautulliApiKey": "mock",
       "plexUrl": "http://localhost:32400",
       "seerrUrl": "http://localhost:8787",
       "seerrApiKey": "mock",
       "complete": true
     },
     "general": {
       "activeLibraries": ["movies", "shows", "music"],
       "activeExternalLinks": ["imdb", "rottenTomatoes", "letterboxd"],
       "complete": true
     },
     "rewind": { "complete": true },
     "dashboard": { "complete": true },
     "activity": { "complete": true },
     "history": { "complete": true },
     "setupComplete": true
   }
   ```

3. For the README, take the screenshots in a 1280×720 window at 2× scale, with the Next.js dev badge hidden, and save them as WebP:

   ```bash
   cwebp -q 82 -m 6 home.png -o .github/screenshots/home.webp
   ```

### Pull requests

Run these and fix anything they report. The same checks run on every pull request.

```bash
pnpm lint:all
pnpm test
pnpm build
```

`pnpm lint:all` runs ESLint, the TypeScript check, Stylelint and a Prettier check, and `pnpm lint:all:fix` fixes what it can.

Fill in the pull request template. For UI changes, add before and after screenshots, at phone and desktop widths where the layout differs. When the change moves or needs interaction, such as animations, transitions or multi-step flows, add a short recording too (MP4 under 10 MB). Drag the files into the description on GitHub.

### Code guidelines

- If you are taking on an existing [issue](https://github.com/RaunoT/rewindarr/issues), comment on it first, so two people don't work on the same thing.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Run `pnpm commit` for a guided prompt, or write the message yourself. Besides the usual types (`feat`, `fix`, `docs`, `chore` and so on) there is a `ui` type for UI changes. A commit hook checks the message. Make meaningful commits, or squash them before opening a pull request.
- Branch names and pull request titles follow the same logic, for example `feat(dashboard)/new-feature` or `fix/bug` for a branch and `feat(dashboard): new feature` or `fix: bug` for a pull request.
- Put user-facing text in `messages/*.json` instead of in the components, and add each new key to every language file, using `en-GB.json` as the reference (`en-US.json` only changes the spelling).
- Check your changes at phone, tablet and desktop widths.
- Use the proper Unicode characters for ellipses (…), arrows (→) and other symbols.
- Open pull requests against `develop`, never `main`. Pull requests to `main` are closed.
