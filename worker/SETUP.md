# Setting up the reading server (Cloudflare Worker)

You need: a free Cloudflare account and an Anthropic API key (console.anthropic.com).

1. In Cloudflare, open **Workers & Pages**, then **Create**, then **Create Worker**. Name it `avakasha-reader` and deploy the sample.
2. Choose **Edit code**. Delete everything, paste the whole of `worker/worker.js`, and **Deploy**.
3. Open the worker's **Settings**, then **Variables and Secrets**. Add these as type **Secret**:
   - `ANTHROPIC_API_KEY`: your key.
   - `APP_KEY`: any long random text you make up (optional, makes casual misuse harder).
4. Daily limits (recommended): in Cloudflare open **Storage and databases**, then **KV**, create a namespace called `avakasha-limits`. In the worker's **Settings**, then **Bindings**, add a KV binding with variable name `LIMITS` pointing to it. Optionally add plain variables `PER_DAY` (default 5 scans a day for each phone address) and `GLOBAL_DAY` (default 300 in all).
5. Copy the worker's address (it looks like `https://avakasha-reader.YOURNAME.workers.dev`).
6. Put that address and the same `APP_KEY` text in `config.js` in this repository.
7. In the Anthropic console, set a monthly spend limit so a runaway bill is impossible.

The key never goes in `config.js` or in the repository. The worker only accepts requests from the app's own address (`ALLOWED_ORIGIN`, which defaults to your GitHub Pages site). If you move to a custom domain, set `ALLOWED_ORIGIN` to it.

## Online search (Explore tab)

The Explore tab can search the web for current jobs and exams through this same worker. Two things to do:

1. In the Anthropic console, make sure **web search** is enabled for your organization (Settings, then Privacy or Tools). Each search is billed per search on top of the tokens.
2. Redeploy `worker/worker.js` (paste the whole file again and Deploy). Optional variables: `SEARCH_PER_DAY` (default 3 searches a day for each phone address) and `SEARCH_GLOBAL_DAY` (default 60 in all). These use the same `LIMITS` KV binding.

The app sends only education level, stream, state, age in years and whether a licence is held. The worker keeps only results whose link appeared in the search results, and marks a result "Official site" only when its address ends in gov.in, nic.in, ibps.in, ac.in or edu.in.
