(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var TODAY = (function () { var t = window.__TODAY || new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); })();
var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
function pd(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
function addMonths(d, m) { return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()); }
function monthsBetween(a, b) { var m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--; return m; }
function daysBetween(a, b) { return Math.round((b - a) / 864e5); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ================= facts ================= */
var YN = [['yes', 'Yes'], ['no', 'No']];
var FACTS = [
  { k: 'dob', g: 'Identity', l: 'Date of birth', type: 'date', why: 'age limits' },
  { k: 'gender', g: 'Identity', l: 'Gender', type: 'select', o: [['f', 'Girl / woman'], ['m', 'Boy / man'], ['o', 'Prefer not to say']], why: 'posts for women' },
  { k: 'state', g: 'Identity', l: 'Home state', type: 'select', o: [['Karnataka', 'Karnataka'], ['other', 'Another state']], why: 'state records' },
  { k: 'board', g: 'Class 10', l: 'Board', type: 'select', o: [['CBSE', 'CBSE'], ['ICSE', 'ICSE'], ['Karnataka SSLC', 'Karnataka SSLC'], ['Other state board', 'Other state board']], why: 'PUC admission' },
  { k: 'examYear', g: 'Class 10', l: 'Year of exam', type: 'number', min: 1960, max: 2035, why: '' },
  { k: 'pct', g: 'Class 10', l: 'Total percentage', type: 'number', step: 0.1, min: 0, max: 100, why: 'marks-based selection' },
  { k: 'passed', g: 'Class 10', l: 'Passed Class 10', type: 'select', o: YN, why: 'basic eligibility' },
  { k: 'core', g: 'Class 10', l: 'Passed Maths, Science and English', type: 'select', o: YN, why: 'diploma and post rules' },
  { k: 'stage', g: 'Now', l: 'Where are you now', type: 'select', o: [['done', 'Just finished 10th'], ['in', 'In 1st PUC, diploma or ITI'], ['out', 'Finished 10th earlier, not studying']], why: 'scholarships' },
  { k: 'cat', g: 'Eligibility', l: 'Category', type: 'select', o: [['General', 'General / EWS'], ['OBC', 'OBC'], ['SC', 'SC'], ['ST', 'ST']], why: 'reservations and scholarships' },
  { k: 'minority', g: 'Eligibility', l: 'Notified minority community', type: 'select', o: YN, why: 'minority scholarships' },
  { k: 'income', g: 'Eligibility', l: 'Family income a year', type: 'select', o: [['100000', 'Up to ₹1 lakh'], ['250000', '₹1 to 2.5 lakh'], ['350000', '₹2.5 to 3.5 lakh'], ['800000', '₹3.5 to 8 lakh'], ['9999999', 'Above ₹8 lakh']], why: 'income limits' },
  { k: 'school', g: 'Eligibility', l: 'School type', type: 'select', o: [['govt', 'Government'], ['aided', 'Government-aided'], ['private', 'Private']], why: 'NMMSS' },
  { k: 'nmms', g: 'Eligibility', l: 'Qualified Class 8 NMMS exam', type: 'select', o: YN, why: 'NMMSS' }
];
var FD = {}; FACTS.forEach(function (f) { FD[f.k] = f; });
function showVal(k, v) {
  var f = FD[k]; if (!f) return String(v);
  if (f.type === 'select') { for (var i = 0; i < f.o.length; i++) if (f.o[i][0] === String(v)) return f.o[i][1]; }
  if (k === 'dob') { return fmt(pd(v)); }
  if (k === 'pct') return Number(v).toFixed(1) + '%';
  return String(v);
}

/* ================= storage ================= */
var APPVER = '4';
var CFG = window.PA_CONFIG || {};
var KEY = 'pa10.db.v2';
var DB = { profiles: [], active: null };
function load() { try { var r = localStorage.getItem(KEY); if (r) { var o = JSON.parse(r); if (o && o.profiles) DB = o; } } catch (e) {} }
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Could not save on this phone. Free some space and try again.'); } }
function prof() { for (var i = 0; i < DB.profiles.length; i++) if (DB.profiles[i].id === DB.active) return DB.profiles[i]; return null; }
function F() { var p = prof(), o = {}; if (!p) return o; for (var k in p.facts) o[k] = p.facts[k].v; return o; }
function setFact(k, v, src) {
  var p = prof(); if (!p) return;
  if (v === '' || v === null || v === undefined) { delete p.facts[k]; } else { p.facts[k] = { v: String(v), src: src || 'typed', at: Date.now() }; }
  save();
}
function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200); }

