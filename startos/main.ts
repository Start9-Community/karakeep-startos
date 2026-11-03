import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  ServiceId,
  serviceBaseUrl,
  servicePublished,
  services,
} from './backends'
import { storeJson } from './fileModels/store.json'
import {
  chromePort,
  dataMount,
  meiliPort,
  primaryUrl,
  uiPort,
  workerPresets,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting Karakeep!'))

  const nextAuthSecret =
    (await storeJson.read((s) => s.nextAuthSecret).const(effects)) ?? ''
  const meiliMasterKey =
    (await storeJson.read((s) => s.meiliMasterKey).const(effects)) ?? ''
  const url = await primaryUrl.bestUsable(effects).const()
  const signupsDisabled = await storeJson
    .read((s) => s.signupsDisabled)
    .const(effects)
  const performance =
    (await storeJson.read((s) => s.performance).const(effects)) ?? 'high'
  const workers = workerPresets[performance]
  // Read per field, like the settings above, so a change to any one of them
  // re-runs this handler and restarts the daemon.
  const aiProvider = await storeJson.read((s) => s.ai?.provider).const(effects)
  const onServer = aiProvider?.startsWith('local-')
    ? (aiProvider.slice('local-'.length) as ServiceId)
    : null
  const aiBaseUrl = onServer
    ? await serviceBaseUrl(effects, onServer, 'const')
    : await storeJson.read((s) => s.ai?.baseUrl).const(effects)
  const aiApiKey = onServer
    ? await servicePublished(effects, onServer, 'apiKey', 'const')
    : await storeJson.read((s) => s.ai?.apiKey).const(effects)
  const aiProtocol = onServer ? services[onServer].protocol : aiProvider
  // vLLM publishes the name of the one model it serves; llama.cpp serves one
  // model and ignores the name sent.
  const servedModel =
    onServer === 'vllm'
      ? await servicePublished(effects, 'vllm', 'model', 'const')
      : onServer === 'llama-cpp'
        ? 'llama-cpp'
        : null
  const aiTextModel =
    servedModel ?? (await storeJson.read((s) => s.ai?.textModel).const(effects))
  const aiImageModel =
    servedModel ??
    (await storeJson.read((s) => s.ai?.imageModel).const(effects))
  const aiAutoSummarize = await storeJson
    .read((s) => s.ai?.autoSummarize)
    .const(effects)
  const aiEmbeddingModel = await storeJson
    .read((s) => s.ai?.embeddingModel)
    .const(effects)
  const aiEmbeddingDimensions = await storeJson
    .read((s) => s.ai?.embeddingDimensions)
    .const(effects)
  const aiEnv: Record<string, string> =
    !aiProvider ||
    aiProvider === 'none' ||
    (onServer && !aiBaseUrl) ||
    (onServer === 'vllm' && !servedModel)
      ? {}
      : {
          ...(aiProtocol === 'ollama'
            ? { OLLAMA_BASE_URL: aiBaseUrl ?? '' }
            : {
                OPENAI_API_KEY: aiApiKey ?? '',
                ...(aiBaseUrl ? { OPENAI_BASE_URL: aiBaseUrl } : {}),
              }),
          INFERENCE_TEXT_MODEL: aiTextModel ?? '',
          INFERENCE_IMAGE_MODEL: aiImageModel ?? '',
          INFERENCE_ENABLE_AUTO_SUMMARIZATION: aiAutoSummarize
            ? 'true'
            : 'false',
          ...(aiEmbeddingModel && aiEmbeddingDimensions
            ? {
                EMBEDDING_TEXT_MODEL: aiEmbeddingModel,
                EMBEDDING_DIMENSIONS: String(aiEmbeddingDimensions),
                EMBEDDING_ENABLE_AUTO_INDEXING: 'true',
              }
            : { EMBEDDING_ENABLE_AUTO_INDEXING: 'false' }),
        }

  return sdk.Daemons.of(effects)
    .addDaemon('meilisearch', {
      subcontainer: sdk.SubContainer.of(
        effects,
        { imageId: 'meilisearch' },
        sdk.Mounts.of().mountVolume({
          volumeId: 'main',
          subpath: 'meilisearch',
          mountpoint: '/meili_data',
          readonly: false,
        }),
        'meilisearch-sub',
      ),
      exec: {
        // The image's entrypoint is tini, which warns when it is not PID 1.
        command: ['/bin/meilisearch'],
        cwd: '/meili_data',
        env: {
          MEILI_MASTER_KEY: meiliMasterKey,
          MEILI_NO_ANALYTICS: 'true',
        },
      },
      ready: {
        display: null, // internal sidecar, not shown to the user
        fn: () =>
          sdk.healthCheck.checkWebUrl(
            effects,
            `http://127.0.0.1:${meiliPort}/health`,
            {
              // Meilisearch answers /health slowly while indexing a backlog;
              // the 1s default flaps and takes karakeep down with it.
              timeout: 15_000,
              successMessage: i18n('Meilisearch is ready'),
              errorMessage: i18n('Meilisearch is not ready'),
            },
          ),
      },
      requires: [],
    })
    .addDaemon('chrome', {
      subcontainer: sdk.SubContainer.of(
        effects,
        { imageId: 'chrome' },
        sdk.Mounts.of(),
        'chrome-sub',
      ),
      exec: {
        command: sdk.useEntrypoint([
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--hide-scrollbars',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1440,900',
        ]),
        // The bundled Chrome launcher expects to run as PID 1.
        runAsInit: true,
      },
      ready: {
        display: null, // internal sidecar, not shown to the user
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, chromePort, {
            successMessage: i18n('Chrome is ready'),
            errorMessage: i18n('Chrome is not ready'),
          }),
      },
      requires: [],
    })
    .addDaemon('karakeep', {
      subcontainer: sdk.SubContainer.of(
        effects,
        { imageId: 'karakeep' },
        dataMount,
        'karakeep-sub',
      ),
      exec: {
        command: sdk.useEntrypoint(),
        // Bundles s6-overlay, which must run as PID 1.
        runAsInit: true,
        env: {
          DATA_DIR: '/data',
          NEXTAUTH_SECRET: nextAuthSecret,
          NEXTAUTH_URL: url ?? `http://localhost:${uiPort}`,
          MEILI_ADDR: `http://127.0.0.1:${meiliPort}`,
          MEILI_MASTER_KEY: meiliMasterKey,
          BROWSER_WEB_URL: `http://127.0.0.1:${chromePort}`,
          DISABLE_SIGNUPS: signupsDisabled ? 'true' : 'false',
          DB_WAL_MODE: 'true',
          EMBEDDING_NUM_WORKERS: String(workers.embedding),
          SEARCH_NUM_WORKERS: String(workers.search),
          ...aiEnv,
        },
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkWebUrl(
            effects,
            `http://127.0.0.1:${uiPort}/api/health`,
            {
              successMessage: i18n('Karakeep is ready'),
              errorMessage: i18n('Karakeep is not ready'),
            },
          ),
      },
      requires: ['meilisearch', 'chrome'],
    })
})
