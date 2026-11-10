/* Avakasha: reading server (Cloudflare Worker).
   Receives a photo from the app, asks Claude to read it, returns only the details the app needs.
   Secrets (set in Cloudflare, never in this file): ANTHROPIC_API_KEY. Optional: APP_KEY, MODEL, ALLOWED_ORIGIN, PER_DAY, GLOBAL_DAY.
   Optional limits: bind a KV namespace named LIMITS to count scans a day for each phone address (PER_DAY, default 5)
   and in all (GLOBAL_DAY, default 300). Without it there is no per-person limit, so set the Anthropic spend limit too.
   The photo is passed to the Anthropic API and is not stored by this worker. */

var DEFAULT_ORIGIN = 'https://ramakrishnamvs1-stack.github.io';
var DEFAULT_MODEL = 'claude-sonnet-5-5';
/* Private job search uses a cheaper model (PVT_MODEL in Cloudflare overrides it). If that model cannot be used, the search falls back to the main model. */
var DEFAULT_PVT_MODEL = 'claude-haiku-5-5';
var PVT_MAX = 10;
/* Rough prices in US dollars per million tokens, and per web search. Sonnet 5.5 is $2 in and $10 out. Haiku uses Haiku 4.5 prices ($1 and $5) because the 5.5 price was not confirmed, so the Haiku figure may be too high. These are estimates for the review page, not a bill. */
var RATES = { haiku: { i: 1, o: 5 }, sonnet: { i: 2, o: 10 }, opus: { i: 5, o: 25 } };
function rateFor(model) { var m = String(model || '').toLowerCase(); return m.indexOf('haiku') >= 0 ? RATES.haiku : m.indexOf('opus') >= 0 ? RATES.opus : RATES.sonnet; }
function costInr(env, model, usage) {
  var r = rateFor(model), fx = parseFloat(env.USD_INR || '90') || 90;
  var usd = ((usage.input_tokens || 0) * r.i + (usage.output_tokens || 0) * r.o) / 1e6 + (usage.searches || 0) * 0.01;
  return usd * fx;
}
var MAX_B64 = 7 * 1024 * 1024; /* about 5 MB of image */