/* ================= rule engine ================= */
function R(s, t, d, x) { var o = { s: s, t: t, d: d || '' }; if (x) for (var k in x) o[k] = x[k]; return o; }
function ageM(f) { return f.dob ? monthsBetween(pd(f.dob), TODAY) : null; }
function ageText(m) { return Math.floor(m / 12) + ' years ' + (m % 12) + ' months'; }
function ruleAge(sp, f) {
  var m = ageM(f), min = sp.min, max = sp.max;
  var lab = 'Age ' + (max ? lab2(min) + ' to ' + max : min + ' or older');
  function lab2(x) { return x === 17.5 ? '17½' : x; }
  if (m === null) return R('unsure', lab, 'Add your date of birth to check this.', { needs: 'dob' });
  var fmin = sp.failMin !== undefined ? sp.failMin : min, fmax = sp.failMax !== undefined ? sp.failMax : max;
  if (m < fmin * 12) { var fr = addMonths(pd(f.dob), Math.round(min * 12)); return R('fail', lab, 'You are ' + ageText(m) + '. You reach ' + lab2(min) + ' on ' + fmt(fr) + '.', { from: fr }); }
  if (max && m > fmax * 12) {
    if (sp.relax && (f.cat === 'OBC' || f.cat === 'SC' || f.cat === 'ST')) return R('unsure', lab, 'Above the general limit. Reserved categories get extra years; the amount was not in my source.');
    if (sp.relax && !f.cat) return R('unsure', lab, 'Above the general limit. Reserved categories get extra years. Add your category to check.', { needs: 'cat' });
    return R('fail', lab, 'You are ' + ageText(m) + ', above the limit.');
  }
  if (sp.soft) return R('unsure', lab, 'You are ' + ageText(m) + '. The age limit was not in the page I read, so confirm it.');
  return R('pass', lab, 'You are ' + ageText(m) + '.');
}
function rule(sp, f) {
  var t = sp.t;
  if (t === 'age') return ruleAge(sp, f);
  if (t === 'passed') { if (f.passed === 'yes') return R('pass', 'Passed Class 10', 'Your profile shows a pass.'); if (f.passed === 'no') return R('fail', 'Passed Class 10', 'Your profile says Class 10 is not passed.'); return R('unsure', 'Passed Class 10', 'Add whether you passed.', { needs: 'passed' }); }
  if (t === 'core') { if (f.core === 'yes') return R('pass', sp.need, 'Your profile shows these subjects passed.'); if (f.core === 'no') return R('fail', sp.need, 'Your profile says one of them is not passed.'); return R('unsure', sp.need, 'Add whether you passed these subjects.', { needs: 'core' }); }
  if (t === 'merit') { var v = parseFloat(f.pct); return R('info', 'Chosen by Class 10 marks', 'Yours: ' + (isNaN(v) ? 'not added yet' : v.toFixed(1) + '%') + '.'); }
  if (t === 'pctmin') { var p = parseFloat(f.pct); if (isNaN(p)) return R('unsure', 'About ' + sp.min + '% overall', 'Add your percentage.', { needs: 'pct' }); return p >= sp.min ? R('pass', 'About ' + sp.min + '% overall', 'Yours is ' + p.toFixed(1) + '%.') : R('fail', 'About ' + sp.min + '% overall', 'Yours is ' + p.toFixed(1) + '%.'); }
  if (t === 'state') { if (!f.state) return R('unsure', 'Karnataka student', 'Add your home state.', { needs: 'state' }); return f.state === 'Karnataka' ? R('pass', 'Karnataka student', 'This record is for Karnataka.') : R('fail', 'Karnataka students only', 'Your home state is not Karnataka.'); }
  if (t === 'stage') { if (!f.stage) return R('unsure', 'Needs enrolment after 10th', 'Add where you are now.', { needs: 'stage' }); return f.stage === 'in' ? R('pass', 'Already enrolled', 'You are in Class 11, a diploma or an ITI.') : R('unsure', 'Needs enrolment after 10th', 'Applies once you are in Class 11, a diploma or an ITI.'); }
  if (t === 'cat') {
    if (sp.is === 'MIN') { if (!f.minority) return R('unsure', sp.name, 'Add whether you belong to a notified minority.', { needs: 'minority' }); return f.minority === 'yes' ? R('pass', sp.name, 'Your profile matches.') : R('fail', sp.name, 'Your profile says no.'); }
    if (!f.cat) return R('unsure', sp.name, 'Add your category.', { needs: 'cat' });
    return f.cat === sp.is ? R('pass', sp.name, 'Your category matches.') : R('fail', sp.name, 'Your category is ' + showVal('cat', f.cat) + '.');
  }
  if (t === 'catAny') { if (!f.cat) return R('unsure', 'SC, ST, OBC or minority', 'Add your category.', { needs: 'cat' }); var ok = f.cat === 'SC' || f.cat === 'ST' || f.cat === 'OBC' || f.minority === 'yes'; if (ok) return R('pass', 'SC, ST, OBC or minority', 'Your category fits at least one scheme.'); if (!f.minority) return R('unsure', 'SC, ST, OBC or minority', 'Add whether you belong to a notified minority.', { needs: 'minority' }); return R('fail', 'SC, ST, OBC or minority', 'Your category is ' + showVal('cat', f.cat) + '.'); }
  if (t === 'income') {
    var lab = sp.known ? 'Family income up to ₹' + (sp.max / 100000) + ' lakh' : 'Income limit';
    if (!f.income) return R('unsure', lab, 'Add your income band to check this.', { needs: 'income' });
    if (!sp.known) return R('unsure', lab, 'The limit was not in my source. Your band is shown on your profile.');
    return parseInt(f.income, 10) <= sp.max ? R('pass', lab, 'Your band is within this limit.') : R('fail', lab, 'Your band is above this limit.');
  }
  if (t === 'nmms') { if (f.nmms === 'yes') return R('pass', 'Qualified the Class 8 NMMS exam', 'Your profile says yes. Renew on the portal.'); if (f.nmms === 'no') return R('fail', 'Qualified the Class 8 NMMS exam', 'Your profile says no.'); return R('unsure', 'Qualified the Class 8 NMMS exam', 'Add this, or check with your school.', { needs: 'nmms' }); }
  if (t === 'school') { if (!f.school) return R('unsure', 'Government or aided school', 'Add your school type.', { needs: 'school' }); return f.school === 'private' ? R('fail', 'Government or aided school', 'Your school is private.') : R('pass', 'Government or aided school', 'Your school is ' + showVal('school', f.school).toLowerCase() + '.'); }
  if (t === 'gender') { if (!f.gender) return R('unsure', sp.title, sp.detail + ' Add your gender to check.', { needs: 'gender' }); if (f.gender === 'o') return R('unsure', sp.title, sp.detail); return f.gender === sp.is ? R('pass', sp.title, sp.detail) : R('fail', sp.title, sp.detail); }
  if (t === 'board') { if (!f.board) return R('unsure', sp.is, 'Add your board.', { needs: 'board' }); return f.board === sp.is ? R('pass', 'Karnataka SSLC', 'Matches the board named in the source.') : R('unsure', 'Board equivalence', 'The source speaks of Karnataka SSLC. Confirm ' + f.board + ' with the college.'); }
  if (t === 'static') return R(sp.s, sp.title, sp.detail);
  return R('unsure', 'Rule', 'Unknown rule.');
}
function status(r) {
  if (r.closes) { var c = pd(r.closes), d = daysBetween(TODAY, c); if (d >= 0) return { k: 'open', t: 'Open until ' + fmt(c) + (d <= 14 ? ' (' + (d === 0 ? 'today' : d + (d === 1 ? ' day' : ' days') + ' left') + ')' : '') }; return { k: 'closed', t: 'Closed ' + fmt(c) }; }
  return r.stat || { k: 'unk', t: 'Dates not confirmed' };
}
function evaluate(r, f) {
  var st = status(r), rules = (r.rules || []).map(function (s) { return rule(s, f); }), verdict = 'yes', from = null;
  rules.forEach(function (x) { if (x.s === 'fail') verdict = 'no'; else if (x.s === 'unsure' && verdict === 'yes') verdict = 'check'; if (x.from && (!from || x.from > from)) from = x.from; });
  if (r.later) verdict = 'later';
  var live = st.k === 'open' || st.k === 'exp', grp;
  if (r.later) grp = 4; else if (verdict === 'no') grp = 3; else if (!live) grp = 2; else grp = verdict === 'yes' ? 0 : 1;
  return { r: r, st: st, rules: rules, verdict: verdict, from: verdict === 'no' ? from : null, grp: grp };
}
window.__eval = function (facts) { return (DATA ? DATA.records : []).map(function (r) { var e = evaluate(r, facts); return { id: r.id, verdict: e.verdict, grp: e.grp, from: e.from ? fmt(e.from) : null }; }); };

