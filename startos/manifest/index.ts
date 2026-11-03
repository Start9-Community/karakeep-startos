import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'karakeep',
  title: 'Karakeep',
  license: 'AGPL-3.0',
  packageRepo: 'https://github.com/Start9-Community/karakeep-startos',
  upstreamRepo: 'https://github.com/karakeep-app/karakeep',
  marketingUrl: 'https://karakeep.com',
  donationUrl: 'https://github.com/sponsors/MohamedBassem',
  description: { short, long },
  // 'main' holds this package's own store.json (generated secrets) plus two
  // subpaths: the karakeep DATA_DIR (sqlite db + assets) and meilisearch's
  // index data (main.ts).
  volumes: ['main', 'startos'],
  images: {
    // Official multi-arch image. Confirmed on ghcr.io 2026-09-01: amd64 + arm64.
    karakeep: {
      source: { dockerTag: 'ghcr.io/karakeep-app/karakeep:0.34.1' },
      arch: ['x86_64', 'aarch64'],
    },
    // Headless Chrome used by the crawler for screenshots/archival. Tagged by
    // its bundled Chrome version, not the karakeep app version. Confirmed on
    // ghcr.io 2026-09-01: amd64 + arm64.
    chrome: {
      source: {
        dockerBuild: {
          buildArgs: {
            IMAGE: 'ghcr.io/karakeep-app/karakeep-chrome:154.0.8037.57-r1',
          },
        },
      },
      arch: ['x86_64', 'aarch64'],
    },
    // Search index. Pinned to the version upstream's own docker-compose.yml
    // ships (docker/docker-compose.yml). Confirmed on Docker Hub 2026-09-01:
    // amd64 + arm64.
    meilisearch: {
      source: { dockerTag: 'getmeili/meilisearch:v1.41.0' },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
