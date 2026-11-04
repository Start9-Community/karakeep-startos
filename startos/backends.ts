import * as fs from 'node:fs/promises'
import { FileHelper, T, z } from '@start9labs/start-sdk'
import { sdk } from './sdk'
import {
  apiHostId as ollamaHostId,
  port as ollamaPort,
} from 'ollama-startos/startos/utils'
import {
  apiHostId as vllmHostId,
  apiPort as vllmPort,
} from 'vllm-startos/startos/utils'
import {
  apiKeyHostId as llamaCppHostId,
  apiPort as llamaCppPort,
} from 'llama-cpp-startos/startos/utils'

export const services = {
  ollama: {
    title: 'Ollama',
    protocol: 'ollama',
    hostId: ollamaHostId,
    internalPort: ollamaPort,
    pathSuffix: '',
    versionRange: '>=0.31.2:2',
    publishesApiKey: false,
    icon: 'https://raw.githubusercontent.com/Start9Labs/ollama-startos/master/icon.svg',
  },
  vllm: {
    title: 'vLLM',
    protocol: 'openai',
    hostId: vllmHostId,
    internalPort: vllmPort,
    pathSuffix: '/v1',
    // The first release that publishes the name of the model it serves.
    versionRange: '>=0.33.0:1',
    publishesApiKey: true,
    icon: 'https://raw.githubusercontent.com/Start9Labs/vllm-startos/master/icon.svg',
  },
  'llama-cpp': {
    title: 'llama.cpp',
    protocol: 'openai',
    hostId: llamaCppHostId,
    internalPort: llamaCppPort,
    pathSuffix: '/v1',
    // The first release with the key-gated API host and a published key.
    versionRange: '>=11960:1',
    publishesApiKey: true,
    icon: 'https://raw.githubusercontent.com/Start9Labs/llama-cpp-startos/master/icon.png',
  },
} as const

export type ServiceId = keyof typeof services
export const serviceIds = Object.keys(services) as ServiceId[]

export async function serviceBaseUrl(
  effects: T.Effects,
  id: ServiceId,
  mode: 'const' | 'once',
) {
  const s = services[id]
  const addr = await sdk.host
    .getBridgeAddress(effects, {
      packageId: id,
      hostId: s.hostId,
      internalPort: s.internalPort,
      ssl: false,
    })
    [mode]()
  return addr === null ? null : `http://${addr}${s.pathSuffix}`
}

// The service's `public` volume, mounted read-only under ours to read what it
// publishes in credentials.json.
const publicMount = (id: ServiceId) =>
  sdk.volumes.startos.subpath(`${id}-public`)

export async function servicePublished(
  effects: T.Effects,
  id: ServiceId,
  field: 'apiKey' | 'model',
  mode: 'const' | 'once',
) {
  if (!services[id].publishesApiKey) return null
  const mountPoint = publicMount(id)
  const file = `${mountPoint}/credentials.json`
  try {
    // Mounting again unmounts first, which would pull the file out from under
    // a `.const()` watcher.
    if (
      !(await fs.access(file).then(
        () => true,
        () => false,
      ))
    ) {
      await fs.mkdir(mountPoint, { recursive: true })
      await effects.mount({
        location: mountPoint,
        target: {
          packageId: id,
          volumeId: 'public',
          subpath: null,
          readonly: true,
          idmap: [],
        },
      })
    }
    const read = FileHelper.json(
      file,
      z.looseObject({
        apiKey: z.string().optional().catch(undefined),
        model: z.string().optional().catch(undefined),
      }),
    ).read((c) => c[field] || undefined)
    return (
      (await (mode === 'const' ? read.const(effects) : read.once())) ?? null
    )
  } catch {
    return null
  }
}

// The models the Ollama package has now, or null when it can't be reached.
export async function ollamaModels(effects: T.Effects) {
  const base = await serviceBaseUrl(effects, 'ollama', 'once')
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { models?: { name?: unknown }[] }
    return (
      body.models
        ?.map((m) => m.name)
        .filter((m): m is string => typeof m === 'string') ?? null
    )
  } catch {
    return null
  }
}

// Ollama resolves a bare name to its `:latest` tag.
export const hasModel = (models: string[], name: string) =>
  models.includes(name) || models.includes(`${name}:latest`)