/* ================= render: profile ================= */
var DATA = null;
var TAB = 'work';
function completion() { var f = F(), n = 0; FACTS.forEach(function (x) { if (f[x.k]) n++; }); return Math.round(n / FACTS.length * 100); }
function srcLabel(p, fct) { if (fct.src === 'typed') return 'You entered'; var d = (p.docs || []).filter(function (x) { return x.id === fct.src; })[0]; return d ? 'From ' + d.label : 'You entered'; }
function renderProfile() {
  var p = prof();
  if (!p) {
    $('app').innerHTML = '<div class="card empty"><h2 class="h2">Start a profile</h2><p>One profile for each person. It is built from their documents and stays on this phone.</p><button class="btn pri big" id="firstAdd" type="button">Add a person</button></div>';
    $('firstAdd').onclick = addPersonSheet; return;
  }
  var pc = completion();
  var docs = (p.docs || []).length ? '<ul class="docs">' + p.docs.map(function (d) { return '<li><span>' + esc(d.label) + '<small>Added ' + fmt(new Date(d.at)) + ' · ' + d.keys.length + ' details read</small></span><button class="btn sm danger" data-deldoc="' + d.id + '" type="button">Remove</button></li>'; }).join('') + '</ul>' : '<p class="note" style="margin-top:10px">No documents yet. Scan the Class 10 marksheet first.</p>';
  var groups = {}; FACTS.forEach(function (x) { (groups[x.g] = groups[x.g] || []).push(x); });
  var f = F();
  var facts = Object.keys(groups).map(function (g) {
    return '<div class="fgroup"><h3>' + g + '</h3>' + groups[g].map(function (x) {
      var fct = p.facts[x.k];
      return '<div class="fact"><div><div class="k">' + x.l + '</div>' + (fct ? '<div class="v">' + esc(showVal(x.k, fct.v)) + '</div><div class="src">' + esc(srcLabel(p, fct)) + '</div>' : '<div class="v none">Not added' + (x.why ? ' · used for ' + x.why : '') + '</div>') + '</div><button class="btn sm" data-edit="' + x.k + '" type="button">' + (fct ? 'Edit' : 'Add') + '</button></div>';
    }).join('') + '</div>';
  }).join('');
  $('app').innerHTML = '<div class="cols"><div class="stack">'
    + '<div class="card"><h2 class="h2">' + esc(p.name) + '</h2><div class="note" style="margin-top:2px">Profile ' + pc + '% complete</div><div class="meter" aria-hidden="true"><i style="width:' + pc + '%"></i></div>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="scanBtn" type="button">Scan a document</button><button class="btn big" id="goExplore" type="button">Explore</button></div>'
    + '<p class="note" style="margin-top:10px">Photos are not kept. Only the details you confirm are saved, and they stay on this phone.</p></div>'
    + '<div class="card"><h3 class="h3">Documents</h3>' + docs + '</div></div>'
    + '<div class="card"><h3 class="h3">Details</h3><p class="note" style="margin-top:2px">Tap Edit to correct anything. Every record on the Explore tab uses these.</p>' + facts + '</div></div>';
  $('scanBtn').onclick = scanSheet; $('goExplore').onclick = function () { location.hash = '#explore'; };
  Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (b) { b.onclick = function () { editSheet(b.getAttribute('data-edit')); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-deldoc]'), function (b) { b.onclick = function () { delDoc(b.getAttribute('data-deldoc')); }; });
}
function delDoc(id) {
  var p = prof(); var d = p.docs.filter(function (x) { return x.id === id; })[0]; if (!d) return;
  sheet('<h2>Remove ' + esc(d.label) + '?</h2><p class="note">This also removes the ' + d.keys.length + ' details read from it. Details you typed yourself stay.</p><div class="row" style="margin-top:16px"><button class="btn danger" id="yes" type="button">Remove</button><button class="btn" id="no" type="button">Keep</button></div>');
  $('no').onclick = closeSheet;
  $('yes').onclick = function () { d.keys.forEach(function (k) { if (p.facts[k] && p.facts[k].src === id) delete p.facts[k]; }); p.docs = p.docs.filter(function (x) { return x.id !== id; }); save(); closeSheet(); render(); };
}

/* ================= render: explore ================= */
var GROUPS = [
  ['Open now, and you appear to qualify', 'Start here. Confirm the details on the official site.'],
  ['Open, with a detail or two to check', 'Answer the questions above or read the notice.'],
  ['Not open right now', 'You look eligible, but there is no open window. Watch for the next notice.'],
  ['Not eligible yet', 'Sorted by the date you could first apply.'],
  ['Plan ahead: after Class 12', 'Dates shown are for students finishing 2nd PUC now. Yours will be later.']];
var VLAB = { yes: 'Likely eligible', check: 'Check details', no: 'Not eligible', later: 'After Class 12' };
function mark(s) { return s === 'pass' ? '✓' : s === 'fail' ? '✕' : s === 'unsure' ? '?' : '•'; }
function card(e) {
  var r = e.r;
  var rules = e.rules.map(function (x) { return '<li><i class="m ' + x.s + '" aria-hidden="true">' + mark(x.s) + '</i><span><b>' + esc(x.t) + '</b> <span>' + esc(x.d) + '</span></span></li>'; }).join('');
  var facts = r.facts.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('');
  var from = e.from ? '<div class="from">You can apply from ' + fmt(e.from) + '.</div>' : '';
  var link = r.link ? '<div class="note">Official site: <a href="' + r.link[1] + '" target="_blank" rel="noopener">' + esc(r.link[0]) + '</a></div>' : '';
  return '<article class="rec"><div class="rhead"><div><div class="pills"><span class="pill">' + esc(r.kind) + '</span><span class="pill ' + e.st.k + '">' + esc(e.st.t) + '</span></div><h3>' + esc(r.title) + '</h3><div class="org">' + esc(r.org) + '</div></div><span class="verdict v-' + e.verdict + '">' + VLAB[e.verdict] + '</span></div>'
    + '<p class="line">' + esc(r.line) + '</p>' + from + (rules ? '<ul class="rules">' + rules + '</ul>' : '') + '<dl class="facts">' + facts + '</dl>'
    + '<details><summary>Dates, source and how sure I am</summary><p>' + esc(r.cyc) + '</p><p>Source: <a href="' + r.src[1] + '" target="_blank" rel="noopener">' + esc(r.src[0]) + '</a>. Read on ' + esc(DATA.readOn) + '. Confidence: ' + r.conf + '. ' + esc(r.note) + '</p></details>' + link + '</article>';
}
function sortG(a, b) {
  if (a.grp === 3 && b.grp === 3) { var fa = a.from ? a.from.getTime() : 9e15, fb = b.from ? b.from.getTime() : 9e15; return fa - fb; }
  if (a.grp < 3) { var ca = a.st.k === 'open' ? pd(a.r.closes).getTime() : 9e15, cb = b.st.k === 'open' ? pd(b.r.closes).getTime() : 9e15; return ca - cb; }
  return 0;
}
function questions(list, f) {
  var count = {};
  list.forEach(function (e) { if (e.grp > 3) return; var seen = {}; e.rules.forEach(function (x) { if (x.s === 'unsure' && x.needs && !f[x.needs] && !seen[x.needs]) { seen[x.needs] = 1; count[x.needs] = (count[x.needs] || 0) + 1; } }); });
  return Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 4).map(function (k) { return { k: k, n: count[k] }; });
}
function ctl(x, val, id) {
  if (x.type === 'select') return '<select id="' + id + '"><option value="">Select</option>' + x.o.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  if (x.type === 'date') return '<input id="' + id + '" type="date" value="' + esc(val || '') + '">';
  return '<input id="' + id + '" type="number" inputmode="decimal" value="' + esc(val || '') + '"' + (x.step ? ' step="' + x.step + '"' : '') + (x.min !== undefined ? ' min="' + x.min + '"' : '') + (x.max !== undefined ? ' max="' + x.max + '"' : '') + '>';
}
function renderExplore() {
  var p = prof();
  if (!p) { renderProfile(); return; }
  var f = F(), all = DATA.records.map(function (r) { return evaluate(r, f); });
  var chips = [];
  if (f.board) chips.push(f.board + (f.examYear ? ' ' + f.examYear : ''));
  if (f.pct) chips.push(Number(f.pct).toFixed(1) + '%');
  var m = ageM(f); if (m !== null) chips.push('Age ' + Math.floor(m / 12) + 'y ' + (m % 12) + 'm');
  if (f.cat) chips.push(showVal('cat', f.cat));
  if (f.state) chips.push(f.state === 'other' ? 'Another state' : f.state);
  var tabs = [['work', 'Start working early'], ['study', 'Study further'], ['scholar', 'Scholarships']];
  var tabsH = tabs.map(function (t) { var n = all.filter(function (e) { return e.r.tab === t[0] && e.grp < 2; }).length; return '<button role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === TAB) + '">' + t[1] + '<span>' + n + ' open for you</span></button>'; }).join('');
  var list = all.filter(function (e) { return e.r.tab === TAB; });
  var h = '';
  var qs = questions(list, f);
  if (qs.length) {
    h += '<div class="q" style="margin-top:14px"><h3>Answer these to sharpen your results</h3>' + qs.map(function (q) { var x = FD[q.k]; return '<div class="qrow"><span>' + x.l + '<small>Settles ' + q.n + (q.n === 1 ? ' record' : ' records') + ' here</small></span><span class="in">' + ctl(x, '', 'q-' + q.k) + '</span></div>'; }).join('') + '</div>';
  }
  if (TAB === 'work') {
    var bt = '';
    if (m !== null && m < 18 * 12) { var nx = all.filter(function (e) { return e.r.tab === 'work' && e.from; }).sort(function (a, b) { return a.from - b.from; })[0]; bt = 'Most government jobs start at 18. You are ' + ageText(m) + '.' + (nx ? ' The first to open for your age is <b>' + esc(nx.r.title) + '</b>, from ' + fmt(nx.from) + '.' : '') + ' Before that, the routes that lead to paid work are an ITI or diploma with an apprenticeship. See <b>Study further</b>.'; }
    else if (m === null) bt = 'Add a date of birth so the age limits on these jobs can be checked.';
    if (f.state === 'other') bt += (bt ? ' ' : '') + 'Only Karnataka and central records are listed. Other states’ recruitments are not included.';
    if (bt) h += '<div class="banner">' + bt + '</div>';
  } else if (TAB === 'scholar') {
    h += '<div class="banner">Post-matric scholarships apply once you are enrolled in Class 11, a diploma or an ITI. Apply on the official portals only.</div>';
  }
  var any = false;
  [0, 1, 2, 3].forEach(function (g) { var items = list.filter(function (e) { return e.grp === g; }).sort(sortG); if (!items.length) return; any = true; h += '<section class="group"><h2>' + GROUPS[g][0] + ' <span class="note">(' + items.length + ')</span></h2><p class="gnote">' + GROUPS[g][1] + '</p><div class="recs">' + items.map(card).join('') + '</div></section>'; });
  var later = list.filter(function (e) { return e.grp === 4; });
  if (later.length) h += '<details class="later-toggle"><summary>' + GROUPS[4][0] + ' (' + later.length + ')</summary><p class="gnote" style="margin-top:4px">' + GROUPS[4][1] + '</p><div class="recs">' + later.map(card).join('') + '</div></details>';
  $('app').innerHTML = '<div class="row" style="justify-content:space-between"><div><h2 class="h2">Opportunities for ' + esc(p.name) + '</h2><div class="chips" style="margin-top:8px">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div></div></div>'
    + '<div class="sub" role="tablist">' + tabsH + '</div>' + h
    + '<p class="foot">Every record comes from a news or listing page read on ' + esc(DATA.readOn) + ', not from the official notice. Check dates, age limits and fees on the official website before you apply, and never pay an agent to apply. NTSE is not listed because it has not been held since 2021.</p>';
  Array.prototype.forEach.call(document.querySelectorAll('.sub button'), function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); try { sessionStorage.setItem('pa10.tab', TAB); } catch (e) {} renderExplore(); window.scrollTo(0, 0); }; });
  qs.forEach(function (q) { var el = $('q-' + q.k); el.onchange = function () { if (el.value) { setFact(q.k, el.value, 'typed'); renderExplore(); } }; });
}

