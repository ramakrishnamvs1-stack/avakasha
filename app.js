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
  { k: 'nmms', g: 'Eligibility', l: 'Qualified Class 8 NMMS exam', type: 'select', o: YN, why: 'NMMSS' },
  { k: 'board12', g: 'Class 12', l: 'Class 12 board', type: 'select', o: [['Karnataka PUC', 'Karnataka PUC'], ['CBSE', 'CBSE'], ['ICSE', 'ICSE / ISC'], ['Other board', 'Other board']], why: 'courses after Class 12' },
  { k: 'year12', g: 'Class 12', l: 'Year of Class 12 exam', type: 'number', min: 1960, max: 2035, why: '' },
  { k: 'pct12', g: 'Class 12', l: 'Class 12 total percentage', type: 'number', step: 0.1, min: 0, max: 100, why: 'marks-based rules' },
  { k: 'passed12', g: 'Class 12', l: 'Passed Class 12', type: 'select', o: YN, why: 'basic eligibility' },
  { k: 'stream12', g: 'Class 12', l: 'Class 12 subjects', type: 'select', o: [['pcm', 'Science: Physics, Chemistry, Maths'], ['pcb', 'Science: Physics, Chemistry, Biology'], ['pcmb', 'Science: PCM and Biology'], ['sci', 'Science: another combination'], ['comm', 'Commerce'], ['arts', 'Arts / Humanities']], why: 'courses and entrance exams' },
  { k: 'lmv', g: 'Driving licence', l: 'Light vehicle (LMV) licence since', type: 'date', why: 'driver posts' },
  { k: 'hmv', g: 'Driving licence', l: 'Heavy vehicle (HMV) licence since', type: 'date', why: 'driver posts' },
  { k: 'badge', g: 'Driving licence', l: 'Public service badge', type: 'select', o: YN, why: 'driver posts' },
  { k: 'dlValid', g: 'Driving licence', l: 'Licence valid until', type: 'date', why: 'driver posts' }
];
var FD = {}; FACTS.forEach(function (f) { FD[f.k] = f; });
function showVal(k, v) {
  var f = FD[k]; if (!f) return String(v);
  if (f.type === 'select') { for (var i = 0; i < f.o.length; i++) if (f.o[i][0] === String(v)) return f.o[i][1]; }
  if (f.type === 'date') { return fmt(pd(v)); }
  if (k === 'pct' || k === 'pct12') return Number(v).toFixed(1) + '%';
  return String(v);
}

/* ================= storage ================= */
var APPVER = '30';
var CFG = window.PA_CONFIG || {};
var KEY = 'pa10.db.v2';
var DB = { profiles: [], active: null };
function load() { try { var r = localStorage.getItem(KEY); if (r) { var o = JSON.parse(r); if (o && o.profiles) DB = o; } } catch (e) {} }
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Could not save on this phone. Free some space and try again.'); } }
function prof() { for (var i = 0; i < DB.profiles.length; i++) if (DB.profiles[i].id === DB.active) return DB.profiles[i]; return null; }
function jobsOf(p) { return (p && p.jobs) || []; }
function jobDone(j) { return !!(j.start && (j.end || j.current)); }
function expMonths(p) {
  var rs = jobsOf(p).filter(jobDone).map(function (j) { return [pd(j.start), j.end ? pd(j.end) : TODAY]; }).filter(function (r) { return r[1] >= r[0]; }).sort(function (a, b) { return a[0] - b[0]; });
  var tot = 0, cs = null, ce = null;
  rs.forEach(function (r) { if (!cs) { cs = r[0]; ce = r[1]; } else if (r[0] <= ce) { if (r[1] > ce) ce = r[1]; } else { tot += monthsBetween(cs, ce); cs = r[0]; ce = r[1]; } });
  if (cs) tot += monthsBetween(cs, ce);
  return tot;
}
function expText(m) { var y = Math.floor(m / 12), mo = m % 12; return (y ? y + (y === 1 ? ' year' : ' years') : '') + (y && mo ? ' ' : '') + (mo || !y ? mo + (mo === 1 ? ' month' : ' months') : ''); }
function F() { var p = prof(), o = {}; if (!p) return o; for (var k in p.facts) o[k] = p.facts[k].v; if (o.passed12 === 'yes' && !o.passed) o.passed = 'yes';
  if (jobsOf(p).some(jobDone)) o.exp = String(Math.round(expMonths(p) / 12 * 10) / 10); return o; }
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
  var asOn = sp.asOn ? pd(sp.asOn) : TODAY, who = sp.asOn ? 'On ' + fmt(asOn) + ' you will be ' : 'You are ';
  var m = f.dob ? monthsBetween(pd(f.dob), asOn) : null, min = sp.min, max = sp.max, byCat = sp.maxByCat && f.cat && sp.maxByCat[f.cat];
  var lab = 'Age ' + (max ? lab2(min) + ' to ' + max : min + ' or older') + (sp.asOn ? ' on ' + fmt(asOn) : '');
  function lab2(x) { return x === 17.5 ? '17½' : x; }
  if (m === null) return R('unsure', lab, 'No date of birth on your profile.', { needs: 'dob' });
  var eff = byCat || max, fmin = sp.failMin !== undefined ? sp.failMin : min, fmax = byCat ? byCat : (sp.failMax !== undefined ? sp.failMax : max);
  if (m < fmin * 12) { var fr = addMonths(pd(f.dob), Math.round(min * 12)); return R('fail', lab, who + ageText(m) + '. You reach ' + lab2(min) + ' on ' + fmt(fr) + '.', { from: fr }); }
  if (max && m > fmax * 12) {
    if (!byCat && sp.relax && (f.cat === 'OBC' || f.cat === 'SC' || f.cat === 'ST') && !sp.maxByCat) return R('unsure', lab, 'Above the general limit. Reserved categories get extra years; the amount was not in my source.');
    if (!byCat && sp.relax && !f.cat) return R('unsure', lab, 'Above the general limit. Reserved categories get extra years. No category on your profile.', { needs: 'cat' });
    return R('fail', lab, who + ageText(m) + ', above the limit' + (byCat ? ' of ' + byCat + ' for your category' : '') + '.');
  }
  if (sp.soft) return R('unsure', lab, who + ageText(m) + '. The age limit was not in the page I read, so confirm it.');
  return R('pass', lab, who + ageText(m) + (byCat ? '. The limit for your category is ' + byCat + '.' : '.'));
}
function rule(sp, f) {
  var t = sp.t;
  if (t === 'age') return ruleAge(sp, f);
  if (t === 'passed') { if (f.passed === 'yes') return R('pass', 'Passed Class 10', 'Your profile shows a pass.'); if (f.passed === 'no') return R('fail', 'Passed Class 10', 'Your profile says Class 10 is not passed.'); return R('unsure', 'Passed Class 10', 'Not on your profile.', { needs: 'passed' }); }
  if (t === 'core') { if (f.core === 'yes') return R('pass', sp.need, 'Your profile shows these subjects passed.'); if (f.core === 'no') return R('fail', sp.need, 'Your profile says one of them is not passed.'); return R('unsure', sp.need, 'Not on your profile.', { needs: 'core' }); }
  if (t === 'merit') { var v = parseFloat(f.pct); return R('info', 'Chosen by Class 10 marks', 'Yours: ' + (isNaN(v) ? 'not added yet' : v.toFixed(1) + '%') + '.'); }
  if (t === 'pctmin') { var p = parseFloat(f.pct); if (isNaN(p)) return R('unsure', 'About ' + sp.min + '% overall', 'No percentage on your profile.', { needs: 'pct' }); return p >= sp.min ? R('pass', 'About ' + sp.min + '% overall', 'Yours is ' + p.toFixed(1) + '%.') : R('fail', 'About ' + sp.min + '% overall', 'Yours is ' + p.toFixed(1) + '%.'); }
  if (t === 'state') { if (!f.state) return R('unsure', 'Karnataka student', 'No home state on your profile.', { needs: 'state' }); return f.state === 'Karnataka' ? R('pass', 'Karnataka student', 'This record is for Karnataka.') : R('fail', 'Karnataka students only', 'Your home state is not Karnataka.'); }
  if (t === 'stage') { if (!f.stage) return R('unsure', 'Needs enrolment after 10th', 'Not on your profile.', { needs: 'stage' }); return f.stage === 'in' ? R('pass', 'Already enrolled', 'You are in Class 11, a diploma or an ITI.') : R('unsure', 'Needs enrolment after 10th', 'Applies once you are in Class 11, a diploma or an ITI.'); }
  if (t === 'cat') {
    if (sp.is === 'MIN') { if (!f.minority) return R('unsure', sp.name, 'Not on your profile.', { needs: 'minority' }); return f.minority === 'yes' ? R('pass', sp.name, 'Your profile matches.') : R('fail', sp.name, 'Your profile says no.'); }
    if (!f.cat) return R('unsure', sp.name, 'No category on your profile.', { needs: 'cat' });
    return f.cat === sp.is ? R('pass', sp.name, 'Your category matches.') : R('fail', sp.name, 'Your category is ' + showVal('cat', f.cat) + '.');
  }
  if (t === 'catAny') { if (!f.cat) return R('unsure', 'SC, ST, OBC or minority', 'No category on your profile.', { needs: 'cat' }); var ok = f.cat === 'SC' || f.cat === 'ST' || f.cat === 'OBC' || f.minority === 'yes'; if (ok) return R('pass', 'SC, ST, OBC or minority', 'Your category fits at least one scheme.'); if (!f.minority) return R('unsure', 'SC, ST, OBC or minority', 'Not on your profile.', { needs: 'minority' }); return R('fail', 'SC, ST, OBC or minority', 'Your category is ' + showVal('cat', f.cat) + '.'); }
  if (t === 'income') {
    var lab = sp.known ? 'Family income up to ₹' + (sp.max / 100000) + ' lakh' : 'Income limit';
    if (!f.income) return R('unsure', lab, 'No income on your profile.', { needs: 'income' });
    if (!sp.known) return R('unsure', lab, 'The limit was not in my source. Your band is shown on your profile.');
    return parseInt(f.income, 10) <= sp.max ? R('pass', lab, 'Your band is within this limit.') : R('fail', lab, 'Your band is above this limit.');
  }
  if (t === 'nmms') { if (f.nmms === 'yes') return R('pass', 'Qualified the Class 8 NMMS exam', 'Your profile says yes. Renew on the portal.'); if (f.nmms === 'no') return R('fail', 'Qualified the Class 8 NMMS exam', 'Your profile says no.'); return R('unsure', 'Qualified the Class 8 NMMS exam', 'Not on your profile. Check with your school.', { needs: 'nmms' }); }
  if (t === 'school') { if (!f.school) return R('unsure', 'Government or aided school', 'Not on your profile.', { needs: 'school' }); return f.school === 'private' ? R('fail', 'Government or aided school', 'Your school is private.') : R('pass', 'Government or aided school', 'Your school is ' + showVal('school', f.school).toLowerCase() + '.'); }
  if (t === 'gender') { if (!f.gender) return R('unsure', sp.title, sp.detail + ' Gender is not on your profile.', { needs: 'gender' }); if (f.gender === 'o') return R('unsure', sp.title, sp.detail); return f.gender === sp.is ? R('pass', sp.title, sp.detail) : R('fail', sp.title, sp.detail); }
  if (t === 'board') { if (!f.board) return R('unsure', sp.is, 'No board on your profile.', { needs: 'board' }); return f.board === sp.is ? R('pass', 'Karnataka SSLC', 'Matches the board named in the source.') : R('unsure', 'Board equivalence', 'The source speaks of Karnataka SSLC. Confirm ' + f.board + ' with the college.'); }
  if (t === 'passed12') { if (f.passed12 === 'yes') return R('pass', 'Passed Class 12', 'Your profile shows a pass.'); if (f.passed12 === 'no') return R('fail', 'Passed Class 12', 'Your profile says Class 12 is not passed.'); return R('unsure', 'Passed Class 12', 'Not on your profile.', { needs: 'passed12' }); }
  if (t === 'pct12') {
    var lb = 'At least ' + sp.min + '% in Class 12';
    if (sp.exemptCat && f.cat && sp.exemptCat.indexOf(f.cat) >= 0) return R('pass', lb, 'No minimum for your category.');
    var v12 = parseFloat(f.pct12); if (isNaN(v12)) return R('unsure', lb, 'No Class 12 percentage on your profile.', { needs: 'pct12' });
    return v12 >= sp.min ? R('pass', lb, 'Yours is ' + v12.toFixed(1) + '%.') : (sp.exemptCat && !f.cat ? R('unsure', lb, 'Yours is ' + v12.toFixed(1) + '%. Some categories have no minimum, and no category is on your profile.', { needs: 'cat' }) : R('fail', lb, 'Yours is ' + v12.toFixed(1) + '%.'));
  }
  if (t === 'stream') {
    if (!f.stream12) return R('unsure', sp.title, 'No Class 12 subjects on your profile.', { needs: 'stream12' });
    return sp.any.indexOf(f.stream12) >= 0 ? R('pass', sp.title, 'Your Class 12 subjects: ' + showVal('stream12', f.stream12) + '.') : R('fail', sp.title, 'Your Class 12 subjects: ' + showVal('stream12', f.stream12) + '.');
  }
  if (t === 'dobrange') {
    var lbd = 'Born between ' + fmt(pd(sp.from)) + ' and ' + fmt(pd(sp.to));
    if (!f.dob) return R('unsure', lbd, 'No date of birth on your profile.', { needs: 'dob' });
    return (f.dob >= sp.from && f.dob <= sp.to) ? R('pass', lbd, 'Your date of birth is ' + fmt(pd(f.dob)) + '.') : R('fail', lbd, 'Your date of birth is ' + fmt(pd(f.dob)) + '. This window is for one intake; later intakes move it.');
  }
  if (t === 'lic') {
    var d0 = f[sp.cls], nm = sp.cls === 'hmv' ? 'Heavy vehicle licence' : 'Light vehicle licence';
    var ttl = sp.min ? nm + ' held for ' + sp.min + ' years' : nm;
    if (!d0) { return (f.lmv || f.hmv) ? R('unsure', ttl, 'Your licence on the profile does not show this class.', { needs: sp.cls }) : R('unsure', ttl, 'No driving licence on your profile.', { needs: sp.cls }); }
    if (f.dlValid && pd(f.dlValid) < TODAY) return R('unsure', ttl, 'Your licence shows it was valid until ' + fmt(pd(f.dlValid)) + '. Renew it first.');
    var held = monthsBetween(pd(d0), TODAY);
    if (!sp.min) return R('pass', ttl, 'You have held it since ' + fmt(pd(d0)) + '.');
    if (held >= sp.min * 12) return R('pass', ttl, 'You have held it since ' + fmt(pd(d0)) + ', about ' + expText(held) + '.');
    var fr2 = addMonths(pd(d0), sp.min * 12); return R('fail', ttl, 'You have held it for ' + expText(Math.max(held, 0)) + '. You reach ' + sp.min + ' years on ' + fmt(fr2) + '.', { from: fr2 });
  }
  if (t === 'flag') {
    var fv = f[sp.k]; if (fv === 'yes') return R('pass', sp.title, 'Your profile says yes.'); if (fv === 'no') return R('fail', sp.title, 'Your profile says no.');
    return R('unsure', sp.title, sp.detail || 'Not on your profile.', { needs: sp.k });
  }
  if (t === 'exp') {
    var yy = f.exp === undefined ? null : parseFloat(f.exp);
    if (sp.min === undefined) return R('info', sp.title || 'Driving or work experience', yy === null ? 'Yours: none added yet. A relieving or experience letter would show it here.' : 'Yours: about ' + yy + (yy === 1 ? ' year' : ' years') + ' in total.', yy === null ? { needs: 'exp' } : null);
    if (yy === null) return R('unsure', sp.min + ' years of experience', 'No work experience on your profile.', { needs: 'exp' });
    return yy >= sp.min ? R('pass', sp.min + ' years of experience', 'You have about ' + yy + ' years.') : R('fail', sp.min + ' years of experience', 'You have about ' + yy + ' years.');
  }
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
  var isLater = r.later && f.passed12 !== 'yes';
  if (isLater) verdict = 'later';
  var live = st.k === 'open', grp;
  if (isLater) grp = 4; else if (verdict === 'no') grp = 3; else if (!live) grp = 2; else grp = verdict === 'yes' ? 0 : 1;
  return { r: r, st: st, rules: rules, verdict: verdict, from: verdict === 'no' ? from : null, grp: grp };
}
window.__eval = function (facts) { return (DATA ? DATA.records : []).map(function (r) { var e = evaluate(r, facts); return { id: r.id, verdict: e.verdict, grp: e.grp, from: e.from ? fmt(e.from) : null }; }); };

