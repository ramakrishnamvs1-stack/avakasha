/* Avakasha: reading server (Cloudflare Worker).
   Receives a photo from the app, asks Claude to read it, returns only the details the app needs.
   Secrets (set in Cloudflare, never in this file): ANTHROPIC_API_KEY. Optional: APP_KEY, MODEL, ALLOWED_ORIGIN, PER_DAY, GLOBAL_DAY.
   Optional limits: bind a KV namespace named LIMITS to count scans a day for each phone address (PER_DAY, default 5)
   and in all (GLOBAL_DAY, default 300). Without it there is no per-person limit, so set the Anthropic spend limit too.
   The photo is passed to the Anthropic API and is not stored by this worker. */

var DEFAULT_ORIGIN = 'https://ramakrishnamvs1-stack.github.io';
var DEFAULT_MODEL = 'claude-sonnet-5-5';
var MAX_B64 = 7 * 1024 * 1024; /* about 5 MB of image */

var COMMON = 'The image is a photo of an Indian official document. Read only the fields asked for. If a value is not clearly readable, use null. Do not guess. Do not include any person\'s name, roll or registration number, address, or any ID number. Reply with only one JSON object and nothing else.';
var PROMPTS = {
  auto: COMMON + '\nFirst decide what the document is and put it in docType: "m10" (a school Class 10, SSLC or matriculation marksheet or pass certificate), "m12" (a Class 12, PUC or higher secondary marksheet), "degree" (a college or university marksheet or degree), "exp" (a relieving letter, experience certificate, offer letter or appointment letter from an employer), "dl" (a driving licence), "birth" (a birth certificate), "cat" (a caste or category certificate), "inc" (an income certificate), or "other". Fill only the fields for that document and use null for the rest. Fields: {"isDocument": boolean, "docType": "m10" | "m12" | "degree" | "exp" | "dl" | "birth" | "cat" | "inc" | "other", "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Karnataka PUC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "category": "SC" | "ST" | "OBC" | "General" | null, "categoryText": string | null, "annualIncomeRupees": number | null, "role": string | null, "employer": string | null, "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null, "stillWorking": boolean, "letterKind": "relieving" | "experience" | "offer" | "other" | null, "licenceClasses": [{"class": string, "issued": "YYYY-MM-DD" | null}], "validUpto": "YYYY-MM-DD" | null, "badgeHeld": boolean | null, "notes": [string]}. For a driving licence list each vehicle class printed (for example LMV, MCWG, HMV, HGMV, HPMV) with its own date of issue, the date the licence is valid until, and whether a public service vehicle badge is shown; never include the licence number, name or address. For a work letter, give the employer organisation name and the job title, never the person\'s name; use the date of joining as startDate and the last working day or relieving date as endDate, not the date the letter was written; if a date is not printed use null, and say so in notes. For a Class 12 marksheet, board is the Class 12 board (use "Karnataka PUC" for the Department of Pre-University Education) and subjects must list every subject with its marks. For a Class 10 or Class 12 marksheet use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  m10: COMMON + '\nThe document should be a school Class 10 marksheet or pass certificate (CBSE, ICSE, Karnataka SSLC, or another state board, in any year). Fields: {"isDocument": boolean, "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "notes": [string]}. Use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  birth: COMMON + '\nThe document should be a birth certificate. Fields: {"isDocument": boolean, "dob": "YYYY-MM-DD" | null, "notes": [string]}.',
  cat: COMMON + '\nThe document should be a caste or category certificate. Fields: {"isDocument": boolean, "category": "SC" | "ST" | "OBC" | "General" | null, "categoryText": string | null (the exact category wording printed, such as "Category-2A"), "notes": [string]}.',
  inc: COMMON + '\nThe document should be an income certificate. Fields: {"isDocument": boolean, "annualIncomeRupees": number | null, "notes": [string]}.'
};

function cors(origin) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status: status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors(origin)) });
}
/* Soft daily limits kept in KV. KV is not atomic, so a few extra scans can slip through; the Anthropic spend limit is the hard stop. */
async function overLimit(request, env, pre, perDef, allDef) {
  if (!env.LIMITS) return false;
  var day = new Date().toISOString().slice(0, 10), ip = request.headers.get('CF-Connecting-IP') || 'x';
  var per = parseInt((pre ? env.SEARCH_PER_DAY : env.PER_DAY) || perDef, 10), all = parseInt((pre ? env.SEARCH_GLOBAL_DAY : env.GLOBAL_DAY) || allDef, 10);
  var kp = pre + 'ip:' + day + ':' + ip, kg = pre + 'all:' + day;
  var np = parseInt((await env.LIMITS.get(kp)) || '0', 10), ng = parseInt((await env.LIMITS.get(kg)) || '0', 10);
  if (np >= per || ng >= all) return true;
  await env.LIMITS.put(kp, String(np + 1), { expirationTtl: 172800 });
  await env.LIMITS.put(kg, String(ng + 1), { expirationTtl: 172800 });
  return false;
}
/* Finds the JSON the model was asked for, even when it also wrote other words, or ran out of room before the end. */
function findJson(text) {
  var m = text.match(/<json>([\s\S]*?)<\/json>/);
  if (m) { try { return JSON.parse(m[1]); } catch (e) {} }
  var i = text.indexOf('{"jobs"');
  if (i < 0) i = text.indexOf('{');
  while (i >= 0) {
    var depth = 0, inStr = false, esc = false;
    for (var k = i; k < text.length; k++) {
      var c = text[k];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(i, k + 1)); } catch (e) { break; } } }
    }
    i = text.indexOf('{', i + 1);
  }
  return null;
}
function extractJson(text) {
  var a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; }
}

