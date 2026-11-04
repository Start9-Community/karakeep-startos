import { hasModel, ollamaModels, serviceBaseUrl } from '../backends'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value, Variants } = sdk

// One model field. For the Ollama package, its description lists the models
// Ollama has.
const modelField = (
  name: string,
  placeholder: string,
  description: string | null,
  ollamaPackage: boolean,
) =>
  !ollamaPackage
    ? Value.text({
        name,
        description,
        default: null,
        required: true,
        placeholder,
      })
    : Value.dynamicText(async ({ effects }) => {
        const models = await ollamaModels(effects)
        return {
          name,
          description: [
            description,
            models?.length
              ? `${i18n('Available on this service:')} ${models.join(', ')}`
              : models
                ? i18n('This service has no models yet. Add one to it first.')
                : i18n(
                    "This service isn't running, so its models can't be listed. Enter the model's name.",
                  ),
          ]
            .filter(Boolean)
            .join('\n'),
          default: null,
          required: true,
          placeholder,
        }
      })

const autoSummarize = Value.toggle({
  name: i18n('Summarize Automatically'),
  description: null,
  default: false,
})

const modelFields = (ollamaPackage: boolean) => ({
  textModel: modelField(i18n('Text Model'), 'qwen2.5:7b', null, ollamaPackage),
  imageModel: modelField(i18n('Image Model'), 'gemma3:4b', null, ollamaPackage),
  autoSummarize,
  semanticSearch: Value.union({
    name: i18n('Semantic Search'),
    description: i18n(
      'Finds bookmarks by meaning as well as keywords. Karakeep creates an embedding of each new bookmark with the model below and keeps it in Meilisearch.',
    ),
    default: 'disabled',
    variants: Variants.of({
      disabled: { name: i18n('Disabled'), spec: InputSpec.of({}) },
      enabled: {
        name: i18n('Enabled'),
        spec: InputSpec.of({
          embeddingModel: modelField(
            i18n('Embedding Model'),
            'nomic-embed-text',
            i18n(
              'When you save, Karakeep asks the server for an embedding from this model to confirm it works and to read its dimensions.',
            ),
            ollamaPackage,
          ),
        }),
      },
    }),
  }),
})

const providers = Variants.of({
  none: { name: i18n('Disabled'), spec: InputSpec.of({}) },
  'local-ollama': {
    name: i18n('Ollama (on this server)'),
    spec: InputSpec.of(modelFields(true)),
  },
  'local-vllm': {
    name: i18n('vLLM (on this server)'),
    spec: InputSpec.of({ autoSummarize }),
  },
  'local-llama-cpp': {
    name: i18n('llama.cpp (on this server)'),
    spec: InputSpec.of({ autoSummarize }),
  },
  ollama: {
    name: i18n('Ollama server (by URL)'),
    spec: InputSpec.of({
      baseUrl: Value.text({
        name: i18n('Server URL'),
        description: null,
        default: null,
        required: true,
        placeholder: 'http://192.168.1.50:11434',
      }),
      ...modelFields(false),
    }),
  },
  openai: {
    name: i18n('OpenAI-compatible server (by URL)'),
    spec: InputSpec.of({
      baseUrl: Value.text({
        name: i18n('Server URL'),
        description: null,
        default: null,
        required: false,
        placeholder: 'https://api.openai.com/v1',
      }),
      apiKey: Value.text({
        name: i18n('API Key'),
        description: i18n(
          "Required. A local server such as Ollama doesn't check it, so any placeholder value (for example 'ollama') works.",
        ),
        default: null,
        required: true,
        masked: true,
      }),
      ...modelFields(false),
    }),
  },
})

export const inputSpec = InputSpec.of({
  provider: Value.union({
    name: i18n('Provider'),
    default: 'none',
    variants: providers,
  }),
})

// Embeds one word through the same endpoint Karakeep will use, from a
// container with the same network as the daemon, and returns the vector length.
const probeScript = `
const { PROVIDER, BASE_URL, API_KEY, MODEL } = process.env
const ollama = PROVIDER === 'ollama'
const base = (BASE_URL || 'https://api.openai.com/v1').replace(/\\/+$/, '')
const url = ollama ? base + '/api/embed' : base + '/embeddings'
fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(ollama ? {} : { authorization: 'Bearer ' + API_KEY }),
  },
  body: JSON.stringify({ model: MODEL, input: 'hello' }),
  signal: AbortSignal.timeout(100000),
})
  .then(async (res) => {
    const text = await res.text()
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300))
    const json = JSON.parse(text)
    const vector = ollama ? json.embeddings?.[0] : json.data?.[0]?.embedding
    if (!Array.isArray(vector) || !vector.length)
      throw new Error('the response contained no embedding')
    console.log(vector.length)
  })
  .catch((e) => {
    console.error(url + ': ' + e.message + (e.cause ? ' (' + e.cause.message + ')' : ''))
    process.exit(1)
  })
`

const throwError = (message: string): never => {
  throw new Error(message)
}