/* ================= render: profile ================= */
var DATA = null;
var TAB = 'work';
var QOPEN = false;
var SHOWALL = false;
function completion() { var f = F(), n = 0, t = 0; FACTS.forEach(function (x) { if (x.g === 'Driving licence') return; t++; if (f[x.k]) n++; }); return Math.round(n / t * 100); }
function srcLabel(p, fct) { if (fct.src === 'typed') return 'You entered'; var d = (p.docs || []).filter(function (x) { return x.id === fct.src; })[0]; return d ? 'From ' + d.label : 'You entered'; }
function renderProfile() {
  var p = prof();
  if (!p) {
    $('app').innerHTML = '<div class="card empty"><h2 class="h2">Start a profile</h2><p>One profile for each person. It is built from their documents and stays on this phone.</p><button class="btn pri big" id="firstAdd" type="button">Add a person</button></div>';
    $('firstAdd').onclick = function () { addPersonSheet(false); }; return;
  }
  var nf = Object.keys(p.facts).length;
  var docs = (p.docs || []).length ? '<ul class="docs">' + p.docs.map(function (d) { return '<li><span>' + esc(d.label) + '<small>Added ' + fmt(new Date(d.at)) + ' · ' + (d.jobs ? d.jobs + (d.jobs === 1 ? ' job' : ' jobs') : d.keys.length + ' details') + ' read</small></span><button class="btn sm danger" data-deldoc="' + d.id + '" type="button">Remove</button></li>'; }).join('') + '</ul>' : '<p class="note" style="margin-top:10px">No documents yet.</p>';
  var groups = {}; FACTS.forEach(function (x) { if (p.facts[x.k]) (groups[x.g] = groups[x.g] || []).push(x); });
  var f = F();
  var facts = Object.keys(groups).map(function (g) {
    return '<div class="fgroup"><h3>' + g + '</h3>' + groups[g].map(function (x) {
      var fct = p.facts[x.k];
      return '<div class="fact"><div><div class="k">' + x.l + '</div>' + '<div class="v">' + esc(showVal(x.k, fct.v)) + '</div><div class="src">' + esc(srcLabel(p, fct)) + '</div></div><button class="btn sm" data-edit="' + x.k + '" type="button">Edit</button></div>';
    }).join('') + '</div>';
  }).join('');
  $('app').innerHTML = '<div class="cols"><div class="stack">'
    + gapCard(p) + '<div class="card"><h2 class="h2">' + esc(p.name) + '</h2><div class="note" style="margin-top:2px">' + (nf ? nf + (nf === 1 ? ' detail' : ' details') + ' from what you added' : 'Nothing added yet') + '</div>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="scanBtn" type="button">Scan a document</button><button class="btn big" id="goExplore" type="button">Explore</button></div>'
    + '<p class="note" style="margin-top:10px">Photos are not kept. Only the details you confirm are saved, and they stay on this phone.</p></div>'
    + '<div class="card"><h3 class="h3">Documents</h3>' + docs + '</div>' + jobCard(p) + '</div>'
    + '<div class="card"><h3 class="h3">Details</h3><p class="note" style="margin-top:2px">' + (nf ? 'Only what you have added or confirmed is shown. Tap Edit to correct anything.' : 'Scan any document, or add a detail by hand. Only what you add is shown here.') + '</p>' + facts + '<div class="row" style="margin-top:12px"><button class="btn" id="addFact" type="button">Add a detail by hand</button><button class="btn" id="addJob" type="button">Add a job by hand</button></div></div></div>';
  wireGap(p); wireJobs(p); $('addFact').onclick = addFactSheet;
  $('scanBtn').onclick = scanFlow; $('goExplore').onclick = function () { location.hash = '#explore'; };
  Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (b) { b.onclick = function () { editSheet(b.getAttribute('data-edit')); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-deldoc]'), function (b) { b.onclick = function () { delDoc(b.getAttribute('data-deldoc')); }; });
}
function addFactSheet() {
  var p = prof(), left = FACTS.filter(function (x) { return !p.facts[x.k]; });
  if (!left.length) { toast('Every detail is already on the profile.'); return; }
  sheet('<h2>Add a detail</h2><label class="field">Which detail<select id="afk">' + left.map(function (x) { return '<option value="' + x.k + '">' + esc(x.l) + '</option>'; }).join('') + '</select></label><div id="afc"></div><div class="row" style="margin-top:16px"><button class="btn pri" id="afok" type="button">Save</button><button class="btn" id="afno" type="button">Cancel</button></div>');
  function draw() { var x = FD[$('afk').value]; $('afc').innerHTML = '<label class="field">' + esc(x.l) + ctl(x, '', 'afv') + '</label>'; }
  $('afk').onchange = draw; draw(); $('afno').onclick = closeSheet;
  $('afok').onclick = function () { var k = $('afk').value, v = $('afv').value; if (v === '') { toast('Choose or type a value first.'); return; } if (k === 'dob' && !(parseInt(v.slice(0, 4), 10) >= 1930 && parseInt(v.slice(0, 4), 10) <= TODAY.getFullYear())) { toast('Check the year of birth.'); return; } setFact(k, v, 'typed'); closeSheet(); render(); };
}
function delDoc(id) {
  var p = prof(); var d = p.docs.filter(function (x) { return x.id === id; })[0]; if (!d) return;
  sheet('<h2>Remove ' + esc(d.label) + '?</h2><p class="note">This also removes the ' + (d.jobs ? d.jobs + (d.jobs === 1 ? ' job' : ' jobs') : d.keys.length + ' details') + ' read from it. Details you typed yourself stay.</p><div class="row" style="margin-top:16px"><button class="btn danger" id="yes" type="button">Remove</button><button class="btn" id="no" type="button">Keep</button></div>');
  $('no').onclick = closeSheet;
  $('yes').onclick = function () { d.keys.forEach(function (k) { if (p.facts[k] && p.facts[k].src === id) delete p.facts[k]; }); p.docs = p.docs.filter(function (x) { return x.id !== id; }); p.jobs = jobsOf(p).filter(function (j) { return j.docId !== id; }); save(); closeSheet(); render(); };
}


/* ================= missing details and work experience ================= */
var ESSENTIAL = [];
function gaps(p) {
  var f = F(), keys = ESSENTIAL.filter(function (k) { return !f[k]; }), jb = jobsOf(p).filter(function (j) { return !jobDone(j); });
  return { keys: keys, jobs: jb, n: keys.length + jb.length };
}
function gapCard(p) {
  var g = gaps(p); if (!g.n) return '';
  var li = g.keys.map(function (k) { return '<li>' + esc(FD[k].l) + ' <small>used for ' + esc(FD[k].why) + '</small></li>'; }).concat(g.jobs.map(function (j) { return '<li>Dates for ' + esc(j.role || 'a job') + ' <small>' + (j.start ? 'the end date is missing' : 'the start date is missing') + '</small></li>'; })).join('');
  return '<div class="q gap"><h3>' + (g.n === 1 ? 'A job is missing its dates' : g.n + ' jobs are missing dates') + '</h3><p class="note" style="margin-top:2px">Experience is counted from the dates.</p><ul class="gl">' + li + '</ul><div class="row" style="margin-top:10px"><button class="btn pri" id="gapBtn" type="button">Add now</button></div></div>';
}
function wireGap(p) { var b = $('gapBtn'); if (b) b.onclick = function () { fillSheet(p); }; }
function fillSheet(p) {
  var g = gaps(p);
  var rows = g.keys.map(function (k) { var x = FD[k]; return '<label class="field">' + esc(x.l) + '<small class="note">Used for ' + esc(x.why) + '</small>' + ctl(x, '', 'fg-' + k) + '</label>'; }).join('');
  var jr = g.jobs.map(function (j) { return '<div class="prop" style="display:block"><b>' + esc(j.role || 'Job') + (j.org ? ' at ' + esc(j.org) : '') + '</b><label class="field">Start date<input type="date" id="fj-s-' + j.id + '" value="' + esc(j.start || '') + '"></label><label class="field">End date<input type="date" id="fj-e-' + j.id + '" value="' + esc(j.end || '') + '"></label><label class="field" style="flex-direction:row;gap:8px;align-items:center;font-weight:500"><input type="checkbox" id="fj-c-' + j.id + '" style="width:20px;height:20px"> I still work here</label></div>'; }).join('');
  sheet('<h2>Add the missing details</h2><p class="note">Type what your documents show. Leave blank anything you do not know.</p>' + rows + jr + '<div class="row" style="margin-top:16px"><button class="btn pri" id="fok" type="button">Save</button><button class="btn" id="fno" type="button">Cancel</button></div>');
  $('fno').onclick = closeSheet;
  $('fok').onclick = function () {
    var bad = '';
    g.jobs.forEach(function (j) { var s = $('fj-s-' + j.id).value, e = $('fj-e-' + j.id).value, c = $('fj-c-' + j.id).checked; if (s && e && e < s) bad = 'An end date is before its start date.'; });
    if (bad) { toast(bad); return; }
    var dobEl = $('fg-dob'); if (dobEl && dobEl.value) { var yy = parseInt(dobEl.value.slice(0, 4), 10); if (!(yy >= 1930 && yy <= TODAY.getFullYear())) { toast('Check the year of birth.'); return; } }
    g.keys.forEach(function (k) { var v = $('fg-' + k).value; if (v !== '') setFact(k, v, 'typed'); });
    g.jobs.forEach(function (j) { var s = $('fj-s-' + j.id).value, e = $('fj-e-' + j.id).value, c = $('fj-c-' + j.id).checked; if (s) j.start = s; if (e) j.end = e; if (c) { j.current = true; j.end = ''; } });
    save(); closeSheet(); render(); toast('Saved.');
  };
}
function jobCard(p) {
  var js = jobsOf(p), tot = expMonths(p);
  if (!js.length) return '';
  var list = js.length ? '<ul class="docs">' + js.map(function (j) {
    var span = j.start ? fmt(pd(j.start)) + ' to ' + (j.end ? fmt(pd(j.end)) : j.current ? 'now' : '<b>end date missing</b>') : '<b>dates missing</b>';
    var dur = jobDone(j) ? ' · ' + expText(monthsBetween(pd(j.start), j.end ? pd(j.end) : TODAY)) : '';
    return '<li><span>' + esc(j.role || 'Job') + (j.org ? ' at ' + esc(j.org) : '') + '<small>' + span + dur + '</small></span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-editjob="' + j.id + '" type="button">Edit</button><button class="btn sm danger" data-deljob="' + j.id + '" type="button">Remove</button></span></li>';
  }).join('') + '</ul>' + (tot ? '<p class="note" style="margin-top:8px">Total work experience: <b>' + expText(tot) + '</b> (overlapping jobs are counted once).</p>' : '') : '';
  return '<div class="card"><h3 class="h3">Work experience</h3>' + list + '</div>';
}
function wireJobs(p) {
  var b = $('addJob'); if (b) b.onclick = function () { jobSheet(null, null, [], '', true); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-editjob]'), function (el) { el.onclick = function () { var j = jobsOf(p).filter(function (x) { return x.id === el.getAttribute('data-editjob'); })[0]; if (j) jobSheet(j, null, [], '', true); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-deljob]'), function (el) { el.onclick = function () { var id = el.getAttribute('data-deljob'); sheet('<h2>Remove this job?</h2><div class="row" style="margin-top:16px"><button class="btn danger" id="jy" type="button">Remove</button><button class="btn" id="jn" type="button">Keep</button></div>'); $('jn').onclick = closeSheet; $('jy').onclick = function () { p.jobs = jobsOf(p).filter(function (x) { return x.id !== id; }); save(); closeSheet(); render(); }; }; });
}
/* j = existing job (edit), d = reading result for a new job, hand = typed in by the person */
function jobSheet(j, d, notes, text, hand) {
  var cur = j || d || {}, kind = cur.letterKind || cur.kind || '';
  var curNow = j ? !!j.current : (d ? (d.stillWorking === true || (d.letterKind === 'offer' && !d.endDate)) : false);
  var s0 = (j ? j.start : d && d.startDate) || '', e0 = (j ? j.end : d && d.endDate) || '', role0 = (j ? j.role : d && d.role) || '', org0 = (j ? j.org : d && d.employer) || '';
  function miss(v, what) { return (!v && !hand) ? '<span class="tag guess">not found on the document</span>' : (!v ? '' : '<span class="tag read">read</span>'); }
  sheet('<h2>' + (j ? 'Edit job' : hand ? 'Add a job' : 'Check the job details') + '</h2>'
    + ((notes && notes.length) ? '<div class="status warn"><b>Please check:</b><ul style="margin:6px 0 0;padding-left:18px">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
    + costLine()
    + '<label class="field">Job title ' + miss(role0) + '<input id="jr" type="text" maxlength="60" value="' + esc(role0) + '" placeholder="e.g. Customer support executive"></label>'
    + '<label class="field">Employer ' + miss(org0) + '<input id="jo" type="text" maxlength="60" value="' + esc(org0) + '" placeholder="Company or office name"></label>'
    + '<label class="field">Start date (date of joining) ' + miss(s0) + '<input id="js" type="date" value="' + esc(s0) + '"></label>'
    + '<label class="field">End date (last working day) ' + miss(e0 || (curNow ? 'x' : '')) + '<input id="je" type="date" value="' + esc(e0) + '"></label>'
    + '<label class="field" style="flex-direction:row;gap:10px;align-items:center;font-weight:500"><input type="checkbox" id="jc" style="width:22px;height:22px" ' + (curNow ? 'checked' : '') + '> I still work here</label>'
    + ((!s0 || (!e0 && !curNow)) && !hand ? '<p class="note">The document did not show ' + (!s0 && !e0 ? 'the start or end date' : !s0 ? 'the start date' : 'the end date') + '. Type it from the letter or from memory. These dates decide how much experience counts.</p>' : '')
    + (text ? '<details style="margin-top:8px"><summary class="note">What the phone read</summary><pre style="white-space:pre-wrap;font-size:12px;color:var(--muted);max-height:160px;overflow:auto">' + esc(text.trim().slice(0, 1200)) + '</pre></details>' : '')
    + '<div class="row" style="margin-top:16px"><button class="btn pri big" id="jok" type="button">Save job</button><button class="btn" id="jno" type="button">Cancel</button></div>');
  $('jno').onclick = closeSheet;
  $('jc').onchange = function () { if ($('jc').checked) $('je').value = ''; };
  $('jok').onclick = function () {
    var s = $('js').value, e = $('je').value, c = $('jc').checked, r = $('jr').value.trim(), o = $('jo').value.trim();
    if (c) e = '';
    if (!s) { toast('Add the start date. It is what experience is counted from.'); return; }
    if (parseInt(s.slice(0, 4), 10) < 1960 || pd(s) > TODAY) { toast('Check the start date.'); return; }
    if (!e && !c) { toast('Add the end date, or tick “I still work here”.'); return; }
    if (e && e < s) { toast('The end date is before the start date.'); return; }
    var p = prof();
    if (j) { j.role = r; j.org = o; j.start = s; j.end = e; j.current = c; save(); closeSheet(); render(); toast('Job updated.'); return; }
    var docId = '';
    if (!hand) { var doc = { id: uid(), label: 'Work experience letter', at: Date.now(), keys: [], jobs: 1 }; p.docs.push(doc); docId = doc.id; }
    p.jobs = jobsOf(p); p.jobs.push({ id: uid(), docId: docId, role: r, org: o, start: s, end: e, current: c });
    save(); closeSheet(); scan = { type: 'auto', canvas: null }; location.hash = '#profile'; render(); toast('Job saved. Experience so far: ' + expText(expMonths(p)) + '.');
  };
}
function parseJobLocal(t) {
  var re1 = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})/g, re2 = /(\d{1,2})\s*(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.\-]*((?:19|20)\d{2})/ig;
  var out = { startDate: null, endDate: null, role: null, employer: null, stillWorking: false, letterKind: /relieving|relieved/i.test(t) ? 'relieving' : /offer\s+letter|appointment/i.test(t) ? 'offer' : 'experience' };
  t.split(/\n/).forEach(function (line) {
    var m, found = [];
    re1.lastIndex = 0; while ((m = re1.exec(line))) found.push((+m[3]) + '-' + two(+m[2]) + '-' + two(+m[1]));
    re2.lastIndex = 0; while ((m = re2.exec(line))) found.push((+m[3]) + '-' + two(MONTHS[m[2].toLowerCase()]) + '-' + two(+m[1]));
    if (!found.length) return;
    if (/join|commenc|start|appointed|from\b/i.test(line) && !out.startDate) out.startDate = found[0];
    if (/relie|last\s+working|till|resign|separat|end\b|\bto\b/i.test(line) && !out.endDate) out.endDate = found[found.length - 1];
  });
  if (out.startDate && out.endDate && out.endDate < out.startDate) { var x = out.startDate; out.startDate = out.endDate; out.endDate = x; }
  return out;
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
var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function card(e) {
  var r = e.r;
  return '<a class="jc" href="#job/' + encodeURIComponent(r.id) + '"><div class="jct"><span class="pill ' + e.st.k + '">' + esc(e.st.t) + '</span><span class="verdict v-' + e.verdict + '">' + VLAB[e.verdict] + '</span></div>'
    + '<h3>' + esc(r.title) + '</h3><div class="org">' + esc(r.org) + '</div><div class="jcl">' + esc(r.line) + '</div>'
    + '<div class="jcf"><span class="' + (r.off ? 'o1' : 'o0') + '">' + (r.off ? 'Read from the official notice' : 'Not checked on the official site') + '</span>' + CHEV + '</div></a>';
}
function renderDetail(id) {
  var r = DATA.records.filter(function (x) { return x.id === id; })[0];
  if (!r) { location.hash = '#explore'; return; }
  var e = evaluate(r, F());
  var rules = e.rules.map(function (x) { return '<li><i class="m ' + x.s + '" aria-hidden="true">' + mark(x.s) + '</i><span><b>' + esc(x.t) + '</b><br><span>' + esc(x.d) + '</span></span></li>'; }).join('');
  var facts = r.facts.map(function (x) { return '<div class="dkv"><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('');
  var url = r.link ? r.link[1] : r.src[1], lab = r.link ? 'Open official site' : 'Open the source page';
  $('app').innerHTML = '<div class="dbar"><button type="button" id="dback" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><b>Job details</b></div>'
    + '<div class="pills" style="margin-top:8px"><span class="pill ' + e.st.k + '">' + esc(e.st.t) + '</span><span class="verdict v-' + e.verdict + '">' + VLAB[e.verdict] + '</span></div>'
    + '<h1 class="dtitle">' + esc(r.title) + '</h1><div class="org" style="font-size:15px;margin-top:6px">' + esc(r.org) + '</div>'
    + (r.off ? '<div class="dnote g"><b>Read from the official notice.</b> Dates and rules here were taken from the government’s own notice.</div>' : '<div class="dnote w"><b>Not checked on the official site.</b> Dates and rules here come from a news or listing page. Confirm them in the official notice before you apply.</div>')
    + (e.from ? '<div class="from" style="margin-top:12px">You can apply from ' + fmt(e.from) + '.</div>' : '')
    + (rules ? '<div class="dh">How you match</div><div class="dlist"><ul class="rules">' + rules + '</ul></div>' : '')
    + '<div class="dh">Key facts</div><div class="dlist">' + facts + '</div>'
    + '<div class="dh">About</div><div class="dabout"><p>' + esc(r.line) + '</p><p class="muted">' + esc(r.cyc) + '</p><p class="note">Source: <a href="' + r.src[1] + '" target="_blank" rel="noopener">' + esc(r.src[0]) + '</a>. Read on ' + esc(DATA.readOn) + '. Confidence: ' + r.conf + '. ' + esc(r.note) + '</p></div>'
    + '<p class="foot">Check dates, age limits and fees on the official website before you apply, and never pay an agent to apply.</p>'
    + '<div class="dact"><a class="btn pri" href="' + url + '" target="_blank" rel="noopener">' + lab + ' ↗</a></div>';
  $('dback').onclick = function () { if (history.length > 1) history.back(); else location.hash = '#explore'; };
}

/* ================= render: home (one card at a time) ================= */
var HOME = { i: 0, t: null, items: [] };
var NOTES = [
  ['A Class 12 pass opens many more posts than Class 10.', 'Scan your marksheet and Explore grows to match.'],
  ['Apply only on the official site.', 'Never pay an agent to apply for a government post.'],
  ['Scan once, use it everywhere.', 'Your details stay on this phone. Photos are not saved.']
];
var EXTRA = { exams: [], pvt: [] }, SHOWCL = false;
/* Shared list: a daily search done once for everyone and approved before it reaches phones. Fetched in the background; the last copy is kept for offline use. */
function getLive() {
  if (!CFG.readerUrl) return Promise.resolve(null);
  var old = lastLive();
  if (old && old.t && Date.now() - old.t < 15 * 6e4) return Promise.resolve(old.j);
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  return fetch(CFG.readerUrl, { signal: ctl.signal, headers: { 'X-App-Key': CFG.appKey || '' } }).then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; }).then(function (j) {
    if (j && Array.isArray(j.records)) { try { localStorage.setItem('pa10.live', JSON.stringify({ t: Date.now(), j: j })); } catch (e) {} return j; }
    return old ? old.j : null;
  }).catch(function () { clearTimeout(t); return old ? old.j : null; });
}
function lastLive() { try { var o = JSON.parse(localStorage.getItem('pa10.live') || 'null'); return o && o.j ? o : null; } catch (e) { return null; } }
function mergeLive(j) {
  if (!j || !DATA) return;
  var tl = {}; DATA.records.forEach(function (r) { tl[r.title.toLowerCase()] = 1; });
  (j.records || []).forEach(function (r) { if (r && r.id && r.title && !tl[r.title.toLowerCase()]) { DATA.records.push(r); tl[r.title.toLowerCase()] = 1; } });
  var te = {}; (EXTRA.exams || []).forEach(function (x) { te[x.title.toLowerCase()] = 1; });
  (j.exams || []).forEach(function (x) { if (x && x.id && x.title && !te[x.title.toLowerCase()]) { (EXTRA.exams = EXTRA.exams || []).push(x); te[x.title.toLowerCase()] = 1; } });
}
var ARTS = {
  med: '<svg viewBox="0 0 190 300" aria-hidden="true"><path d="M10 300V252Q10 205 55 195L95 185L135 195Q180 205 180 252V300Z" fill="#fff"/><path d="M70 188L95 232L120 188" fill="none" stroke="#dfe5ea" stroke-width="3"/><path d="M80 190L95 226L110 190Z" fill="#0d6e6e"/><rect x="85" y="165" width="20" height="28" fill="#d99a6c"/><ellipse cx="95" cy="135" rx="34" ry="40" fill="#e9b58a"/><path d="M60 130Q60 86 95 88Q130 86 130 130Q118 106 95 108Q72 106 60 130Z" fill="#2b2118"/><circle cx="82" cy="138" r="2.6" fill="#2b2118"/><circle cx="108" cy="138" r="2.6" fill="#2b2118"/><path d="M85 153Q95 160 105 153" fill="none" stroke="#8a4b2a" stroke-width="2.4" stroke-linecap="round"/><path d="M68 194Q58 228 76 248Q96 262 112 240" fill="none" stroke="#17323f" stroke-width="4" stroke-linecap="round"/><circle cx="112" cy="238" r="8" fill="#17323f"/><circle cx="112" cy="238" r="3.5" fill="#f6b73c"/><path d="M146 222v22M135 233h22" stroke="#0d6e6e" stroke-width="6" stroke-linecap="round"/></svg>',
  def: '<svg viewBox="0 0 190 300" aria-hidden="true"><path d="M10 300V252Q10 205 55 195L135 195Q180 205 180 252V300Z" fill="#55693f"/><path d="M62 196L142 300" stroke="#37462a" stroke-width="14" opacity=".55"/><rect x="26" y="236" width="34" height="26" rx="4" fill="#44562f"/><rect x="130" y="226" width="36" height="9" rx="2" fill="#f6b73c"/><rect x="130" y="240" width="36" height="9" rx="2" fill="#f6b73c" opacity=".7"/><rect x="85" y="165" width="20" height="28" fill="#b98258"/><ellipse cx="95" cy="138" rx="33" ry="38" fill="#c98f64"/><path d="M52 126Q52 70 95 68Q138 70 138 126L138 132Q95 116 52 132Z" fill="#667d4b"/><path d="M52 126Q95 112 138 126" fill="none" stroke="#3f5030" stroke-width="5"/><path d="M62 134L66 170M128 134L124 170" stroke="#3f5030" stroke-width="3"/><circle cx="82" cy="142" r="2.6" fill="#2b2118"/><circle cx="108" cy="142" r="2.6" fill="#2b2118"/><path d="M86 158H104" stroke="#7a4527" stroke-width="2.6" stroke-linecap="round"/></svg>',
  biz: '<svg viewBox="0 0 190 300" aria-hidden="true"><path d="M10 300V252Q10 205 55 195L135 195Q180 205 180 252V300Z" fill="#102530"/><path d="M78 192L95 244L112 192Z" fill="#fff"/><path d="M91 205H99L103 250L95 264L87 250Z" fill="#f6b73c"/><path d="M62 196L90 250M128 196L100 250" stroke="#2b4a5c" stroke-width="3"/><rect x="85" y="165" width="20" height="28" fill="#d99a6c"/><ellipse cx="95" cy="135" rx="33" ry="39" fill="#e9b58a"/><path d="M62 128Q62 88 95 88Q128 88 128 128Q118 104 95 104Q72 104 62 128Z" fill="#3a3a3a"/><rect x="74" y="132" width="18" height="13" rx="4" fill="none" stroke="#17323f" stroke-width="2.4"/><rect x="98" y="132" width="18" height="13" rx="4" fill="none" stroke="#17323f" stroke-width="2.4"/><path d="M92 138H98" stroke="#17323f" stroke-width="2.4"/><path d="M86 154Q95 160 104 154" fill="none" stroke="#8a4b2a" stroke-width="2.4" stroke-linecap="round"/><rect x="120" y="244" width="58" height="42" rx="7" fill="#9a6a33"/><path d="M137 244V237a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v7" fill="none" stroke="#9a6a33" stroke-width="5"/><rect x="146" y="258" width="8" height="9" rx="2" fill="#f6b73c"/></svg>'
};
var HICONS = [
  ['Profile', 'ic-p', '#profile', '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'],
  ['Govt Jobs', 'ic-g', '#govt', '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'],
  ['Pvt Jobs', 'ic-v', '#pvt', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'],
  ['Upcoming exams', 'ic-e', '#exams', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15.5l2 2 4-4"/>']
];
function upExams() { return (EXTRA.exams || []).filter(function (x) { return pd(x.d) >= TODAY; }).sort(function (a, b) { return pd(a.d) - pd(b.d); }); }
function dayTxt(x) { if (x.tent) return 'Expected ' + x.when; var n = daysBetween(TODAY, pd(x.d)); return n === 0 ? 'Today' : n === 1 ? '1 day to go' : n + ' days to go'; }
function stopHome() { if (HOME.t) { clearInterval(HOME.t); HOME.t = null; } }
function homeItems() {
  var out = upExams().filter(function (x) { return x.hero; }).slice(0, 3).map(function (x) { return { exam: x }; });
  if (!out.length) out.push({ note: NOTES[(Math.floor(TODAY.getTime() / 864e5)) % NOTES.length] });
  return out;
}
function homeCard(it) {
  if (it.note) return '<div class="hcard note" id="hc" aria-live="polite"><i class="tbar"></i><span class="hp">Career note</span><h2>' + esc(it.note[0]) + '</h2><div class="hs">' + esc(it.note[1]) + '</div></div>';
  var x = it.exam, d = pd(x.d);
  return '<a class="hcard hx g-' + x.art + '" id="hc" href="#x/' + encodeURIComponent(x.id) + '"><i class="tbar"></i><div class="hart">' + ARTS[x.art] + '</div><span class="hp">UPCOMING EXAM</span><h2>' + esc(x.short) + '</h2><div class="hs">' + esc(x.sub) + '</div>'
    + '<div class="hdl">Exam date</div><div class="hdd">' + (x.tent ? esc(x.when) : d.getDate() + ' ' + MON[d.getMonth()]) + '</div><div class="hleft">' + esc(dayTxt(x)) + '</div>'
    + '<span class="hgo hbtn">See exam details ›</span></a>';
}
function drawHome() {
  var it = HOME.items[HOME.i];
  $('hslot').innerHTML = homeCard(it);
  Array.prototype.forEach.call(document.querySelectorAll('.hdots button'), function (b, k) { if (k === HOME.i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
}
function renderHome() {
  stopHome();
  HOME.items = homeItems(); if (HOME.i >= HOME.items.length) HOME.i = 0;
  var ics = HICONS.map(function (c) { return '<a class="hic" href="' + c[2] + '"><span class="hc ' + c[1] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + c[3] + '</svg></span><span class="hl">' + c[0].replace('Upcoming exams', 'Upcoming<br>exams') + '</span></a>'; }).join('');
  $('app').innerHTML = '<div class="homew"><div id="hslot"></div><div class="hdots">' + HOME.items.map(function (x, k) { return '<button type="button" data-k="' + k + '" aria-label="Show card ' + (k + 1) + '"><i></i></button>'; }).join('') + '</div><div class="hics">' + ics + '</div></div>';
  drawHome();
  function go(k) { HOME.i = k; drawHome(); stopHome(); HOME.t = setInterval(next, 5500); }
  function next() { go((HOME.i + 1) % HOME.items.length); }
  Array.prototype.forEach.call(document.querySelectorAll('.hdots button'), function (b) { b.onclick = function () { go(+b.getAttribute('data-k')); }; });
  if (HOME.items.length > 1) HOME.t = setInterval(next, 5500);
}
/* ---- list screens: exams, govt jobs, private jobs ---- */
function subHead(title, sub) {
  return '<div class="dbar"><button type="button" id="dback" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><b class="dbt">' + esc(title) + '</b></div><p class="subl">' + esc(sub) + '</p>';
}
function wireBack(to) { var b = $('dback'); if (b) b.onclick = function () { if (to) location.hash = to; else if (history.length > 1) history.back(); else location.hash = '#home'; }; }
var BRIEF = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>';
function xcard(x, kind) {
  var left, tags;
  if (kind === 'exam') {
    var d = pd(x.d), mon = MON[d.getMonth()];
    left = '<div class="xd g-' + x.art + '">' + (x.tent ? '<b>' + mon + '</b><small>' + d.getFullYear() + '</small>' : '<b>' + d.getDate() + '</b><small>' + mon + '</small>') + '</div>';
    tags = '<span class="tg w">' + esc(dayTxt(x)) + '</span><span class="tg">' + esc(x.org) + '</span>';
  } else { left = '<div class="xi">' + BRIEF + '</div>'; tags = '<span class="tg w">Sample listing</span><span class="tg">' + esc(x.place) + '</span>'; }
  return '<a class="xc" href="#x/' + encodeURIComponent(x.id) + '">' + left + '<div class="xb"><h3>' + esc(x.title) + '</h3><div class="org">' + esc(x.org) + '</div><div class="xt">' + tags + '</div></div></a>';
}
function renderExams() {
  var l = upExams();
  $('app').innerHTML = subHead('Upcoming exams', 'Sorted by date. Check each date on the official site.')
    + (l.length ? '<div class="xl">' + l.map(function (x) { return xcard(x, 'exam'); }).join('') + '</div>' : '<div class="card"><p class="note">No upcoming exams are listed right now.</p></div>')
    + '<p class="foot">Dates were read on ' + esc(EXTRA.readOn || '') + ' from news reports of the official calendars, and are tentative. Open the official site before you plan.</p>';
  wireBack('#home');
}
function renderGovt() {
  var f = F(), p = prof(), hasFacts = p && Object.keys(p.facts).length;
  var ev = DATA.records.filter(function (r) { return r.tab === 'work' || r.tab === 'exp'; }).filter(function (r) { return hasFacts ? relevant(r, f, p) : !r.later && r.tab !== 'exp'; }).map(function (r) { return evaluate(r, f); });
  var open = ev.filter(function (e) { return e.st.k === 'open' && e.grp < 2; }).sort(function (a, b) { return pd(a.r.closes) - pd(b.r.closes); });
  var rest = ev.filter(function (e) { return open.indexOf(e) < 0; });
  $('app').innerHTML = subHead('Govt Jobs', hasFacts ? 'Open posts that match your details.' : 'Open posts. Scan a document to see which fit you.')
    + (open.length ? '<div class="recs">' + open.map(card).join('') + '</div>' : '<div class="card"><p class="note">Nothing is open for you right now.</p></div>')
    + (rest.length ? '<div class="row" style="margin-top:16px"><button class="btn xbtn" id="showCl" type="button">' + (SHOWCL ? 'Hide closed ones' : 'Show closed ones') + '</button></div>' : '')
    + (SHOWCL && rest.length ? '<div class="recs">' + rest.map(card).join('') + '</div>' : '')
    + '<p class="foot">Records marked “Read from the official notice” were taken from the government’s own notice. Check dates, age limits and fees on the official website before you apply, and never pay an agent to apply.</p>';
  wireBack('#home');
  if ($('showCl')) $('showCl').onclick = function () { SHOWCL = !SHOWCL; renderGovt(); };
}
function renderPvt() {
  var l = EXTRA.pvt || [];
  $('app').innerHTML = subHead('Pvt Jobs', 'Private openings near you.')
    + '<div class="banner" style="margin-top:12px"><b>Sample listings.</b> We are still finding a trusted source for private jobs, so these are examples of what will appear here. They are not real openings.</div><div class="xl">' + l.map(function (x) { return xcard(x, 'pvt'); }).join('') + '</div>';
  wireBack('#home');
}
function renderX(id) {
  var isE = true, x = (EXTRA.exams || []).filter(function (e) { return e.id === id; })[0];
  if (!x) { isE = false; x = (EXTRA.pvt || []).filter(function (e) { return e.id === id; })[0]; }
  if (!x) { location.hash = '#home'; return; }
  var facts = x.facts.map(function (r) { return '<div class="dkv"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('');
  $('app').innerHTML = '<div class="dbar"><button type="button" id="dback" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><b>' + (isE ? 'Exam details' : 'Job details') + '</b></div>'
    + '<h1 class="dtitle">' + esc(x.title) + '</h1><div class="org" style="font-size:15px;margin-top:6px">' + esc(x.org) + '</div>'
    + (isE ? '<div class="dnote w"><b>Not checked on the official site.</b> ' + esc(x.note) + '</div>' : '<div class="dnote w"><b>Sample listing.</b> This is an example, not a real opening. Real private jobs will appear here once we have a trusted source.</div>')
    + '<div class="dh">Key facts</div><div class="dlist">' + facts + '</div>'
    + '<div class="dh">About</div><div class="dabout"><p>' + esc(x.line) + '</p>' + (isE ? '<p class="note">Source: <a href="' + x.src[1] + '" target="_blank" rel="noopener">' + esc(x.src[0]) + '</a>. Read on ' + esc(EXTRA.readOn || '') + '.</p>' : '') + '</div>'
    + (isE ? '<p class="foot">Never pay an agent to apply or to get an exam seat.</p><div class="dact"><a class="btn pri" href="' + x.src[1] + '" target="_blank" rel="noopener">Open official site ↗</a></div>' : '');
  wireBack(null);
}
function sortG(a, b) {
  if (a.grp === 3 && b.grp === 3) { var fa = a.from ? a.from.getTime() : 9e15, fb = b.from ? b.from.getTime() : 9e15; return fa - fb; }
  if (a.grp < 3) { var ca = a.st.k === 'open' ? pd(a.r.closes).getTime() : 9e15, cb = b.st.k === 'open' ? pd(b.r.closes).getTime() : 9e15; return ca - cb; }
  return 0;
}
function questions(list, f) {
  var count = {};
  list.forEach(function (e) { if (e.grp > 3) return; var seen = {}; e.rules.forEach(function (x) { if (x.s === 'unsure' && x.needs && FD[x.needs] && FD[x.needs].g !== 'Driving licence' && !f[x.needs] && !seen[x.needs]) { seen[x.needs] = 1; count[x.needs] = (count[x.needs] || 0) + 1; } }); });
  return Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 4).map(function (k) { return { k: k, n: count[k] }; });
}
function ctl(x, val, id) {
  if (x.type === 'select') return '<select id="' + id + '"><option value="">Select</option>' + x.o.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  if (x.type === 'date') return '<input id="' + id + '" type="date" value="' + esc(val || '') + '">';
  return '<input id="' + id + '" type="number" inputmode="decimal" value="' + esc(val || '') + '"' + (x.step ? ' step="' + x.step + '"' : '') + (x.min !== undefined ? ' min="' + x.min + '"' : '') + (x.max !== undefined ? ' max="' + x.max + '"' : '') + '>';
}
function has10(f) { return !!(f.board || f.examYear || f.pct || f.passed || f.core); }
function has12(f) { return !!(f.board12 || f.year12 || f.pct12 || f.passed12 || f.stream12); }
/* A record is shown only when the profile holds something it is about. */
function relevant(r, f, p) {
  if (r.tab === 'exp') return !!(f.lmv || f.hmv);
  if (r.lvl === 12 && !has12(f)) return false;
  if (r.upto12 && f.passed12 === 'yes') return false;
  if (!has10(f) && !has12(f)) return false;
  if (r.tab === 'work') return true;
  var m = ageM(f); return !!(f.stage || m === null || m <= 25 * 12);
}
function renderExplore() {
  var p = prof();
  if (!p) { renderProfile(); return; }
  var f = F(), all = DATA.records.filter(function (r) { return relevant(r, f, p); }).map(function (r) { return evaluate(r, f); });
  var chips = [];
  if (f.board) chips.push(f.board + (f.examYear ? ' ' + f.examYear : ''));
  if (f.pct) chips.push(Number(f.pct).toFixed(1) + '%');
  var m = ageM(f); if (m !== null) chips.push('Age ' + Math.floor(m / 12) + 'y ' + (m % 12) + 'm');
  if (f.cat) chips.push(showVal('cat', f.cat));
  if (f.state) chips.push(f.state === 'other' ? 'Another state' : f.state);
  var hiddenN = all.filter(function (e) { return e.grp >= 2; }).length, allRecs = all;
  if (!SHOWALL) all = all.filter(function (e) { return e.grp < 2; });
  var tabs = [['work', 'Jobs'], ['exp', 'With experience'], ['study', 'Study'], ['scholar', 'Scholarships']];
  tabs = tabs.filter(function (t) { return all.some(function (e) { return e.r.tab === t[0]; }); });
  if (!tabs.length && hiddenN && !SHOWALL) {
    $('app').innerHTML = '<div class="chips" style="margin:4px 0 14px">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div><div class="card"><h3 class="h3">Nothing is open for you right now</h3><p class="note" style="margin-top:4px">' + hiddenN + (hiddenN === 1 ? ' record matches' : ' records match') + ' this profile but ' + (hiddenN === 1 ? 'is' : 'are') + ' closed, not open yet, or not eligible yet.</p><div class="row" style="margin-top:10px"><button class="btn" id="showAll" type="button">Show them</button></div></div>';
    $('showAll').onclick = function () { SHOWALL = true; renderExplore(); };
    return;
  }
  if (!tabs.length) {
    $('app').innerHTML = '<div class="chips" style="margin:4px 0 14px">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div><div class="card"><h3 class="h3">Nothing to match yet</h3><p class="note" style="margin-top:4px">Results appear for the kinds of details a profile holds: Class 10 details, a driving licence or work experience. ' + (jobsOf(p).length || Object.keys(p.facts).length ? 'This profile has none of those that match the records available so far. More kinds of jobs are being added.' : 'Scan a document or add a detail on the Profile tab.') + '</p></div><p class="foot">Records so far cover Karnataka and central government posts open to Class 10 pass candidates, driver posts, and study and scholarship routes after Class 10.</p>';
    return;
  }
  if (!tabs.some(function (t) { return t[0] === TAB; })) TAB = tabs[0][0];
  var tabsH = tabs.map(function (t) { var n = all.filter(function (e) { return e.r.tab === t[0] && e.grp < 2; }).length; return '<button role="tab" class="tb" data-t="' + t[0] + '" aria-selected="' + (t[0] === TAB) + '">' + t[1] + ' <span>' + n + '</span></button>'; }).join('');
  var list = all.filter(function (e) { return e.r.tab === TAB; });
  var h = gapCard(p);
  var qs = questions(list, f);
  if (qs.length) {
    h += '<details class="q" id="qd" style="margin-top:14px"' + (QOPEN ? ' open' : '') + '><summary><b>Optional: narrow these results</b></summary>' + qs.map(function (q) { var x = FD[q.k]; return '<div class="qrow"><span>' + x.l + '<small>Settles ' + q.n + (q.n === 1 ? ' record' : ' records') + ' here</small></span><span class="in">' + ctl(x, '', 'q-' + q.k) + '</span></div>'; }).join('') + '</details>';
  }
  if (TAB === 'work') {
    var bt = '';
    if (m !== null && m < 18 * 12) { var nx = all.filter(function (e) { return e.r.tab === 'work' && e.from; }).sort(function (a, b) { return a.from - b.from; })[0]; bt = 'Most government jobs start at 18. You are ' + ageText(m) + '.' + (nx ? ' The first to open for your age is <b>' + esc(nx.r.title) + '</b>, from ' + fmt(nx.from) + '.' : '') + ' Before that, the routes that lead to paid work are an ITI or diploma with an apprenticeship. See <b>Study further</b>.'; }
    if (f.state === 'other') bt += (bt ? ' ' : '') + 'Only Karnataka and central records are listed. Other states’ recruitments are not included.';
    if (bt) h += '<div class="banner">' + bt + '</div>';
  } else if (TAB === 'exp') {
    if (jobsOf(p).some(jobDone)) h += '<div class="banner">Your recorded work experience: <b>' + expText(expMonths(p)) + '</b>.</div>';
  } else if (TAB === 'scholar') {
    h += '<div class="banner">Post-matric scholarships apply once you are enrolled in Class 11, a diploma or an ITI. Apply on the official portals only.</div>';
  }
  var any = false;
  [0, 1, 2, 3].forEach(function (g) { var items = list.filter(function (e) { return e.grp === g; }).sort(sortG); if (!items.length) return; any = true; h += '<section class="group"><h2>' + GROUPS[g][0] + ' <span class="note">(' + items.length + ')</span></h2><p class="gnote">' + GROUPS[g][1] + '</p><div class="recs">' + items.map(card).join('') + '</div></section>'; });
  var later = list.filter(function (e) { return e.grp === 4; });
  if (later.length) h += '<details class="later-toggle"><summary>' + GROUPS[4][0] + ' (' + later.length + ')</summary><p class="gnote" style="margin-top:4px">' + GROUPS[4][1] + '</p><div class="recs">' + later.map(card).join('') + '</div></details>';
  $('app').innerHTML = '<div class="row" style="justify-content:space-between"><div><div class="chips" style="margin-top:4px">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div></div></div>'
    + '<div class="tabs" role="tablist" aria-label="Kind of opportunity">' + tabsH + '</div>' + h
    + (hiddenN ? '<div class="row" style="margin-top:18px"><button class="btn" id="showAll" type="button">' + (SHOWALL ? 'Hide closed and not-open records' : 'Show ' + hiddenN + ' closed or not-yet-open ' + (hiddenN === 1 ? 'record' : 'records')) + '</button></div>' : '')
    + '<p class="foot">Records marked “Read from the official notice” were taken from the government’s own notice. The others come from news or listing pages read on ' + esc(DATA.readOn) + ' and have not been checked against an official notice, so open the official site first. Check dates, age limits and fees on the official website before you apply, and never pay an agent to apply. NTSE is not listed because it has not been held since 2021. Only records that match what is on this profile are shown.</p>';
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); try { sessionStorage.setItem('pa10.tab', TAB); } catch (e) {} renderExplore(); window.scrollTo(0, 0); }; });
  wireGap(p);
  if ($('showAll')) $('showAll').onclick = function () { SHOWALL = !SHOWALL; renderExplore(); window.scrollTo(0, 0); };
  if ($('qd')) $('qd').ontoggle = function () { QOPEN = $('qd').open; };
  qs.forEach(function (q) { var el = $('q-' + q.k); el.onchange = function () { if (el.value) { setFact(q.k, el.value, 'typed'); renderExplore(); } }; });
}

/* ================= sheets ================= */
function sheet(html) { var si = $('sheetin'); si.style.transform = ''; si.innerHTML = '<div class="grab" aria-hidden="true"></div>' + html; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; }
(function () {
  var y0 = null, dy = 0, si = $('sheetin');
  si.addEventListener('touchstart', function (e) { y0 = si.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  si.addEventListener('touchmove', function (e) { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0) si.style.transform = 'translateY(' + dy + 'px)'; else { dy = 0; si.style.transform = ''; } }, { passive: true });
  si.addEventListener('touchend', function () { if (y0 === null) return; if (dy > 110) closeSheet(); else si.style.transform = ''; y0 = null; dy = 0; });
})();
function closeSheet() { stopCam(); $('sheet').hidden = true; $('sheetin').innerHTML = ''; document.body.style.overflow = ''; }
$('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) closeSheet(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

function addPersonSheet(first, after) {
  first = first === true;
  sheet('<h2>' + (first ? 'Who is this for?' : 'Add a person') + '</h2><p class="note">A first name or nickname is enough. It stays on this phone.</p><label class="field">Name<input id="pn" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Asha"></label><div class="row" style="margin-top:16px"><button class="btn pri" id="pok" type="button">' + (first ? 'Continue' : 'Add') + '</button><button class="btn" id="pno" type="button">' + (first ? 'Later' : 'Cancel') + '</button></div>');
  $('pno').onclick = closeSheet;
  $('pok').onclick = function () { var n = $('pn').value.trim(); if (!n) { $('pn').focus(); return; } var p = { id: uid(), name: n, created: Date.now(), facts: {}, docs: [] }; DB.profiles.push(p); DB.active = p.id; save(); closeSheet(); location.hash = first ? '#home' : '#profile'; render(); if (typeof after === 'function') after(); };
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
function initial(n) { return esc((n || '?').trim().charAt(0).toUpperCase() || '?'); }
function deleteSheet(p) {
  sheet('<h2>Delete ' + esc(p.name) + '’s profile?</h2><p class="note">This removes all their details from this phone. A backup file you saved earlier is not affected.</p><div class="row" style="margin-top:16px"><button class="btn danger" id="y" type="button">Delete</button><button class="btn" id="n" type="button">Keep</button></div>');
  $('n').onclick = closeSheet; $('y').onclick = function () { DB.profiles = DB.profiles.filter(function (x) { return x.id !== p.id; }); DB.active = DB.profiles.length ? DB.profiles[0].id : null; save(); closeSheet(); render(); };
}
function peopleSheet() {
  var p = prof(), l = costLog(), t30 = l.filter(function (x) { return x.at > Date.now() - 30 * 864e5; });
  var rows = DB.profiles.map(function (pp) { var on = pp.id === DB.active, nf = Object.keys(pp.facts).length, nd = (pp.docs || []).length;
    return '<button type="button" class="prow' + (on ? ' on' : '') + '" data-pid="' + pp.id + '"><span class="av">' + initial(pp.name) + '</span><span class="pn"><b>' + esc(pp.name) + '</b><small>' + nf + (nf === 1 ? ' detail' : ' details') + ' · ' + nd + (nd === 1 ? ' document' : ' documents') + '</small></span>' + (on ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</button>'; }).join('');
  sheet('<div class="sh">People on this phone</div>' + rows
    + '<button type="button" class="prow add" id="pa"><span class="av dash">+</span><b>Add person</b></button><div class="sdiv"></div>'
    + '<button type="button" class="mrow" id="phow">How Avakasha works<span>›</span></button>'
    + '<button type="button" class="mrow" id="pbk">Backup and restore<span>' + '›' + '</span></button>'
    + '<button type="button" class="mrow" id="pco">Reading cost<span>' + (l.length ? inr(t30.reduce(function (s, x) { return s + x.usd; }, 0) * rate()) + ' in 30 days · ' + t30.length + (t30.length === 1 ? ' scan' : ' scans') : 'No scans yet') + '</span></button>'
    + '<button type="button" class="mrow" id="pky">Claude key<span>' + (CFG.readerUrl ? 'Server set up' : userKey() ? 'Saved on this phone' : 'Not saved') + '</span></button>'
    + (p ? '<div class="sdiv"></div><button type="button" class="mrow danger" id="pdel">Delete ' + esc(p.name) + '</button>' : ''));
  Array.prototype.forEach.call(document.querySelectorAll('[data-pid]'), function (b) { b.onclick = function () { DB.active = b.getAttribute('data-pid'); save(); closeSheet(); render(); }; });
  $('pa').onclick = function () { addPersonSheet(false); }; $('phow').onclick = function () { closeSheet(); showIntro(null); }; $('pbk').onclick = menuSheet; $('pco').onclick = menuSheet; $('pky').onclick = menuSheet;
  if ($('pdel')) $('pdel').onclick = function () { deleteSheet(p); };
}
function menuSheet() {
  sheet('<h2>Backup and people</h2><p class="note">Profiles live only on this phone. If the phone is lost or its data is cleared, they are gone, so save a backup file now and then.</p>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri" id="bk" type="button">Save backup file</button><button class="btn" id="rs" type="button">Restore from file</button></div><input type="file" id="rsf" accept="application/json,.json" hidden>'
    + '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3 class="h3">Claude key for testing</h3><p class="note" style="margin-top:4px">Lets this phone read documents with Claude without a server. The key is saved only on this phone and is never put in the app files. Use a key that has a spend limit, and delete it in the Anthropic console if you lose the phone.</p>'
    + (CFG.readerUrl ? '<p class="note" style="margin-top:6px">A reading server is set up, so no key is needed.</p>' : '<p class="note" style="margin-top:6px">' + (userKey() ? 'A key is saved on this phone.' : 'No key saved yet.') + '</p><label class="field">Paste key<input id="ak" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-..."></label><div class="row" style="margin-top:10px"><button class="btn pri" id="aks" type="button">Save key</button>' + (userKey() ? '<button class="btn danger" id="akc" type="button">Remove key</button>' : '') + '</div>')
    + (function () { var l = costLog(), tot = l.reduce(function (s, x) { return s + x.usd; }, 0), t30 = l.filter(function (x) { return x.at > Date.now() - 30 * 864e5; }).reduce(function (s, x) { return s + x.usd; }, 0);
        return '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3 class="h3">Reading cost</h3><p class="note" style="margin-top:4px">' + (l.length ? l.length + (l.length === 1 ? ' scan' : ' scans') + ' read with Claude on this phone: about <b>' + inr(tot * rate()) + '</b> in all, <b>' + inr(t30 * rate()) + '</b> in the last 30 days. Average ' + inr(tot / l.length * rate()) + ' a scan.' : 'No scans read with Claude yet.') + ' Estimated from the token counts Claude returns and the list price of $' + PRICE_IN + ' in and $' + PRICE_OUT + ' out per million tokens. The Anthropic console shows the real bill. Browsing and reading on the phone cost nothing. Each online search costs a little more than a scan.</p><label class="field">Rupees per US dollar<input id="rt" type="number" inputmode="decimal" step="0.1" min="1" value="' + rate() + '"></label><div class="row" style="margin-top:8px"><button class="btn" id="rts" type="button">Save rate</button>' + (l.length ? '<button class="btn" id="cc" type="button">Clear this count</button>' : '') + '</div>'; })()
    + (prof() ? '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn danger" id="dp" type="button">Delete ' + esc(prof().name) + '’s profile</button>' : '')
    + '<p class="note" style="margin-top:16px">App version ' + APPVER + '. Records dated ' + esc(DATA ? DATA.version : '') + '.</p><div class="row" style="margin-top:10px"><button class="btn" id="mc" type="button">Close</button></div>');
  $('mc').onclick = closeSheet;
  if ($('rts')) $('rts').onclick = function () { var v = parseFloat($('rt').value); if (!(v > 0)) { toast('Type a rate above zero.'); return; } try { localStorage.setItem('pa10.rate', String(v)); } catch (e) {} closeSheet(); toast('Rate saved.'); };
  if ($('cc')) $('cc').onclick = function () { try { localStorage.removeItem('pa10.cost'); } catch (e) {} closeSheet(); toast('Count cleared.'); };
  if ($('aks')) $('aks').onclick = function () { var v = $('ak').value.trim(); if (!/^sk-ant-/.test(v)) { toast('That does not look like an Anthropic key. It starts with sk-ant-'); return; } try { localStorage.setItem('pa10.key', v); } catch (e) { toast('Could not save the key on this phone.'); return; } closeSheet(); toast('Key saved on this phone.'); };
  if ($('akc')) $('akc').onclick = function () { try { localStorage.removeItem('pa10.key'); } catch (e) {} closeSheet(); toast('Key removed.'); };
  $('bk').onclick = function () {
    var blob = new Blob([JSON.stringify({ app: 'avakasha', saved: new Date().toISOString(), db: DB }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'avakasha-backup-' + TODAY.toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Backup file saved to your downloads.');
  };
  $('rs').onclick = function () { $('rsf').click(); };
  $('rsf').onchange = function () {
    var fl = $('rsf').files[0]; if (!fl) return; var rd = new FileReader();
    rd.onload = function () { try { var o = JSON.parse(rd.result); var db = o.db || o; if (!db.profiles) throw 0; var ids = {}; DB.profiles.forEach(function (p) { ids[p.id] = 1; }); var n = 0; db.profiles.forEach(function (p) { if (!ids[p.id]) { DB.profiles.push(p); n++; } }); if (!DB.active && DB.profiles.length) DB.active = DB.profiles[0].id; save(); closeSheet(); render(); toast(n + ' profile' + (n === 1 ? '' : 's') + ' restored.'); } catch (e) { toast('That file is not an Avakasha backup.'); } };
    rd.readAsText(fl);
  };
  if ($('dp')) $('dp').onclick = function () { deleteSheet(prof()); };
}

/* ================= scan ================= */
var stream = null;
function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } var c = $('camv'); if (c) { c.hidden = true; try { $('vid').srcObject = null; } catch (e) {} if ($('sheet').hidden) document.body.style.overflow = ''; } }
var DOCTYPES = [['m10', 'Class 10 marksheet'], ['birth', 'Birth certificate'], ['cat', 'Category (caste) certificate'], ['inc', 'Income certificate'], ['exp', 'Work experience letter'], ['dl', 'Driving licence'], ['m12', 'Class 12 marksheet']];
var scan = { type: 'auto', canvas: null };
function scanFlow() { scan = { type: 'auto', canvas: null, local: false }; if (!$('sheet').hidden) closeSheet(); openCamera(); }
function scanSheet() {
  scan = { type: 'auto', canvas: null, local: false };
  sheet('<h2>Scan a document</h2><p class="note">Photograph it flat, in good light, with the whole page in the frame. The photo is not saved.</p>'
    + '<p class="note">You do not need to say what it is. The app works that out: a Class 10 or Class 12 marksheet, birth certificate, caste certificate, income certificate, a driving licence, or a relieving, experience or offer letter.</p>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="cam" type="button">Open camera</button><button class="btn big" id="gal" type="button">Choose from gallery</button></div><input type="file" id="gf" accept="image/*" hidden>'
    + '<div id="sm"></div><div class="row" style="margin-top:16px"><button class="btn" id="sc" type="button">Cancel</button></div>');
  $('sc').onclick = closeSheet;
  $('gal').onclick = function () { $('gf').click(); };
  $('gf').onchange = function () { var fl = $('gf').files[0]; if (fl) loadFile(fl); };
  $('cam').onclick = openCamera;
}
function camFail(msg) { scanSheet(); $('sm').innerHTML = '<div class="status warn">' + msg + '</div>'; }
async function openCamera() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camFail('The camera is not available here. Choose from gallery instead.'); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }); }
  catch (e) { camFail('The camera is blocked or not found. Allow camera access for this app in the browser, or choose from gallery.'); return; }
  if (!$('sheet').hidden) closeSheet();
  $('vid').srcObject = stream; $('camv').hidden = false; document.body.style.overflow = 'hidden';
  var fl = $('cfl'); fl.classList.remove('on'); fl.hidden = true;
  try { var tr = stream.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {}; if (caps.torch) fl.hidden = false; } catch (e) {}
}
function wireCamera() {
  $('cx').onclick = stopCam;
  $('cfl').onclick = function () { try { var tr = stream.getVideoTracks()[0], on = !$('cfl').classList.contains('on'); tr.applyConstraints({ advanced: [{ torch: on }] }); $('cfl').classList.toggle('on', on); } catch (e) {} };
  $('cgal').onclick = function () { $('gfile').click(); };
  $('gfile').onchange = function () { var fl = $('gfile').files[0]; $('gfile').value = ''; if (fl) { stopCam(); loadFile(fl); } };
  $('snap').onclick = function () {
    var v = $('vid'), c = document.createElement('canvas'); c.width = v.videoWidth || 1280; c.height = v.videoHeight || 960; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    stopCam(); scan.canvas = c; review();
  };
}
function loadFile(fl) {
  var img = new Image(), u = URL.createObjectURL(fl);
  img.onload = function () { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(u); scan.canvas = c; review(); };
  img.onerror = function () { if ($('sm')) $('sm').innerHTML = '<div class="status err">That file could not be opened as an image.</div>'; else toast('That file could not be opened as an image.'); };
  img.src = u;
}
function review() {
  var url = scan.canvas.toDataURL('image/jpeg', 0.6);
  sheet('<h2>Check the photo</h2><img class="prev" alt="Your photo" src="' + url + '"><p class="note" style="margin-top:8px">Is the text sharp and the whole page visible? If not, retake it.</p>'
    + '<div class="row" style="margin-top:14px"><button class="btn pri big" id="rd" type="button">Read this document</button><button class="btn" id="rt" type="button">Retake</button></div><div id="sm"></div>');
  $('rt').onclick = scanFlow;
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
    var t = scan.type === 'auto' ? detectLocal(text) : scan.type;
    if (!isSupported(t)) { $('rd').disabled = false; $('rt').disabled = false; box.innerHTML = '<div class="status warn">' + esc(unsupportedMsg(t)) + '</div>'; return; }
    scan.type = t;
    if (t === 'exp') { jobSheet(null, parseJobLocal(text), ['Read on this phone, so the dates may be wrong. Check each one against the letter.'], text, false); return; }
    confirmSheet(parse(t, text), text);
  } catch (e) {
    $('rd').disabled = false; $('rt').disabled = false;
    box.innerHTML = '<div class="status err">Reading failed (' + esc(String(e && e.message || e)) + '). Try again with a clearer photo, or close this and add the details by hand.</div>';
  }
}

/* ---- personal test key: saved only on this phone, used to call Claude directly ---- */
function userKey() { try { return localStorage.getItem('pa10.key') || ''; } catch (e) { return ''; } }
var MODEL = 'claude-sonnet-5-5';
var COMMON = 'The image is a photo of an Indian official document. Read only the fields asked for. If a value is not clearly readable, use null. Do not guess. Do not include any person\'s name, roll or registration number, address, or any ID number. Reply with only one JSON object and nothing else.';
var PROMPTS = {
  auto: COMMON + '\nFirst decide what the document is and put it in docType: "m10" (a school Class 10, SSLC or matriculation marksheet or pass certificate), "m12" (a Class 12, PUC or higher secondary marksheet), "degree" (a college or university marksheet or degree), "exp" (a relieving letter, experience certificate, offer letter or appointment letter from an employer), "dl" (a driving licence), "birth" (a birth certificate), "cat" (a caste or category certificate), "inc" (an income certificate), or "other". Fill only the fields for that document and use null for the rest. Fields: {"isDocument": boolean, "docType": "m10" | "m12" | "degree" | "exp" | "dl" | "birth" | "cat" | "inc" | "other", "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Karnataka PUC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "category": "SC" | "ST" | "OBC" | "General" | null, "categoryText": string | null, "annualIncomeRupees": number | null, "role": string | null, "employer": string | null, "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null, "stillWorking": boolean, "letterKind": "relieving" | "experience" | "offer" | "other" | null, "licenceClasses": [{"class": string, "issued": "YYYY-MM-DD" | null}], "validUpto": "YYYY-MM-DD" | null, "badgeHeld": boolean | null, "notes": [string]}. For a driving licence list each vehicle class printed (for example LMV, MCWG, HMV, HGMV, HPMV) with its own date of issue, the date the licence is valid until, and whether a public service vehicle badge is shown; never include the licence number, name or address. For a work letter, give the employer organisation name and the job title, never the person\'s name; use the date of joining as startDate and the last working day or relieving date as endDate, not the date the letter was written; if a date is not printed use null, and say so in notes. For a Class 12 marksheet, board is the Class 12 board (use "Karnataka PUC" for the Department of Pre-University Education) and subjects must list every subject with its marks. For a Class 10 or Class 12 marksheet use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  m10: COMMON + '\nThe document should be a school Class 10 marksheet or pass certificate (CBSE, ICSE, Karnataka SSLC, or another state board, in any year). Fields: {"isDocument": boolean, "board": "CBSE" | "ICSE" | "Karnataka SSLC" | "Other state board" | null, "examYear": number | null, "dob": "YYYY-MM-DD" | null, "result": "pass" | "fail" | "unknown", "gradeSystem": "marks" | "cgpa" | "grades" | "unknown", "totalObtained": number | null, "totalMax": number | null, "printedPercentage": number | null, "cgpa": number | null, "subjects": [{"name": string, "obtained": number | null, "max": number | null}], "notes": [string]}. Use the printed total if there is one. In notes, list anything doubtful, such as a printed total that does not equal the sum of subjects, a subject printed separately from the total, or a blurred value. Keep notes short.',
  birth: COMMON + '\nThe document should be a birth certificate. Fields: {"isDocument": boolean, "dob": "YYYY-MM-DD" | null, "notes": [string]}.',
  cat: COMMON + '\nThe document should be a caste or category certificate. Fields: {"isDocument": boolean, "category": "SC" | "ST" | "OBC" | "General" | null, "categoryText": string | null, "notes": [string]}.',
  inc: COMMON + '\nThe document should be an income certificate. Fields: {"isDocument": boolean, "annualIncomeRupees": number | null, "notes": [string]}.'
};
/* ---- cost of reading (Claude Sonnet 5.5 list price, per million tokens; check the Anthropic console for the real bill) ---- */
var PRICE_IN = 2, PRICE_OUT = 10;
function rate() { try { var r = parseFloat(localStorage.getItem('pa10.rate')); return r > 0 ? r : 95; } catch (e) { return 95; } }
function costLog() { try { var l = JSON.parse(localStorage.getItem('pa10.cost') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function inr(x) { return '₹' + (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString('en-IN')); }
function recordCost(u) {
  if (!u || typeof u.input_tokens !== 'number') return null;
  var usd = (u.input_tokens * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6 + (u.searches || 0) * 0.01, l = costLog();
  l.push({ at: Date.now(), usd: usd, i: u.input_tokens, o: u.output_tokens || 0 }); if (l.length > 500) l = l.slice(-500);
  try { localStorage.setItem('pa10.cost', JSON.stringify(l)); } catch (e) {}
  return { usd: usd, inr: usd * rate(), i: u.input_tokens, o: u.output_tokens || 0 };
}
function costLine() { return scan.cost ? '<p class="note" style="margin-top:8px">This scan cost about <b>' + inr(scan.cost.inr) + '</b> (' + scan.cost.i.toLocaleString('en-IN') + ' tokens in, ' + scan.cost.o.toLocaleString('en-IN') + ' out).</p>' : ''; }
async function callDirect(type, b64, signal) {
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: signal,
    headers: { 'content-type': 'application/json', 'x-api-key': userKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: PROMPTS[type] }] }] })
  });
  var j = null; try { j = await res.json(); } catch (e) {}
  if (!res.ok) {
    var er = new Error('upstream'), m = (j && j.error && j.error.message) || '';
    er.code = res.status === 401 || res.status === 403 ? 'bad_key' : res.status === 429 ? 'rate_limited' : /credit|balance|billing/i.test(m) ? 'credit' : 'upstream'; throw er;
  }
  var text = ((j && j.content) || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  var a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) { var e2 = new Error('unreadable'); e2.code = 'unreadable'; throw e2; }
  var out; try { out = JSON.parse(text.slice(a, b + 1)); } catch (e) { var e3 = new Error('unreadable'); e3.code = 'unreadable'; e3.usage = j && j.usage; throw e3; }
  out.__usage = j && j.usage; return out;
}

/* ---- reading: Claude through the server when set up, otherwise on this phone ---- */
function consented() { try { return localStorage.getItem('pa10.consent') === '1'; } catch (e) { return false; } }
function readIt() {
  var server = (CFG.readerUrl || userKey()) && navigator.onLine !== false && !scan.local;
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
  $('cg').onchange = function () { $('cy').disabled = !$('cg').checked; };
  $('cy').onclick = function () { try { localStorage.setItem('pa10.consent', '1'); } catch (e) {} review(); readRemote(); };
  $('cl').onclick = function () { scan.local = true; review(); readLocal(); };
  $('cn').onclick = function () { review(); };
}
function downscale(src, max) {
  var s = Math.min(1, max / Math.max(src.width, src.height)), c = document.createElement('canvas');
  c.width = Math.round(src.width * s); c.height = Math.round(src.height * s); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
}
function blobToB64(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(b); }); }
var SERR = { daily_limit: 'You have used today’s free scans. Try again tomorrow, or read on this phone.', bad_key: 'Claude refused the key saved on this phone. Check it in Backup.', credit: 'The Anthropic account has no credit left for this key. Add credit in the Anthropic console.', forbidden: 'The reading server refused this app. Tell whoever set it up.', not_configured: 'The reading server is not finished being set up.', too_large: 'The photo is too large. Retake it a little farther away.', rate_limited: 'Too many photos just now. Wait a minute and try again.', upstream: 'The reading service did not answer. Try again in a moment.', unreadable: 'The photo could not be read. Try a clearer photo.', bad_request: 'The app sent something the server did not understand.' };
async function readRemote() {
  var box = $('sm');
  box.innerHTML = '<div class="status"><span class="note">Reading with Claude. This takes about 10 to 30 seconds.</span><div class="bar"><i style="width:60%"></i></div></div>';
  $('rd').disabled = true; $('rt').disabled = true;
  var ctlr = new AbortController(), timer = setTimeout(function () { ctlr.abort(); }, 70000);
  try {
    var blob = await new Promise(function (r) { downscale(scan.canvas, 1800).toBlob(r, 'image/jpeg', 0.82); });
    var b64 = await blobToB64(blob);
    var data;
    if (CFG.readerUrl) {
      var res = await fetch(CFG.readerUrl, { method: 'POST', signal: ctlr.signal, headers: { 'Content-Type': 'application/json', 'X-App-Key': CFG.appKey || '' }, body: JSON.stringify({ type: scan.type, image: b64, mediaType: 'image/jpeg' }) });
      var j = null; try { j = await res.json(); } catch (e) {}
      if (!res.ok || !j || !j.ok) { var er = new Error((j && j.error) || 'upstream'); er.code = (j && j.error) || 'upstream'; throw er; }
      data = j.data;
    } else { data = await callDirect(scan.type, b64, ctlr.signal); }
    clearTimeout(timer);
    scan.cost = recordCost(data && data.__usage);
    var t = scan.type === 'auto' ? (data && data.isDocument !== false ? data.docType : 'other') : scan.type;
    if (!isSupported(t)) { $('rd').disabled = false; $('rt').disabled = false; box.innerHTML = '<div class="status warn">' + esc(unsupportedMsg(t)) + '</div>' + costLine(); return; }
    scan.type = t;
    if (t === 'exp') { var xn = (data.notes || []).filter(function (x) { return typeof x === 'string'; }).slice(0, 5); jobSheet(null, data, xn, '', false); return; }
    var m = mapServer(t, data);
    if (m.notDoc) { $('rd').disabled = false; $('rt').disabled = false; box.innerHTML = '<div class="status warn">' + esc(unsupportedMsg('other')) + '</div>' + costLine(); return; }
    confirmSheet(m.props, '', m.notes);
  } catch (e) {
    clearTimeout(timer);
    if (e && e.usage) scan.cost = recordCost(e.usage);
    $('rd').disabled = false; $('rt').disabled = false;
    var msg = e && e.name === 'AbortError' ? 'The reading took too long.' : (SERR[e && e.code] || 'Could not reach the reading server. Check your internet.');
    box.innerHTML = '<div class="status err">' + esc(msg) + '</div>' + costLine() + '<div class="row" style="margin-top:10px"><button class="btn" id="loc" type="button">Read on this phone instead</button></div><p class="note" style="margin-top:6px">Reading on this phone misses more details.</p>';
    $('loc').onclick = function () { scan.local = true; review(); readLocal(); };
  }
}
function streamOf(txt) {
  var P = /physic/i.test(txt), C = /chem/i.test(txt), M = /math/i.test(txt), B = /biolog|botan|zoolog/i.test(txt);
  if (P && C && M && B) return 'pcmb'; if (P && C && M) return 'pcm'; if (P && C && B) return 'pcb'; if (P || C) return 'sci';
  if (/accountan|business\s*stud|commerce/i.test(txt)) return 'comm';
  if (/histor|politic|sociolog|geograph|econom|psycholog/i.test(txt)) return 'arts';
  return null;
}
function board12Of(b) { if (!b) return null; if (/cbse|central\s+board/i.test(b)) return 'CBSE'; if (/icse|\bisc\b|cisce|council\s+for\s+the\s+indian/i.test(b)) return 'ICSE'; if (/puc|pre[\s-]*university|dpue/i.test(b)) return 'Karnataka PUC'; return 'Other board'; }
function toM12(P, subjectText, boardText, notes) {
  var out = [], map = { examYear: 'year12', pct: 'pct12', passed: 'passed12' };
  P.forEach(function (p) { if (p.k === 'board' || p.k === 'core') return; out.push({ k: map[p.k] || p.k, v: p.v, conf: p.conf, note: p.note }); });
  var b = board12Of(boardText); if (b) out.unshift({ k: 'board12', v: b, conf: 'read', note: '' });
  var s = streamOf(subjectText); if (s) out.push({ k: 'stream12', v: s, conf: 'guess', note: 'Worked out from the subjects on the sheet. Check it.' });
  if (notes) for (var i = notes.length - 1; i >= 0; i--) if (/Maths, Science and English/.test(notes[i])) notes.splice(i, 1);
  return out;
}
function isSupported(t) { return DOCTYPES.some(function (d) { return d[0] === t; }); }
function unsupportedMsg(t) {
  if (t === 'degree') return 'This looks like a college or degree document. The app reads Class 10 documents for now.';
  return 'This does not look like a Class 10 or 12 marksheet, birth, caste or income certificate, driving licence or work letter. Retake the photo with the whole page in the frame.';
}
function detectLocal(t) {
  if (/driving\s+licen[cs]e|licen[cs]e\s+to\s+drive|\bmcwg\b|\bhgmv\b|\bhpmv\b|\blmv\b/i.test(t) && !/marks\s+obtained|grand\s+total/i.test(t)) return 'dl';
  if (/relieving|relieved\s+from|experience\s+(?:certificate|letter)|offer\s+letter|appointment\s+letter|date\s+of\s+joining|last\s+working\s+day/i.test(t) && !/marks\s+obtained|subject|grand\s+total/i.test(t)) return 'exp';
  if (/senior\s+secondary|class\s*(?:xii|12)\b|\bpuc\b|pre[\s-]*university|higher\s+secondary|\bhsc\b|intermediate/i.test(t)) return 'm12';
  if (/certificate\s+of\s+birth|birth\s+certificate|registrar\s+of\s+(?:births|birth)|date\s+of\s+birth[\s\S]{0,200}place\s+of\s+birth/i.test(t) && !/marks|subject/i.test(t)) return 'birth';
  if (/income\s+certificate|annual\s+(?:family\s+)?income/i.test(t)) return 'inc';
  if (/caste\s+certificate|scheduled\s+(?:caste|tribe)|other\s+backward|category\s+certificate/i.test(t) && !/marks|subject/i.test(t)) return 'cat';
  if (/secondary\s+school|\bsslc\b|class\s*(?:x|10)\b|matriculation|marks|subject|\bcbse\b|\bicse\b/i.test(t)) return 'm10';
  return 'other';
}
function mapServer(type, d) {
  var P = [], notes = (d.notes || []).filter(function (x) { return typeof x === 'string'; }).slice(0, 5);
  function add(k, v, conf, note) { P.push({ k: k, v: String(v), conf: conf, note: note || '' }); }
  if (d.isDocument === false) return { notDoc: true };
  if (type === 'dl') {
    var ok = function (v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && +v.slice(0, 4) >= 1960 && pd(v) <= TODAY; }, lm = null, hm = null;
    (d.licenceClasses || []).forEach(function (c) {
      if (!c || typeof c.class !== 'string' || !ok(c.issued)) return; var n = c.class.toUpperCase();
      if (/HMV|HGMV|HPMV|HGV|HPV|HEAVY/.test(n)) { if (!hm || c.issued < hm) hm = c.issued; } else if (/LMV|LIGHT/.test(n)) { if (!lm || c.issued < lm) lm = c.issued; }
    });
    if (lm) add('lmv', lm, 'guess', 'Earliest date of issue found for a light motor vehicle class. Check it.');
    if (hm) add('hmv', hm, 'guess', 'Earliest date of issue found for a heavy vehicle class. Check it.');
    if (typeof d.validUpto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.validUpto)) add('dlValid', d.validUpto, 'read', 'Check the valid-until date.');
    if (d.badgeHeld === true) add('badge', 'yes', 'guess', 'A public service badge seems to be shown. Check it.');
    var cl = (d.licenceClasses || []).map(function (c) { return c && c.class; }).filter(Boolean).join(', ');
    if (cl) notes.push('Classes found on the licence: ' + cl + '. Only light (LMV) and heavy (HMV) classes are saved.');
    return { props: P, notes: notes };
  }
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
  else if (subs.length && type !== 'm12') notes.push('Maths, Science and English were not all found in the subject list. Set that answer yourself.');
  if (type === 'm12') P = toM12(P, subs.map(function (s) { return s.name; }).join(' | '), d.board, notes);
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
  if (type === 'm12') return toM12(parse('m10', text), text, text, null);
  var P = [], t = text.replace(/[|_]/g, ' ');
  function add(k, v, conf, note) { P.push({ k: k, v: String(v), conf: conf, note: note || '' }); }
  if (type === 'dl') {
    var dd = function (l) { var m = l.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*((?:19|20)\d{2})/); return m ? m[3] + '-' + two(+m[2]) + '-' + two(+m[1]) : null; };
    var lm = null, hm = null, vu = null;
    t.split(/\n/).forEach(function (l) {
      var d = dd(l); if (!d) return;
      if (/\bHMV\b|\bHGMV\b|\bHPMV\b|\bHGV\b|\bHPV\b/i.test(l)) { if (!hm || d < hm) hm = d; }
      else if (/\bLMV\b/i.test(l)) { if (!lm || d < lm) lm = d; }
      else if (/valid|validity|till|expiry/i.test(l) && /non[\s-]*transport|nt\b|transport/i.test(l) === false) { vu = vu || d; }
    });
    if (lm) add('lmv', lm, 'guess', 'Found a date beside LMV. Check it is the date of issue.');
    if (hm) add('hmv', hm, 'guess', 'Found a date beside HMV. Check it is the date of issue.');
    if (vu) add('dlValid', vu, 'guess', 'Check the valid-until date.');
    return P;
  }
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
var EXPECT = { m12: ['board12', 'year12', 'passed12', 'pct12', 'stream12'], dl: ['lmv'], m10: ['board', 'examYear', 'passed', 'pct', 'core', 'dob'], birth: ['dob'], cat: ['cat'], inc: ['income'] };
var EXPECT_NOTE = { lmv: 'Many licences list the date of issue next to each vehicle class. If you hold only a heavy or two-wheeler class, leave this blank.', dob: 'Many marksheets do not print the date of birth. Use the birth certificate if so.', core: 'Check each of Maths, Science and English on the sheet.' };
function confirmSheet(props, text, notes) {
  var have = F(), got = {}; props.forEach(function (p) { got[p.k] = 1; });
  var missing = (EXPECT[scan.type] || []).filter(function (k) { return !got[k] && !have[k]; });
  var rows = props.map(function (p, i) {
    var x = FD[p.k];
    return '<div class="prop"><input type="checkbox" id="pc' + i + '" checked aria-label="Use ' + x.l + '"><div class="main2"><b>' + x.l + '</b><span class="tag ' + p.conf + '">' + (p.conf === 'read' ? 'read clearly' : 'please check') + '</span>' + '<div style="margin-top:6px">' + ctl(x, p.v, 'pv' + i) + '</div>' + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div></div>';
  }).join('');
  var mrows = missing.map(function (k) { var x = FD[k]; return '<div class="prop"><div class="main2" style="width:100%"><b>' + x.l + '</b><span class="tag guess">not found</span><div style="margin-top:6px">' + ctl(x, '', 'mv-' + k) + '</div>' + (EXPECT_NOTE[k] ? '<small>' + esc(EXPECT_NOTE[k]) + '</small>' : '') + '</div></div>'; }).join('');
  var canSave = props.length || missing.length;
  sheet('<h2>' + (props.length ? 'Check what was read' : 'Nothing could be read') + '</h2>'
    + ((notes && notes.length) ? '<div class="status warn"><b>Please check:</b><ul style="margin:6px 0 0;padding-left:18px">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
    + costLine()
    + (props.length ? '<p class="note">Untick anything that is wrong or fix it. Only ticked details are saved.</p>' + rows : '<div class="status warn">The text was too faint or the page was cut off. Retake the photo in better light, or type the details from the document below.</div>')
    + (missing.length ? '<h3 class="h3" style="margin-top:14px">Not found on this document</h3><p class="note" style="margin-top:2px">This document should show these. Type them from the document if you can; leave blank if not.</p>' + mrows : '')
    + (text ? '<details style="margin-top:12px"><summary class="note">What the phone read</summary><pre style="white-space:pre-wrap;font-size:12px;color:var(--muted);max-height:180px;overflow:auto">' + esc(text.trim().slice(0, 1500)) + '</pre></details>' : '')
    + '<div class="row" style="margin-top:16px">' + (canSave ? '<button class="btn pri big" id="ok" type="button">Save to profile</button>' : '') + '<button class="btn" id="back" type="button">' + (canSave ? 'Cancel' : 'Retake') + '</button></div>');
  $('back').onclick = canSave ? closeSheet : function () { scanSheet(); };
  if (canSave) $('ok').onclick = function () {
    var p = prof(), dt = DOCTYPES.filter(function (d) { return d[0] === scan.type; })[0], doc = { id: uid(), label: dt[1], at: Date.now(), keys: [] }, n = 0;
    props.forEach(function (pr, i) { if ($('pc' + i).checked) { var v = $('pv' + i).value; if (v !== '') { setFact(pr.k, v, doc.id); doc.keys.push(pr.k); n++; } } });
    missing.forEach(function (k) { var v = $('mv-' + k).value; if (v !== '') { if (k === 'dob' && !(parseInt(v.slice(0, 4), 10) >= 1930)) return; setFact(k, v, doc.id); doc.keys.push(k); n++; } });
    if (!n) { toast('Nothing was ticked or typed.'); return; }
    p.docs.push(doc); save(); closeSheet(); scan = { type: 'auto', canvas: null }; location.hash = '#profile'; render(); toast('Read as ' + dt[1] + '. ' + n + ' detail' + (n === 1 ? '' : 's') + ' saved.' + (gaps(p).n ? ' Some details are still missing.' : ''));
  };
}

/* ================= shell ================= */
/* ================= first-launch intro ================= */
var ART = [
  '<svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><rect x="70" y="40" width="120" height="160" rx="12" fill="#fff" stroke="#dfe5ea" stroke-width="2"/><rect x="88" y="62" width="60" height="8" rx="4" fill="#c9d2d9"/><rect x="88" y="82" width="84" height="6" rx="3" fill="#dfe5ea"/><rect x="88" y="98" width="76" height="6" rx="3" fill="#dfe5ea"/><rect x="88" y="120" width="84" height="40" rx="6" fill="none" stroke="#c9d2d9" stroke-width="2"/><path d="M40 90V62a14 14 0 0 1 14-14h28M178 48h28a14 14 0 0 1 14 14v28M220 170v28a14 14 0 0 1-14 14h-28M82 212H54a14 14 0 0 1-14-14v-28" fill="none" stroke="#0d6e6e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M130 100l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" fill="#f6b73c"/></svg>',
  '<svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><rect x="52" y="30" width="156" height="64" rx="14" fill="#fff" stroke="#dfe5ea" stroke-width="2"/><rect x="66" y="44" width="52" height="12" rx="6" fill="#e0f2e7"/><rect x="66" y="66" width="100" height="9" rx="4.5" fill="#c9d2d9"/><circle cx="184" cy="62" r="13" fill="#0d6e6e"/><path d="M177 62l5 5 9-10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="40" y="108" width="180" height="64" rx="14" fill="#fff" stroke="#dfe5ea" stroke-width="2"/><rect x="54" y="122" width="52" height="12" rx="6" fill="#dff1f0"/><rect x="54" y="144" width="110" height="9" rx="4.5" fill="#c9d2d9"/><circle cx="198" cy="140" r="13" fill="#0d6e6e"/><path d="M191 140l5 5 9-10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="52" y="186" width="156" height="50" rx="14" fill="#fff" stroke="#dfe5ea" stroke-width="2"/><rect x="66" y="200" width="52" height="12" rx="6" fill="#fcebd0"/><rect x="66" y="218" width="84" height="8" rx="4" fill="#dfe5ea"/><path d="M214 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#f6b73c"/></svg>',
  '<svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><rect x="78" y="28" width="104" height="204" rx="20" fill="#17323f"/><rect x="88" y="46" width="84" height="168" rx="8" fill="#f2f5f7"/><rect x="108" y="34" width="44" height="6" rx="3" fill="#2f4a58"/><rect x="108" y="108" width="44" height="38" rx="8" fill="#0d6e6e"/><path d="M116 108v-9a14 14 0 0 1 28 0v9" fill="none" stroke="#0d6e6e" stroke-width="7" stroke-linecap="round"/><circle cx="130" cy="127" r="5" fill="#f6b73c"/><rect x="100" y="162" width="60" height="7" rx="3.5" fill="#c9d2d9"/><rect x="108" y="176" width="44" height="7" rx="3.5" fill="#dfe5ea"/></svg>'
];
var INTRO = [
  ['Scan your documents', 'Point your camera at a marksheet, certificate, licence or work letter. Avakasha reads it and builds your profile.'],
  ['See what suits you', 'Jobs, courses and scholarships that match your details, open right now. Add more documents and the list grows.'],
  ['Stays on your phone', 'Your details are kept on this phone, and photos are not saved. You decide what to add.']
];
function introSeen() { try { return localStorage.getItem('pa10.intro') === '1'; } catch (e) { return false; } }
function showIntro(done) {
  var el = $('intro'), i = 0, x0 = null;
  el.hidden = false; document.body.style.overflow = 'hidden';
  function finish() { try { localStorage.setItem('pa10.intro', '1'); } catch (e) {} el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; if (done) done(); }
  function draw() {
    var last = i === INTRO.length - 1;
    el.innerHTML = (last ? '' : '<button type="button" class="iskip" id="isk">Skip</button>')
      + '<div class="iart"><div class="icirc">' + ART[i] + '</div></div>'
      + '<div class="itxt"><h1>' + esc(INTRO[i][0]) + '</h1><p>' + esc(INTRO[i][1]) + '</p></div>'
      + '<div class="idots">' + INTRO.map(function (_, k) { return '<span' + (k === i ? ' class="on"' : '') + '></span>'; }).join('') + '</div>'
      + '<div class="ibtn"><button type="button" class="btn pri big" id="inx">' + (last ? 'Get started' : 'Next') + '</button></div>';
    $('inx').onclick = function () { if (last) finish(); else { i++; draw(); } };
    if ($('isk')) $('isk').onclick = finish;
  }
  el.ontouchstart = function (e) { x0 = e.touches[0].clientX; };
  el.ontouchend = function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -60 && i < INTRO.length - 1) { i++; draw(); } else if (dx > 60 && i > 0) { i--; draw(); } };
  draw();
}
function firstRun() { if (!prof() && $('sheet').hidden) addPersonSheet(true); }
var CHEVD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function route() { var h = location.hash.replace('#', ''); if (h.indexOf('job/') === 0) return { r: 'job', id: decodeURIComponent(h.slice(4)) }; if (h.indexOf('x/') === 0) return { r: 'x', id: decodeURIComponent(h.slice(2)) }; if (h === 'explore' || h === 'profile' || h === 'exams' || h === 'govt' || h === 'pvt') return { r: h }; return { r: 'home' }; }
function renderTop(r) {
  var p = prof(), b = $('avatar'), br = document.querySelector('.brand');
  br.innerHTML = r === 'profile' ? '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;vertical-align:-4px;margin-right:8px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="M15 5l-7 7 7 7"/></svg>Profile' : 'Avakasha'; br.style.color = r === 'profile' ? 'var(--ink)' : '';
  if (r === 'profile' && p) { b.className = 'avatar pill'; b.setAttribute('aria-label', 'Switch person or open menu'); b.innerHTML = '<span class="av">' + initial(p.name) + '</span><span class="an">' + esc(p.name) + '</span>' + CHEVD; b.onclick = peopleSheet; }
  else if (r === 'profile') { b.className = 'avatar pill'; b.setAttribute('aria-label', 'Menu'); b.innerHTML = '<span class="an" style="padding-left:8px">Menu</span>' + CHEVD; b.onclick = menuSheet; }
  else { b.className = 'avatar'; b.setAttribute('aria-label', 'Open profile'); b.innerHTML = '<span class="av">' + (p ? initial(p.name) : '<svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:#fff;width:20px;height:20px"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>') + '</span>'; b.onclick = function () { location.hash = '#profile'; }; }
}
function render() {
  var rt = route(), h = rt.r;
  stopHome();
  document.body.classList.toggle('is-detail', h === 'job' || h === 'x');
  document.body.classList.toggle('is-sub', h === 'exams' || h === 'govt' || h === 'pvt');
  document.body.classList.toggle('is-home', h === 'home');
  $('nav-home').setAttribute('aria-current', h === 'home' ? 'page' : 'false'); $('nav-explore').setAttribute('aria-current', h === 'explore' ? 'page' : 'false');
  renderTop(h);
  if (!DATA) return;
  if (h === 'job') renderDetail(rt.id); else if (h === 'x') renderX(rt.id); else if (h === 'exams') renderExams(); else if (h === 'govt') renderGovt(); else if (h === 'pvt') renderPvt(); else if (h === 'explore') renderExplore(); else if (h === 'profile') renderProfile(); else renderHome();
}
window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
$('nav-scan').onclick = function () { if (!prof()) { addPersonSheet(true, scanFlow); return; } scanFlow(); };
wireCamera();
(function () {
  var sp = $('splash'), seen = false; try { seen = sessionStorage.getItem('pa10.splash') === '1'; sessionStorage.setItem('pa10.splash', '1'); } catch (e) {}
  if (seen) { sp.remove(); return; }
  setTimeout(function () { sp.classList.add('out'); setTimeout(function () { sp.remove(); }, 400); }, 1500);
})();

load();
/* A fresh launch opens on Home; a refresh (pull down) stays on the page you are on. */
try { var navT = (performance.getEntriesByType('navigation')[0] || {}).type; if (location.hash && navT !== 'reload') history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
try { TAB = sessionStorage.getItem('pa10.tab') || 'work'; } catch (e) {}
if (!DB.active && DB.profiles.length) DB.active = DB.profiles[0].id;
if (DB.profiles.length && !introSeen()) { try { localStorage.setItem('pa10.intro', '1'); } catch (e) {} }
if (!introSeen() || !DB.profiles.length) showIntro(firstRun);
Promise.all([fetch('data/records.json').then(function (r) { return r.json(); }), fetch('data/extra.json').then(function (r) { return r.json(); }).catch(function () { return null; }), getLive()]).then(function (a) { DATA = a[0]; if (a[1]) EXTRA = a[1]; mergeLive(a[2]); render(); }).catch(function () { $('app').innerHTML = '<div class="card empty"><h2 class="h2">Could not load the records</h2><p>Connect to the internet once and reopen the app.</p></div>'; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(function (r) { r.update(); }).catch(function () {});
}
window.__app = { DB: function () { return DB; }, parse: parse, findDob: findDob };
})();