/* ================= sheets ================= */
function sheet(html) { $('sheetin').innerHTML = html; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; }
function closeSheet() { stopCam(); $('sheet').hidden = true; $('sheetin').innerHTML = ''; document.body.style.overflow = ''; }
$('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) closeSheet(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

function addPersonSheet() {
  sheet('<h2>Add a person</h2><p class="note">A first name or nickname is enough. It stays on this phone.</p><label class="field">Name<input id="pn" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Asha"></label><div class="row" style="margin-top:16px"><button class="btn pri" id="pok" type="button">Add</button><button class="btn" id="pno" type="button">Cancel</button></div>');
  $('pno').onclick = closeSheet;
  $('pok').onclick = function () { var n = $('pn').value.trim(); if (!n) { $('pn').focus(); return; } var p = { id: uid(), name: n, created: Date.now(), facts: {}, docs: [] }; DB.profiles.push(p); DB.active = p.id; save(); closeSheet(); location.hash = '#profile'; render(); };
  setTimeout(function () { var e = $('pn'); if (e) e.focus(); }, 50);
}
function editSheet(k) {
  var x = FD[k], p = prof(), cur = p.facts[k] ? p.facts[k].v : '';
  sheet('<h2>' + x.l + '</h2>' + (x.why ? '<p class="note">Used for ' + x.why + '.</p>' : '') + '<label class="field">' + x.l + ctl(x, cur, 'ev') + '</label><div class="row" style="margin-top:16px"><button class="btn pri" id="eok" type="button">Save</button>' + (p.facts[k] ? '<button class="btn danger" id="edel" type="button">Clear</button>' : '') + '<button class="btn" id="eno" type="button">Cancel</button></div>');
  $('eno').onclick = closeSheet;
  $('eok').onclick = function () { var v = $('ev').value; if (v === '' ) { toast('Choose or type a value first.'); return; }
    if (k === 'dob') { var yy = parseInt(v.slice(0, 4), 10); if (!(yy >= 1930 && yy <= TODAY.getFullYear())) { toast('Check the year of birth.'); return; } } setFact(k, v, 'typed'); closeSheet(); render(); };
  if ($('edel')) $('edel').onclick = function () { setFact(k, '', ''); closeSheet(); render(); };
}
function menuSheet() {
  sheet('<h2>Backup and people</h2><p class="note">Profiles live only on this phone. If the phone is lost or its data is cleared, they are gone, so save a backup file now and then.</p>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri" id="bk" type="button">Save backup file</button><button class="btn" id="rs" type="button">Restore from file</button></div><input type="file" id="rsf" accept="application/json,.json" hidden>'
    + (prof() ? '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger" id="dp" type="button">Delete ' + esc(prof().name) + '’s profile</button>' : '')
    + '<p class="note" style="margin-top:16px">App version ' + APPVER + '. Records dated ' + esc(DATA ? DATA.version : '') + '.</p><div class="row" style="margin-top:10px"><button class="btn" id="mc" type="button">Close</button></div>');
  $('mc').onclick = closeSheet;
  $('bk').onclick = function () {
    var blob = new Blob([JSON.stringify({ app: 'path-after-10th', saved: new Date().toISOString(), db: DB }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'path-after-10th-backup-' + TODAY.toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Backup file saved to your downloads.');
  };
  $('rs').onclick = function () { $('rsf').click(); };
  $('rsf').onchange = function () {
    var fl = $('rsf').files[0]; if (!fl) return; var rd = new FileReader();
    rd.onload = function () { try { var o = JSON.parse(rd.result); var db = o.db || o; if (!db.profiles) throw 0; var ids = {}; DB.profiles.forEach(function (p) { ids[p.id] = 1; }); var n = 0; db.profiles.forEach(function (p) { if (!ids[p.id]) { DB.profiles.push(p); n++; } }); if (!DB.active && DB.profiles.length) DB.active = DB.profiles[0].id; save(); closeSheet(); render(); toast(n + ' profile' + (n === 1 ? '' : 's') + ' restored.'); } catch (e) { toast('That file is not a Path After 10th backup.'); } };
    rd.readAsText(fl);
  };
  if ($('dp')) $('dp').onclick = function () {
    var p = prof(); sheet('<h2>Delete ' + esc(p.name) + '’s profile?</h2><p class="note">This removes all their details from this phone. A backup file you saved earlier is not affected.</p><div class="row" style="margin-top:16px"><button class="btn danger" id="y" type="button">Delete</button><button class="btn" id="n" type="button">Keep</button></div>');
    $('n').onclick = closeSheet; $('y').onclick = function () { DB.profiles = DB.profiles.filter(function (x) { return x.id !== p.id; }); DB.active = DB.profiles.length ? DB.profiles[0].id : null; save(); closeSheet(); render(); };
  };
}

/* ================= scan ================= */
var stream = null;
function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
var DOCTYPES = [['m10', 'Class 10 marksheet'], ['birth', 'Birth certificate'], ['cat', 'Category (caste) certificate'], ['inc', 'Income certificate']];
var scan = { type: 'm10', canvas: null };
function scanSheet() {
  scan = { type: 'm10', canvas: null, local: false };
  sheet('<h2>Scan a document</h2><p class="note">Photograph it flat, in good light, with the whole page in the frame. The photo is not saved.</p>'
    + '<label class="field">What is it?<select id="dt">' + DOCTYPES.map(function (d) { return '<option value="' + d[0] + '">' + d[1] + '</option>'; }).join('') + '</select></label>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="cam" type="button">Open camera</button><button class="btn big" id="gal" type="button">Choose from gallery</button></div><input type="file" id="gf" accept="image/*" hidden>'
    + '<div id="sm"></div><div class="row" style="margin-top:16px"><button class="btn" id="sc" type="button">Cancel</button></div>');
  $('sc').onclick = closeSheet;
  $('dt').onchange = function () { scan.type = $('dt').value; };
  $('gal').onclick = function () { $('gf').click(); };
  $('gf').onchange = function () { var fl = $('gf').files[0]; if (fl) loadFile(fl); };
  $('cam').onclick = openCamera;
}
async function openCamera() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('sm').innerHTML = '<div class="status warn">The camera is not available here. Choose from gallery instead.</div>'; return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }); }
  catch (e) { $('sm').innerHTML = '<div class="status warn">The camera is blocked or not found. Allow camera access for this app in the browser, or choose from gallery.</div>'; return; }
  var dt = scan.type;
  sheet('<h2>Frame the document</h2><div class="cam"><video id="vid" autoplay playsinline muted></video></div><div class="row" style="margin-top:14px"><button class="btn pri big" id="snap" type="button">Take photo</button><button class="btn" id="cx" type="button">Cancel</button></div>');
  scan.type = dt;
  var v = $('vid'); v.srcObject = stream;
  $('cx').onclick = function () { scanSheet(); $('dt').value = dt; scan.type = dt; };
  $('snap').onclick = function () {
    var c = document.createElement('canvas'); c.width = v.videoWidth || 1280; c.height = v.videoHeight || 960; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    stopCam(); scan.canvas = c; review();
  };
}
function loadFile(fl) {
  var img = new Image(), u = URL.createObjectURL(fl);
  img.onload = function () { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(u); scan.canvas = c; review(); };
  img.onerror = function () { $('sm').innerHTML = '<div class="status err">That file could not be opened as an image.</div>'; };
  img.src = u;
}
function review() {
  var url = scan.canvas.toDataURL('image/jpeg', 0.6), dt = scan.type;
  sheet('<h2>Check the photo</h2><img class="prev" alt="Your photo" src="' + url + '"><p class="note" style="margin-top:8px">Is the text sharp and the whole page visible? If not, retake it.</p>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="rd" type="button">Read this document</button><button class="btn" id="rt" type="button">Retake</button></div><div id="sm"></div>');
  scan.type = dt;
  $('rt').onclick = function () { scanSheet(); $('dt').value = dt; scan.type = dt; };
  $('rd').onclick = readIt;
}
function prepCanvas(src) {
  var max = 2200, s = Math.min(1, max / Math.max(src.width, src.height)); var c = document.createElement('canvas'); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  var x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
  var d = x.getImageData(0, 0, c.width, c.height), a = d.data, lo = 255, hi = 0, i, g;
  for (i = 0; i < a.length; i += 4) { g = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) | 0; a[i] = a[i + 1] = a[i + 2] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
  var span = Math.max(1, hi - lo); for (i = 0; i < a.length; i += 4) { g = ((a[i] - lo) * 255 / span) | 0; a[i] = a[i + 1] = a[i + 2] = g; }
  x.putImageData(d, 0, 0); return c;
}
async function ocr(canvas, onp) {
  var base = new URL('vendor/tesseract/', location.href).href;
  var w = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, logger: function (m) { if (m && typeof m.progress === 'number') onp(m.status, m.progress); } });
  try { var r = await w.recognize(canvas); return r.data.text || ''; } finally { try { await w.terminate(); } catch (e) {} }
}
async function readLocal() {
  var box = $('sm');
  box.innerHTML = '<div class="status"><span id="ps">Getting ready…</span><div class="bar"><i id="pb"></i></div></div>';
  $('rd').disabled = true; $('rt').disabled = true;
  try {
    var text = await ocr(prepCanvas(scan.canvas), function (st, p) { $('ps') && ($('ps').textContent = st === 'recognizing text' ? 'Reading the text…' : 'Getting ready…'); $('pb') && ($('pb').style.width = Math.round(p * 100) + '%'); });
    var props = parse(scan.type, text);
    confirmSheet(props, text);
  } catch (e) {
    $('rd').disabled = false; $('rt').disabled = false;
    box.innerHTML = '<div class="status err">Reading failed (' + esc(String(e && e.message || e)) + '). Try again with a clearer photo, or close this and add the details by hand.</div>';
  }
}

