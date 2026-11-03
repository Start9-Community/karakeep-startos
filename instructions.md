# Karakeep

## Documentation

- [Using Karakeep](https://github.com/karakeep-app/karakeep/tree/main/docs/docs/04-using-karakeep) — bookmarking, lists, tags, importing, and the search query language.
- [Integrations](https://github.com/karakeep-app/karakeep/tree/main/docs/docs/05-integrations) — the command-line tool, MCP server, SingleFile, RSS feeds, and agent skills.
- [AI providers](https://github.com/karakeep-app/karakeep/blob/main/docs/docs/03-configuration/02-different-ai-providers.md) — which models work for tagging and how to set them up.
- [FAQ](https://github.com/karakeep-app/karakeep/blob/main/docs/docs/06-administration/02-FAQ.md) — common questions from people running Karakeep.

## What you get on StartOS

Karakeep runs with its own page-archiving browser and search index, behind a
single **Web Interface**. Your bookmarks, notes, images, archived pages, and
search index all live on your server. The administrator account is created for
you, and sign-ups are closed unless you open them.

## Getting set up

1. Run the **Set Admin Password** task. It shows the administrator's email and
   password — save the password in your password manager; it is shown only
   once.
2. Start Karakeep and open the **Web Interface**.
3. Sign in with that email and password.

To give someone else an account, either create it under **Admin Settings →
Users** in Karakeep, or run **Disable Signups**/**Enable Signups** to let them
sign up, and run it again afterwards to close sign-ups.

## Using Karakeep

### Web interface

After signing in you land on your bookmark dashboard, where you save links,
notes, and images, browse your tags, and search everything you've saved.

Karakeep fetches each page you bookmark from your server. If you publish
Karakeep through a tunnel to keep your home IP private, send its outbound
traffic through that tunnel too; otherwise the sites you bookmark see your home
IP. If you use the tunnel for another reason, there is nothing to change.

### Actions

- **Set Admin Password** — generates a new password for the administrator and
  signs the administrator out everywhere. Run it if you lose the password.
- **Enable Signups** / **Disable Signups** — opens or closes Karakeep's sign-up
  page. Closed is the safe default: while it is open, anyone who can reach your
  Karakeep address can create an account.
- **Set Primary URL** — chooses the address Karakeep uses in the links it
  creates, and the one **Open UI** opens. If you pick an `https` address, sign
  in over `https` addresses only.
- **Configure AI** — connects Karakeep to an AI model so it tags your
  bookmarks (and optionally summarizes them). See below.
- **Set Performance** — **Low**, **Medium**, or **High**: how many indexing
  jobs run at once. Pick a lower setting if your server becomes sluggish while
  Karakeep indexes a large library.

## Using AI tagging

Karakeep doesn't run a model itself. It uses Ollama, vLLM or llama.cpp
installed on this server, or any Ollama or OpenAI-compatible server it can
reach, such as another computer on your home network. Make sure the models you
want are already available on it.

1. Run **Configure AI** and choose a provider:
   - **Ollama**, **vLLM** or **llama.cpp (on this server)** — Karakeep fills in
     its address and API key. If it isn't installed yet, StartOS shows the
     missing dependency on Karakeep's page; install it from the Marketplace.
     The service must stay running for AI to work.
   - **Ollama server (by URL)** or **OpenAI-compatible server (by URL)** —
     enter the address (for example `http://192.168.1.50:11434`). Make sure
     the server listens on the network (for Ollama, set `OLLAMA_HOST=0.0.0.0`).
     An OpenAI-compatible server needs an API key even if it ignores it —
     enter any placeholder like `ollama`.

   - **vLLM** and **llama.cpp** serve one model, chosen with their own
     **Set Model** action, and Karakeep uses it — there's nothing more to
     enter. Image tagging works only if that model reads images. Semantic
     search isn't available with them.
   - For the others, enter the text and image model names. For **Ollama
     (on this server)** the form lists the models Ollama has, and saving
     fails if you name one it doesn't; add models to Ollama first, for
     example from Open WebUI.

2. Add a bookmark. Tags appear shortly after Karakeep finishes fetching the
   page.

AI only runs on new bookmarks. To process ones you already have, open
**Admin Settings** in Karakeep and use **Regenerate AI Tags** (or summaries).
This queues every bookmark, so on a large library it can take many hours and
keeps your AI server busy throughout. If the AI server is offline, those jobs
fail; run **Regenerate AI Tags → Failed Bookmarks Only** once it is back.

## Using semantic search

Semantic search finds bookmarks by meaning, not just matching words. It needs
an embedding model on the same server you use for tagging — for Ollama, pull
one first.

1. Run **Configure AI**, set **Semantic Search** to **Enabled**, and enter the
   embedding model's name. When you save, Karakeep asks your server for a test
   embedding, so the model must already be available; if it can't be reached,
   the save fails with the reason.
2. Add a bookmark. Karakeep embeds new bookmarks as it processes them.

Bookmarks you already have are not embedded automatically. In **Admin
Settings**, use **Regenerate Embeddings for All Bookmarks** under **Embedding
Jobs**. Do the same if you later change the embedding model.

## Using the command line or an AI assistant

Karakeep's command-line tool, `karakeep`, works against your server, and so
does the upstream agent skill that teaches an AI assistant to use it. You need
an API key and your service's address.

1. In Karakeep, open **Settings → API Keys** and create a key.
2. Install the tool with `npm install -g @karakeep/cli`.
3. Run `karakeep auth init`, enter the address you use for the **Web
   Interface** and the API key, then check it with `karakeep whoami`.

A LAN address only works while you are on your home network. If `whoami` says
`fetch failed` for an `https` address, your computer doesn't trust your
server's certificate yet: install your StartOS root CA and run the tool with
`NODE_OPTIONS=--use-system-ca`.
