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

## Daily shared search and review

One search a day finds government jobs and exams for everyone and writes each job's eligibility rules (age, qualification, marks). Results wait in a draft until you approve them on the review page. Each phone then checks the approved list against its own profile, for free.

1. **Anthropic console:** make sure web search is enabled for your organization. Each search is billed per search on top of the tokens. A daily run costs roughly ₹40 to ₹50 (two search passes).
2. **Redeploy** `worker/worker.js` (paste the whole file and Deploy).
3. **Add a secret** `ADMIN_KEY` in the worker's Settings, Variables and Secrets: a long random text only you know. It opens the review page. Never put it in the repository.
4. **KV:** the daily search and the approved list use the same `LIMITS` KV binding you already made. Nothing new to create.
5. **Schedule:** in the worker's Settings, open **Triggers**, add a **Cron Trigger** with `0 2 * * *` (once a day, 7:30 am India time).
6. **Review:** open `https://ramakrishnamvs1-stack.github.io/avakasha/review.html`, enter the admin key, and approve or reject each find. You can fix the closing date and age limits before approving. **Search now** runs the search at once (at most once an hour). Approved items reach phones the next time the app opens.

Nothing is public until you approve it. Items that came from a site that is not gov.in, nic.in, ibps.in, ac.in or edu.in are flagged on the review page.

### How the daily run searches

Pass A searches official government sites only (gov.in, nic.in, ibps.in, ac.in, edu.in) and names the main ones (KEA, KPSC, SSC, UPSC, IBPS, RRB, India Post, ISRO, BEL). Pass B searches anywhere for posts pass A missed. Those show on the review page under **Leads**. A lead can be approved only after you paste its official notice link, and the Worker rejects an approval without a link on an official domain.


## Private jobs and resumes

- The daily search now has a third step that looks for private jobs (Bengaluru and Karnataka first). The review page runs all three steps from "Search now" and shows private jobs in their own section. Approve only listings where the employer looks real and nothing asks for a fee.
- Each full run now costs about 60 to 75 rupees. Private jobs with no closing date disappear from the app after 21 days.
- Redeploy `worker.js` for this to work. The review page and app update by themselves.
- A resume scan reads skills, job titles, years of work, highest education, city and languages. It never reads name, phone, email or address. Details from several documents are combined on the phone.
