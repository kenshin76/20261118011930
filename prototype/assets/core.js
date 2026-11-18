/* FIXFLOW [프로토타입] — 상태·규칙·라우터
   한 건(Job)의 상태 전이, 추가 작업 이중 승인, 수금 대조 규칙을 브라우저 안에서 시연합니다.
   실제 문자 발송·사진 저장 서버·결제와 연결되지 않습니다. */
(function () {
  'use strict';
  const KEY = 'fixflow.proto.v1';
  const APP = (window.APP = { routes: [], live: null });
  const U = (APP.U = {});
  const HOUR = 3600000, DAY = 86400000;

  /* ---------- 유틸 ---------- */
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');
  U.pad = (n) => String(n).padStart(2, '0');
  U.d = (t) => { const d = new Date(t); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`; };
  U.dt = (t) => { const d = new Date(t); return `${U.d(t)} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
  U.md = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
  U.ago = (t) => {
    const s = Math.round((Date.now() - t) / 1000); const a = Math.abs(s); const f = s < 0;
    const v = a < 60 ? '방금' : a < 3600 ? Math.floor(a / 60) + '분' : a < 86400 ? Math.floor(a / 3600) + '시간' : Math.floor(a / 86400) + '일';
    return v === '방금' ? '방금' : f ? v + ' 후' : v + ' 전';
  };
  U.dur = (ms) => { const h = Math.floor(ms / HOUR); return h >= 24 ? Math.floor(h / 24) + '일 ' + (h % 24) + '시간' : h >= 1 ? h + '시간' : Math.max(1, Math.round(ms / 60000)) + '분'; };
  U.qs = (s, el = document) => el.querySelector(s);
  U.qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  U.uid = (p) => p + Math.random().toString(36).slice(2, 8);
  U.maskPhone = (p) => p.replace(/-(\d{4})-/, '-****-');
  U.csv = (rows) => '﻿' + rows.map((r) => r.map((c) => { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n');
  U.dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400); };
  U.xlsx = (name, rows, sheet) => {
    if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet || 'Sheet1'); XLSX.writeFile(wb, name); return; }
    U.dl(name.replace(/\.xlsx$/, '.csv'), U.csv(rows)); APP.toast('엑셀 모듈을 불러오지 못해 CSV로 내려받았습니다', 'warn');
  };
  APP.HOUR = HOUR; APP.DAY = DAY;

  /* ---------- 저장 ---------- */
  let S = null; let dirty = false;
  APP.get = () => S;
  APP.save = () => { dirty = true; };
  let viewId = 0;
  const sessionKey = () => JSON.stringify(S && S.session);
  APP.scope = () => { const v = viewId, key = sessionKey(); return () => v === viewId && key === sessionKey(); };
  APP.defer = (fn, ms) => { const valid = APP.scope(); return setTimeout(() => { if (valid()) fn(); }, ms); };
  APP.money = (value, zero) => { const text = String(value == null ? '' : value).replace(/,/g, '').trim(); const n = Number(text); return /^\d+$/.test(text) && Number.isSafeInteger(n) && n >= (zero ? 0 : 1) && n <= 1000000000 ? n : null; };
  APP.validDate = (value) => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(value)) return false; const date = new Date(value.replace(' ', 'T')); return Number.isFinite(date.getTime()) && U.dt(date.getTime()) === value.replace('T', ' '); };
  APP.allowed = (role, id, job) => {
    if (!S) return false;
    if (role === '관리자') return document.body.dataset.area === 'admin' && S.session.admin === 'admin';
    if (role === '고객') return (document.body.dataset.area === 'admin' && S.session.admin === 'admin') || (S.session.cust === id && (!job || job.custId === id));
    if (role === '협력업체') { const p = S.partners.find(x => x.id === id); return S.session.partner === id && p && p.status === '승인' && (!job || job.selectedQuote && job.selectedQuote.partnerId === id); }
    return role === '시스템';
  };
  APP.require = (role, id, job) => { const ok = APP.allowed(role, id, job); if (!ok) APP.toast('계정 또는 작업 권한이 변경되었습니다. 다시 확인해 주세요', 'warn'); return ok; };
  function persist() { if (!dirty) return; dirty = false; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }
  APP.reset = () => { seenKeys.clear(); if (APP.clearUploads) APP.clearUploads(); try { localStorage.removeItem(KEY); } catch (e) {} S = seed(); dirty = true; persist(); };

  /* ---------- 상태 규칙 ---------- */
  const STAGES = ['접수', '견적 요청', '견적 공개', '업체 확정', '방문 예정', '작업 중', '완료 보류', '고객 확인 대기', '보완 요청', '작업 완료'];
  const TRANS = {
    '접수': ['견적 요청'],
    '견적 요청': ['견적 공개'],
    '견적 공개': ['업체 확정', '견적 요청'],
    '업체 확정': ['방문 예정', '견적 공개'],
    '방문 예정': ['작업 중', '업체 확정'],
    '작업 중': ['고객 확인 대기', '완료 보류'],
    '완료 보류': ['고객 확인 대기'],
    '고객 확인 대기': ['작업 완료', '보완 요청'],
    '보완 요청': ['고객 확인 대기'],
    '작업 완료': []
  };
  APP.STAGES = STAGES; APP.TRANS = TRANS;
  APP.STEPS = ['접수', '견적', '선택', '일정', '작업', '완료', '수금', 'A/S'];
  APP.stepIndex = function (j) {
    const m = { '접수': 0, '견적 요청': 1, '견적 공개': 1, '업체 확정': 3, '방문 예정': 3, '작업 중': 4, '완료 보류': 4, '고객 확인 대기': 5, '보완 요청': 5, '작업 완료': 6 };
    let i = m[j.stage];
    if (j.stage === '견적 공개') i = 2;
    if (j.stage === '작업 완료') { const p = APP.payStatus(j).label; i = p === '수금 일치' ? 7 : 6; if ((j.as || []).length) i = 7; }
    return i;
  };

  const jobById = (APP.jobById = (id) => S.jobs.find((j) => j.id === id));
  const partnerById = (APP.partnerById = (id) => S.partners.find((p) => p.id === id));
  const custById = (APP.custById = (id) => S.customers.find((c) => c.id === id));
  APP.siteById = (id) => S.sites.find((s) => s.id === id);
  APP.cat = (id) => D.CATS.find((c) => c.id === id);

  function actorName(role, id) {
    if (role === '관리자') return '운영 관리자';
    if (role === '협력업체') return (partnerById(id) || {}).name || '협력업체';
    if (role === '고객') return (custById(id) || {}).name || '고객';
    return '시스템';
  }
  APP.actorName = actorName;

  APP.transition = function (j, to, role, by, reason, at) {
    if (!APP.require(role, by, j)) return false;
    const destinations = { '고객': ['업체 확정', '견적 공개', '작업 완료', '보완 요청'], '협력업체': ['방문 예정', '작업 중', '완료 보류', '고객 확인 대기'], '관리자': ['견적 요청', '견적 공개'], '시스템': ['고객 확인 대기', '견적 요청'] };
    if (!(destinations[role] || []).includes(to) || role === '고객' && ![['견적 공개','업체 확정'],['업체 확정','견적 공개'],['고객 확인 대기','작업 완료'],['고객 확인 대기','보완 요청']].some(([from, next]) => j.stage === from && to === next)) { APP.toast('이 단계는 담당 권한자가 처리해야 합니다', 'warn'); return false; }
    if (to === '작업 완료' && (!j.completion || j.cos.some(APP.coOpen))) { APP.toast('완료 보고와 추가 작업 처리 상태를 확인해 주세요', 'warn'); return false; }
    const ok = (TRANS[j.stage] || []).includes(to);
    if (!ok) { APP.toast(`허용되지 않는 상태 변경입니다 (${j.stage} → ${to})`, 'err'); return false; }
    const t = at || Date.now();
    j.hist.push({ at: t, from: j.stage, to, role, by: actorName(role, by), reason: reason || '' });
    j.stage = to; j.stageAt = t; APP.save();
    return true;
  };
  APP.log = function (j, role, by, text, kind, at) { j.log.push({ at: at || Date.now(), role, by: actorName(role, by), text, kind: kind || 'info' }); APP.save(); };

  /* 같은 요청은 한 번만 반영 (요청 고유 키) */
  const seenKeys = new Set();
  APP.once = function (key, fn) { if (seenKeys.has(key)) { APP.toast('이미 처리된 요청입니다', 'info'); return false; } const result = fn(); if (result === false) return false; seenKeys.add(key); return true; };

  /* ---------- 견적 ---------- */
  APP.quoteTotal = (q) => { const sub = (+q.labor || 0) + (+q.material || 0); const tax = Math.round(sub * (q.taxRate || 0) / 100); return { sub, tax, total: sub + tax }; };
  APP.quoteState = function (j, q) {
    if (j.selectedQuote && j.selectedQuote.quoteId === q.id) return '선택됨';
    if (q.canceled) return '취소';
    if (q.validUntil < Date.now()) return '유효기간 경과';
    if (j.selectedQuote) return '미선택';
    return q.published ? '공개' : '제출됨';
  };
  APP.reqState = function (r) { if (r.quoteId) return '응답'; if (r.closed) return '마감(미응답)'; if (r.deadline < Date.now()) return '응답 마감 경과'; return '응답 대기'; };
  APP.eligible = (j) => S.partners.filter((p) => p.status === '승인' && p.cats.includes(j.cat) && p.regions.includes(APP.siteById(j.siteId) ? APP.siteById(j.siteId).region : j.region));

  APP.submitQuote = function (j, pid, data) {
    const r = j && j.reqs.find(x => x.partnerId === pid);
    if (!j || !APP.require('협력업체', pid) || !r || r.closed || r.deadline <= Date.now() || j.selectedQuote || !['견적 요청', '견적 공개'].includes(j.stage) || !APP.eligible(j).some(p => p.id === pid)) { APP.toast('견적 요청의 기한·진행 상태·담당 업체를 다시 확인해 주세요', 'warn'); return false; }
    const previous = j.quotes.find(q => q.id === r.quoteId);
    if ((previous ? previous.id : null) !== (data.prevId || null)) { APP.toast('더 최근 견적이 있습니다. 목록에서 다시 열어 주세요', 'warn'); return false; }
    const labor = APP.money(data.labor), material = APP.money(data.material || 0, true);
    if (labor === null || material === null || !['확정','조건부','진단형'].includes(data.type) || ![3,5,7,14].includes(+data.days) || !String(data.scope || '').trim() || !String(data.schedule || '').trim() || data.type !== '확정' && !String(data.cond || '').trim()) { APP.toast('견적 금액·유형·범위·일정·조건을 확인해 주세요', 'warn'); return false; }
    const review = j.stage === '견적 공개';
    const q = { id: U.uid('q'), partnerId: pid, ver: previous ? previous.ver + 1 : 1, prev: previous ? previous.id : null, type: data.type, labor, material, taxRate: 10, scope: data.scope.trim(), schedule: data.schedule.trim(), cond: data.type === '확정' ? '' : data.cond.trim(), at: Date.now(), validUntil: Date.now() + (+data.days) * DAY, published: false };
    Object.assign(q, APP.quoteTotal(q));
    if (previous) previous.canceled = true;
    j.quotes.push(q); r.quoteId = q.id;
    if (review) { j.quoteReview = { at: Date.now(), partnerId: pid }; APP.transition(j, '견적 요청', '시스템', null, '수정 견적 접수 · 운영자 재검토 후 다시 공개'); }
    APP.log(j, '협력업체', pid, `견적 제출 v${q.ver} · ${q.type} · ${U.won(q.total)}원${previous ? ' · 이전 버전 보존, 운영자 재검토 대기' : ''}`);
    return q;
  };

  APP.proxyDetails = function (data) {
    if (!APP.require('관리자')) return false;
    const customer = APP.custById(data.custId), cat = APP.cat(data.cat);
    const site = data.siteId ? APP.siteById(data.siteId) : null;
    const consent = data.consent || {};
    if (!customer || !cat || !cat.q.every((_, i) => data.answers && data.answers[i]) || data.siteId && (!site || !customer.siteIds.includes(data.siteId))) { APP.toast('고객·사업장과 질문 답변을 다시 확인해 주세요', 'warn'); return false; }
    const addr = String(data.addr || '').trim();
    if (!site && !addr) { APP.toast('작업할 주소를 입력해 주세요', 'warn'); return false; }
    if (!consent.confirmed || consent.custId !== customer.id || !String(consent.note || '').trim()) { APP.toast('현재 고객의 대리접수 동의와 확인 근거가 필요합니다', 'warn'); return false; }
    if (!APP.validDate(consent.time) || new Date(consent.time.replace(' ', 'T')).getTime() > Date.now()) { APP.toast('동의 시각을 현재 또는 과거의 올바른 일시로 입력해 주세요', 'warn'); return false; }
    return { customer, cat, site, addr, consent: { custId: customer.id, time: consent.time.replace('T', ' '), method: '전화', note: consent.note.trim() } };
  };

  /* ---------- 추가 작업 (이중 승인) ---------- */
  APP.coStatus = function (co) {
    if (co.withdrawn) return '철회';
    const a = co.approvals.find((x) => x.role === '관리자' && x.seq === co.seq);
    const c = co.approvals.find((x) => x.role === '고객' && x.seq === co.seq);
    if ((a && a.decision === '반려') || (c && c.decision === '반려')) return '반려';
    if (a && c && a.amount === co.amount && c.amount === co.amount && (!a.scope || a.scope === co.reason) && (!c.scope || c.scope === co.reason)) return '확정';
    if (!c && co.deadline < Date.now() && a) return '응답 기한 경과';
    if (a) return '고객 승인 대기';
    if (c) return '관리자 확인 대기';
    if (co.deadline < Date.now()) return '응답 기한 경과';
    return '요청됨';
  };
  APP.coOpen = (co) => !['확정', '반려', '철회'].includes(APP.coStatus(co));
  APP.coBadge = function (co) {
    const s = APP.coStatus(co);
    const c = { '확정': 'g', '반려': 'r', '철회': 'n', '응답 기한 경과': 'r', '고객 승인 대기': 'a', '관리자 확인 대기': 'a', '요청됨': 'b' }[s];
    return `<span class="bdg ${c}">${s}</span>`;
  };
  APP.approveCO = function (j, co, role, by, decision, opt) {
    opt = opt || {};
    if (!['관리자','고객'].includes(role) || !j || !co || !j.cos.includes(co) || !APP.require(opt.inputRole || role, opt.inputRole === '관리자' ? null : by, j) || !['승인','반려'].includes(decision)) return false;
    if (!['작업 중','완료 보류'].includes(j.stage) || APP.money(co.amount) === null || decision === '승인' && co.deadline <= Date.now()) { APP.toast('처리 단계와 응답 기한을 확인해 주세요. 기한이 지났다면 운영자에게 재안내를 요청하세요', 'warn'); return false; }
    if (opt.method === '전화 대리' && (!opt.consent || !APP.validDate(opt.consent.time) || !opt.consent.note.trim())) { APP.toast('고객 동의 시각과 확인 근거가 필요합니다', 'warn'); return false; }
    if (!APP.coOpen(co) && APP.coStatus(co) !== '응답 기한 경과') { APP.toast('이미 종결된 추가 작업입니다', 'warn'); return false; }
    if (co.approvals.some((x) => x.role === role && x.seq === co.seq)) { APP.toast(`${role} 판단은 이미 기록되어 있습니다`, 'warn'); return false; }
    const rec = { id: U.uid('ap'), seq: co.seq, role, decision, at: Date.now(), by: actorName(opt.inputRole || role, by), method: opt.method || '화면', amount: co.amount, scope: co.reason, reason: opt.reason || '' };
    if (opt.consent) rec.consent = opt.consent;
    co.approvals.push(rec);
    APP.log(j, opt.inputRole || role, by, `추가 작업 ${co.seq}차 ${role} ${decision}${opt.method === '전화 대리' ? ' (전화 대리 입력 · 동의 ' + opt.consent.time + ')' : ''} · ${U.won(co.amount)}원${opt.reason ? ' · ' + opt.reason : ''}`, decision === '승인' ? 'ok' : 'warn');
    afterCO(j);
    return true;
  };
  APP.withdrawCO = function (j, co, role, by, reason) { if (!APP.require(role, by, j) || !j.cos.includes(co) || !APP.coOpen(co) || !String(reason || '').trim()) { APP.toast('철회할 요청과 사유를 확인해 주세요', 'warn'); return false; } co.withdrawn = { at: Date.now(), by: actorName(role, by), reason }; APP.log(j, role, by, `추가 작업 ${co.seq}차 철회 · ${reason}`, 'warn'); afterCO(j); };
  APP.requestCO = function (j, by, data, prev) {
    if (!APP.require('협력업체', by, j) || !['작업 중','완료 보류'].includes(j.stage) || APP.money(data.amount) === null || !String(data.reason || '').trim() || prev && (!j.cos.includes(prev) || APP.coStatus(prev) !== '반려' || j.cos.some(c => c.prevId === prev.id))) { APP.toast('추가 작업의 상태·사유·금액을 확인해 주세요', 'warn'); return false; }
    const co = { id: U.uid('co'), seq: prev ? prev.seq + 1 : (j.cos.length ? Math.max(...j.cos.map((c) => c.seq)) + 1 : 1), prevId: prev ? prev.id : null, reason: data.reason, amount: data.amount, photos: data.photos || [], at: Date.now(), deadline: Date.now() + 24 * HOUR, approvals: [] };
    j.cos.push(co);
    APP.log(j, '협력업체', by, `추가 작업 ${co.seq}차 요청 · ${data.reason} · ${U.won(data.amount)}원${prev ? ' (' + prev.seq + '차 금액·범위 변경)' : ''}`, 'info');
    return co;
  };
  function afterCO(j) {
    if (j.stage === '완료 보류' && !j.cos.some(APP.coOpen)) {
      APP.transition(j, '고객 확인 대기', '시스템', null, '미해결 추가 작업이 종결되어 고객 완료 확인으로 진행');
    }
    APP.save();
  }

  /* ---------- 금액 ---------- */
  APP.billed = function (j) {
    const base = j.selectedQuote ? j.selectedQuote.total : 0;
    const add = j.cos.filter((c) => APP.coStatus(c) === '확정').reduce((a, c) => a + c.amount, 0);
    return { base, add, total: base + add };
  };
  APP.latestPay = (j, side) => { const r = j.pays.filter((p) => p.side === side); return r.length ? r[r.length - 1] : null; };
  APP.payStatus = function (j) {
    const c = APP.latestPay(j, '고객'); const p = APP.latestPay(j, '협력업체'); const b = APP.billed(j).total;
    const res = { c, p, billed: b, diffs: [] };
    if (!c && !p) return Object.assign(res, { label: '수금 대기', cls: 'n' });
    if (!c || !p) return Object.assign(res, { label: '한쪽 기록됨', cls: 'a', missing: !c ? '고객 지급 기록' : '협력업체 수령 기록' });
    if (c.amount !== p.amount) res.diffs.push('금액');
    if (c.date.replace('T', ' ') !== p.date.replace('T', ' ')) res.diffs.push('일시');
    if (c.method !== p.method) res.diffs.push('방법');
    const handled = j.payReview && j.payReview.after >= j.pays.length;
    if (res.diffs.length) return Object.assign(res, handled ? { label: '확인 처리됨', cls: 'v', open: true } : { label: '불일치', cls: 'r' });
    if (c.amount !== b) return Object.assign(res, handled ? { label: '확인 처리됨', cls: 'v', open: true, gap: c.amount - b } : { label: '청구 금액 차이', cls: 'a', gap: c.amount - b });
    return Object.assign(res, { label: '수금 일치', cls: 'g' });
  };
  APP.payBadge = (j) => { const s = APP.payStatus(j); return `<span class="bdg ${s.cls}">${s.label}</span>`; };
  APP.addPay = function (j, side, rec, role, by, opt) {
    opt = opt || {};
    if ((!opt.inputRole && side !== role) || !j || !j.selectedQuote || !['고객','협력업체'].includes(side) || !APP.require(opt.inputRole || role, opt.inputRole === '관리자' ? null : by, j) || !['작업 중','완료 보류','고객 확인 대기','작업 완료'].includes(j.stage) || APP.money(rec.amount) === null || !APP.validDate(rec.date) || !D.PAY_METHODS.includes(rec.method)) { APP.toast('수금 기록의 권한·금액·일시·방법을 확인해 주세요', 'warn'); return false; }
    const prev = APP.latestPay(j, side);
    const r = { id: U.uid('pay'), side, amount: +rec.amount, date: rec.date, method: rec.method, at: Date.now(), by: actorName(opt.inputRole || role, by), supersedes: opt.correct && prev ? prev.id : null, note: opt.note || '' };
    j.pays.push(r);
    APP.log(j, opt.inputRole || role, by, `${side === '고객' ? '고객 지급' : '협력업체 수령'} 기록${r.supersedes ? ' 정정(원래 기록 보존)' : ''} · ${U.won(r.amount)}원 · ${r.date} · ${r.method}${opt.inputRole === '관리자' ? ' · 관리자 대리 입력' : ''}`, 'pay');
    APP.save();
    return r;
  };

  /* ---------- 확인 필요 ---------- */
  APP.todo = function () {
    const out = []; const now = Date.now();
    S.jobs.forEach((j) => {
      const site = APP.siteById(j.siteId); const name = site ? site.name : custById(j.custId).name;
      const add = (lv, kind, reason, since, tab) => out.push({ lv, kind, reason, since, job: j, name, tab });
      if (j.stage === '접수') add('b', '견적 요청 필요', '적격 업체를 골라 견적을 요청하세요', j.stageAt, 'quote');
      if (j.stage === '견적 요청') {
        const rs = j.reqs; const late = rs.filter((r) => APP.reqState(r) === '응답 마감 경과'); const soon = rs.filter((r) => APP.reqState(r) === '응답 대기' && r.deadline - now < 6 * HOUR);
        if (late.length) add('r', '견적 미응답', `${late.map((r) => partnerById(r.partnerId).name).join(', ')} 응답 마감 경과 · 대체 업체 재요청 검토`, late[0].deadline, 'quote');
        else if (soon.length) add('a', '응답 마감 임박', `${soon.length}곳 응답 대기 · 마감 ${U.ago(soon[0].deadline)}`, j.stageAt, 'quote');
        else if (j.quoteReview || rs.filter((r) => r.quoteId).length && rs.every((r) => APP.reqState(r) !== '응답 대기')) add('b', '견적 공개 가능', j.quoteReview ? '수정 견적이 접수되었습니다 · 검토 후 다시 공개' : '응답이 모였습니다 · 확인 후 공개', j.stageAt, 'quote');
      }
      if (j.stage === '견적 공개' && now - j.stageAt > 20 * HOUR) add('a', '고객 선택 대기', `견적 공개 후 ${U.dur(now - j.stageAt)} · 미응답은 선택으로 처리하지 않음`, j.stageAt, 'quote');
      j.cos.forEach((co) => {
        const s = APP.coStatus(co);
        if (s === '요청됨') add('a', '추가 작업 관리자 검토', `${co.seq}차 · ${co.reason} · ${U.won(co.amount)}원`, co.at, 'co');
        if (s === '고객 승인 대기') add('b', '추가 작업 고객 승인 대기', `${co.seq}차 · 관리자 승인 완료 · 고객 응답 기한 ${U.ago(co.deadline)}`, co.at, 'co');
        if (s === '관리자 확인 대기') add('a', '추가 작업 관리자 확인', `${co.seq}차 · 고객 승인 완료`, co.at, 'co');
        if (s === '응답 기한 경과') add('r', '추가 작업 응답 기한 경과', `${co.seq}차 · 승인으로 처리하지 않음 · 재안내 또는 철회`, co.deadline, 'co');
      });
      if (j.stage === '완료 보류') add('r', '완료 보류', '미해결 유상 추가 작업이 있어 완료로 넘어가지 않습니다', j.stageAt, 'co');
      if (j.stage === '고객 확인 대기' && now - j.stageAt > 12 * HOUR) add('a', '고객 완료 확인 대기', `완료 보고 후 ${U.dur(now - j.stageAt)} · 자동 완료하지 않음`, j.stageAt, 'work');
      if (j.stage === '보완 요청') add('a', '보완 요청 처리 중', (j.revisions[j.revisions.length - 1] || {}).reason || '', j.stageAt, 'work');
      if (j.stage === '작업 완료') {
        const ps = APP.payStatus(j);
        if (ps.label === '수금 대기' && now - j.stageAt > 24 * HOUR) add('a', '수금 미기록', '고객 지급·협력업체 수령 기록이 없습니다', j.stageAt, 'pay');
        if (ps.label === '한쪽 기록됨') add('a', '수금 한쪽 미기록', `${ps.missing} 없음`, (ps.c || ps.p).at, 'pay');
        if (ps.open) add('a', '수금 재확인 필요', '확인 근거가 기록되어 있습니다. 실제 금액·일시·방법의 차이를 정정해 주세요', j.payReview.at, 'pay');
        if (ps.label === '불일치') add('r', '수금 불일치', `${ps.diffs.join('·')} 기록이 서로 다릅니다`, Math.max(ps.c.at, ps.p.at), 'pay');
        if (ps.label === '청구 금액 차이') add('a', '청구 금액 차이', `청구 예정과 ${U.won(Math.abs(ps.gap))}원 차이`, Math.max(ps.c.at, ps.p.at), 'pay');
      }
      (j.as || []).forEach((a) => { if (a.status !== 'A/S 완료') add(a.status === 'A/S 접수' ? 'r' : 'b', a.status, a.desc, a.at, 'as'); });
    });
    S.partners.filter((p) => p.status === '승인 대기').forEach((p) => out.push({ lv: 'b', kind: '협력업체 가입 승인', reason: `${p.name} · ${p.cats.map((c) => APP.cat(c).name).join(', ')}`, since: new Date(p.joined).getTime(), partner: p, name: p.name }));
    const order = { r: 0, a: 1, b: 2 };
    return out.sort((x, y) => order[x.lv] - order[y.lv] || x.since - y.since);
  };

  /* ---------- 시드 ---------- */
  function seed() {
    const now = Date.now();
    const st = { v: 1, partners: JSON.parse(JSON.stringify(D.PARTNERS)), sites: [], customers: [], jobs: [], seq: 1200, session: { cust: null, partner: null, admin: null }, demo: { netFail: false } };
    const owners = ['김민지', '이서준', '박지우', '최하은', '정도윤', '강서연', '조민준', '윤하늘', '장예준', '임수아', '한지호', '오유진', '서시우', '신다은', '권현우', '황채원', '안건우', '송나연', '류준서', '홍소율'];
    D.SITE_NAMES.forEach((n, i) => {
      const cid = 'c' + (i + 1);
      st.customers.push({ id: cid, name: owners[i], phone: i === 1 ? '010-1234-5678' : '010-' + (2100 + i * 137) + '-' + (3300 + i * 211), kind: '사업자', siteIds: ['s' + (i + 1)] });
      st.sites.push({ id: 's' + (i + 1), name: n, kind: D.SITE_KIND[i % D.SITE_KIND.length], region: D.REGIONS[i % 3 === 2 ? 2 : i % 2], owner: cid, addr: `${D.REGIONS[i % 3 === 2 ? 2 : i % 2].split(' ')[0]}시 가상로 ${10 + i * 7}` });
    });
    st.customers.push({ id: 'c21', name: '문지원', phone: '010-5555-0101', kind: '개인', siteIds: [], region: '사천 동부', addr: '사천시 가상로 301 (개인)' });
    S = st;
    const ph = (label, tone) => ({ id: U.uid('ph'), kind: 'ph', label, tone: tone || 0 });
    let n = 0;
    function job(o) {
      n++;
      const at = now - o.ago;
      const site = o.site ? APP.siteById(o.site) : null;
      const j = { id: 'J-' + (2611 + Math.floor(n / 10)) + '-' + String(1000 + n).slice(1), custId: site ? site.owner : o.cust, siteId: o.site || null, region: site ? site.region : '사천 동부', cat: o.cat, answers: o.answers, memo: o.memo || '', photos: o.photos || [ph('접수 사진 1', 0), ph('접수 사진 2', 1)], via: o.via || '고객', consent: o.consent || null,
        at, stage: '접수', stageAt: at, hist: [{ at, from: '', to: '접수', role: o.via === '전화 대리접수' ? '관리자' : '고객', by: o.via === '전화 대리접수' ? '운영 관리자' : '', reason: o.via === '전화 대리접수' ? '전화 대리접수 · 고객 동의 기록' : '문자 인증 후 비회원 접수' }],
        log: [], reqs: [], quotes: [], selectedQuote: null, visits: [], work: { before: [], after: [], noPhoto: null, startedAt: null }, cos: [], completion: null, revisions: [], pays: [], payReview: null, as: [] };
      j.hist[0].by = j.hist[0].by || custById(j.custId).name;
      st.jobs.push(j);
      return j;
    }
    const T = (j, to, role, by, reason, t) => { j.hist.push({ at: t, from: j.stage, to, role, by: actorName(role, by), reason: reason || '' }); j.stage = to; j.stageAt = t; };
    const L = (j, role, by, text, kind, t) => j.log.push({ at: t, role, by: actorName(role, by), text, kind: kind || 'info' });
    function request(j, pids, t, dl) { pids.forEach((pid) => j.reqs.push({ id: U.uid('rq'), partnerId: pid, at: t, deadline: t + (dl || 24 * HOUR), quoteId: null, closed: false })); T(j, '견적 요청', '관리자', null, `적격 업체 ${pids.length}곳에 견적 요청`, t); }
    function quote(j, pid, o, t) {
      const q = Object.assign({ id: U.uid('q'), partnerId: pid, ver: 1, type: '확정', taxRate: 10, at: t, validUntil: t + 5 * DAY, published: false, scope: '', schedule: '', cond: '' }, o);
      Object.assign(q, APP.quoteTotal(q)); j.quotes.push(q);
      const r = j.reqs.find((x) => x.partnerId === pid); if (r) r.quoteId = q.id;
      L(j, '협력업체', pid, `견적 제출 v1 · ${q.type} · ${U.won(q.total)}원`, 'info', t);
      return q;
    }
    function publish(j, t) { j.quotes.forEach((q) => (q.published = true)); j.reqs.forEach((r) => { if (!r.quoteId) r.closed = true; }); T(j, '견적 공개', '관리자', null, `견적 ${j.quotes.length}개 공개`, t); }
    function select(j, q, t) { j.selectedQuote = { quoteId: q.id, partnerId: q.partnerId, ver: q.ver, type: q.type, labor: q.labor, material: q.material, tax: q.tax, total: q.total, scope: q.scope, cond: q.cond, at: t }; T(j, '업체 확정', '고객', j.custId, `${partnerById(q.partnerId).name} 견적 선택 · ${U.won(q.total)}원 고정`, t); }
    function visit(j, t, when) { j.visits.push({ at: t, when, by: actorName('협력업체', j.selectedQuote.partnerId), note: '' }); T(j, '방문 예정', '협력업체', j.selectedQuote.partnerId, `방문 일정 ${U.dt(when)}`, t); }
    function start(j, t) { j.work.before = [ph('작업 전 1', 2), ph('작업 전 2', 3)]; j.work.startedAt = t; T(j, '작업 중', '협력업체', j.selectedQuote.partnerId, '현장 도착 · 작업 전 사진 2장', t); }
    function co(j, o, t) { const c = { id: U.uid('co'), seq: o.seq || 1, prevId: null, reason: o.reason, amount: o.amount, photos: [ph('추가 작업 사진', 4)], at: t, deadline: t + (o.dl || 24 * HOUR), approvals: [] }; j.cos.push(c); L(j, '협력업체', j.selectedQuote.partnerId, `추가 작업 ${c.seq}차 요청 · ${o.reason} · ${U.won(o.amount)}원`, 'info', t); return c; }
    function ap(j, c, role, decision, t, extra) { c.approvals.push(Object.assign({ id: U.uid('ap'), seq: c.seq, role, decision, at: t, by: role === '관리자' ? '운영 관리자' : custById(j.custId).name, method: '화면', amount: c.amount, reason: '' }, extra || {})); L(j, role, role === '고객' ? j.custId : null, `추가 작업 ${c.seq}차 ${role} ${decision} · ${U.won(c.amount)}원`, decision === '승인' ? 'ok' : 'warn', t); }
    function report(j, t, hold) {
      const cat = APP.cat(j.cat);
      j.work.after = [ph('작업 후 1', 5), ph('작업 후 2', 6)];
      j.completion = { at: t, checklist: cat.check.map((c) => ({ item: c, ok: true })), note: '점검 완료', photos: j.work.after };
      T(j, hold ? '완료 보류' : '고객 확인 대기', '협력업체', j.selectedQuote.partnerId, hold ? '완료 보고 · 미해결 추가 작업으로 보류' : '완료 보고 · 고객 확인 요청', t);
    }
    function confirm(j, t) { T(j, '작업 완료', '고객', j.custId, '고객 완료 확인', t); }
    function pay(j, side, amount, t, method, dateOverride) { const r = { id: U.uid('pay'), side, amount, date: dateOverride || U.dt(t), method, at: t, by: side === '고객' ? custById(j.custId).name : partnerById(j.selectedQuote.partnerId).name, supersedes: null, note: '' }; j.pays.push(r); L(j, side === '고객' ? '고객' : '협력업체', side === '고객' ? j.custId : j.selectedQuote.partnerId, `${side === '고객' ? '고객 지급' : '협력업체 수령'} 기록 · ${U.won(amount)}원 · ${r.date} · ${method}`, 'pay', t); }
    function full(j, pid, total, t0, steps) {
      request(j, [pid], t0 + HOUR);
      const q = quote(j, pid, { labor: Math.round(total / 1.1 * 0.7 / 1000) * 1000, material: Math.round(total / 1.1 * 0.3 / 1000) * 1000, scope: '현장 확인 범위 내 작업', schedule: '2일 내' }, t0 + 4 * HOUR);
      publish(j, t0 + 6 * HOUR); select(j, q, t0 + 9 * HOUR); visit(j, t0 + 10 * HOUR, t0 + 26 * HOUR); start(j, t0 + 26 * HOUR);
      if (steps === 'start') return q;
      report(j, t0 + 30 * HOUR); return q;
    }
    const ans = (cat, picks) => APP.cat(cat).q.map((qq, i) => ({ q: qq[0], a: qq[1][picks[i] || 0] }));

    // 1. 전화 대리접수 · 견적 요청 전
    job({ site: 's7', cat: 'elec', ago: 2 * HOUR, answers: ans('elec', [0, 0, 0]), via: '전화 대리접수', consent: { time: U.dt(now - 2 * HOUR - 300000), method: '전화', note: '대표 통화로 접수·문자 안내 동의' }, photos: [], memo: '사진은 고객이 나중에 추가 예정' });
    // 2. 견적 요청 중 · 미응답 1곳
    let j = job({ site: 's2', cat: 'plumb', ago: 30 * HOUR, answers: ans('plumb', [0, 1, 0]) });
    request(j, ['p1', 'p6'], now - 28 * HOUR, 20 * HOUR); quote(j, 'p1', { labor: 120000, material: 40000, scope: '싱크대 하부 배관 교체', schedule: '내일 오전' }, now - 25 * HOUR);
    // 3. 견적 공개 · 고객 선택 대기 (데모 고객 c2)
    j = job({ site: 's2', cat: 'paint', ago: 3 * DAY, answers: ans('paint', [1, 1, 0]) });
    request(j, ['p4', 'p6'], now - 70 * HOUR);
    quote(j, 'p4', { type: '확정', labor: 260000, material: 90000, scope: '주방 벽 한 면 곰팡이 제거·방수 도장', schedule: '이번 주 토요일' }, now - 60 * HOUR);
    quote(j, 'p6', { type: '조건부', labor: 220000, material: 80000, scope: '곰팡이 제거·부분 도장', cond: '벽체 내부 누수가 없을 때 금액 유지', schedule: '다음 주 월요일' }, now - 58 * HOUR);
    const r3 = { id: U.uid('rq'), partnerId: 'p1', at: now - 70 * HOUR, deadline: now - 46 * HOUR, quoteId: null, closed: false }; j.reqs.push(r3);
    quote(j, 'p1', { type: '진단형', labor: 30000, material: 0, scope: '진단 방문(출장·점검) 후 본작업비 확정', cond: '본작업비는 진단 후 재견적', schedule: '내일' }, now - 50 * HOUR);
    publish(j, now - 26 * HOUR);
    // 4. 방문 예정 (c2)
    j = job({ site: 's2', cat: 'clean', ago: 2 * DAY, answers: ans('clean', [2, 1, 0]) }); request(j, ['p2'], now - 46 * HOUR); { const q = quote(j, 'p2', { labor: 180000, material: 20000, scope: '주방 후드·덕트 세척', schedule: '모레 영업 전' }, now - 40 * HOUR); publish(j, now - 38 * HOUR); select(j, q, now - 30 * HOUR); visit(j, now - 28 * HOUR, now + 20 * HOUR); }
    // 5. 작업 중 · 추가 작업 관리자 승인 / 고객 승인 대기 (c2)
    j = job({ site: 's2', cat: 'plumb', ago: 4 * DAY, answers: ans('plumb', [1, 0, 1]) }); full(j, 'p1', 198000, now - 4 * DAY, 'start');
    { const c = co(j, { reason: '바닥 배수구 내부 배관 파손 확인 · 1m 교체 필요', amount: 132000, dl: 22 * HOUR }, now - 3 * HOUR); ap(j, c, '관리자', '승인', now - 2 * HOUR); }
    // 6. 작업 중 · 추가 작업 요청됨 (관리자 검토)
    j = job({ site: 's5', cat: 'elec', ago: 3 * DAY, answers: ans('elec', [1, 1, 1]) }); full(j, 'p3', 154000, now - 3 * DAY, 'start'); co(j, { reason: '노후 분전반 차단기 1개 추가 교체', amount: 88000 }, now - 50 * 60000);
    // 7. 완료 보류 · 고객 응답 기한 경과
    j = job({ site: 's9', cat: 'fix', ago: 5 * DAY, answers: ans('fix', [0, 1, 0]) }); full(j, 'p6', 110000, now - 5 * DAY, 'start');
    { const c = co(j, { reason: '도어클로저 교체 추가', amount: 55000, dl: 24 * HOUR }, now - 40 * HOUR); ap(j, c, '관리자', '승인', now - 39 * HOUR); report(j, now - 30 * HOUR, true); }
    // 8. 고객 확인 대기 (c2)
    j = job({ site: 's2', cat: 'elec', ago: 6 * DAY, answers: ans('elec', [2, 0, 2]) }); full(j, 'p3', 77000, now - 6 * DAY); j.stageAt = now - 20 * HOUR; j.hist[j.hist.length - 1].at = now - 20 * HOUR; j.completion.at = now - 20 * HOUR;
    // 9. 보완 요청
    j = job({ site: 's11', cat: 'clean', ago: 6 * DAY, answers: ans('clean', [1, 2, 2]) }); full(j, 'p2', 330000, now - 6 * DAY); j.revisions.push({ at: now - 10 * HOUR, reason: '창틀 물때가 남아 있습니다', by: custById(j.custId).name }); T(j, '보완 요청', '고객', j.custId, '창틀 물때가 남아 있습니다', now - 10 * HOUR);
    // 10. 작업 완료 · 수금 한쪽 기록됨 (c2)
    j = job({ site: 's2', cat: 'fix', ago: 9 * DAY, answers: ans('fix', [1, 0, 2]) }); { full(j, 'p1', 99000, now - 9 * DAY); confirm(j, now - 7 * DAY); pay(j, '고객', 99000, now - 7 * DAY + 2 * HOUR, '계좌이체'); }
    // 11. 작업 완료 · 수금 불일치 (추가 작업 확정 포함)
    j = job({ site: 's3', cat: 'plumb', ago: 10 * DAY, answers: ans('plumb', [2, 2, 2]) }); { full(j, 'p1', 275000, now - 10 * DAY, 'start'); const c = co(j, { reason: '역류 방지 밸브 추가 설치', amount: 55000 }, now - 9 * DAY + 2 * HOUR); ap(j, c, '관리자', '승인', now - 9 * DAY + 3 * HOUR); ap(j, c, '고객', '승인', now - 9 * DAY + 4 * HOUR); report(j, now - 9 * DAY + 8 * HOUR); confirm(j, now - 8 * DAY); pay(j, '고객', 330000, now - 8 * DAY + HOUR, '계좌이체'); pay(j, '협력업체', 300000, now - 8 * DAY + 3 * HOUR, '현금'); }
    // 12. 작업 완료 · 수금 일치
    j = job({ site: 's4', cat: 'paint', ago: 14 * DAY, answers: ans('paint', [0, 1, 2]) }); { full(j, 'p4', 440000, now - 14 * DAY); confirm(j, now - 12 * DAY); const t = now - 12 * DAY + HOUR; pay(j, '고객', j.selectedQuote.total, t, '계좌이체'); pay(j, '협력업체', j.selectedQuote.total, t, '계좌이체'); }
    // 13. 작업 완료 · 청구 금액 차이
    j = job({ site: 's6', cat: 'move', ago: 12 * DAY, answers: ans('move', [1, 0, 0]) }); { full(j, 'p5', 220000, now - 12 * DAY); confirm(j, now - 10 * DAY); const t = now - 10 * DAY + HOUR; pay(j, '고객', 200000, t, '현금'); pay(j, '협력업체', 200000, t + 600000, '현금'); }
    // 14. 작업 완료 · A/S 접수 (수금 일치)
    j = job({ site: 's8', cat: 'plumb', ago: 20 * DAY, answers: ans('plumb', [0, 0, 2]) }); { full(j, 'p1', 165000, now - 20 * DAY); confirm(j, now - 18 * DAY); const t = now - 18 * DAY + HOUR; pay(j, '고객', j.selectedQuote.total, t, '카드(현장 단말기)'); pay(j, '협력업체', j.selectedQuote.total, t, '카드(현장 단말기)'); j.as.push({ id: 'AS-' + j.id.slice(2), at: now - 5 * HOUR, desc: '같은 위치에서 다시 물이 샙니다', photos: [ph('A/S 사진', 4)], status: 'A/S 접수', by: custById(j.custId).name }); L(j, '고객', j.custId, 'A/S 접수 · 원작업 연결 · 같은 위치에서 다시 물이 샙니다', 'warn', now - 5 * HOUR); }
    // 15. 작업 완료 · 불일치 → 확인 처리됨
    j = job({ site: 's10', cat: 'clean', ago: 16 * DAY, answers: ans('clean', [0, 0, 1]) }); { full(j, 'p2', 154000, now - 16 * DAY); confirm(j, now - 15 * DAY); pay(j, '고객', 154000, now - 15 * DAY, '계좌이체', U.dt(now - 15 * DAY)); pay(j, '협력업체', 154000, now - 14 * DAY, '계좌이체', U.dt(now - 13 * DAY)); j.payReview = { at: now - 12 * DAY, by: '운영 관리자', reason: '고객 이체 확인서와 업체 입금 내역 대조 · 은행 마감 후 입금되어 일자 차이', evidence: '이체 확인서 캡처', after: j.pays.length }; L(j, '관리자', null, '수금 확인 처리 · 일자 차이 사유 기록(원래 기록 보존)', 'pay', now - 12 * DAY); }
    // 16. 개인 고객 · 업체 확정
    j = job({ cust: 'c21', cat: 'move', ago: 26 * HOUR, answers: ans('move', [0, 0, 1]) }); request(j, ['p5'], now - 25 * HOUR); { const q = quote(j, 'p5', { labor: 300000, material: 50000, scope: '원룸 집기 이전 (소형)', schedule: '이번 주 금요일' }, now - 22 * HOUR); publish(j, now - 21 * HOUR); select(j, q, now - 8 * HOUR); }

    st.jobs.forEach((jj) => jj.log.sort((a, b) => a.at - b.at));
    st.jobs.reverse();
    return st;
  }

  /* ---------- UI 공통 ---------- */
  APP.toast = function (msg, kind, ms) {
    const box = document.getElementById('toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || 'ok'); el.setAttribute('role', 'status');
    el.innerHTML = `<i></i><span>${U.esc(msg)}</span>`; box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms || 3200);
  };
  APP.modal = function (title, body, actions, opts) {
    APP.closeModal();
    const valid = APP.scope();
    const snapshot = S ? JSON.stringify({jobs:S.jobs, partners:S.partners}) : '';
    const w = document.createElement('div'); w.className = 'mwrap'; w.id = 'modal';
    w.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="m-h"><h3 id="mT">${title}</h3><button class="x" data-close aria-label="닫기">×</button></div><div class="m-b">${body}</div><div class="m-f">${(actions || []).map((a, i) => `<button class="btn ${a.cls || (i === actions.length - 1 ? 'pri' : 'line')}" data-act="${i}">${a.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in'));
    w.addEventListener('click', (e) => {
      if (e.target === w || e.target.closest('[data-close]')) { APP.closeModal(); return; }
      const b = e.target.closest('[data-act]'); if (b) { const a = actions[+b.dataset.act]; if (!valid()) { APP.closeModal(); return; } if (a.fn && snapshot !== JSON.stringify({jobs:S.jobs, partners:S.partners})) { APP.toast('정보가 변경되었습니다. 창을 닫고 최신 내용으로 다시 확인해 주세요', 'warn'); return; } if (!a.fn || a.fn(w) !== false) APP.closeModal(); }
    });
    const f = w.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea'); if (f) APP.defer(() => { if (w.isConnected) f.focus(); }, 60);
    return w;
  };
  APP.closeModal = () => { const m = document.getElementById('modal'); if (m) m.remove(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') APP.closeModal(); });

  const P = {
    search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5',
    pipe: 'M4 10h6v4H4zM10 11h6a4 4 0 0 1 4 4v5h-4v-5h-6z', bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', brush: 'M18 3l3 3-9 9-3-3zM9 12l-4 4c-1 1-1 4-3 5 3 1 6 0 7-1l3-3',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z', check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12', arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M19 12H5M11 18l-6-6 6-6',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', user: 'M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', cal: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18', won: 'M4 6l4 12 4-9 4 9 4-12M3 11h18M3 14h18', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
    clip: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5', down: 'M12 3v12M6 11l6 6 6-6M4 21h16',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5', alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', plus: 'M12 5v14M5 12h14', play: 'M6 4l14 8-14 8z', sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'
  };
  APP.icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || ''}"/></svg>`;

  /* 사진: AI 제작 서비스 예시 또는 직접 업로드한 썸네일 */
  const TONES = [['#C9D8EA', '#7A97B8'], ['#E6D7C3', '#A88B66'], ['#CFE0D8', '#6E9C88'], ['#D9D2E8', '#8B7BB3'], ['#F0D2C4', '#C07A5B'], ['#D3E6EF', '#5E97B3'], ['#E4E8D2', '#8C9A55']];
  APP.photo = function (p, size) {
    if (p.kind === 'img') return `<figure class="ph ${size || ''}"><img src="${p.src}" alt="${U.esc(p.label)}"><figcaption>${U.esc(p.label)}</figcaption></figure>`;
    const src = ['plumbing', 'space', 'care'][Math.abs(p.tone || 0) % 3];
    return `<figure class="ph ${size || ''}"><img src="assets/images/${src}.jpg" alt="${U.esc(p.label)} · 가상 접수의 예시 사진" loading="lazy"><figcaption>${U.esc(p.label)}</figcaption></figure>`;
  };
  APP.svgDefs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${TONES.map((t, i) => `<linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t[0]}"/><stop offset="1" stop-color="${t[1]}"/></linearGradient>`).join('')}</defs></svg>`;

  /* 체험판 사진: 브라우저 안에서 긴 변 360px의 화면용 썸네일만 보관 */
  APP.readPhotos = function (files, label, cb) {
    const ok = []; const errs = []; const valid = APP.scope(); const done = () => { if (valid()) cb(ok, errs); };
    const list = Array.from(files).slice(0, 6);
    let left = list.length; if (!left) return done();
    list.forEach((f, i) => {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) { errs.push(`${f.name}: 이미지 형식(JPG·PNG·WEBP·HEIC)만 가능합니다`); if (!--left) done(); return; }
      if (f.size > 15 * 1024 * 1024) { errs.push(`${f.name}: 15MB 이하만 올릴 수 있습니다`); if (!--left) done(); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const t = Math.min(1, 360 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * t); c.height = Math.round(img.height * t);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok.push({ id: U.uid('ph'), kind: 'img', src: c.toDataURL('image/jpeg', 0.72), label: `${label} ${i + 1}`, orig: f.size, small: `${c.width}×${c.height}` });
          if (!--left) done();
        };
        img.onerror = () => { errs.push(`${f.name}: 이미지를 읽을 수 없습니다`); if (!--left) done(); };
        img.src = fr.result;
      };
      fr.onerror = () => { errs.push(`${f.name}: 파일을 읽을 수 없습니다`); if (!--left) done(); };
      fr.readAsDataURL(f);
    });
  };

  APP.stageBadge = function (j) {
    const c = { '접수': 'b', '견적 요청': 'b', '견적 공개': 'v', '업체 확정': 'v', '방문 예정': 'v', '작업 중': 'o', '완료 보류': 'r', '고객 확인 대기': 'a', '보완 요청': 'a', '작업 완료': 'g' }[j.stage];
    return `<span class="bdg ${c}">${j.stage}</span>`;
  };
  APP.stepper = function (j, compact) {
    const idx = APP.stepIndex(j);
    const payPending = idx === 7 && APP.payStatus(j).label !== '수금 일치';
    return `<ol class="steps ${compact ? 'sm' : ''}" aria-label="진행 단계">${APP.STEPS.map((s, i) => { const pending = i === 6 && payPending; return `<li class="${pending ? 'pending' : i < idx ? 'done' : i === idx ? 'now' : ''}" ${pending ? 'aria-label="수금 확인 중" title="수금 확인 중"' : ''}><i>${pending ? '!' : i < idx ? '✓' : i + 1}</i><span>${s}</span></li>`; }).join('')}</ol>`;
  };
  APP.nextLine = function (j) {
    const m = { '접수': ['접수됨', '운영자가 견적을 요청합니다'], '견적 요청': ['견적 요청 중', '견적이 도착하면 문자로 알려 드립니다'], '견적 공개': ['견적 도착', '견적을 비교하고 선택해 주세요'], '업체 확정': ['업체 확정', '업체가 방문 일정을 등록합니다'], '방문 예정': ['방문 예정', '방문일에 작업 전 사진을 남깁니다'], '작업 중': ['작업 중', '추가 작업이 생기면 승인 요청이 옵니다'], '완료 보류': ['완료 보류', '미해결 추가 작업을 확인한 뒤 완료 확인을 진행합니다'], '고객 확인 대기': ['완료 보고 도착', '결과를 보고 완료 확인 또는 보완 요청'], '보완 요청': ['보완 요청됨', '업체가 보완 후 다시 보고합니다'], '작업 완료': ['작업 완료', '수금 기록을 확인하고 필요하면 A/S를 접수하세요'] }[j.stage];
    if (j.stage === '견적 요청' && j.quoteReview) { m[0] = '수정 견적 검토 중'; m[1] = '운영자 검토 후 견적을 다시 안내해 드립니다'; }
    return `<p class="nextline"><b>지금: ${m[0]}</b><span>다음: ${m[1]}</span></p>`;
  };

  /* 서비스 이동 버튼은 모든 화면에서 같은 마크업과 크기를 사용합니다. */
  APP.serviceNav = (active = '') => `<nav class="service-switch" aria-label="서비스 전환">${[['cust', '#/c', 'user', '고객서비스'], ['partner', '#/p', 'tool', '협력업체'], ['admin', '#/a', 'grid', '운영 콘솔']].map(([key, href, icon, label]) => `<a class="service-switch-btn" href="${href}" ${key === active ? 'aria-current="page"' : ''}>${APP.icon(icon)}<span>${label}</span></a>`).join('')}</nav>`;

  /* ---------- 라우터 ---------- */
  APP.route = (re, fn) => APP.routes.push({ re, fn });
  APP.go = (h) => { if (location.hash === h) render(); else location.hash = h; };
  function render() {
    const raw = location.hash.slice(1) || '/'; const [path, q] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(q || ''));
    viewId++; if (APP.clearUploads) APP.clearUploads();
    APP.live = null; APP.closeModal();
    const ap = document.getElementById('app'); if (ap) { ap.onclick = null; ap.onchange = null; ap.oninput = null; ap.onsubmit = null; }
    for (const r of APP.routes) { const m = path.match(r.re); if (m) { document.body.dataset.area = path.startsWith('/a') ? 'admin' : path.startsWith('/c') ? 'cust' : path.startsWith('/p') ? 'partner' : 'hub'; r.fn(m, params); window.scrollTo(0, 0); if (APP.demoBar) APP.demoBar(); return; } }
    APP.go('#/');
  }
  APP.render = render;
  APP.start = function () {
    try { const raw = localStorage.getItem(KEY); if (raw) S = JSON.parse(raw); } catch (e) { S = null; }
    if (!S || S.v !== 1) { S = seed(); dirty = true; persist(); }
    document.body.insertAdjacentHTML('afterbegin', APP.svgDefs());
    window.addEventListener('hashchange', render);
    render();
    setInterval(() => { if (APP.live) try { APP.live(); } catch (e) { console.error(e); } persist(); }, 1000);
    window.addEventListener('beforeunload', () => { dirty = true; persist(); });
  };
})();
