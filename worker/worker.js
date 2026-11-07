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
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
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
function extractJson(text) {
  var a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; }
}

var OFFICIAL = /(^|\.)(gov\.in|nic\.in|ibps\.in|ac\.in|edu\.in|india\.gov\.in)$/;
function cleanS(v, n) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''; }
function okDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
/* Live search: Claude searches the web for current openings and exams, and the worker keeps only items whose link really appeared in the search results. */
async function doSearch(s, request, env, origin) {
  if (await overLimit(request, env, 's', '3', '60')) return json({ error: 'daily_limit' }, 429, origin);
  var today = new Date().toISOString().slice(0, 10);
  var prof = ['Education: ' + cleanS(s.level, 80), s.stream ? 'Stream: ' + cleanS(s.stream, 40) : '', 'State: ' + (cleanS(s.state, 40) || 'Karnataka'), s.age ? 'Age: ' + (parseInt(s.age, 10) || '') : '', s.licence ? 'Has a driving licence: ' + cleanS(s.licence, 20) : ''].filter(Boolean).join('. ');
  var prompt = 'Today is ' + today + '. You help a job seeker in India. Profile: ' + prof + '.\nUse web search to find: (1) government jobs that are open to apply for right now and suit this profile, (2) government and entrance exams coming in the next 8 months that suit this profile, (3) private jobs in or near the profile\'s state that suit this education level. Prefer official sites (gov.in, nic.in, ibps.in and similar).\nRules: list only what you saw on a page in the search results, and use that page\'s own address as url. Never invent a date: use null if it is not on the page. Skip anything already closed. Up to 8 items in each list.\nReply with only this JSON: {"govt":[{"title":"","org":"","closes":"YYYY-MM-DD or null","line":"one short sentence","url":""}],"exams":[{"title":"","org":"","date":"YYYY-MM-DD or null","line":"","url":""}],"pvt":[{"title":"","org":"","place":"","line":"","url":""}]}';
  var msgs = [{ role: 'user', content: prompt }], seen = {}, text = '', u = { input_tokens: 0, output_tokens: 0, searches: 0 };
  var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 100000);
  try {
    for (var turn = 0; turn < 3; turn++) {
      var up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.MODEL || DEFAULT_MODEL, max_tokens: 4000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }], messages: msgs })
      });
      if (up.status === 429) { clearTimeout(timer); return json({ error: 'rate_limited' }, 429, origin); }
      if (!up.ok) { clearTimeout(timer); return json({ error: 'upstream', status: up.status }, 502, origin); }
      var d = await up.json();
      if (d.usage) { u.input_tokens += d.usage.input_tokens || 0; u.output_tokens += d.usage.output_tokens || 0; u.searches += (d.usage.server_tool_use && d.usage.server_tool_use.web_search_requests) || 0; }
      (d.content || []).forEach(function (c) {
        if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) c.content.forEach(function (r) { if (r && r.url) seen[r.url.split('#')[0]] = 1; });
        if (c.type === 'text') text += c.text;
      });
      if (d.stop_reason === 'pause_turn') { msgs.push({ role: 'assistant', content: d.content }); text = ''; continue; }
      break;
    }
  } catch (e) { clearTimeout(timer); return json({ error: 'upstream' }, 502, origin); }
  clearTimeout(timer);
  var o = extractJson(text);
  if (!o) return json({ error: 'unreadable', usage: u }, 422, origin);
  function keep(list, kind) {
    return (Array.isArray(list) ? list : []).map(function (x) {
      var url = cleanS(x && x.url, 400).split('#')[0], host = '';
      try { var uo = new URL(url); if (uo.protocol !== 'https:') return null; host = uo.hostname; } catch (e) { return null; }
      if (!seen[url]) return null;
      var it = { title: cleanS(x.title, 120), org: cleanS(x.org, 80), line: cleanS(x.line, 160), url: url, off: OFFICIAL.test(host) };
      if (!it.title) return null;
      if (kind === 'govt') { it.closes = okDate(x.closes); if (it.closes && it.closes < today) return null; }
      if (kind === 'exams') { it.date = okDate(x.date); if (it.date && it.date < today) return null; }
      if (kind === 'pvt') { it.place = cleanS(x.place, 60); it.off = false; }
      return it;
    }).filter(Boolean).slice(0, 8);
  }
  return json({ ok: true, found: { govt: keep(o.govt, 'govt'), exams: keep(o.exams, 'exams'), pvt: keep(o.pvt, 'pvt') }, usage: u }, 200, origin);
}

export default {
  async fetch(request, env) {
    var origin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'bad_request' }, 405, origin);
    var reqOrigin = request.headers.get('Origin');
    if (reqOrigin && reqOrigin !== origin) return json({ error: 'forbidden' }, 403, origin);
    if (env.APP_KEY && request.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: 'forbidden' }, 403, origin);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 500, origin);

    var body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400, origin); }
    if (body && body.search) return doSearch(body.search, request, env, origin);
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
  }
};
