export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting Karakeep!': 0,
  'Web Interface': 1,
  'Meilisearch is ready': 2,
  'Meilisearch is not ready': 3,
  'Chrome is ready': 4,
  'Chrome is not ready': 5,
  'Karakeep is ready': 6,
  'Karakeep is not ready': 7,
  // interfaces.ts
  'The Karakeep bookmark manager UI': 8,
  // actions/toggleSignups.ts
  'Enable Signups': 9,
  'Disable Signups': 10,
  'Signups are currently disabled. Run this action to permit new account creation.': 11,
  'Signups are currently enabled. Run this action to prohibit new account creation.': 12,
  'Anyone who can reach your Karakeep address will be able to create an account on your server.': 13,
  // utils.ts (Set Primary URL)
  URL: 14,
  'Set Primary URL': 15,
  'Choose the address Karakeep puts in the links it generates, such as sign-in callbacks. Karakeep restarts to apply the change.': 16,
  // init/taskSetAdminPassword.ts, actions/setAdminPassword.ts
  'Create the Karakeep administrator account and its password': 17,
  'Set Admin Password': 18,
  // actions/configureAi.ts
  'Configure AI': 19,
  'Connect Karakeep to an AI service on this server, or to any Ollama or OpenAI-compatible server, for automatic tagging and summaries.': 20,
  Provider: 21,
  Disabled: 22,
  'Ollama server (by URL)': 23,
  'OpenAI-compatible server (by URL)': 24,
  'Server URL': 25,
  'API Key': 26,
  'Text Model': 27,
  'Image Model': 28,
  'Summarize Automatically': 29,
  "Required. A local server such as Ollama doesn't check it, so any placeholder value (for example 'ollama') works.": 30,
  'Semantic Search': 31,
  'Finds bookmarks by meaning as well as keywords. Karakeep creates an embedding of each new bookmark with the model below and keeps it in Meilisearch.': 32,
  Enabled: 33,
  'Embedding Model': 34,
  'When you save, Karakeep asks the server for an embedding from this model to confirm it works and to read its dimensions.': 35,
  'Set Performance': 36,
  'Choose how many search and embedding jobs Karakeep runs at once. Lower it on slower hardware if the server becomes sluggish while indexing.': 37,
  'Hardware Speed': 38,
  'Limits how many background indexing jobs run at once. Higher values index large libraries faster but use more CPU and memory. Only matters when many bookmarks are processed at once, such as Reindex All Bookmarks.': 39,
  'Low: slow hardware (5 search, 2 embedding jobs)': 40,
  'Medium (20 search, 5 embedding jobs)': 41,
  'High: fast hardware (50 search, 10 embedding jobs)': 42,
  'Generate a new random password for the Karakeep administrator account. Replaces any existing password.': 43,
  'Replaces the current admin password and signs the administrator out of every device.': 44,
  'Admin Credentials': 45,
  'Sign in to Karakeep with this email and password.': 46,
  Email: 47,
  Password: 48,
  'Ollama (on this server)': 49,
  'vLLM (on this server)': 50,
  'llama.cpp (on this server)': 51,
  'Available on this service:': 52,
  'This service has no models yet. Add one to it first.': 53,
  "This service isn't running, so its models can't be listed. Enter the model's name.": 54,
  'Not available on this service:': 55,
  'Could not get an embedding from this model:': 56,
  'the request timed out': 57,
  "Semantic search needs this service installed and running, to read the embedding model's dimensions. Install it, or save with Semantic Search disabled.": 58,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