/* ---- reading: Claude through the server when set up, otherwise on this phone ---- */
function consented() { try { return localStorage.getItem('pa10.consent') === '1'; } catch (e) { return false; } }
function readIt() {
  var server = CFG.readerUrl && navigator.onLine !== false && !scan.local;
  if (!server) return readLocal();
  if (!consented()) return consentSheet();
  return readRemote();
}
function consentSheet() {
  sheet('<h2>Read this with Claude?</h2><p>To read the document accurately, the photo is sent over the internet to Claude, an AI service run by Anthropic. This app does not keep the photo. Only the details you tick afterwards are saved, and they stay on this phone.</p>'
    + '<p style="margin-top:10px"><b>If the person in the document is under 18, a parent or guardian must agree.</b></p>'
    + '<label class="field" style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="cg" style="width:22px;height:22px;flex:none"><span>I am an adult, or a parent or guardian agrees to this photo being read by Claude.</span></label>'
    + '<div class="row" style="margin-top:16px"><button class="btn pri big" id="cy" type="button" disabled>Agree and read</button><button class="btn" id="cl" type="button">Read on this phone instead</button><button class="btn" id="cn" type="button">Cancel</button></div>'
    + '<p class="note" style="margin-top:10px">Reading on this phone keeps the photo here but misses more details.</p>');
  var dt = scan.type;
  $('cg').onchange = function () { $('cy').disabled = !$('cg').checked; };
  $('cy').onclick = function () { try { localStorage.setItem('pa10.consent', '1'); } catch (e) {} review(); scan.type = dt; readRemote(); };
  $('cl').onclick = function () { scan.local = true; review(); scan.type = dt; readLocal(); };
  $('cn').onclick = function () { review(); scan.type = dt; };
}
function downscale(src, max) {
  var s = Math.min(1, max / Math.max(src.width, src.height)), c = document.createElement('canvas');
  c.width = Math.round(src.width * s); c.height = Math.round(src.height * s); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
}
function blobToB64(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(b); }); }
var SERR = { forbidden: 'The reading server refused this app. Tell whoever set it up.', not_configured: 'The reading server is not finished being set up.', too_large: 'The photo is too large. Retake it a little farther away.', rate_limited: 'Too many photos just now. Wait a minute and try again.', upstream: 'The reading service did not answer. Try again in a moment.', unreadable: 'The photo could not be read. Try a clearer photo.', bad_request: 'The app sent something the server did not understand.' };
async function readRemote() {
  var box = $('sm');
  box.innerHTML = '<div class="status"><span class="note">Reading with Claude. This takes about 10 to 30 seconds.</span><div class="bar"><i style="width:60%"></i></div></div>';
  $('rd').disabled = true; $('rt').disabled = true;
  var ctlr = new AbortController(), timer = setTimeout(function () { ctlr.abort(); }, 70000);
  try {
    var blob = await new Promise(function (r) { downscale(scan.canvas, 1800).toBlob(r, 'image/jpeg', 0.82); });
    var b64 = await blobToB64(blob);
    var res = await fetch(CFG.readerUrl, { method: 'POST', signal: ctlr.signal, headers: { 'Content-Type': 'application/json', 'X-App-Key': CFG.appKey || '' }, body: JSON.stringify({ type: scan.type, image: b64, mediaType: 'image/jpeg' }) });
    var j = null; try { j = await res.json(); } catch (e) {}
    clearTimeout(timer);
    if (!res.ok || !j || !j.ok) { var er = new Error((j && j.error) || 'upstream'); er.code = (j && j.error) || 'upstream'; throw er; }
    var m = mapServer(scan.type, j.data);
    if (m.notDoc) { $('rd').disabled = false; $('rt').disabled = false; box.innerHTML = '<div class="status warn">This does not look like the document you chose. Check the type, or retake the photo.</div>'; return; }
    confirmSheet(m.props, '', m.notes);
  } catch (e) {
    clearTimeout(timer);
    $('rd').disabled = false; $('rt').disabled = false;
    var msg = e && e.name === 'AbortError' ? 'The reading took too long.' : (SERR[e && e.code] || 'Could not reach the reading server. Check your internet.');
    box.innerHTML = '<div class="status err">' + esc(msg) + '</div><div class="row" style="margin-top:10px"><button class="btn" id="loc" type="button">Read on this phone instead</button></div><p class="note" style="margin-top:6px">Reading on this phone misses more details.</p>';
    var dt = scan.type; $('loc').onclick = function () { scan.local = true; review(); scan.type = dt; readLocal(); };
  }
}
function mapServer(type, d) {
  var P = [], notes = (d.notes || []).filter(function (x) { return typeof x === 'string'; }).slice(0, 5);
  function add(k, v, conf, note) { P.push({ k: k, v: String(v), conf: conf, note: note || '' }); }
  if (d.isDocument === false) return { notDoc: true };
  if (type === 'birth') { if (validDob(d.dob)) add('dob', d.dob, 'read', 'Check the day and month.'); return { props: P, notes: notes }; }
  if (type === 'cat') {
    if (d.category === 'SC' || d.category === 'ST' || d.category === 'OBC' || d.category === 'General') add('cat', d.category, 'read', d.categoryText ? 'The certificate says: ' + d.categoryText : '');
    return { props: P, notes: notes };
  }
  if (type === 'inc') {
    var n = Number(d.annualIncomeRupees);
    if (n > 0) { var band = n <= 100000 ? '100000' : n <= 250000 ? '250000' : n <= 350000 ? '350000' : n <= 800000 ? '800000' : '9999999'; add('income', band, 'read', 'The certificate says ₹' + n.toLocaleString('en-IN') + ' a year. Check the band.'); }
    return { props: P, notes: notes };
  }
  var boards = ['CBSE', 'ICSE', 'Karnataka SSLC', 'Other state board'];
  if (boards.indexOf(d.board) >= 0) add('board', d.board, 'read');
  if (typeof d.examYear === 'number' && d.examYear >= 1960 && d.examYear <= TODAY.getFullYear()) add('examYear', d.examYear, 'read');
  if (validDob(d.dob)) add('dob', d.dob, 'read', 'Check the day and month. Some marksheets do not print a birth date; if so, use the birth certificate.');
  if (d.result === 'pass') add('passed', 'yes', 'read'); else if (d.result === 'fail') { add('passed', 'no', 'guess', 'The sheet seems to show a fail.'); }
  var subs = (d.subjects || []).filter(function (s) { return s && s.name; }), sumO = 0, sumM = 0, cnt = 0;
  subs.forEach(function (s) { if (typeof s.obtained === 'number') { sumO += s.obtained; cnt++; } if (typeof s.max === 'number') sumM += s.max; });
  var tO = typeof d.totalObtained === 'number' ? d.totalObtained : (cnt ? sumO : null), tM = typeof d.totalMax === 'number' ? d.totalMax : (sumM || null);
  var pc = null, pconf = 'read', pnote = '';
  if (tO !== null && tM) { pc = Math.round(tO / tM * 1000) / 10; pnote = 'Read ' + tO + ' of ' + tM + '.'; }
  else if (typeof d.printedPercentage === 'number') { pc = d.printedPercentage; pnote = 'The sheet prints this percentage.'; }
  else if (d.gradeSystem === 'cgpa' || typeof d.cgpa === 'number') { notes.push('This sheet gives a CGPA' + (typeof d.cgpa === 'number' ? ' of ' + d.cgpa : '') + ', not marks. Enter the percentage your board states for it, or leave it blank.'); }
  if (typeof d.totalObtained === 'number' && cnt && Math.abs(sumO - d.totalObtained) > 0) { pconf = 'guess'; notes.push('The subject marks add up to ' + sumO + ', but the printed total is ' + d.totalObtained + '. A subject may be counted separately, or one value was misread.'); }
  if (pc !== null && (pc <= 0 || pc > 100)) { notes.push('The percentage came out as ' + pc + ', which cannot be right.'); pc = null; }
  if (pc !== null) add('pct', pc, pconf, pnote + (pconf === 'guess' ? ' Check it.' : ''));
  var has = function (re) { return subs.some(function (s) { return re.test(s.name); }); };
  if (subs.length && has(/math/i) && has(/scien|physic|chem|bio/i) && has(/engl/i) && d.result === 'pass') add('core', 'yes', 'guess', 'Found Maths, Science and English with a pass. Check that each was passed.');
  else if (subs.length) notes.push('Maths, Science and English were not all found in the subject list. Set that answer yourself.');
  return { props: P, notes: notes };
}
function validDob(v) { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; var y = +v.slice(0, 4); return y >= 1940 && y <= 2014; }

