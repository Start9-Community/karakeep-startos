import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.looseObject({
  // Generated once on install (init/seedFiles.ts); never a static fallback.
  nextAuthSecret: z.string().optional().catch(undefined),
  meiliMasterKey: z.string().optional().catch(undefined),
  // Written by Set Admin Password; the administrator's current password.
  adminPassword: z.string().optional().catch(undefined),
  // The primary URL (Set Primary URL), passed as NEXTAUTH_URL.
  domain: z.string().catch(''),
  // Mirrors karakeep's DISABLE_SIGNUPS; flipped by Toggle Signups.
  signupsDisabled: z.boolean().catch(true),
  // Set Performance; mapped via workerPresets in utils.ts.
  performance: z.enum(['low', 'medium', 'high']).catch('high'),
  // Configure AI; mapped to karakeep's AI env vars in main.ts.
  ai: z
    .looseObject({
      // `local-<id>` is that AI package on this server; `ollama`/`openai` take a URL.
      provider: z
        .enum([
          'none',
          'ollama',
          'openai',
          'local-ollama',
          'local-vllm',
          'local-llama-cpp',
        ])
        .catch('none'),
      baseUrl: z.string().catch(''),
      apiKey: z.string().catch(''),
      textModel: z.string().catch(''),
      imageModel: z.string().catch(''),
      autoSummarize: z.boolean().catch(false),
      embeddingModel: z.string().catch(''),
      embeddingDimensions: z.number().catch(0),
    })
    .catch({
      provider: 'none',
      baseUrl: '',
      apiKey: '',
      textModel: '',
      imageModel: '',
      autoSummarize: false,
      embeddingModel: '',
      embeddingDimensions: 0,
    }),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