var COMMON = 'The image is a photo of an Indian official document. Read only the fields asked for. If a value is not clearly readable, use null. Do not guess. Do not include any person\'s name, roll or registration number, address, or any ID number, phone number or email address. Reply with only one JSON object and nothing else.';
var PROMPTS = {
  auto: COMMON + '\nFirst decide what the document is and put it in docType: "m10" (a school Class 10, SSLC or matriculation marksheet or pass certificate), "m12" (a Class 12, PUC or higher secondary marksheet), "degree" (a college or university marksheet or degree), "exp" (a relieving letter, experience certificate, offer letter or appointment letter from an employer), "dl" (a driving licence), "birth" (a birth certificate), "cat" (a caste or category certificate), "inc" (an income certificate), "resume" (a resume or CV), or "other". For a resume or CV (docType "resume"): "skills" is up to 12 short skills, tools or certifications, "roles" is up to 5 job titles the person has held or is seeking, "expYears" is the total years of paid work (0 for a fresher, null if unclear), "eduLevel" is the highest completed ("10" Class 10, "12" Class 12 or PUC, "diploma" diploma or ITI, "degree" bachelor\'s, "pg" master\'s or above), "city" is the city where the person lives or wants to work, "languages" is the languages the person speaks. Never output a name, phone number, email or address. Fill only the fields for that document and use null for the rest. Fields: {"isDocument": boolean, "skills": [string], "roles": [string], "expYears": number | null, "eduLevel": "10" | "12" | "diploma" | "degree" | "pg" | null, "city": string | null, "languages": [string], "docType": "m10" | "m12" | "degree" | "exp" | "dl" | "birth" | "cat" | "inc" | "resume" | "other", "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Karnataka PUC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "category": "SC" | "ST" | "OBC" | "General" | null, "categoryText": string | null, "annualIncomeRupees": number | null, "role": string | null, "employer": string | null, "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null, "stillWorking": boolean, "letterKind": "relieving" | "experience" | "offer" | "other" | null, "licenceClasses": [{"class": string, "issued": "YYYY-MM-DD" | null}], "validUpto": "YYYY-MM-DD" | null, "badgeHeld": boolean | null, "notes": [string]}. For a driving licence list each vehicle class printed (for example LMV, MCWG, HMV, HGMV, HPMV) with its own date of issue, the date the licence is valid until, and whether a public service vehicle badge is shown; never include the licence number, name or address. For a work letter, give the employer organisation name and the job title, never the person\'s name; use the date of joining as startDate and the last working day or relieving date as endDate, not the date the letter was written; if a date is not printed use null, and say so in notes. For a Class 12 marksheet, board is the Class 12 board (use "Karnataka PUC" for the Department of Pre-University Education) and subjects must list every subject with its marks. For a Class 10 or Class 12 marksheet use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  m10: COMMON + '\nThe document should be a school Class 10 marksheet or pass certificate (CBSE, ICSE, Karnataka SSLC, or another state board, in any year). Fields: {"isDocument": boolean, "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "notes": [string]}. Use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  resume: COMMON + '\nThe document should be a resume or CV.'+ ' For a resume or CV (docType "resume"): "skills" is up to 12 short skills, tools or certifications, "roles" is up to 5 job titles the person has held or is seeking, "expYears" is the total years of paid work (0 for a fresher, null if unclear), "eduLevel" is the highest completed ("10" Class 10, "12" Class 12 or PUC, "diploma" diploma or ITI, "degree" bachelor\'s, "pg" master\'s or above), "city" is the city where the person lives or wants to work, "languages" is the languages the person speaks. Never output a name, phone number, email or address.' + ' Fields: {"isDocument": boolean, "skills": [string], "roles": [string], "expYears": number | null, "eduLevel": "10" | "12" | "diploma" | "degree" | "pg" | null, "city": string | null, "languages": [string], "notes": [string]}.',
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
function cleanRecord(x, seen, today, tab) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 120); if (!title) return null;
  var closes = okDate(x.closes); if (closes && closes < today) return null;
  var facts = (Array.isArray(x.facts) ? x.facts : []).slice(0, 6).map(function (f) { return Array.isArray(f) && f.length > 1 ? [cleanS(f[0], 40), cleanS(f[1], 200)] : null; }).filter(function (f) { return f && f[0] && f[1]; });
  var off = OFFICIAL.test(host);
  var isC = tab === 'study', r = { id: (isC ? 'dc-' : 'd-') + hash(url), k: 'rec', tab: isC ? 'study' : 'work', kind: isC ? 'Course' : 'Job', title: title, org: cleanS(x.org, 80), line: cleanS(x.line, 200), closes: closes, cyc: cleanS(x.cyc, 300) || (closes ? 'Closes ' + closes + '.' : 'Dates not found. Check the notice.'),
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
var EDU_NAME = { '10': 'Class 10', '12': 'Class 12', diploma: 'Diploma or ITI', degree: 'Degree', pg: 'Master\'s degree' };
var BOARDS = /(^|\.)(naukri|linkedin|indeed|foundit|monster|shine|glassdoor|apna|workindia|quikr|timesjobs|freshersworld|jooble|instahyre|internshala|olx|talent|simplyhired|ziprecruiter|careerbuilder|hirist|cutshort|wellfound|jobhai|babajob|sulekha|justdial|facebook|whatsapp|telegram|t)\.(com|co\.in|in|app|me|io)$/i;
var FEEWORDS = /registration\s+fee|security\s+deposit|refundable|pay\s+(?:rs|₹|inr)|joining\s+fee|training\s+fee|fee\s+required|deposit\s+required|work\s+from\s+home.{0,30}(?:earn|per\s+day)/i;
function viaOf(host, org) {
  if (BOARDS.test(host)) return 'Job board';
  var h = host.replace(/^www\./, '').split('.').slice(0, -1).join('.').toLowerCase(), toks = String(org).toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 4; });
  return toks.some(function (t) { return h.indexOf(t) >= 0; }) ? 'Employer\'s own page' : 'Other site';
}
function cleanPvt(x, seen, today) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 100), org = cleanS(x.company || x.org, 80); if (!title || !org) return null;
  if (FEEWORDS.test(title + ' ' + cleanS(x.line, 300) + ' ' + cleanS(x.pay, 80))) return null;
  var closes = okDate(x.closes); if (closes && closes < today) return null;
  var city = cleanS(x.city || x.place, 40) || 'Karnataka', skills = (Array.isArray(x.skills) ? x.skills : []).map(function (s) { return cleanS(s, 30); }).filter(Boolean).slice(0, 8);
  var minExp = num(x.minExp, 0, 30), edu = EDU_NAME[x.edu] ? x.edu : null, pay = cleanS(x.pay, 60);
  var facts = [['Where', city]];
  if (pay) facts.push(['Pay', pay]);
  facts.push(['Experience', minExp ? minExp + (minExp === 1 ? ' year' : ' years') + ' or more' : 'Freshers can apply']);
  if (edu) facts.push(['Qualification', EDU_NAME[edu] + ' or higher']);
  if (skills.length) facts.push(['Skills', skills.join(', ')]);
  if (closes) facts.push(['Apply by', closes]);
  return { id: 'dp-' + hash(url), k: 'pvt', live: true, title: title, org: org, place: city, line: cleanS(x.line, 200), skills: skills, pay: pay, minExp: minExp || 0, edu: edu, closes: closes, found: today, via: viaOf(host, org), facts: facts, src: [cleanS(x.srcName, 80) || host, url], host: host, note: 'Found on a job site by the daily search and checked by Avakasha. This is not an official page. Check the employer before you apply.' };
}
function cleanSch(x, seen, today) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 120), org = cleanS(x.provider || x.org, 80); if (!title || !org) return null;
  if (FEEWORDS.test(title + ' ' + cleanS(x.line, 300) + ' ' + cleanS(x.who, 300))) return null;
  var closes = okDate(x.closes); if (closes && closes < today) return null;
  var edu = EDU_NAME[x.level] ? x.level : null, amount = cleanS(x.amount, 80), who = cleanS(x.who, 220), off = OFFICIAL.test(host), gov = !!(x.gov === true || x.gov === 'true') || off;
  var facts = [];
  if (amount) facts.push(['Amount', amount]);
  if (edu) facts.push(['For', EDU_NAME[edu] + ' students']);
  if (who) facts.push(['Who can apply', who]);
  facts.push(['Last date', closes || 'Not found. Check the page']);
  return { id: 'ds-' + hash(url), k: 'sch', live: true, gov: gov, title: title, org: org, line: cleanS(x.line, 200), amount: amount, who: who, level: edu, closes: closes, found: today, facts: facts, src: [cleanS(x.srcName, 80) || host, url], host: host, official: off, note: gov ? 'Found by the weekly search and checked by Avakasha. Confirm the details and the last date on the official page before you apply.' : 'A private scholarship, found by the weekly search. This is not a government scheme and not an official page. Check the provider and apply only on its own site. Never pay to apply.' };
}
function cleanTrain(x, seen, today) {
  var url = cleanS(x && x.url, 400).split('#')[0], host;
  try { var u = new URL(url); if (u.protocol !== 'https:') return null; host = u.hostname; } catch (e) { return null; }
  if (seen && !seen[url]) return null;
  var title = cleanS(x.title, 120), org = cleanS(x.provider || x.org, 80); if (!title || !org) return null;
  var free = x.free === true || x.free === 'true';
  if (!free && FEEWORDS.test(title + ' ' + cleanS(x.line, 300))) return null;
  var amin = num(x.ageMin, 10, 60), amax = num(x.ageMax, 10, 70), me = { none: 0, '10': 1, '12': 2, degree: 3 }[String(x.level)] || 0, off = OFFICIAL.test(host), dur = cleanS(x.length, 80), who = cleanS(x.who, 200);
  var facts = [['Cost', free ? 'Free for candidates' : (cleanS(x.cost, 80) || 'Check the page')]];
  if (amin && amax) facts.push(['Age', amin + ' to ' + amax + ' years']);
  if (dur) facts.push(['Length', dur]);
  if (who) facts.push(['Who can join', who]);
  var t = { id: 'dt-' + hash(url), k: 'train', title: title, org: org, line: cleanS(x.line, 200), free: free, minEdu: me, off: off, facts: facts, src: [cleanS(x.srcName, 80) || host, url], go: url, found: today, host: host, note: off ? 'Found by the weekly search and checked by Avakasha. Courses, centres and dates change, so confirm on the official page before you join.' : 'Found by the weekly search. This is not an official government page. Confirm on the provider\'s own site before you join, and never pay to get a place.' };
  if (amin && amax && amax >= amin) { t.ageMin = amin; t.ageMax = amax; }
  return t;
}
async function kget(env, k) { try { var v = await env.LIMITS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
var OFFICIAL_DOMAINS = ['gov.in', 'nic.in', 'ibps.in', 'ac.in', 'edu.in'];
var RULES_TEXT = 'For each job, give the eligibility rules as a list using only these kinds: {"t":"age","min":18,"max":27,"maxByCat":{"OBC":30,"SC":32,"ST":32}} (ages as on the notice), {"t":"passed"} (Class 10 pass needed), {"t":"passed12"} (Class 12 pass needed), {"t":"pct12","min":50} (minimum Class 12 marks), {"t":"pctmin","min":50} (minimum Class 10 marks), {"t":"exp","min":2} (years of experience), {"t":"static","title":"short name","detail":"one sentence"} for anything else, such as a degree, a diploma, a trade, a licence or a language test. Be careful: give a Class 10 or Class 12 rule only when the notice itself asks for exactly that. For diploma, ITI or degree posts use a static rule and no Class 10 or 12 rule. Set "lvl":12 when Class 12 is needed. If the age limit or qualification is not on the page, leave that rule out.';
var JOB_SHAPE = '{"title":"","org":"","line":"one short sentence","closes":"YYYY-MM-DD or null","cyc":"the application dates in one sentence","lvl":10,"facts":[["Age","..."],["Qualification","..."],["Pay","..."]],"rules":[],"srcName":"notice name","url":""}';
/* One search pass. domains limits where Claude may search; null means anywhere. */
async function searchPass(env, prompt, domains, maxUses, model) {
  var base = env.MODEL || DEFAULT_MODEL; model = model || base;
  var msgs = [{ role: 'user', content: prompt }], seen = {}, text = '', u = { input_tokens: 0, output_tokens: 0, searches: 0, inr: 0, model: model }, stop = '';
  var tool = { type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }; if (domains) tool.allowed_domains = domains;
  var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 280000);
  try {
    for (var turn = 0; turn < 4; turn++) {
      var up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model, max_tokens: 12000, tools: [tool], messages: msgs })
      });
      if (!up.ok && model !== base && (up.status === 400 || up.status === 404)) { model = base; u.model = base; u.fellBack = true; turn--; continue; }
      if (!up.ok) { clearTimeout(timer); var et = ''; try { et = (await up.text()).slice(0, 200); } catch (e) {} return { error: 'upstream', status: up.status, tail: et, u: u }; }
      var d = await up.json();
      if (d.usage) { u.input_tokens += d.usage.input_tokens || 0; u.output_tokens += d.usage.output_tokens || 0; var ws = (d.usage.server_tool_use && d.usage.server_tool_use.web_search_requests) || 0; u.searches += ws; u.inr += costInr(env, model, { input_tokens: d.usage.input_tokens || 0, output_tokens: d.usage.output_tokens || 0, searches: ws }); }
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
function promptA(today) {
  return 'Today is ' + today + '. You help job seekers in India (Karnataka first, then central government).\nUse web search, which is limited to official government sites, to find government job recruitments that are open to apply for right now, in Karnataka or central government, at any qualification level (Class 10, Class 12, ITI or diploma, degree). Check these official sites by name: KEA (cetonline.karnataka.gov.in), KPSC (kpsc.kar.nic.in), Karnataka School Education Department, Karnataka Forest Department, Staff Selection Commission (ssc.gov.in), UPSC (upsc.gov.in), IBPS (ibps.in), the Railway Recruitment Boards, India Post (indiapost.gov.in), ISRO and BEL.\nRules: list only what you saw on a page in the search results, and use that page\'s own address as url. Never invent a date or a number. Skip anything already closed. Up to 12 jobs. Keep every field short.\n' + RULES_TEXT + '\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + JOB_SHAPE + ']}</json>';
}
function promptE(today) {
  return 'Today is ' + today + '. You help students and job seekers in India (Karnataka first, then national).\nUse web search, which is limited to official government sites, to find government and entrance exams coming in the next 8 months (for example KCET, NEET, JEE, CUET, SSC, UPSC, KPSC, KEA, IBPS, railway and state exams). List only what you saw on a page in the search results, and use that page\'s own address as url. Never invent a date. Skip anything already held. Up to 8 exams. Keep every field short; include the qualification needed as a fact.\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"exams":[{"title":"","org":"","date":"YYYY-MM-DD","line":"","facts":[["Exam","..."],["Qualification","..."]],"srcName":"","url":""}]}</json>';
}
function promptK(today) {
  return 'Today is ' + today + '. You help students in Karnataka, India find courses to join.\nUse web search, which is limited to official government and university sites, to find course admissions that are open or opening soon for Karnataka students: PUC (Class 11) admissions, diploma and polytechnic admissions, ITI admissions, and degree admissions through state bodies (for example the Karnataka Department of Technical Education, the Department of Pre-University Education, the Department of Skill Development, KEA and Karnataka state universities). Up to 8 items. List only what you saw on a page in the search results, with that page\'s own address as url. Never invent a date or a number. Skip anything whose last date has passed. Set closes to the last date to apply. Keep every field short.\n' + RULES_TEXT + '\nUse lvl 12 only when Class 12 is needed to join. Reply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + JOB_SHAPE + ']}</json>';
}
var TRAIN_SHAPE = '{"title":"","provider":"who runs it","free":true,"cost":"as printed, or empty","ageMin":15,"ageMax":45,"level":"none or 10 or 12 or degree","length":"how long","who":"who can join in one sentence","line":"one short sentence","srcName":"site name","url":""}';
function promptT(today) {
  return 'Today is ' + today + '. You help young people in Karnataka, India find skill training.\nUse web search on any site to find skill training programs open to join for candidates in Karnataka, preferring government schemes (for example Kaushalya Karnataka, the Karnataka Skill Development Corporation, Skill India Digital, PMKVY, NSDC, the Government Tool Rooms and training centres, and ITI short courses) and also a few well known free or low-cost private programs. Up to 8 programs. List only what you saw on a page in the search results, with that page\'s own address as url, preferring the official page. Never invent a cost, an age limit or a provider. Skip anything that asks the applicant to pay a registration fee or deposit to be considered. Keep every field short.\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"programs":[' + TRAIN_SHAPE + ']}</json>';
}
function promptB(today) {
  return 'Today is ' + today + '. You help job seekers in India (Karnataka first, then central government).\nUse web search on any site to find government job recruitments that are open to apply for right now, in Karnataka or central government, at any qualification level. Up to 10 jobs. List only what you saw on a page in the search results, with that page\'s own address as url. Never invent a date or a number. Skip anything already closed. Keep every field short.\n' + RULES_TEXT + '\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + JOB_SHAPE + ']}</json>';
}
var PVT_SHAPE = '{"title":"","company":"","city":"","line":"one short sentence","pay":"as printed, or empty","minExp":0,"edu":"10 or 12 or diploma or degree or pg","skills":[],"closes":"YYYY-MM-DD or null","srcName":"site name","url":""}';
function promptC(today) {
  return 'Today is ' + today + '. You help job seekers in India.\nUse web search on any site to find private-sector jobs that are open right now in Bengaluru and elsewhere in Karnataka. Cover a mix: entry-level and fresher roles, Class 10 or Class 12 pass roles (delivery, retail, office assistant, driver, technician, security), diploma or ITI roles, and graduate roles. Up to 10 jobs. List only what you saw on a page in the search results, and use that page\'s own address as url, preferring the employer\'s own careers page over a job board. Never invent a company, pay or date. Skip anything that asks the applicant to pay any fee or deposit, anything vague about the employer, and anything already closed. Keep every field short; edu is the lowest qualification asked for, and minExp is the years of experience asked for (0 if freshers can apply).\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + PVT_SHAPE + ']}</json>';
}
/* Role families for private jobs. Each is its own search, so roles like software and Agile get looked for by name. */
var FAMILIES = [
  { id: 'sw', name: 'Software and IT', roles: 'Software Engineer, Developer (Java, Python, JavaScript, .NET, React), Frontend or Backend Developer, Full Stack Developer, DevOps Engineer, Data Analyst, IT Support or Technical Support Engineer', levels: 'freshers, 1 to 3 years, and 3 to 8 years' },
  { id: 'agile', name: 'Agile, testing and project roles', roles: 'Scrum Master, Agile Coach, Product Owner, Project Coordinator, Project Manager, QA or Test Engineer, Manual or Automation Tester', levels: '1 to 3 years, 3 to 8 years, and senior' },
  { id: 'acc', name: 'Accounts and finance', roles: 'Accountant, Accounts Executive, Tally, GST or Taxation Executive, Bookkeeper, Finance Analyst, Banking or Loan Officer', levels: 'freshers, 1 to 3 years, and 3 to 8 years' }
];
function promptF(today, f) {
  return 'Today is ' + today + '. You help job seekers in India.\nUse web search on any site, job boards included (for example Naukri, LinkedIn, Indeed, Foundit and company career pages), to find ' + f.name + ' jobs that are open right now in Bengaluru and elsewhere in Karnataka. Roles to look for: ' + f.roles + '. Include a spread of levels: ' + f.levels + '. Up to 10 jobs. List only what you saw on a page in the search results, and use that page\'s own address as url. Never invent a company, pay or date. Skip anything that asks the applicant to pay any fee or deposit, anything vague about the employer, and anything already closed. Keep every field short; edu is the lowest qualification asked for, and minExp is the years of experience asked for (0 if freshers can apply).\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"jobs":[' + PVT_SHAPE + ']}</json>';
}
var SCH_SHAPE = '{"title":"","provider":"who offers it","gov":true,"level":"10 or 12 or diploma or degree or pg","amount":"as printed, or empty","who":"who can apply in one sentence, with income limit, category or marks if stated","line":"one short sentence","closes":"YYYY-MM-DD or null","srcName":"site name","url":""}';
function promptS(today) {
  return 'Today is ' + today + '. You help students in Karnataka, India find scholarships.\nUse web search on any site to find scholarships that are open to apply for right now (or open soon) for students in Karnataka: (1) government schemes, state and central (for example through the State Scholarship Portal, the National Scholarship Portal, Karnataka Social Welfare, Backward Classes, Minorities and other departments, and AICTE or UGC schemes), and (2) private scholarships offered by foundations, trusts and companies (for example Reliance Foundation, Tata, HDFC, Azim Premji, Buddy4Study listings). Cover a mix of levels: Class 10 pass students going to PUC, ITI or diploma, Class 12 pass students, and degree students. Up to 12 scholarships, about half government and half private. List only what you saw on a page in the search results, with that page\'s own address as url, preferring the provider\'s own page. Set gov to true only for government schemes. Never invent an amount, a date or a provider. Skip anything that asks the applicant to pay any fee, and anything already closed. Keep every field short.\nReply with only this JSON, between <json> and </json> tags, with no other words after it: <json>{"scholarships":[' + SCH_SHAPE + ']}</json>';
}
function addUsage(a, b) { return { input_tokens: (a.input_tokens || 0) + (b.input_tokens || 0), output_tokens: (a.output_tokens || 0) + (b.output_tokens || 0), searches: (a.searches || 0) + (b.searches || 0), inr: (a.inr || 0) + (b.inr || 0), fellBack: !!(a.fellBack || b.fellBack) }; }
/* The daily job has two steps so each fits in one request. Step A searches official government sites only and starts a fresh draft. Step B searches anywhere for posts step A missed; those are "leads" that need an official notice link before they can be approved. Nothing reaches users until it is approved. */
async function runStep(env, step, runId, fam) {
  if (!env.LIMITS || !env.ANTHROPIC_API_KEY) return { error: 'not_configured' };
  var today = todayStr(), live = (await kget(env, 'live')) || { records: [], exams: [] };
  var known = {}; live.records.concat(live.exams).forEach(function (x) { known[x.id] = 1; });
  async function mergeDraft(items, u) {
    var d = (await kget(env, 'draft')) || { items: [] }, have = {}, keep = cutoffMs(30);
    d.items = d.items.filter(function (x) { return !x.run || x.run >= keep; });
    d.items.forEach(function (x) { have[x.id] = 1; });
    var added = 0; items.forEach(function (x) { if (!have[x.id]) { d.items.push(x); have[x.id] = 1; added++; } });
    d.usage = addUsage(d.usage || {}, u); d.at = Date.now();
    await env.LIMITS.put('draft', JSON.stringify(d));
    return { n: d.items.length, leads: d.items.filter(function (x) { return x.lead; }).length, added: added };
  }
  function dedupeTitles(items) { var t = [], out = []; items.forEach(function (x) { var nk = nkey(x.title); if (t.some(function (y) { return sameTitle(y, nk); })) return; t.push(nk); out.push(x); }); return out; }
  if (step === 'A') {
    var A = await searchPass(env, promptA(today), OFFICIAL_DOMAINS, 8);
    if (!A.ok) return { error: A.error, stop: A.stop, len: A.len, tail: A.tail, status: A.status, usage: A.u };
    var rawA = Array.isArray(A.o.jobs) ? A.o.jobs.length : 0, itemsA = [];
    (Array.isArray(A.o.jobs) ? A.o.jobs : []).forEach(function (x) { var c = cleanRecord(x, A.seen, today); if (c && !known[c.id]) { c.run = runId; itemsA.push(c); } });
    var mA = await mergeDraft(dedupeTitles(itemsA), A.u);
    return { ok: true, n: mA.n, leads: mA.leads, usage: A.u, stats: { raw: rawA, added: mA.added } };
  }
  if (step === 'E') {
    var E = await searchPass(env, promptE(today), OFFICIAL_DOMAINS, 6);
    if (!E.ok) return { error: E.error, stop: E.stop, len: E.len, tail: E.tail, status: E.status, usage: E.u };
    var rawE = Array.isArray(E.o.exams) ? E.o.exams.length : 0, itemsE = [];
    (Array.isArray(E.o.exams) ? E.o.exams : []).forEach(function (x) { var c = cleanExam(x, E.seen, today); if (c && !known[c.id]) { c.run = runId; itemsE.push(c); } });
    var mE = await mergeDraft(dedupeTitles(itemsE), E.u);
    return { ok: true, n: mE.n, leads: mE.leads, usage: E.u, stats: { raw: rawE, added: mE.added } };
  }
  if (step === 'K') {
    var K = await searchPass(env, promptK(today), OFFICIAL_DOMAINS, 6, env.PVT_MODEL || DEFAULT_PVT_MODEL);
    if (!K.ok) return { error: K.error, stop: K.stop, len: K.len, tail: K.tail, status: K.status, usage: K.u };
    var rawK = Array.isArray(K.o.jobs) ? K.o.jobs.length : 0, itemsK = [];
    (Array.isArray(K.o.jobs) ? K.o.jobs : []).slice(0, 10).forEach(function (x) { var c = cleanRecord(x, K.seen, today, 'study'); if (c && !known[c.id]) { c.run = runId; itemsK.push(c); } });
    var mK = await mergeDraft(dedupeTitles(itemsK), K.u);
    return { ok: true, n: mK.n, leads: mK.leads, usage: K.u, stats: { raw: rawK, added: mK.added } };
  }
  if (step === 'T') {
    var T = await searchPass(env, promptT(today), null, 6, env.PVT_MODEL || DEFAULT_PVT_MODEL);
    if (!T.ok) return { error: T.error, stop: T.stop, len: T.len, tail: T.tail, status: T.status, usage: T.u };
    var rawT = Array.isArray(T.o.programs) ? T.o.programs.length : 0, itemsT = [], kt = {}; (live.train || []).forEach(function (x) { kt[x.id] = 1; });
    (Array.isArray(T.o.programs) ? T.o.programs : []).slice(0, 10).forEach(function (x) { var c = cleanTrain(x, T.seen, today); if (c && !kt[c.id]) { c.run = runId; itemsT.push(c); } });
    var mT = await mergeDraft(dedupeTitles(itemsT), T.u);
    return { ok: true, n: mT.n, leads: mT.leads, usage: T.u, stats: { raw: rawT, added: mT.added } };
  }
  if (step === 'S') {
    var ds = (await kget(env, 'draft')) || { items: [] }, ids3 = {}, ts = []; ds.items.forEach(function (x) { ids3[x.id] = 1; if (x.k === 'sch') ts.push(nkey(x.org + x.title)); });
    (live.sch || []).forEach(function (x) { ids3[x.id] = 1; ts.push(nkey(x.org + x.title)); });
    var S = await searchPass(env, promptS(today), null, 6, env.PVT_MODEL || DEFAULT_PVT_MODEL);
    if (!S.ok) return { error: S.error, stop: S.stop, len: S.len, tail: S.tail, status: S.status, usage: S.u };
    var adds = 0, raws = 0, bads = 0, dups = 0;
    (Array.isArray(S.o.scholarships) ? S.o.scholarships : []).slice(0, 14).forEach(function (x) {
      raws++; var c = cleanSch(x, S.seen, today); if (!c) { bads++; return; } c.run = runId;
      var nk = nkey(c.org + c.title); if (ids3[c.id] || ts.indexOf(nk) >= 0) { dups++; return; } ts.push(nk); ids3[c.id] = 1; ds.items.push(c); adds++;
    });
    ds.usage = addUsage(ds.usage || {}, S.u); ds.at = Date.now();
    await env.LIMITS.put('draft', JSON.stringify(ds));
    return { ok: true, n: ds.items.length, leads: ds.items.filter(function (x) { return x.lead; }).length, usage: S.u, stats: { raw: raws, added: adds, dup: dups, bad: bads } };
  }
  if (step === 'C') {
    var dc = (await kget(env, 'draft')) || { items: [] }, idc = {}, tc = []; dc.items.forEach(function (x) { idc[x.id] = 1; if (x.k === 'pvt') tc.push(nkey(x.org + x.title)); });
    (live.pvt || []).forEach(function (x) { idc[x.id] = 1; });
    var C = await searchPass(env, fam ? promptF(today, fam) : promptC(today), null, 5, env.PVT_MODEL || DEFAULT_PVT_MODEL);
    if (!C.ok) return { error: C.error, stop: C.stop, len: C.len, tail: C.tail, status: C.status, usage: C.u };
    var addc = 0, rawc = 0, badc = 0, dupc = 0;
    (Array.isArray(C.o.jobs) ? C.o.jobs : []).slice(0, PVT_MAX).forEach(function (x) {
      rawc++; var c = cleanPvt(x, C.seen, today); if (!c) { badc++; return; } c.run = runId; if (fam) c.fam = fam.id; if (idc[c.id]) { dupc++; return; }
      var nk = nkey(c.org + c.title); if (tc.indexOf(nk) >= 0) { dupc++; return; } tc.push(nk); idc[c.id] = 1; dc.items.push(c); addc++;
    });
    dc.usage = addUsage(dc.usage || {}, C.u); dc.passC = 'ok'; dc.at = Date.now();
    await env.LIMITS.put('draft', JSON.stringify(dc));
    return { ok: true, n: dc.items.length, leads: dc.items.filter(function (x) { return x.lead; }).length, pvt: addc, usage: C.u, stats: { raw: rawc, added: addc, dup: dupc, bad: badc } };
  }
  var d = (await kget(env, 'draft')) || { items: [] }, titles2 = d.items.map(function (x) { return nkey(x.title); }), ids = {}; d.items.forEach(function (x) { ids[x.id] = 1; });
  var B = await searchPass(env, promptB(today), null, 5);
  if (!B.ok) return { error: B.error, stop: B.stop, len: B.len, tail: B.tail, status: B.status, usage: B.u };
  var added = 0, rawb = 0, badb = 0, dupb = 0;
  (Array.isArray(B.o.jobs) ? B.o.jobs : []).forEach(function (x) {
    rawb++; var c = cleanRecord(x, B.seen, today); if (!c) { badb++; return; } c.run = runId; if (known[c.id] || ids[c.id]) { dupb++; return; }
    var nk = nkey(c.title); if (titles2.some(function (t) { return sameTitle(t, nk); })) { dupb++; return; }
    if (!c.official) c.lead = true;
    titles2.push(nk); ids[c.id] = 1; d.items.push(c); added++;
  });
  d.usage = addUsage(d.usage || {}, B.u); d.passB = 'ok'; d.at = Date.now();
  await env.LIMITS.put('draft', JSON.stringify(d));
  return { ok: true, n: d.items.length, leads: d.items.filter(function (x) { return x.lead; }).length, usage: B.u, stats: { raw: rawb, added: added, dup: dupb, bad: badb } };
}
/* Adds approved or rejected counts to the matching entries of the run history. */
async function bumpRuns(env, counts, field) {
  var keys = Object.keys(counts); if (!keys.length) return;
  try { var lg = (await kget(env, 'runlog')) || [], ch = false; lg.forEach(function (e) { if (counts[e.id]) { e[field] = (e[field] || 0) + counts[e.id]; ch = true; } }); if (ch) await env.LIMITS.put('runlog', JSON.stringify(lg)); } catch (e) {}
}
/* Runs a step and adds its estimated cost to this month's total (spend:YYYY-MM in KV). */
async function runLogged(env, step, src, fam) {
  var runId = Date.now(), r = await runStep(env, step, runId, fam), inr = r && r.usage && r.usage.inr || 0;
  if (env.LIMITS) { try { var lg = (await kget(env, 'runlog')) || []; lg.unshift({ id: runId, at: runId, live: 0, rej: 0, step: step, label: fam ? fam.name : null, src: src || 'manual', ok: !!r.ok, error: r.ok ? null : (r.error || 'upstream'), raw: r.stats && r.stats.raw, added: r.stats && r.stats.added, dup: r.stats && r.stats.dup, bad: r.stats && r.stats.bad, inr: Math.round(inr * 10) / 10, model: r.usage && r.usage.model, fellBack: !!(r.usage && r.usage.fellBack) }); await env.LIMITS.put('runlog', JSON.stringify(lg.slice(0, 45))); } catch (e) {} }
  if (inr > 0 && env.LIMITS) { try { var k = 'spend:' + todayStr().slice(0, 7), v = parseFloat((await env.LIMITS.get(k)) || '0') || 0; await env.LIMITS.put(k, String(v + inr), { expirationTtl: 7776000 }); } catch (e) {} }
  return r;
}
function cutoffMs(days) { return Date.now() - days * 864e5; }
function cutoff(days) { return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
/* The six kinds of search, the steps each one runs, the time slot it runs in, and its default days (0 = Sunday). */
var KINDS = [
  { id: 'govt', name: 'Govt jobs', steps: ['A', 'B'], slot: 0, def: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6] } },
  { id: 'exam', name: 'Exams', steps: ['E'], slot: 0, def: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6] } },
  { id: 'pvt', name: 'Private jobs', steps: ['C'], slot: 1, def: { mode: 'daily', days: [0, 1, 2, 3, 4, 5, 6] } },
  { id: 'course', name: 'Courses', steps: ['K'], slot: 1, def: { mode: 'weekly', days: [1] } },
  { id: 'sch', name: 'Scholarships', steps: ['S'], slot: 2, def: { mode: 'weekly', days: [1] } },
  { id: 'train', name: 'Trainings', steps: ['T'], slot: 2, def: { mode: 'weekly', days: [1] } }
];
function cleanSched(x, def) {
  if (!x || typeof x !== 'object') return def;
  var mode = x.mode === 'daily' || x.mode === 'weekly' || x.mode === 'custom' ? x.mode : def.mode, days = (Array.isArray(x.days) ? x.days : []).map(Number).filter(function (d) { return d >= 0 && d <= 6; });
  days = days.filter(function (d, i) { return days.indexOf(d) === i; }).sort();
  if (mode === 'daily') days = [0, 1, 2, 3, 4, 5, 6]; else if (mode === 'weekly') days = days.slice(0, 1); if (!days.length) return def;
  return { mode: mode, days: days };
}
async function getSched(env) {
  var st = (await kget(env, 'sched')) || {}, out = {}; KINDS.forEach(function (k) { out[k.id] = cleanSched(st[k.id], k.def); }); return out;
}
function dueToday(sched, kind, dow) { return sched[kind.id].days.indexOf(dow) >= 0; }
async function runKinds(env, kinds, src) {
  var last = { ok: true, n: 0, leads: 0, usage: {} };
  for (var i = 0; i < kinds.length; i++) {
    for (var j = 0; j < kinds[i].steps.length; j++) {
      var r = await runLogged(env, kinds[i].steps[j], src);
      last.usage = addUsage(last.usage, r.usage || {});
      if (!r.ok) { last.ok = false; last.error = r.error; last.stop = r.stop; last.len = r.len; last.tail = r.tail; last.status = r.status; } else { last.n = r.n; last.leads = r.leads; }
    }
  }
  return last;
}
async function adminDo(b, request, env, origin) {
  if (!env.ADMIN_KEY || !env.LIMITS) return json({ error: 'not_configured' }, 500, origin);
  var ip = request.headers.get('CF-Connecting-IP') || 'x', kf = 'fail:' + todayStr() + ':' + ip, nf = parseInt((await env.LIMITS.get(kf)) || '0', 10);
  if (nf >= 10) return json({ error: 'locked' }, 429, origin);
  if (b.key !== env.ADMIN_KEY) { await env.LIMITS.put(kf, String(nf + 1), { expirationTtl: 86400 }); return json({ error: 'forbidden' }, 403, origin); }
  var today = todayStr(), live = (await kget(env, 'live')) || { at: 0, records: [], exams: [] }; live.pvt = live.pvt || []; live.sch = live.sch || []; live.train = live.train || []; var draft = (await kget(env, 'draft')) || { at: 0, items: [] };
  if (b.action === 'run' || b.action === 'run2' || b.action === 'run3' || b.action === 'runfam' || b.action === 'runsch' || b.action === 'runstep') {
    var fam = null; if (b.action === 'runfam') { fam = FAMILIES.filter(function (f) { return f.id === b.fam; })[0]; if (!fam) return json({ error: 'unknown_family' }, 400, origin); }
    var step = b.action === 'run' ? 'A' : b.action === 'run2' ? 'B' : b.action === 'runsch' ? 'S' : b.action === 'runstep' ? String(b.step) : 'C'; if (['A', 'B', 'C', 'E', 'K', 'S', 'T'].indexOf(step) < 0) return json({ error: 'unknown_step' }, 400, origin);
    if (step === 'A') { var last = await env.LIMITS.get('lastrun'); if (last && Date.now() - parseInt(last, 10) < 36e5) return json({ error: 'too_soon' }, 429, origin); }
    var r = await runLogged(env, step, 'manual', fam);
    var res = { at: Date.now(), ok: !!r.ok, step: step, n: r.n, leads: r.leads, error: r.error, stop: r.stop, len: r.len, tail: r.tail, status: r.status, usage: r.usage };
    await env.LIMITS.put('lastresult', JSON.stringify(res));
    if (r.ok && step === 'A') await env.LIMITS.put('lastrun', String(Date.now()));
    return json(r.ok ? { ok: true, n: r.n, leads: r.leads, usage: r.usage } : { error: r.error || 'upstream', stop: r.stop, len: r.len, tail: r.tail, status: r.status }, r.ok ? 200 : 502, origin);
  }
  if (b.action === 'setsched') {
    var kd = KINDS.filter(function (k) { return k.id === b.kind; })[0]; if (!kd) return json({ error: 'unknown_kind' }, 400, origin);
    var cur = (await kget(env, 'sched')) || {}; cur[kd.id] = cleanSched({ mode: b.mode, days: b.days }, kd.def); await env.LIMITS.put('sched', JSON.stringify(cur));
  }
  if (b.action === 'approve') {
    var ids = {};
    (Array.isArray(b.items) ? b.items : []).slice(0, 40).forEach(function (x) {
      if (!x || !Array.isArray(x.src)) return; x.url = x.src[1]; x.srcName = x.src[0]; x.date = x.d;
      x.provider = x.org; var c = x.k === 'exam' ? cleanExam(x, null, today) : x.k === 'pvt' ? cleanPvt(x, null, today) : x.k === 'sch' ? cleanSch(x, null, today) : x.k === 'train' ? cleanTrain(x, null, today) : cleanRecord(x, null, today, x.tab); if (!c) return;
      if (x.lead && !c.official) return;
      var list = c.k === 'exam' ? live.exams : c.k === 'pvt' ? live.pvt : c.k === 'sch' ? live.sch : c.k === 'train' ? live.train : live.records; var i = list.map(function (y) { return y.id; }).indexOf(c.id);
      if (i >= 0) list[i] = c; else list.push(c); ids[c.id] = 1;
    });
    live.at = Date.now(); await env.LIMITS.put('live', JSON.stringify(live));
    var lc = {}; draft.items.forEach(function (x) { if (ids[x.id] && x.run) lc[x.run] = (lc[x.run] || 0) + 1; }); await bumpRuns(env, lc, 'live');
    draft.items = draft.items.filter(function (x) { return !ids[x.id]; }); await env.LIMITS.put('draft', JSON.stringify(draft));
  } else if (b.action === 'reject') {
    var rj = {}; (Array.isArray(b.ids) ? b.ids : []).forEach(function (i) { rj[i] = 1; });
    var rc = {}; draft.items.forEach(function (x) { if (rj[x.id] && x.run) rc[x.run] = (rc[x.run] || 0) + 1; }); await bumpRuns(env, rc, 'rej');
    draft.items = draft.items.filter(function (x) { return !rj[x.id]; }); await env.LIMITS.put('draft', JSON.stringify(draft));
  } else if (b.action === 'remove') {
    var rm = {}; (Array.isArray(b.ids) ? b.ids : []).forEach(function (i) { rm[i] = 1; });
    live.records = live.records.filter(function (x) { return !rm[x.id]; }); live.exams = live.exams.filter(function (x) { return !rm[x.id]; }); live.pvt = live.pvt.filter(function (x) { return !rm[x.id]; }); live.sch = live.sch.filter(function (x) { return !rm[x.id]; }); live.train = live.train.filter(function (x) { return !rm[x.id]; });
    live.at = Date.now(); await env.LIMITS.put('live', JSON.stringify(live));
  }
  var lastres = await kget(env, 'lastresult'), spend = parseFloat((await env.LIMITS.get('spend:' + todayStr().slice(0, 7))) || '0') || 0;
  var runlog = (await kget(env, 'runlog')) || [];
  var sched = await getSched(env);
  return json({ ok: true, sched: sched, kinds: KINDS.map(function (k) { return { id: k.id, name: k.name, steps: k.steps }; }), fams: FAMILIES.map(function (f) { return { id: f.id, name: f.name }; }), draft: draft, last: lastres, spend: Math.round(spend), runlog: runlog, live: { at: live.at, records: live.records.map(function (x) { return { id: x.id, title: x.title, closes: x.closes }; }), exams: live.exams.map(function (x) { return { id: x.id, title: x.title, d: x.d }; }), pvt: live.pvt.map(function (x) { return { id: x.id, title: x.title + ' · ' + x.org, closes: x.closes, d: x.found }; }), sch: live.sch.map(function (x) { return { id: x.id, title: (x.gov ? 'Govt scholarship: ' : 'Private scholarship: ') + x.title, closes: x.closes, d: x.found }; }), train: live.train.map(function (x) { return { id: x.id, title: 'Training: ' + x.title, d: x.found }; }) } }, 200, origin);
}
async function liveGet(env, origin) {
  var today = todayStr(), live = (await kget(env, 'live')) || { at: 0, records: [], exams: [] };
  return json({ at: live.at, records: live.records.filter(function (x) { return !x.closes || x.closes >= today; }), exams: live.exams.filter(function (x) { return x.d >= today; }), pvt: (live.pvt || []).filter(function (x) { return x.closes ? x.closes >= today : x.found >= cutoff(21); }), sch: (live.sch || []).filter(function (x) { return x.closes ? x.closes >= today : x.found >= cutoff(45); }), train: (live.train || []).filter(function (x) { return x.found >= cutoff(90); }) }, 200, origin);
}