async function detectEmbeddingDimensions(
  effects: Parameters<typeof sdk.SubContainer.withTemp>[0],
  opts: {
    provider: 'ollama' | 'openai'
    baseUrl: string
    apiKey: string
    model: string
  },
): Promise<number> {
  const res = await sdk.SubContainer.withTemp(
    effects,
    { imageId: 'karakeep' },
    null,
    'embedding-probe',
    (sub) =>
      sub.exec(['node', '-e', probeScript], {
        env: {
          PROVIDER: opts.provider,
          BASE_URL: opts.baseUrl,
          API_KEY: opts.apiKey,
          MODEL: opts.model,
        },
        timeout: 120_000,
      }),
  )
  const dimensions = Number(String(res.stdout).trim())
  if (res.exitCode !== 0 || !Number.isInteger(dimensions) || dimensions < 1) {
    throw new Error(
      `${i18n('Could not get an embedding from this model:')} ${opts.model}: ${String(res.stderr).trim() || i18n('the request timed out')}`,
    )
  }
  return dimensions
}

export const configureAi = sdk.Action.withInput(
  // id
  'configure-ai',

  // metadata
  async () => ({
    name: i18n('Configure AI'),
    description: i18n(
      'Connect Karakeep to an AI service on this server, or to any Ollama or OpenAI-compatible server, for automatic tagging and summaries.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  // form input specification
  inputSpec,

  // pre-fill the input form with the current values
  async () => {
    const ai = await storeJson.read((s) => s.ai).once()
    if (!ai || ai.provider === 'none')
      return { provider: { selection: 'none' as const } }
    const models = {
      textModel: ai.textModel,
      imageModel: ai.imageModel,
      autoSummarize: ai.autoSummarize,
      semanticSearch: ai.embeddingModel
        ? {
            selection: 'enabled' as const,
            value: { embeddingModel: ai.embeddingModel },
          }
        : { selection: 'disabled' as const },
    }
    const baseUrl = ai.baseUrl || undefined
    switch (ai.provider) {
      case 'local-ollama':
        return { provider: { selection: ai.provider, value: models } }
      case 'local-vllm':
      case 'local-llama-cpp':
        return {
          provider: {
            selection: ai.provider,
            value: { autoSummarize: ai.autoSummarize },
          },
        }
      case 'ollama':
        return {
          provider: {
            selection: 'ollama' as const,
            value: { ...models, baseUrl },
          },
        }
      case 'openai':
        return {
          provider: {
            selection: 'openai' as const,
            value: { ...models, baseUrl, apiKey: ai.apiKey || undefined },
          },
        }
    }
  },

  // the execution function
  async ({ effects, input }) => {
    const p = input.provider
    if (p.selection === 'none') {
      await storeJson.merge(effects, { ai: { provider: 'none' } })
      return
    }
    // vLLM and llama.cpp serve one model, which main.ts reads from them.
    if (p.selection === 'local-vllm' || p.selection === 'local-llama-cpp') {
      await storeJson.merge(effects, {
        ai: {
          provider: p.selection,
          baseUrl: '',
          apiKey: '',
          textModel: '',
          imageModel: '',
          autoSummarize: p.value.autoSummarize,
          embeddingModel: '',
          embeddingDimensions: 0,
        },
      })
      return
    }
    const custom =
      p.selection === 'ollama'
        ? { baseUrl: p.value.baseUrl, apiKey: '' }
        : p.selection === 'openai'
          ? { baseUrl: p.value.baseUrl ?? '', apiKey: p.value.apiKey }
          : null
    const embeddingModel =
      p.value.semanticSearch.selection === 'enabled'
        ? p.value.semanticSearch.value.embeddingModel
        : ''
    const models = custom ? null : await ollamaModels(effects)
    const missing = [p.value.textModel, p.value.imageModel, embeddingModel]
      .filter((m) => m && models && !hasModel(models, m))
      .join(', ')
    if (models && missing)
      throw new Error(
        `${i18n('Not available on this service:')} ${missing}. ${i18n('Available on this service:')} ${models.join(', ') || '-'}`,
      )
    const embeddingDimensions = !embeddingModel
      ? 0
      : await detectEmbeddingDimensions(effects, {
          model: embeddingModel,
          ...(custom
            ? {
                provider: p.selection === 'ollama' ? 'ollama' : 'openai',
                ...custom,
              }
            : {
                provider: 'ollama',
                baseUrl:
                  (await serviceBaseUrl(effects, 'ollama', 'once')) ??
                  throwError(
                    `Ollama: ${i18n("Semantic search needs this service installed and running, to read the embedding model's dimensions. Install it, or save with Semantic Search disabled.")}`,
                  ),
                apiKey: '',
              }),
        })
    await storeJson.merge(effects, {
      ai: {
        provider: p.selection,
        baseUrl: custom?.baseUrl ?? '',
        apiKey: custom?.apiKey ?? '',
        textModel: p.value.textModel,
        imageModel: p.value.imageModel,
        autoSummarize: p.value.autoSummarize,
        embeddingModel,
        embeddingDimensions,
      },
    })
  },
)
