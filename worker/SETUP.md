# Setting up the reading server (Cloudflare Worker)

You need: a free Cloudflare account and an Anthropic API key (console.anthropic.com).

1. In Cloudflare, open **Workers & Pages**, then **Create**, then **Create Worker**. Name it `path-reader` and deploy the sample.
2. Choose **Edit code**. Delete everything, paste the whole of `worker/worker.js`, and **Deploy**.
3. Open the worker's **Settings**, then **Variables and Secrets**. Add these as type **Secret**:
   - `ANTHROPIC_API_KEY`: your key.
   - `APP_KEY`: any long random text you make up (optional, makes casual misuse harder).
4. Copy the worker's address (it looks like `https://path-reader.YOURNAME.workers.dev`).
5. Put that address and the same `APP_KEY` text in `config.js` in this repository.
6. In the Anthropic console, set a monthly spend limit so a runaway bill is impossible.

The key never goes in `config.js` or in the repository.