var OFFICIAL = /(^|\.)(gov\.in|nic\.in|ibps\.in|ac\.in|edu\.in)$/;
function cleanS(v, n) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''; }
function okDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function num(v, lo, hi) { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? v : null; }
function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* Only rule kinds the app understands are kept; anything else becomes a "check this" line. */
function cleanRules(rs) {
  var out = [], hasAge = false, hasEdu = false;
  (Array.isArray(rs) ? rs : []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    if (r.t === 'age') {
      var mn = num(r.min, 14, 60), mx = num(r.max, 14, 70); if (mn === null) return;
      var o = { t: 'age', min: mn, relax: 1 }; if (mx !== null && mx >= mn) o.max = mx;
      if (r.maxByCat && typeof r.maxByCat === 'object') { var m = {}; ['OBC', 'SC', 'ST'].forEach(function (k) { var v = num(r.maxByCat[k], 14, 70); if (v !== null) m[k] = v; }); if (Object.keys(m).length) o.maxByCat = m; }
      out.push(o); hasAge = true;
    } else if (r.t === 'passed' || r.t === 'passed12') { out.push({ t: r.t }); hasEdu = true; }
    else if (r.t === 'pct12') { var p = num(r.min, 1, 100); if (p !== null) { out.push({ t: 'pct12', min: p }); hasEdu = true; } }
    else if (r.t === 'pctmin') { var q = num(r.min, 1, 100); if (q !== null) { out.push({ t: 'pctmin', min: q }); hasEdu = true; } }
    else if (r.t === 'exp') { var y = num(r.min, 0, 40); if (y !== null) out.push({ t: 'exp', min: y }); }
    else if (r.t === 'static') { var t = cleanS(r.title, 80); if (t) out.push({ t: 'static', s: 'unsure', title: t, detail: cleanS(r.detail, 200) || 'Confirm in the notice.' }); }
  });
  if (!hasAge) out.push({ t: 'static', s: 'unsure', title: 'Age limit', detail: 'The age limit was not found. Confirm it in the notice.' });
  if (!hasEdu) out.push({ t: 'static', s: 'unsure', title: 'Qualification', detail: 'The qualification was not clear. Confirm it in the notice.' });
  return out.slice(0, 8);
}
function cleanRecord(x, seen, today) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 120); if (!title) return null;
  var closes = okDate(x.closes); if (closes && closes < today) return null;
  var facts = (Array.isArray(x.facts) ? x.facts : []).slice(0, 6).map(function (f) { return Array.isArray(f) && f.length > 1 ? [cleanS(f[0], 40), cleanS(f[1], 200)] : null; }).filter(function (f) { return f && f[0] && f[1]; });
  var off = OFFICIAL.test(host);
  var r = { id: 'd-' + hash(url), k: 'rec', tab: 'work', kind: 'Job', title: title, org: cleanS(x.org, 80), line: cleanS(x.line, 200), closes: closes, cyc: cleanS(x.cyc, 300) || (closes ? 'Closes ' + closes + '.' : 'Dates not found. Check the notice.'),
    facts: facts, src: [cleanS(x.srcName, 80) || host, url], conf: off ? 'Medium' : 'Low', note: 'Found by the daily search and checked by Avakasha. Confirm in the official notice.', rules: cleanRules(x.rules), off: false };
  if (Number(x.lvl) === 12) r.lvl = 12;
  if (!closes) r.stat = { k: 'unk', t: 'Dates not confirmed' };
  r.official = off;
  return r;
}
function cleanExam(x, seen, today) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 120), d = okDate(x.date); if (!title || !d || d < today) return null;
  var facts = (Array.isArray(x.facts) ? x.facts : []).slice(0, 5).map(function (f) { return Array.isArray(f) && f.length > 1 ? [cleanS(f[0], 40), cleanS(f[1], 200)] : null; }).filter(function (f) { return f && f[0] && f[1]; });
  if (!facts.length) facts = [['Exam', d]];
  var off = OFFICIAL.test(host);
  return { id: 'dx-' + hash(url), k: 'exam', art: 'biz', d: d, when: d, title: title, short: title, sub: cleanS(x.org, 80), org: cleanS(x.org, 80), line: cleanS(x.line, 200), facts: facts, src: [cleanS(x.srcName, 80) || host, url], note: 'Found by the daily search and checked by Avakasha. Confirm the date on the official site.', official: off };
}
async function kget(env, k) { try { var v = await env.LIMITS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
var OFFICIAL_DOMAINS = ['gov.in', 'nic.in', 'ibps.in', 'ac.in', 'edu.in'];
var RULES_TEXT = 'For each job, give the eligibility rules as a list using only these kinds: {"t":"age","min":18,"max":27,"maxByCat":{"OBC":30,"SC":32,"ST":32}} (ages as on the notice), {"t":"passed"} (Class 10 pass needed), {"t":"passed12"} (Class 12 pass needed), {"t":"pct12","min":50} (minimum Class 12 marks), {"t":"pctmin","min":50} (minimum Class 10 marks), {"t":"exp","min":2} (years of experience), {"t":"static","title":"short name","detail":"one sentence"} for anything else, such as a degree, a diploma, a trade, a licence or a language test. Be careful: give a Class 10 or Class 12 rule only when the notice itself asks for exactly that. For diploma, ITI or degree posts use a static rule and no Class 10 or 12 rule. Set "lvl":12 when Class 12 is needed. If the age limit or qualification is not on the page, leave that rule out.';
var JOB_SHAPE = '{"title":"","org":"","line":"one short sentence","closes":"YYYY-MM-DD or null","cyc":"the application dates in one sentence","lvl":10,"facts":[["Age","..."],["Qualification","..."],["Pay","..."]],"rules":[],"srcName":"notice name","url":""}';
/* One search pass. domains limits where Claude may search; null means anywhere. */
async function searchPass(env, prompt, domains, maxUses) {
  var msgs = [{ role: 'user', content: prompt }], seen = {}, text = '', u = { input_tokens: 0, output_tokens: 0, searches: 0 }, stop = '';
  var tool = { type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }; if (domains) tool.allowed_domains = domains;
  var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 280000);
  try {
    for (var turn = 0; turn < 4; turn++) {
      var up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.MODEL || DEFAULT_MODEL, max_tokens: 12000, tools: [tool], messages: msgs })
      });
      if (!up.ok) { clearTimeout(timer); var et = ''; try { et = (await up.text()).slice(0, 200); } catch (e) {} return { error: 'upstream', status: up.status, tail: et, u: u }; }
      var d = await up.json();
      if (d.usage) { u.input_tokens += d.usage.input_tokens || 0; u.output_tokens += d.usage.output_tokens || 0; u.searches += (d.usage.server_tool_use && d.usage.server_tool_use.web_search_requests) || 0; }
      text = ''; stop = d.stop_reason || '';
      (d.content || []).forEach(function (c) {
        if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) c.content.forEach(function (r) { if (r && r.url) seen[r.url.split('#')[0]] = 1; });
        if (c.type === 'text') text += c.text;
      });
      if (d.stop_reason === 'pause_turn') { msgs.push({ role: 'assistant', content: d.content }); continue; }
      break;
    }
  } catch (e) { clearTimeout(timer); return { error: 'upstream', u: u }; }
  clearTimeout(timer);
  var o = findJson(text);
  if (!o) return { error: 'unreadable', u: u, stop: stop, len: text.length, tail: text.slice(-240) };
  return { ok: true, o: o, seen: seen, u: u };
}
function nkey(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40); }
function sameTitle(a, b) { return a && b && Math.min(a.length, b.length) >= 10 && (a.indexOf(b) === 0 || b.indexOf(a) === 0); }
/* Daily job: one search for everyone. Pass A searches official sites only. Pass B looks anywhere for posts pass A missed; those are "leads" that need an official notice link before they can be approved. Results go to a draft and nothing reaches users until it is approved. */
async function runDaily(env) {
  if (!env.LIMITS || !env.ANTHROPIC_API_KEY) return { error: 'not_configured' };
  var today = todayStr(), rules = RULES_TEXT;
  var pa = 'Today is ' + today + '. You help job seekers in India (Karnataka first, then central government).\nUse web search, which is limited to official government sites, to find (1) government job recruitments that are open to apply for right now, in Karnataka or central government, at any qualification level (Class 10, Class 12, ITI or diploma, degree), and (2) government and entrance exams coming in the next 8 months. Check these official sites by name: KEA (cetonline.karnataka.gov.in), KPSC (kpsc.kar.nic.in), Karnataka School Education Department, Karnataka Forest Department, Staff Selection Commission (ssc.gov.in), UPSC (upsc.gov.in), IBPS (ibps.in), the Railway Recruitment Boards, India Post (indiapost.gov.in), ISRO and BEL.\nRules: list only what you saw on a page in the search results, and use that page\'s own address as url. Never invent a date or a number. Skip anything already closed. Up to 12 jobs and 6 exams. Keep every field short.\n' + rules + '\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + JOB_SHAPE + '],"exams":[{"title":"","org":"","date":"YYYY-MM-DD","line":"","facts":[["Exam","..."],["Qualification","..."]],"srcName":"","url":""}]}</json>';
  var A = await searchPass(env, pa, OFFICIAL_DOMAINS, 8);
  var pb = 'Today is ' + today + '. You help job seekers in India (Karnataka first, then central government).\nUse web search on any site to find government job recruitments that are open to apply for right now, in Karnataka or central government, at any qualification level. Up to 10 jobs. List only what you saw on a page in the search results, with that page\'s own address as url. Never invent a date or a number. Skip anything already closed. Keep every field short.\n' + rules + '\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + JOB_SHAPE + ']}</json>';
  var B = await searchPass(env, pb, null, 5);
  var u = { input_tokens: 0, output_tokens: 0, searches: 0 };
  [A, B].forEach(function (p) { if (p && p.u) { u.input_tokens += p.u.input_tokens; u.output_tokens += p.u.output_tokens; u.searches += p.u.searches; } });
  if (!A.ok && !B.ok) { var e = A.error ? A : B; return { error: e.error, stop: e.stop, len: e.len, tail: e.tail, status: e.status, usage: u }; }
  var live = (await kget(env, 'live')) || { records: [], exams: [] };
  var known = {}; live.records.concat(live.exams).forEach(function (x) { known[x.id] = 1; });
  var items = [], keys = {}, titles = [];
  function add(x) { if (!x || known[x.id] || keys[x.id]) return; var nk = nkey(x.title); if (titles.some(function (t) { return sameTitle(t, nk); })) return; keys[x.id] = 1; titles.push(nk); items.push(x); }
  if (A.ok) {
    (Array.isArray(A.o.jobs) ? A.o.jobs : []).forEach(function (x) { add(cleanRecord(x, A.seen, today)); });
    (Array.isArray(A.o.exams) ? A.o.exams : []).forEach(function (x) { add(cleanExam(x, A.seen, today)); });
  }
  if (B.ok) {
    (Array.isArray(B.o.jobs) ? B.o.jobs : []).forEach(function (x) { var c = cleanRecord(x, B.seen, today); if (c && !c.official) c.lead = true; add(c); });
  }
  var draft = { at: Date.now(), items: items, usage: u, passA: A.ok ? 'ok' : A.error, passB: B.ok ? 'ok' : B.error };
  await env.LIMITS.put('draft', JSON.stringify(draft));
  return { ok: true, n: items.length, leads: items.filter(function (x) { return x.lead; }).length, usage: u };
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
async function adminDo(b, request, env, origin, ctx) {
  if (!env.ADMIN_KEY || !env.LIMITS) return json({ error: 'not_configured' }, 500, origin);
  var ip = request.headers.get('CF-Connecting-IP') || 'x', kf = 'fail:' + todayStr() + ':' + ip, nf = parseInt((await env.LIMITS.get(kf)) || '0', 10);
  if (nf >= 10) return json({ error: 'locked' }, 429, origin);
  if (b.key !== env.ADMIN_KEY) { await env.LIMITS.put(kf, String(nf + 1), { expirationTtl: 86400 }); return json({ error: 'forbidden' }, 403, origin); }
  var today = todayStr(), live = (await kget(env, 'live')) || { at: 0, records: [], exams: [] }, draft = (await kget(env, 'draft')) || { at: 0, items: [] };
  if (b.action === 'run') {
    var last = await env.LIMITS.get('lastrun'); if (last && Date.now() - parseInt(last, 10) < 36e5) return json({ error: 'too_soon' }, 429, origin);
    var running = await env.LIMITS.get('running'); if (running && Date.now() - parseInt(running, 10) < 6e5) return json({ error: 'already_running' }, 429, origin);
    await env.LIMITS.put('running', String(Date.now()));
    ctx.waitUntil((async function () {
      var r; try { r = await runDaily(env); } catch (e) { r = { error: 'upstream' }; }
      await env.LIMITS.put('lastresult', JSON.stringify({ at: Date.now(), ok: !!r.ok, n: r.n, leads: r.leads, error: r.error, stop: r.stop, len: r.len, tail: r.tail, status: r.status, usage: r.usage }));
      await env.LIMITS.delete('running'); if (r.ok) await env.LIMITS.put('lastrun', String(Date.now()));
    })());
    return json({ ok: true, started: true }, 200, origin);
  }
  if (b.action === 'approve') {
    var ids = {};
    (Array.isArray(b.items) ? b.items : []).slice(0, 40).forEach(function (x) {
      if (!x || !Array.isArray(x.src)) return; x.url = x.src[1]; x.srcName = x.src[0]; x.date = x.d;
      var c = x.k === 'exam' ? cleanExam(x, null, today) : cleanRecord(x, null, today); if (!c) return;
      if (x.lead && !c.official) return;
      var list = c.k === 'exam' ? live.exams : live.records; var i = list.map(function (y) { return y.id; }).indexOf(c.id);
      if (i >= 0) list[i] = c; else list.push(c); ids[c.id] = 1;
    });
    live.at = Date.now(); await env.LIMITS.put('live', JSON.stringify(live));
    draft.items = draft.items.filter(function (x) { return !ids[x.id]; }); await env.LIMITS.put('draft', JSON.stringify(draft));
  } else if (b.action === 'reject') {
    var rj = {}; (Array.isArray(b.ids) ? b.ids : []).forEach(function (i) { rj[i] = 1; });
    draft.items = draft.items.filter(function (x) { return !rj[x.id]; }); await env.LIMITS.put('draft', JSON.stringify(draft));
  } else if (b.action === 'remove') {
    var rm = {}; (Array.isArray(b.ids) ? b.ids : []).forEach(function (i) { rm[i] = 1; });
    live.records = live.records.filter(function (x) { return !rm[x.id]; }); live.exams = live.exams.filter(function (x) { return !rm[x.id]; });
    live.at = Date.now(); await env.LIMITS.put('live', JSON.stringify(live));
  }
  var lastres = await kget(env, 'lastresult'), runv = await env.LIMITS.get('running');
  return json({ ok: true, draft: draft, last: lastres, running: !!(runv && Date.now() - parseInt(runv, 10) < 6e5), live: { at: live.at, records: live.records.map(function (x) { return { id: x.id, title: x.title, closes: x.closes }; }), exams: live.exams.map(function (x) { return { id: x.id, title: x.title, d: x.d }; }) } }, 200, origin);
}
async function liveGet(env, origin) {
  var today = todayStr(), live = (await kget(env, 'live')) || { at: 0, records: [], exams: [] };
  return json({ at: live.at, records: live.records.filter(function (x) { return !x.closes || x.closes >= today; }), exams: live.exams.filter(function (x) { return x.d >= today; }) }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    var origin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    var reqOrigin = request.headers.get('Origin');
    if (reqOrigin && reqOrigin !== origin) return json({ error: 'forbidden' }, 403, origin);
    if (request.method === 'GET') return liveGet(env, origin);
    if (request.method !== 'POST') return json({ error: 'bad_request' }, 405, origin);
    var body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400, origin); }
    if (body && body.admin) return adminDo(body.admin, request, env, origin, ctx);
    if (env.APP_KEY && request.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: 'forbidden' }, 403, origin);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 500, origin);
    var type = body && body.type, image = body && body.image, mt = (body && body.mediaType) || 'image/jpeg';
    if (!PROMPTS[type] || typeof image !== 'string' || !image) return json({ error: 'bad_request' }, 400, origin);
    if (image.length > MAX_B64) return json({ error: 'too_large' }, 413, origin);
    if (mt !== 'image/jpeg' && mt !== 'image/png') return json({ error: 'bad_request' }, 400, origin);

    if (await overLimit(request, env, '', '5', '300')) return json({ error: 'daily_limit' }, 429, origin);

    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 55000), up;
    try {
      up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL, max_tokens: 1200,
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mt, data: image } }, { type: 'text', text: PROMPTS[type] }] }]
        })
      });
    } catch (e) { clearTimeout(timer); return json({ error: 'upstream' }, 502, origin); }
    clearTimeout(timer);
    if (up.status === 429) return json({ error: 'rate_limited' }, 429, origin);
    if (!up.ok) return json({ error: 'upstream', status: up.status }, 502, origin);
    var data; try { data = await up.json(); } catch (e) { return json({ error: 'upstream' }, 502, origin); }
    var text = (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    var out = extractJson(text);
    if (!out) return json({ error: 'unreadable' }, 422, origin);
    out.__usage = data.usage || null;
    return json({ ok: true, type: type, data: out }, 200, origin);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil((async function () { var r; try { r = await runDaily(env); } catch (e) { r = { error: 'upstream' }; } await env.LIMITS.put('lastresult', JSON.stringify({ at: Date.now(), ok: !!r.ok, n: r.n, leads: r.leads, error: r.error, stop: r.stop, len: r.len, tail: r.tail, status: r.status, usage: r.usage })); })()); }
};
