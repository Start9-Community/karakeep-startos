import { T } from '@start9labs/start-sdk'
import { ServiceId, services } from './backends'
import { storeJson } from './fileModels/store.json'
import { sdk } from './sdk'

const descriptions: Record<ServiceId, T.LocaleString> = {
  ollama: {
    en_US:
      'Optional: run AI tagging, summaries and semantic search on local models. Connect it with the Configure AI action.',
    es_ES:
      'Opcional: ejecuta el etiquetado, los resúmenes y la búsqueda semántica con IA en modelos locales. Conéctalo con la acción Configurar IA.',
    de_DE:
      'Optional: KI-Verschlagwortung, Zusammenfassungen und semantische Suche mit lokalen Modellen. Über die Aktion „KI konfigurieren“ verbinden.',
    pl_PL:
      'Opcjonalnie: tagowanie, podsumowania i wyszukiwanie semantyczne z AI na lokalnych modelach. Połącz w akcji Skonfiguruj AI.',
    fr_FR:
      "Optionnel : étiquetage, résumés et recherche sémantique par IA sur des modèles locaux. Connectez-le via l'action Configurer l'IA.",
  },
  vllm: {
    en_US:
      'Optional: run AI tagging and summaries on the model vLLM serves. Connect it with the Configure AI action.',
    es_ES:
      'Opcional: ejecuta el etiquetado y los resúmenes con IA en el modelo que sirve vLLM. Conéctalo con la acción Configurar IA.',
    de_DE:
      'Optional: KI-Verschlagwortung und Zusammenfassungen mit dem Modell, das vLLM bereitstellt. Über die Aktion „KI konfigurieren“ verbinden.',
    pl_PL:
      'Opcjonalnie: tagowanie i podsumowania z AI na modelu udostępnianym przez vLLM. Połącz w akcji Skonfiguruj AI.',
    fr_FR:
      "Optionnel : étiquetage et résumés par IA avec le modèle que sert vLLM. Connectez-le via l'action Configurer l'IA.",
  },
  'llama-cpp': {
    en_US:
      'Optional: run AI tagging and summaries on the model llama.cpp serves. Connect it with the Configure AI action.',
    es_ES:
      'Opcional: ejecuta el etiquetado y los resúmenes con IA en el modelo que sirve llama.cpp. Conéctalo con la acción Configurar IA.',
    de_DE:
      'Optional: KI-Verschlagwortung und Zusammenfassungen mit dem Modell, das llama.cpp bereitstellt. Über die Aktion „KI konfigurieren“ verbinden.',
    pl_PL:
      'Opcjonalnie: tagowanie i podsumowania z AI na modelu udostępnianym przez llama.cpp. Połącz w akcji Skonfiguruj AI.',
    fr_FR:
      "Optionnel : étiquetage et résumés par IA avec le modèle que sert llama.cpp. Connectez-le via l'action Configurer l'IA.",
  },
}

const optional = <const Id extends ServiceId>(id: Id) =>
  sdk.Dependency.optional(id, {
    description: descriptions[id],
    metadata: { title: services[id].title, icon: services[id].icon },
    versionRange: services[id].versionRange,
    kind: 'running',
    healthChecks: ['primary'],
    enabled: async ({ effects }) =>
      (await storeJson
        .read((s) => s.ai?.provider === `local-${id}`)
        .const(effects)) ?? false,
  })

export const dependencies = sdk.Dependencies.of()
  .addDependency(optional('ollama'))
  .addDependency(optional('vllm'))
  .addDependency(optional('llama-cpp'))
