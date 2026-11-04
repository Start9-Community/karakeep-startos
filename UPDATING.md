# Updating the upstream version

Upstream is tracked as three independently pinned prebuilt Docker images in
`startos/manifest/index.ts`:

- `images.karakeep.source.dockerTag` — the Karakeep app itself, tagged
  `ghcr.io/karakeep-app/karakeep:<version>` (no `v` prefix on the image tag,
  unlike the git release tag which does have one).
- `images.chrome.source.dockerBuild.buildArgs.IMAGE` — `ghcr.io/karakeep-app/karakeep-chrome`
  (built through the root `Dockerfile`, a temporary eMudhra CA-store layer;
  remove it and restore `source: { dockerTag }` in the first bump whose image
  has `ca-certificates` 20250419+deb13u1 or later: `docker run --rm --entrypoint sh <image> -c 'grep -c MIICTjCCAdOgAwIBAgIKPPYHqWhwDtqLhDAKBggqhkjOPQQDAzBr /etc/ssl/certs/ca-certificates.crt'` must print `0`),
  tagged by its bundled Chrome version, not the Karakeep app version. Only
  bump it when upstream's `docker/docker-compose.yml` moves its own pin (or
  Chrome ships a security fix) — it does not track Karakeep releases.
- `images.meilisearch.source.dockerTag` — `getmeili/meilisearch`, pinned to
  whatever version upstream's own `docker/docker-compose.yml` ships. Bump it
  in lockstep with that file, not independently — a mismatched Meilisearch
  version is the most common cause of a broken search index after an update.

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