export default {
  async fetch(request, env) {
    var origin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    var reqOrigin = request.headers.get('Origin');
    if (reqOrigin && reqOrigin !== origin) return json({ error: 'forbidden' }, 403, origin);
    if (request.method === 'GET') {
      if (env.APP_KEY && request.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: 'forbidden' }, 403, origin);
      var lr = await liveGet(env, origin); lr.headers.set('Cache-Control', 'private, max-age=300'); return lr;
    }
    if (request.method !== 'POST') return json({ error: 'bad_request' }, 405, origin);
    var body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400, origin); }
    if (body && body.admin) return adminDo(body.admin, request, env, origin);
    if (env.APP_KEY && request.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: 'forbidden' }, 403, origin);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 500, origin);
    var type = body && body.type, image = body && body.image, mt = (body && body.mediaType) || 'image/jpeg', docText = body && typeof body.text === 'string' ? body.text.slice(0, 30000) : '';
    if (!PROMPTS[type] || (!docText && (typeof image !== 'string' || !image))) return json({ error: 'bad_request' }, 400, origin);
    if (!docText && image.length > MAX_B64) return json({ error: 'too_large' }, 413, origin);
    if (!docText && mt !== 'image/jpeg' && mt !== 'image/png' && mt !== 'application/pdf') return json({ error: 'bad_request' }, 400, origin);

    if (await overLimit(request, env, '', '5', '300')) return json({ error: 'daily_limit' }, 429, origin);

    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 55000), up;
    try {
      up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL, max_tokens: 1200,
          messages: [{ role: 'user', content: [docText ? { type: 'text', text: 'Document text:\n' + docText } : mt === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: mt, data: image } } : { type: 'image', source: { type: 'base64', media_type: mt, data: image } }, { type: 'text', text: PROMPTS[type] }] }]
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async function () {
      var r;
      try {
        var sched = await getSched(env), dow = new Date().getUTCDay(), cron = String(event.cron || '0 2 * * *'), m = parseInt(cron.split(' ')[0], 10) || 0, slot = m >= 40 ? 2 : m >= 20 ? 1 : 0;
        if (slot > 0) await env.LIMITS.put('slots', String(Date.now()));
        var sl = parseInt((await env.LIMITS.get('slots')) || '0', 10) || 0, split = Date.now() - sl < 3 * 864e5;
        var kinds = KINDS.filter(function (k) { return dueToday(sched, k, dow) && (split ? k.slot === slot : slot === 0); });
        r = await runKinds(env, kinds, 'daily');
      } catch (e) { r = { error: 'upstream' }; }
      await env.LIMITS.put('lastresult', JSON.stringify({ at: Date.now(), ok: !!r.ok, n: r.n, leads: r.leads, error: r.error, stop: r.stop, len: r.len, tail: r.tail, status: r.status, usage: r.usage }));
    })());
  }
};