/* ---- parsing (every value is only a proposal until the person confirms it) ---- */
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function two(n) { return (n < 10 ? '0' : '') + n; }
function findDob(text) {
  var lines = text.split(/\n/), best = null, re1 = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})/, re2 = /(\d{1,2})\s*(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.\-]*((?:19|20)\d{2})/i;
  function ok(y, m, d) { return y >= 1940 && y <= 2014 && m >= 1 && m <= 12 && d >= 1 && d <= 31; }
  for (var i = 0; i < lines.length; i++) {
    var near = /birth|dob|d\.o\.b/i.test(lines[i]) || (i > 0 && /birth|dob|d\.o\.b/i.test(lines[i - 1]));
    var m = lines[i].match(re1), d2 = lines[i].match(re2), y, mo, dd;
    if (m) { dd = +m[1]; mo = +m[2]; y = +m[3]; if (ok(y, mo, dd)) { var c = { v: y + '-' + two(mo) + '-' + two(dd), conf: near ? 'read' : 'guess' }; if (near) return c; if (!best) best = c; } }
    if (d2) { dd = +d2[1]; mo = MONTHS[d2[2].toLowerCase()]; y = +d2[3]; if (ok(y, mo, dd)) { var c2 = { v: y + '-' + two(mo) + '-' + two(dd), conf: near ? 'read' : 'guess' }; if (near) return c2; if (!best) best = c2; } }
  }
  return best;
}
function parse(type, text) {
  var P = [], t = text.replace(/[|_]/g, ' ');
  function add(k, v, conf, note) { P.push({ k: k, v: String(v), conf: conf, note: note || '' }); }
  if (type === 'birth') { var d0 = findDob(t); if (d0) add('dob', d0.v, d0.conf, 'Check the day and month.'); return P; }
  if (type === 'cat') {
    if (/scheduled\s+tribe/i.test(t)) add('cat', 'ST', 'read', 'Found "Scheduled Tribe".');
    else if (/scheduled\s+caste/i.test(t)) add('cat', 'SC', 'read', 'Found "Scheduled Caste".');
    else if (/other\s+backward|\bobc\b|category\s*[-:]?\s*(?:1|2a|2b|3a|3b)\b|backward\s+class/i.test(t)) add('cat', 'OBC', 'guess', 'Found a backward class term. Check the exact category.');
    return P;
  }
  if (type === 'inc') {
    var im = t.match(/income[^0-9₹]{0,60}(?:rs\.?|inr|₹)?\s*([0-9][0-9,\.]{3,9})/i);
    if (im) { var n = parseInt(im[1].replace(/[,\.]/g, ''), 10); if (n > 0) { var band = n <= 100000 ? '100000' : n <= 250000 ? '250000' : n <= 350000 ? '350000' : n <= 800000 ? '800000' : '9999999'; add('income', band, 'guess', 'Read ₹' + n.toLocaleString('en-IN') + ' a year. Check the band.'); } }
    return P;
  }
  /* Class 10 marksheet */
  if (/central\s+board\s+of\s+secondary|\bcbse\b/i.test(t)) add('board', 'CBSE', 'read');
  else if (/council\s+for\s+the\s+indian\s+school|\bicse\b|\bcisce\b/i.test(t)) add('board', 'ICSE', 'read');
  else if (/karnataka\s+(?:school\s+)?(?:secondary\s+)?(?:education|examination)|\bsslc\b|\bkseab\b|\bkseeb\b/i.test(t)) add('board', 'Karnataka SSLC', 'read');
  else if (/board\s+of\s+(?:secondary|school)|secondary\s+education/i.test(t)) add('board', 'Other state board', 'guess');
  var yrs = (t.match(/\b(?:19[6-9]\d|20[0-3]\d)\b/g) || []).map(Number).filter(function (y) { return y <= TODAY.getFullYear() && y >= 1960; });
  var yl = t.split(/\n/).filter(function (l) { return /exam|march|april|result|issued|year/i.test(l); }).join(' ').match(/\b(?:19[6-9]\d|20[0-3]\d)\b/g);
  if (yl) { var yy = Math.max.apply(null, yl.map(Number).filter(function (y) { return y <= TODAY.getFullYear() && y >= 1960; }).concat([0])); if (yy) add('examYear', yy, 'guess', 'Check the year.'); }
  else if (yrs.length) add('examYear', Math.max.apply(null, yrs), 'guess', 'Check the year.');
  var dob = findDob(t); if (dob) add('dob', dob.v, dob.conf, 'Check the day and month.');
  var pass = /\b(pass|passed|qualified|successful)\b/i.test(t) && !/\b(fail|failed|essential\s+repeat|compartment)\b/i.test(t);
  if (pass) add('passed', 'yes', 'guess', 'Found the word "pass".'); else if (/\b(fail|failed)\b/i.test(t)) add('passed', 'no', 'guess', 'Found the word "fail". Check the sheet.');
  /* total and percentage */
  var pm = t.match(/(\d{2,3}(?:\.\d{1,2})?)\s*%/), got = null;
  var lines = t.split(/\n/);
  for (var i = 0; i < lines.length && !got; i++) {
    if (/grand\s*total|total\s*marks|aggregate|\btotal\b/i.test(lines[i])) {
      var nums = (lines[i].match(/\d{2,4}/g) || []).map(Number);
      for (var a = 0; a < nums.length - 1; a++) { if (nums[a] <= nums[a + 1] && nums[a + 1] >= 100 && nums[a + 1] <= 1000 && nums[a + 1] % 5 === 0 && nums[a] > 0) { got = [nums[a], nums[a + 1]]; break; } }
    }
  }
  if (got) { var pv = Math.round(got[0] / got[1] * 1000) / 10; if (pv > 0 && pv <= 100) add('pct', pv, 'guess', 'Read ' + got[0] + ' of ' + got[1] + '. Check the percentage.'); }
  else if (pm && +pm[1] > 0 && +pm[1] <= 100) add('pct', pm[1], 'guess', 'Read a percentage on the sheet. Check it.');
  var hasM = /math/i.test(t), hasS = /scien|physic|chem/i.test(t), hasE = /engl/i.test(t);
  if (hasM && hasS && hasE && pass) add('core', 'yes', 'guess', 'Found Maths, Science and English with a pass.');
  return P;
}
function confirmSheet(props, text, notes) {
  var rows = props.map(function (p, i) {
    var x = FD[p.k];
    return '<div class="prop"><input type="checkbox" id="pc' + i + '" checked aria-label="Use ' + x.l + '"><div class="main2"><b>' + x.l + '</b><span class="tag ' + p.conf + '">' + (p.conf === 'read' ? 'read clearly' : 'please check') + '</span>' + '<div style="margin-top:6px">' + ctl(x, p.v, 'pv' + i) + '</div>' + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div></div>';
  }).join('');
  sheet('<h2>' + (props.length ? 'Check what was read' : 'Nothing could be read') + '</h2>'
    + ((notes && notes.length) ? '<div class="status warn"><b>Please check:</b><ul style="margin:6px 0 0;padding-left:18px">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
    + (props.length ? '<p class="note">Untick anything that is wrong or fix it. Only ticked details are saved.</p>' + rows : '<div class="status warn">The text was too faint or the page was cut off. Retake the photo in better light, or close this and add the details by hand on the Profile screen.</div>')
    + (text ? '<details style="margin-top:12px"><summary class="note">What the phone read</summary><pre style="white-space:pre-wrap;font-size:12px;color:var(--muted);max-height:180px;overflow:auto">' + esc(text.trim().slice(0, 1500)) + '</pre></details>' : '')
    + '<div class="row" style="margin-top:16px">' + (props.length ? '<button class="btn pri big" id="ok" type="button">Save to profile</button>' : '') + '<button class="btn" id="back" type="button">' + (props.length ? 'Cancel' : 'Retake') + '</button></div>');
  $('back').onclick = props.length ? closeSheet : function () { scanSheet(); };
  if (props.length) $('ok').onclick = function () {
    var p = prof(), dt = DOCTYPES.filter(function (d) { return d[0] === scan.type; })[0], doc = { id: uid(), label: dt[1], at: Date.now(), keys: [] }, n = 0;
    props.forEach(function (pr, i) { if ($('pc' + i).checked) { var v = $('pv' + i).value; if (v !== '') { setFact(pr.k, v, doc.id); doc.keys.push(pr.k); n++; } } });
    if (!n) { toast('Nothing was ticked.'); return; }
    p.docs.push(doc); save(); closeSheet(); scan = { type: 'm10', canvas: null }; location.hash = '#profile'; render(); toast(n + ' detail' + (n === 1 ? '' : 's') + ' saved. Add the rest below.');
  };
}

/* ================= shell ================= */
function renderWho() {
  var s = $('whoSel');
  s.innerHTML = DB.profiles.length ? DB.profiles.map(function (p) { return '<option value="' + p.id + '"' + (p.id === DB.active ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') : '<option>No one yet</option>';
  s.disabled = !DB.profiles.length;
}
function render() {
  var h = location.hash.replace('#', '') === 'explore' ? 'explore' : 'profile';
  $('nav-profile').setAttribute('aria-current', h === 'profile' ? 'page' : 'false'); $('nav-explore').setAttribute('aria-current', h === 'explore' ? 'page' : 'false');
  renderWho();
  if (h === 'explore') renderExplore(); else renderProfile();
}
window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
$('whoSel').onchange = function () { DB.active = $('whoSel').value; save(); render(); };
$('addPerson').onclick = addPersonSheet;
$('menuBtn').onclick = menuSheet;

load();
try { TAB = sessionStorage.getItem('pa10.tab') || 'work'; } catch (e) {}
if (!DB.active && DB.profiles.length) DB.active = DB.profiles[0].id;
fetch('data/records.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d; render(); }).catch(function () { $('app').innerHTML = '<div class="card empty"><h2 class="h2">Could not load the records</h2><p>Connect to the internet once and reopen the app.</p></div>'; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(function (r) { r.update(); }).catch(function () {});
}
window.__app = { DB: function () { return DB; }, parse: parse, findDob: findDob };
})();
