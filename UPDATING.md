# Updating the upstream version

Upstream is tracked as three independently pinned prebuilt Docker images in
`startos/manifest/index.ts`:

- `images.karakeep.source.dockerTag` — the Karakeep app itself, tagged
  `ghcr.io/karakeep-app/karakeep:<version>` (no `v` prefix on the image tag,
  unlike the git release tag which does have one).
- `images.chrome.source.dockerTag` — `ghcr.io/karakeep-app/karakeep-chrome`,
  tagged by its bundled Chrome version, not the Karakeep app version. Pin the
  tag of upstream's `docker/chrome/Dockerfile` `GOOGLE_CHROME_VERSION` at the
  matching Karakeep git tag (published as `<version>-r<n>`; take the highest
  `-r`). Upstream's compose file uses the floating `release` tag, so it does
  not move with Karakeep releases — check the Dockerfile.
- `images.meilisearch.source.dockerTag` — `getmeili/meilisearch`, pinned to
  whatever version upstream's own `docker/docker-compose.yml` ships. Bump it
  in lockstep with that file, not independently — a mismatched Meilisearch
  version is the most common cause of a broken search index after an update.
  `MEILI_UPGRADE_DB=true` in `startos/main.ts` stays set on purpose: it is
  what lets a new pin open the old index (it migrates it in place), and it
  does nothing when the version is unchanged. Don't remove it.

## Determining the upstream version

- Latest Karakeep release: `gh release view -R karakeep-app/karakeep --json tagName -q .tagName`
  (git tag has a `v` prefix, e.g. `v0.33.2`; the image tag does not: `0.33.2`).
- Confirm the image tag is published as multi-arch on ghcr.io before pinning it:
  ```
  TOK=$(curl -s "https://ghcr.io/token?service=ghcr.io&scope=repository:karakeep-app/karakeep:pull" | jq -r .token)
  curl -s -H "Authorization: Bearer $TOK" -H "Accept: application/vnd.oci.image.index.v1+json" \
    https://ghcr.io/v2/karakeep-app/karakeep/manifests/<tag> | jq '.manifests[].platform'
  ```
  Must include both `amd64` and `arm64`. Same check against
  `karakeep-app/karakeep-chrome` for the Chrome image.
- Current Meilisearch pin: read `docker/docker-compose.yml` at the matching
  Karakeep git tag (`getmeili/meilisearch` image line).

## Applying the bump

1. Update `images.karakeep.source.dockerTag` (and `images.meilisearch.source.dockerTag`
   if upstream's compose file moved it) in `startos/manifest/index.ts`.
2. Bump the version in `startos/versions/current.ts` to match
   (`<upstream-version-without-v>:0`).
3. Before bumping, diff upstream's `packages/shared/config.ts` (env var
   options) and `docker/docker-compose.yml` between the old and new tag for
   anything this package relies on: `DATA_DIR`, `NEXTAUTH_URL`,
   `NEXTAUTH_SECRET`, `MEILI_ADDR`, `MEILI_MASTER_KEY`, `BROWSER_WEB_URL`,
   `DISABLE_SIGNUPS`, and the `/api/health` route. A renamed or removed
   variable breaks `startos/main.ts` silently until someone hits it.
4. **Set Admin Password** (`startos/actions/setAdminPassword.ts`) writes the
   admin account straight into `db.db`, mirroring upstream's `User.createRaw`
   and `setUserPassword` (`packages/trpc/models/users.ts`, `packages/trpc/auth.ts`).
   Diff those, the `user`/`account`/`session` tables in `packages/db/schema.ts`,
   and the image's `/db_migrations` and
   `/app/apps/workers/node_modules/@karakeep/{db,trpc}` layout between tags.
5. **After any Meilisearch pin change**, install the build over an existing
   install with bookmarks and confirm the in-place index upgrade succeeded.
   A failed upgrade leaves `/health` green but stops all indexing for good:
   ```
   start-cli package attach karakeep -n meilisearch-sub -- sh -c \
     'K=$(tr "\0" "\n" </proc/$(pidof meilisearch)/environ | sed -n "s/^MEILI_MASTER_KEY=//p");
      curl -s -H "Authorization: Bearer $K" "http://127.0.0.1:7700/tasks?types=upgradeDatabase"'
   ```
   The latest task must be `"status":"succeeded"`. (An attach shell doesn't
   inherit the daemon's env, so the key is read from the running process.)
   Then save a new bookmark and confirm search finds it.
