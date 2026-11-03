import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'

// Karakeep web port (docker/Dockerfile EXPOSE 3000 / PORT default).
export const uiPort = 3000

// Meilisearch and Chrome are internal sidecars, reached over this package's
// shared loopback network namespace — never exposed via an interface.
export const meiliPort = 7700
export const chromePort = 9222

export const uiMultiHostId = 'ui'
export const uiInterfaceId = 'ui'

// Sign-in email of the administrator account Set Admin Password creates.
export const adminEmail = 'admin@karakeep.local'

export const dataMount = sdk.Mounts.of().mountVolume({
  volumeId: 'main',
  subpath: 'data',
  mountpoint: '/data',
  readonly: false,
})

export const primaryUrl = sdk.setupPrimaryUrl({
  id: 'set-primary-url',
  hostId: uiMultiHostId,
  interfaceId: uiInterfaceId,
  metadata: {
    name: i18n('Set Primary URL'),
    description: i18n(
      'Choose the address Karakeep puts in the links it generates, such as sign-in callbacks. Karakeep restarts to apply the change.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  field: { name: i18n('URL'), description: null },
  get: storeJson.read((s) => s.domain),
  set: (effects, url) => storeJson.merge(effects, { domain: url }),
})

// Background job concurrency per "Set Performance" choice. Each job waits for
// its Meilisearch batch, so more workers fill batches and index faster, at the
// cost of CPU and memory.
export const workerPresets = {
  low: { search: 5, embedding: 2 },
  medium: { search: 20, embedding: 5 },
  high: { search: 50, embedding: 10 },
} as const
