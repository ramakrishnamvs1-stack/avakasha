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

### Cost and the private-job model (optional settings)
- The review page now shows an estimated rupee cost for the last step and for the month so far. These are estimates from token counts and web searches, not your bill; check Anthropic Console for the real figure.
- Private job search uses a cheaper model (default `claude-haiku-5-5`). To change it, add a Worker variable `PVT_MODEL`. If that model cannot be used, the search falls back to the main model and the review page says so.
- `USD_INR` (default 90) sets the exchange rate used for the estimate.
- Each private search is capped at 10 jobs.

### Scholarship search (weekly, Karnataka first)
- A fourth step looks for scholarships open to Karnataka students: government schemes and private ones (foundations, trusts, companies). It runs by itself after the daily steps on **Mondays**, and on demand from the review page with **Search scholarships** (about ₹15 to ₹30 a run).
- Finds wait on the review page under **Scholarships**. Open each page, check the provider is real and nothing asks for a fee, fix the level, the offered-by choice (Government or Private) and the last date, then approve. Nothing reaches users before that.
- In the app, **Explore → Scholarships** has two tabs, Govt and Private. The worker must be redeployed (paste the new `worker.js`) before the search and the approved list reach the app.

### Six searches and the schedule (v64)
- The review page now runs six searches: Govt jobs, Private jobs, Exams, Courses, Scholarships and Trainings. Each has its own **Run now** button and its own schedule: **Daily**, **Weekly** or **Custom** (pick days with the M T W T F S S chips). Press **Change** on a search to set it.
- Searches are spread over three cron slots so they do not all run at once. In Cloudflare, open the Worker → Triggers → Cron Triggers and have all three: `0 2 * * *`, `20 2 * * *` and `40 2 * * *`.
- Approved Courses show under **Explore → Courses**, and approved Trainings under **Explore → Trainings**. Nothing reaches users before you approve it. **Approve all** on a list approves every item that has the required checks done.
- Redeploy `worker.js` (paste the new file) for the new searches and schedules to work. The review page and app update by themselves.

### Better, more genuine finds (search optimisation)
- Every search now tells the model who the app is for (Class 10, Class 12, ITI or diploma, degree) and to skip results pages, answer keys, admit cards, seat allotments and postgraduate-only posts. A title filter in the Worker also drops those.
- After each search, the Worker opens every notice page itself (up to 14 at a time) and checks that the title and the last date really appear on it. Government sites sometimes block this; those finds are marked "not checked" and are not dropped.
- Each find gets a **Trust score** (0 to 100): official page, a link to the specific notice, a date found, and the page check. The review page shows the score with the reasons, lists the strongest finds first, and **Approve those** only includes finds scoring 60 or more whose page check did not fail. The score helps you decide; it does not replace opening the notice.
- Redeploy `worker.js` for this to work. The review page updates by itself.

### Tidier waiting list (v2 of search optimisation)
- The waiting list now cleans itself every time the review page loads: finds whose last date has passed are removed, repeats of the same notice (found under different titles or pages) are merged into the strongest one, and finds that are already approved are removed.
- Private jobs: employers named only as "a leading company" are dropped, staffing and placement agencies score lower, no more than three listings with the same job title are kept, and the search is told to give each job's own page and its date.
- Redeploy `worker.js` for this to work.

### Using myavakasha.com
- The worker accepts requests from both the GitHub address and `https://myavakasha.com` (and `www`). To allow another address, set `ALLOWED_ORIGIN` to it; you can list several, separated by commas.
- GoDaddy DNS for the GitHub site: four `A` records on `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` record on `www` pointing to `ramakrishnamvs1-stack.github.io`. Then, in the GitHub repository, open Settings, Pages, enter `myavakasha.com` as the custom domain and turn on Enforce HTTPS once it is offered.

## Saved-notice re-check, official-page watchlist and rotating focus

- **Re-check:** about once a week (in the 40-minute cron slot) each saved govt notice, exam, scholarship and training page is opened again. No AI is used, so it costs nothing. A date extension that the page itself states is updated automatically. A cancellation, a missing date or a dead page is listed under "Look at changes" on the review page. A page that is gone twice in a row is hidden from students until you restore it.
- **Watchlist:** the `WATCH` list near the middle of worker.js holds official recruitment pages. They are opened in the 20-minute cron slot. The first visit only records what is already there. After that, any new relevant link is added to your waiting list. Pages that did not open are listed on the review page. Edit the list freely; each entry is `{ id, name, url, org, tab }` (`tab` is `work` or `study`).
- **Rotation:** each search adds an "extra attention" group of departments that changes every day (govt jobs, exams) or every week (courses, scholarships, trainings).
- **Buttons:** "Re-check now" and "Check pages now" on the review home page run these on demand.
- After pasting the new worker.js, press Deploy. No new settings or bindings are needed.

## Auto-approval

After each search finishes, a find goes live by itself only when ALL of these are true: its page is on gov.in or nic.in, the page was opened and checked (the title matches and the date is on the page), it has a last date (or exam date), its score is 70 or more, it is not a lead, and it is a job, course, exam or government scholarship. Private jobs, trainings, leads, watchlist links and anything on other sites wait for your review. The review page lists what was approved automatically, with a "Take it down" button, and a switch to turn auto-approval off or on.
