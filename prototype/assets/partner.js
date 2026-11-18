/* FIXFLOW [프로토타입] — 협력업체 모바일 화면 */
(function () {
  'use strict';
  const U = APP.U; const esc = U.esc; const I = APP.icon;
  const S = () => APP.get();
  const me = () => (S().session.partner ? APP.partnerById(S().session.partner) : null);
  const ACTIVE = ['업체 확정', '방문 예정', '작업 중', '완료 보류', '고객 확인 대기', '보완 요청'];

  function myReqs(p) { return S().jobs.filter((j) => j.reqs.some((r) => r.partnerId === p.id) && (!j.selectedQuote || j.selectedQuote.partnerId !== p.id)); }
  function myWork(p, done) { return S().jobs.filter((j) => j.selectedQuote && j.selectedQuote.partnerId === p.id && (done ? j.stage === '작업 완료' : ACTIVE.includes(j.stage))); }
  function tabs() {
    const p = me(); if (!p || p.status !== '승인') return [];
    const n1 = myReqs(p).filter((j) => j.reqs.some((r) => r.partnerId === p.id && APP.reqState(r) === '응답 대기')).length;
    const n2 = myWork(p).filter((j) => need(j)).length;
    const n3 = myWork(p, true).filter((j) => need(j)).length;
    return [['#/p', '견적 요청', 'clip', n1 || ''], ['#/p/work', '진행 작업', 'tool', n2 || ''], ['#/p/done', '완료', 'check', n3 || '']];
  }
  function need(j) {
    const aftercare = (j.as || []).filter(a => a.status === 'A/S 처리 중').length;
    if (aftercare) return `A/S 처리 ${aftercare}건`;
    if (j.stage === '업체 확정') return '방문 일정 등록';
    if (j.stage === '방문 예정') return '작업 시작';
    if (j.stage === '작업 중') return j.cos.some((c) => APP.coStatus(c) === '반려') ? '추가 작업 반려 확인' : '완료 보고';
    if (j.stage === '보완 요청') return '보완 보고';
    if (j.stage === '작업 완료' && !APP.latestPay(j, '협력업체')) return '수령 금액 기록';
    return '';
  }

  /* ---------- 로그인·가입 ---------- */
  function home() {
    const p = me();
    if (!p) {
      const b = APP.mshell({ role: 'partner', title: '협력업체', body: `<section class="c-hero p"><span class="pill">${I('tool')}협력업체 전용</span><h2>견적부터 완료 보고까지<br><em>현장에서 바로</em></h2><p>관리자 승인을 받은 업체만 견적 요청을 받습니다.</p></section>
        <form class="fbox" id="pl" onsubmit="return false"><label class="fld">아이디<input name="id" value="partner1" autocomplete="username"></label><label class="fld">비밀번호<input name="pw" type="password" value="demo1234" autocomplete="current-password"></label><button class="btn pri block" data-plogin>로그인</button></form>
        <a class="btn line block" href="#/p/join">${I('plus')}협력업체 가입 신청</a><p class="hint center">체험 계정: partner1(한빛설비) · partner2(맑은청소) · partner3(바른전기) / demo1234</p>`, tabs: [] });
      b.onclick = (e) => {
        if (!e.target.closest('[data-plogin]')) return;
        const f = U.qs('#pl'); const x = S().partners.find((q) => q.login === f.id.value.trim());
        if (!x || f.pw.value !== (x.pw || 'demo1234')) { APP.toast('아이디 또는 비밀번호가 맞지 않습니다', 'err'); return; }
        S().session.partner = x.id; APP.save(); APP.render();
      };
      return;
    }
    if (p.status !== '승인') { status(p); return; }
    const list = myReqs(p);
    const aftercare = myWork(p, true).filter(j => (j.as || []).some(a => a.status === 'A/S 처리 중'));
    const body = `<section class="service-overview"><div><span class="overview-kicker">PARTNER WORKSPACE</span><h2>${esc(p.name)}의 업무 현황</h2><p>견적 요청을 확인하고, 진행 중인 작업을 이어서 처리하세요.</p></div><a class="btn line" href="#/p/work">${I('tool')}작업 확인하기</a></section><div class="overview-stats"><a href="#/p"><span>${I('clip')}응답 대기</span><b>${list.filter((j) => j.reqs.some((r) => r.partnerId === p.id && APP.reqState(r) === '응답 대기')).length}<small>건</small></b><em>견적 요청 ${I('arrow')}</em></a><a href="#/p/work"><span>${I('tool')}진행 작업</span><b>${myWork(p).length}<small>건</small></b><em>작업 보기 ${I('arrow')}</em></a><a href="#/p/done"><span>${I('check')}완료 작업</span><b>${myWork(p, true).length}<small>건</small></b><em>완료 내역 ${I('arrow')}</em></a></div>
      ${aftercare.length ? `<section class="aftercare-alert"><h3>${I('tool')}처리할 A/S가 있어요</h3>${aftercare.map(j => workCard(j, true)).join('')}</section>` : ''}
      <div class="task-heading"><h3>받은 견적 요청</h3><span>가격과 작업 범위를 확인해 주세요</span></div>${list.map((j) => { const r = j.reqs.find((x) => x.partnerId === p.id); const st = APP.reqState(r); const q = j.quotes.find((x) => x.id === r.quoteId); const cat = APP.cat(j.cat); const site = APP.siteById(j.siteId);
        return `<a class="jcard" href="#/p/req/${j.id}" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.kind : '개인')} · ${esc(j.region)}</b><span>${esc(j.id)} · ${st === '응답 대기' ? '응답 마감 ' + U.dt(r.deadline) : q ? `제출 v${q.ver} · ${U.won(q.total)}원` : st}</span>${st === '응답 대기' ? `<em class="need">${I('clock')}견적 작성</em>` : ''}</div><span class="bdg ${st === '응답' ? (APP.quoteState(j, q) === '미선택' ? 'n' : 'v') : st === '응답 대기' ? 'a' : 'n'}">${st === '응답' ? APP.quoteState(j, q) : st}</span></a>`; }).join('') || '<p class="quiet-empty">새 견적 요청이 도착하면 이곳에 표시돼요.</p>'}${myWork(p).length ? `<section class="task-section"><div class="task-heading"><h3>이어서 처리할 작업</h3><a href="#/p/work">모두 보기 ${I('arrow')}</a></div>${myWork(p).slice(0,2).map(j => workCard(j, false)).join('')}</section>` : ''}`;
    APP.mshell({ role: 'partner', title: esc(p.name), body, tabs: tabs(), tab: '#/p', right: `<button class="m-ib" data-plogout aria-label="로그아웃">${I('out')}</button>` });
    bindOut();
  }
  function bindOut() { const b = U.qs('[data-plogout]'); if (b) b.onclick = () => { S().session.partner = null; APP.save(); APP.go('#/p'); }; }
  function status(p) {
    const b = APP.mshell({ role: 'partner', title: esc(p.name), body: `<div class="locked ${p.status === '보완 요청' ? 'warn' : ''}">${I(p.status === '보완 요청' ? 'alert' : 'clock')}<b>${p.status === '보완 요청' ? '가입 서류 보완이 필요합니다' : '관리자 승인을 기다리고 있습니다'}</b><p>${p.status === '보완 요청' ? esc(p.memo || '') : '승인되면 문자로 알려 드리고, 분야·지역이 맞는 견적 요청을 받을 수 있습니다.'}</p>
      <dl class="kv"><div><dt>전문 분야</dt><dd>${p.cats.map((c) => APP.cat(c).name).join(', ')}</dd></div><div><dt>지역</dt><dd>${p.regions.join(', ')}</dd></div><div><dt>증빙</dt><dd>${p.docs.map(esc).join(', ') || '없음'}</dd></div></dl>
      ${p.status === '보완 요청' ? `<label class="upl sm">${I('clip')}<b>증빙 다시 첨부</b><input type="file" id="reDoc"></label>` : ''}</div>`, tabs: [], right: `<button class="m-ib" data-plogout aria-label="로그아웃">${I('out')}</button>` });
    bindOut();
    const f = b.querySelector('#reDoc'); if (f) f.onchange = () => { if (!f.files[0]) return; p.docs.push(f.files[0].name); p.status = '승인 대기'; p.memo = ''; APP.save(); APP.toast('다시 제출했습니다 · 관리자 확인을 기다립니다'); APP.render(); };
  }
  function join() {
    const sel = { cats: [], regions: [], doc: null };
    const draw = () => {
      const b = APP.mshell({ role: 'partner', title: '가입 신청', back: '#/p', body: `<p class="lead">업체 정보와 전문 분야를 입력하면 관리자가 확인 후 승인합니다.</p><form class="fbox" id="pj" onsubmit="return false">
        <label class="fld">업체명<input name="name" placeholder="예) 가상설비"></label><label class="fld">대표자<input name="owner"></label><label class="fld">연락처<input name="phone" inputmode="numeric" placeholder="010-0000-0000"></label><label class="fld">아이디<input name="login" placeholder="영문·숫자 4자 이상"></label><label class="fld">체험용 비밀번호<input name="pw" type="password" placeholder="8자 이상" autocomplete="new-password"></label>
        <fieldset class="qf"><legend>전문 분야 (여러 개 선택)</legend><div class="chips">${D.CATS.map((c) => `<button type="button" class="chip ${sel.cats.includes(c.id) ? 'on' : ''}" data-c="${c.id}">${c.name}</button>`).join('')}</div></fieldset>
        <fieldset class="qf"><legend>활동 지역</legend><div class="chips">${D.REGIONS.map((r) => `<button type="button" class="chip ${sel.regions.includes(r) ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div></fieldset>
        <label class="upl sm">${I('clip')}<b>사업자등록증·자격 증빙 첨부</b><input type="file" name="doc"></label><button class="btn pri block" data-join>가입 신청</button></form>`, tabs: [] });
      b.onchange = (e) => { if (e.target.name === 'doc') sel.doc = e.target.files[0] || null; };
      b.onclick = (e) => {
        const c = e.target.closest('[data-c]'); const r = e.target.closest('[data-r]');
        if (c) { const v = c.dataset.c; sel.cats = sel.cats.includes(v) ? sel.cats.filter((x) => x !== v) : sel.cats.concat(v); keep(); return; }
        if (r) { const v = r.dataset.r; sel.regions = sel.regions.includes(v) ? sel.regions.filter((x) => x !== v) : sel.regions.concat(v); keep(); return; }
        if (e.target.closest('[data-join]')) {
          const f = U.qs('#pj'); if (!f.name.value.trim() || !f.owner.value.trim() || !/^01\d{8,9}$/.test(f.phone.value.replace(/\D/g, '')) || f.pw.value.length < 8 || !/^[a-z0-9]{4,}$/i.test(f.login.value) || !sel.cats.length || !sel.regions.length) { APP.toast('업체 정보·휴대폰 번호·아이디·비밀번호(8자 이상)·분야·지역을 확인해 주세요', 'warn'); return; }
          if (S().partners.some((x) => x.login === f.login.value)) { APP.toast('이미 쓰는 아이디입니다', 'warn'); return; }
          const p = { id: 'p' + (S().partners.length + 1), login: f.login.value, pw: f.pw.value, name: f.name.value.trim(), owner: f.owner.value, phone: f.phone.value, cats: sel.cats, regions: sel.regions, status: '승인 대기', joined: U.d(Date.now()), docs: (f.doc.files[0] || sel.doc) ? [(f.doc.files[0] || sel.doc).name] : [] };
          S().partners.push(p); S().session.partner = p.id; APP.save(); APP.toast('가입 신청이 완료되었습니다. 관리자 확인 후 이용하실 수 있습니다'); APP.go('#/p');
        }
      };
      function keep() { const f = U.qs('#pj'); const v = {}; ['name', 'owner', 'phone', 'login', 'pw'].forEach((k) => (v[k] = f[k].value)); draw(); const g = U.qs('#pj'); Object.keys(v).forEach((k) => (g[k].value = v[k])); }
    };
    draw();
  }

  /* ---------- 견적서 ---------- */
  function req(mm) {
    const p = me(); const j = APP.jobById(mm[1]);
    if (!p || p.status !== '승인') { APP.go('#/p'); return; }
    const r = j && j.reqs.find((x) => x.partnerId === p.id);
    if (!r) { APP.mshell({ role: 'partner', title: '견적 요청', back: '#/p', body: `<div class="locked">${I('shield')}<b>요청받은 건만 볼 수 있습니다</b><p>견적을 요청받지 않은 건의 고객 정보와 사진은 열리지 않습니다.</p></div>`, tabs: tabs() }); return; }
    const cur = j.quotes.filter((q) => q.partnerId === p.id).pop();
    const F = cur ? { type: cur.type, labor: cur.labor, material: cur.material, schedule: cur.schedule, scope: cur.scope, cond: cur.cond, days: 5 } : { type: '확정', labor: '', material: '', schedule: '', scope: '', cond: '', days: 5 };
    const locked = j.selectedQuote || r.closed || r.deadline <= Date.now();
    const draw = () => {
      const t = APP.quoteTotal({ labor: F.labor, material: F.material, taxRate: 10 }); const cat = APP.cat(j.cat); const site = APP.siteById(j.siteId);
      const b = APP.mshell({ role: 'partner', title: '견적서', back: '#/p', body: `<div class="jhead" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.kind : '개인')} · ${esc(j.region)}</b><span>${esc(j.id)} · 응답 마감 ${U.dt(r.deadline)}</span></div><span class="bdg ${APP.reqState(r) === '응답 대기' ? 'a' : 'n'}">${APP.reqState(r)}</span></div>
        <dl class="kv">${j.answers.map((a) => `<div><dt>${esc(a.q)}</dt><dd>${esc(a.a)}</dd></div>`).join('')}${j.memo ? `<div><dt>메모</dt><dd>${esc(j.memo)}</dd></div>` : ''}</dl><div class="phs">${j.photos.map((x) => APP.photo(x, 'sm')).join('') || '<p class="hint">사진 없음 · 운영자 메모 참고</p>'}</div><p class="hint">고객 연락처는 업체 확정 후 공개됩니다.</p>
        ${cur ? `<p class="paid">${I('check')}제출한 견적 v${cur.ver} · ${U.won(cur.total)}원 · ${APP.quoteState(j, cur)}</p>` : ''}
        ${locked ? (j.selectedQuote && j.selectedQuote.partnerId !== p.id ? '<p class="warnbox">고객이 다른 업체를 선택했습니다.</p>' : '<p class="warnbox">응답이 마감된 요청입니다.</p>') : `<form class="fbox" id="qf" onsubmit="return false"><h3 class="m-h3">${cur ? `견적 수정 (v${cur.ver + 1}로 저장)` : '견적 작성'}</h3>
          <fieldset class="qf"><legend>견적 유형</legend><div class="seg3">${['확정', '조건부', '진단형'].map((x) => `<button type="button" class="${F.type === x ? 'on' : ''}" data-type="${x}">${x}</button>`).join('')}</div><p class="hint">${{ '확정': '현장 상황이 접수 내용과 같으면 이 금액으로 진행합니다.', '조건부': '적어 둔 조건이 맞을 때 금액이 유지됩니다.', '진단형': '진단 방문비만 정하고, 본작업비는 진단 후 다시 견적합니다.' }[F.type]}</p></fieldset>
          <label class="fld">${F.type === '진단형' ? '진단비(출장·점검)' : '작업비'}<input data-f="labor" inputmode="numeric" value="${F.labor ? U.won(F.labor) : ''}" placeholder="0"></label>
          <label class="fld">자재비<input data-f="material" inputmode="numeric" value="${F.material ? U.won(F.material) : ''}" placeholder="0"></label>
          <div class="sum"><div><span>공급가</span><b>${U.won(t.sub)}원</b></div><div><span>세금 (10%)</span><b>${U.won(t.tax)}원</b></div><div class="tot"><span>합계 (자동)</span><b>${U.won(t.total)}원</b></div></div>
          ${F.type !== '확정' ? `<label class="fld">${F.type === '조건부' ? '적용 조건' : '본작업 확정 방법'}<input data-f="cond" value="${esc(F.cond)}" placeholder="${F.type === '조건부' ? '예) 벽체 내부 누수가 없을 때' : '예) 진단 후 재견적·고객 재승인'}"></label>` : ''}
          <label class="fld">포함 범위<input data-f="scope" value="${esc(F.scope)}" placeholder="예) 싱크대 하부 배관 교체·통수 시험"></label>
          <label class="fld">가능 일정<input data-f="schedule" value="${esc(F.schedule)}" placeholder="예) 내일 오전"></label>
          <label class="fld">유효기간<select data-f="days">${[3, 5, 7, 14].map((d) => `<option value="${d}" ${+F.days === d ? 'selected' : ''}>${d}일</option>`).join('')}</select></label>
          <button class="btn pri block" data-sendq>${cur ? '수정본 제출' : '견적 제출'}</button></form>`}`, tabs: tabs(), tab: '#/p', focus: j });
      b.onclick = (e) => {
        const ty = e.target.closest('[data-type]'); if (ty) { F.type = ty.dataset.type; draw(); return; }
        if (e.target.closest('[data-sendq]')) {
          if (APP.money(F.labor) === null || APP.money(F.material || 0, true) === null || !F.scope.trim() || !F.schedule.trim() || (F.type !== '확정' && !F.cond.trim())) { APP.toast('금액·포함 범위·일정' + (F.type !== '확정' ? '·조건' : '') + '을 입력해 주세요', 'warn'); return; }
          const saved = APP.once('q-' + j.id + '-' + p.id + '-' + (cur ? cur.ver + 1 : 1), () => {
            const q = APP.submitQuote(j, p.id, Object.assign({}, F, { prevId: cur ? cur.id : null }));
            if (!q) return false;
            APP.toast(cur ? `수정 견적을 제출했습니다 (v${q.ver}) · 운영자 검토 후 다시 공개됩니다` : '견적을 제출했습니다 · 운영자가 확인 후 고객에게 공개합니다');
          });
          if (!saved) return;
          APP.go('#/p');
        }
      };
      b.oninput = (e) => { const k = e.target.dataset.f; if (!k) return; if (k === 'labor' || k === 'material') { if (/[^0-9,]/.test(e.target.value)) { F[k] = e.target.value; return; } const pos = e.target.value.length - e.target.selectionStart; F[k] = +e.target.value.replace(/\D/g, '') || ''; draw(); const n = U.qs(`[data-f=${k}]`); n.focus(); const L = n.value.length - pos; n.setSelectionRange(L, L); } else F[k] = e.target.value; };
    };
    draw();
  }

  /* ---------- 업로드 (실패 시 횟수 제한 자동 재시도 · 수동 재전송) ---------- */
  const Q = {};
  function uploader(key, label, target, onChange) {
    const valid = APP.scope();
    Q[key] = Q[key] || [];
    return {
      html() {
        return `<label class="upl sm">${I('camera')}<b>${label} 촬영·선택</b><input type="file" accept="image/*" multiple data-up="${key}"></label><button type="button" class="btn line sm" data-upsample="${key}">${I('play')}예시 사진</button>
          <ul class="upq">${Q[key].map((u, i) => `<li class="u-${u.state}"><span>${esc(u.photo.label)}</span>${u.state === 'up' ? `<i class="bar"><b style="width:${u.pct}%"></b></i><em>${u.tries > 1 ? `재시도 ${u.tries}/3` : '전송 중'}</em>` : u.state === 'fail' ? `<em>전송 실패 (3회)</em><button type="button" class="btn line xs" data-retry="${key}:${i}">다시 보내기</button>` : `<em>${I('check')}완료</em>`}</li>`).join('')}</ul>
          <div class="phs">${target.map((p) => APP.photo(p, 'sm')).join('')}</div>`;
      },
      add(photos) { photos.forEach((ph) => { const u = { photo: ph, state: 'up', pct: 0, tries: 1 }; Q[key].push(u); run(u); }); onChange(); },
      retry(i) { const u = Q[key][i]; u.state = 'up'; u.tries = 1; u.pct = 0; run(u); onChange(); }
    };
    function run(u) {
      const tick = () => {
        if (!valid() || !Q[key] || !Q[key].includes(u)) return;
        u.pct = Math.min(100, u.pct + 25 + Math.random() * 20); onChange();
        if (u.pct < 100) { setTimeout(tick, 220); return; }
        const fail = S().demo.netFail && Math.random() < 0.7;
        if (fail) { if (u.tries < 3) { u.tries++; u.pct = 0; setTimeout(tick, 500); } else { u.state = 'fail'; } onChange(); return; }
        u.state = 'ok'; target.push(u.photo); APP.save(); onChange();
        setTimeout(() => { if (!Q[key]) return; const k = Q[key].indexOf(u); if (k >= 0 && u.state === 'ok') { Q[key].splice(k, 1); onChange(); } }, 1600);
      };
      setTimeout(tick, 200);
    }
  }
  APP.clearUploads = () => { Object.keys(Q).forEach((k) => delete Q[k]); };

  /* ---------- 진행 작업 ---------- */
  function workCard(j, done) {
    const cat = APP.cat(j.cat), site = APP.siteById(j.siteId), n = need(j), v = j.visits[j.visits.length - 1];
    return `<a class="jcard" href="#/p/work/${j.id}" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.name : APP.custById(j.custId).name)}</b><span>${esc(j.id)}${v ? ' · 방문 ' + U.md(v.when) : ''}${done ? ' · ' + APP.payStatus(j).label : ''}</span>${n ? `<em class="need">${I('bell')}${n}</em>` : ''}</div>${APP.stageBadge(j)}</a>`;
  }
  function workList(done) {
    const p = me(); if (!p || p.status !== '승인') { APP.go('#/p'); return; }
    const list = myWork(p, done);
    APP.mshell({ role: 'partner', title: done ? '완료한 작업' : '진행 작업', back: '#/p', body: list.map(j => workCard(j, done)).join('') || '<p class="empty">해당하는 작업이 없습니다</p>', tabs: tabs(), tab: done ? '#/p/done' : '#/p/work', right: `<button class="m-ib" data-plogout aria-label="로그아웃">${I('out')}</button>` });
    bindOut();
  }

  function work(mm) {
    const p = me(); const j = APP.jobById(mm[1]);
    if (!p || p.status !== '승인') { APP.go('#/p'); return; }
    if (!j || !j.selectedQuote || j.selectedQuote.partnerId !== p.id) { APP.mshell({ role: 'partner', title: '작업', back: '#/p/work', body: `<div class="locked">${I('shield')}<b>배정된 작업만 볼 수 있습니다</b><p>다른 업체에 배정된 건은 열리지 않습니다.</p><button class="btn pri block" data-asp>체험: 이 건의 협력업체로 로그인</button></div>`, tabs: tabs() }); const b = U.qs('[data-asp]'); if (b) b.onclick = () => { if (j && j.selectedQuote) { S().session.partner = j.selectedQuote.partnerId; APP.save(); APP.render(); } else APP.toast('아직 업체가 확정되지 않은 건입니다', 'warn'); }; return; }
    const D2 = { checklist: null, noBefore: '', noAfter: '', rev: [] };
    const upB = uploader('b-' + j.id, '작업 전 사진', j.work.before, () => redraw());
    const upA = uploader('a-' + j.id, '작업 후 사진', j.work.after, () => redraw());
    const coPh = []; const upC = uploader('c-' + j.id, '추가 작업 사진', coPh, () => redraw());
    const revPh = []; const upR = uploader('r-' + j.id, '보완 사진', revPh, () => redraw());
    let timer = null;
    const validView = APP.scope();
    function redraw() { clearTimeout(timer); timer = APP.defer(() => { if (validView() && APP.allowed('협력업체', p.id, j) && location.hash.split('?')[0] === '#/p/work/' + j.id && !document.getElementById('modal')) draw(); }, 30); }
    function draw() {
      const active = document.activeElement; const keepId = active && active.dataset && active.dataset.keep; const keepVal = keepId ? active.value : null;
      const cat = APP.cat(j.cat); const site = APP.siteById(j.siteId); const c = APP.custById(j.custId); const s = j.selectedQuote; const b = APP.billed(j);
      let h = `<div class="jhead" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.name : c.name)}</b><span>${esc(j.id)} · ${esc(site ? site.addr : j.addr || '')}</span></div>${APP.stageBadge(j)}</div>${APP.stepper(j, true)}
        <div class="sel"><b>${esc(c.name)} · ${esc(c.phone)}</b><span class="qt t-${s.type}">${s.type}</span><p>${esc(s.scope)}</p></div>
        <div class="sum"><div><span>견적 확정</span><b>${U.won(b.base)}원</b></div>${b.add ? `<div><span>확정 추가 작업</span><b>+${U.won(b.add)}원</b></div>` : ''}<div class="tot"><span>청구 예정</span><b>${U.won(b.total)}원</b></div></div>`;
      if (['업체 확정', '방문 예정', '작업 중'].includes(j.stage)) {
        const v = j.visits[j.visits.length - 1];
        h += `<section class="panel-m"><h3>${I('cal')}방문 일정</h3>${v ? `<p class="visit">${U.dt(v.when)}</p>` : '<p class="hint">고객과 통화 후 방문 일정을 등록하세요.</p>'}<div class="row"><input type="datetime-local" id="vAt" aria-label="방문 일시" data-keep="vAt"><button class="btn ${v ? 'line' : 'pri'}" data-visit>${v ? '변경' : '등록'}</button></div>${j.visits.length ? `<ul class="mini">${j.visits.slice().reverse().map((x, i) => `<li>${U.dt(x.when)} <em>${i === 0 ? '현재' : '이전'} · ${U.md(x.at)} 등록</em></li>`).join('')}</ul>` : ''}</section>`;
      }
      if (j.stage === '방문 예정') {
        h += `<section class="panel-m hot"><h3>${I('camera')}작업 시작 · 작업 전 사진</h3>${upB.html()}<details class="nophoto"><summary>사진을 남길 수 없어요</summary><select data-keep="noB" id="noB"><option value="">사유 선택</option>${D.NOPHOTO.map((x) => `<option>${x}</option>`).join('')}</select><input id="noBm" data-keep="noBm" placeholder="메모 (선택)"></details><button class="btn pri block" data-start>작업 시작</button></section>`;
      }
      if (['작업 중', '완료 보류'].includes(j.stage)) {
        h += `<section class="panel-m"><h3>${I('plus')}추가 작업</h3>${j.cos.map((co) => `<div class="cor"><div><b>${co.seq}차 · ${esc(co.reason)}</b><span>+${U.won(co.amount)}원 · ${APP.coBadge(co)}</span></div>${APP.coStatus(co) === '반려' && !j.cos.some((x) => x.prevId === co.id) ? `<button class="btn line xs" data-rere="${co.id}">금액·범위 수정해 재요청</button>` : ''}${APP.coOpen(co) || APP.coStatus(co) === '응답 기한 경과' ? `<button class="btn line xs" data-wd="${co.id}">미수행 철회</button>` : ''}</div>`).join('') || '<p class="hint">현장에서 작업 범위가 늘어나면 원작업에 연결해 요청하세요. 관리자·고객 모두 승인해야 진행할 수 있습니다.</p>'}
          <form class="fbox in" id="coF" onsubmit="return false"><label class="fld">사유<input name="reason" data-keep="coR" placeholder="예) 배관 내부 파손 · 1m 교체"></label><label class="fld">추가 비용<input name="amount" data-keep="coA" inputmode="numeric" placeholder="원"></label>${upC.html()}<button class="btn pri block" data-co>추가 작업 요청</button></form></section>`;
      }
      if (j.stage === '작업 중') {
        const cl = D2.checklist || (D2.checklist = cat.check.map((x) => ({ item: x, ok: false })));
        const open = j.cos.filter(APP.coOpen).length;
        h += `<section class="panel-m hot"><h3>${I('check')}완료 보고</h3><ul class="chk edit">${cl.map((x, i) => `<li><label><input type="checkbox" data-cl="${i}" ${x.ok ? 'checked' : ''}> ${esc(x.item)}</label></li>`).join('')}</ul>${upA.html()}
          <details class="nophoto"><summary>결과 사진을 남길 수 없어요</summary><select id="noA" data-keep="noA"><option value="">사유 선택</option>${D.NOPHOTO.map((x) => `<option>${x}</option>`).join('')}</select></details>
          <fieldset class="qf"><legend>수령 금액 기록 (현장에서 받은 경우)</legend>${payFields('rc')}</fieldset>
          ${open ? `<p class="warnbox">승인이 끝나지 않은 추가 작업 ${open}건이 있어 「완료 보류」로 보고됩니다.</p>` : ''}<button class="btn pri block" data-report>완료 보고 · 고객 확인 요청</button></section>`;
      }
      if (j.stage === '완료 보류') h += `<p class="warnbox">완료 보고됨 · 추가 작업 승인이 끝나면 고객 확인 요청이 자동으로 이어집니다.</p>`;
      if (j.stage === '고객 확인 대기') h += `<p class="paid">${I('clock')}고객이 완료를 확인할 때까지 대기합니다. 자동으로 완료 처리되지 않습니다.</p>`;
      if (j.stage === '보완 요청') {
        const rv = j.revisions[j.revisions.length - 1];
        h += `<section class="panel-m hot"><h3>${I('alert')}보완 요청</h3><p class="warnbox">${esc(rv.reason)} · ${U.md(rv.at)}</p>${upR.html()}<label class="fld">보완 내용<input id="rvN" data-keep="rvN" placeholder="예) 창틀 물때 제거 완료"></label><button class="btn pri block" data-revdone>보완 보고 · 고객 확인 요청</button></section>`;
      }
      if (j.stage === '작업 완료') {
        const mine = APP.latestPay(j, '협력업체'); const st = APP.payStatus(j);
        h += `<section class="panel-m"><h3>${I('won')}수령 금액 <span class="bdg ${st.cls}">${st.label}</span></h3>${mine ? `<p class="paid">${I('check')}${U.won(mine.amount)}원 · ${esc(mine.date)} · ${esc(mine.method)}</p>${st.label === '불일치' ? `<p class="warnbox">고객 기록과 ${st.diffs.join('·')} 기록이 서로 다릅니다. 운영자가 확인 중입니다.</p>` : ''}` : `<form id="rcF" onsubmit="return false">${payFields('rc2')}<button class="btn pri block" data-rc>수령 기록 남기기</button></form>`}</section>`;
        (j.as || []).forEach((a) => { h += `<section class="panel-m"><h3>${I('tool')}${esc(a.id)} <span class="bdg ${a.status === 'A/S 완료' ? 'g' : 'a'}">${a.status}</span></h3><p>${esc(a.desc)}</p>${a.status === 'A/S 처리 중' ? '<button class="btn pri block" data-asdone="' + a.id + '">A/S 처리 완료 보고</button>' : ''}</section>`; });
      }
      h += `<details class="sec-d"><summary>진행 기록</summary><ol class="tl">${j.hist.slice().reverse().map((x) => `<li><time>${U.md(x.at)}</time><b>${esc(x.to)}</b><span>${esc(x.by)}${x.reason ? ' · ' + esc(x.reason) : ''}</span></li>`).join('')}</ol></details>`;
      const scroll = (U.qs('#mbody') || {}).scrollTop || 0;
      const keep = {}; U.qsa('[data-keep]').forEach((el) => { keep[el.dataset.keep] = el.value; });
      APP.mshell({ role: 'partner', title: '작업', back: '#/p/work', body: h, tabs: tabs(), tab: '#/p/work', focus: j });
      U.qsa('[data-keep]').forEach((el) => { if (keep[el.dataset.keep] != null) el.value = keep[el.dataset.keep]; });
      const mb = U.qs('#mbody'); if (mb) mb.scrollTop = scroll;
      if (keepId) { const el = U.qs(`[data-keep="${keepId}"]`); if (el) { el.value = keepVal; el.focus(); } }
    }
    function payFields(k) { const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); return `<div class="pf3"><input data-keep="${k}a" id="${k}a" aria-label="수령 금액" inputmode="numeric" placeholder="금액" value=""><input data-keep="${k}d" id="${k}d" aria-label="수령 일시" type="datetime-local" value="${now}"><select data-keep="${k}m" id="${k}m" aria-label="수령 방법">${D.PAY_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></div>`; }
    draw();
    const app = U.qs('#app');
    app.onchange = (e) => {
      const up = e.target.dataset.up; if (up) { const u = { ['b-' + j.id]: upB, ['a-' + j.id]: upA, ['c-' + j.id]: upC, ['r-' + j.id]: upR }[up]; APP.readPhotos(e.target.files, up[0] === 'b' ? '작업 전' : up[0] === 'a' ? '작업 후' : up[0] === 'c' ? '추가 작업' : '보완', (ok, errs) => { errs.forEach((x) => APP.toast(x, 'warn')); u.add(ok); }); return; }
      const cl = e.target.dataset.cl; if (cl != null) { D2.checklist[+cl].ok = e.target.checked; }
    };
    app.onclick = (e) => {
      const t = e.target.closest('button'); if (!t) return; if (!validView() || !APP.require('협력업체', p.id, j)) return;
      const ds = t.dataset;
      if (ds.upsample) { const u = { ['b-' + j.id]: upB, ['a-' + j.id]: upA, ['c-' + j.id]: upC, ['r-' + j.id]: upR }[ds.upsample]; u.add([{ id: U.uid('ph'), kind: 'ph', label: { b: '작업 전', a: '작업 후', c: '추가 작업', r: '보완' }[ds.upsample[0]] + ' 사진', tone: Math.floor(Math.random() * 7) }]); return; }
      if (ds.retry) { const [k, i] = ds.retry.split(':'); ({ ['b-' + j.id]: upB, ['a-' + j.id]: upA, ['c-' + j.id]: upC, ['r-' + j.id]: upR }[k]).retry(+i); return; }
      if (ds.visit != null) { const v = U.qs('#vAt').value; if (!APP.validDate(v) || new Date(v).getTime() < Date.now()) { APP.toast('현재 이후의 방문 일시를 선택하세요', 'warn'); return; } const when = new Date(v).getTime(); const first = !j.visits.length; j.visits.push({ at: Date.now(), when, by: p.name }); if (j.stage === '업체 확정') APP.transition(j, '방문 예정', '협력업체', p.id, '방문 일정 ' + U.dt(when)); else APP.log(j, '협력업체', p.id, `방문 일정 ${first ? '등록' : '변경'} · ${U.dt(when)}`); APP.toast('방문 일정을 ' + (first ? '등록' : '변경') + '했습니다 · 고객에게 문자 안내'); draw(); return; }
      if (ds.start != null) { const nb = U.qs('#noB').value; if (!j.work.before.length && !nb) { APP.toast('작업 전 사진을 올리거나, 사진이 없는 사유를 선택하세요', 'warn'); return; } if (!j.work.before.length) j.work.noPhoto = { reason: nb, memo: U.qs('#noBm').value }; j.work.startedAt = Date.now(); APP.transition(j, '작업 중', '협력업체', p.id, j.work.before.length ? `작업 전 사진 ${j.work.before.length}장` : '사진 없음 · ' + nb); draw(); return; }
      if (ds.co != null) { const f = U.qs('#coF'); const amt = APP.money(f.amount.value); if (!f.reason.value.trim() || !amt) { APP.toast('사유와 추가 비용을 입력하세요', 'warn'); return; } APP.once('co-' + j.id + '-' + j.cos.length, () => { if (!APP.requestCO(j, p.id, { reason: f.reason.value.trim(), amount: amt, photos: coPh.slice() })) return false; coPh.length = 0; APP.toast('추가 작업을 요청했습니다 · 관리자·고객 승인 후 진행하세요'); }); f.reason.value = ''; f.amount.value = ''; draw(); return; }
      if (ds.rere) { const prev = j.cos.find((c) => c.id === ds.rere); APP.modal(`추가 작업 ${prev.seq + 1}차 재요청`, `<p class="hint">${prev.seq}차 승인 기록은 이력으로 남고 새 차수에 이어지지 않습니다. 두 승인을 다시 받습니다.</p><label class="fld">사유<input id="rrR" value="${esc(prev.reason)}"></label><label class="fld">추가 비용<input id="rrA" inputmode="numeric" value="${U.won(Math.round(prev.amount * 0.85 / 1000) * 1000)}"></label>`, [{ label: '취소', cls: 'line' }, { label: '재요청', fn: () => { if (!APP.requestCO(j, p.id, { reason: U.qs('#rrR').value, amount: APP.money(U.qs('#rrA').value) }, prev)) return false; draw(); } }]); return; }
      if (ds.wd) { const co = j.cos.find((c) => c.id === ds.wd); APP.modal('추가 작업 철회', '<p>아직 수행하지 않은 추가 작업만 철회할 수 있습니다. 이미 수행한 작업은 철회하지 말고 관리자에게 알려 주세요.</p><label class="fld">철회 사유<input id="wdR" value="고객과 협의해 이번에는 진행하지 않음"></label>', [{ label: '취소', cls: 'line' }, { label: '미수행 철회', cls: 'danger', fn: () => { APP.withdrawCO(j, co, '협력업체', p.id, U.qs('#wdR').value); draw(); } }]); return; }
      if (ds.report != null) {
        const cl = D2.checklist; const na = U.qs('#noA').value;
        if (!cl.every((x) => x.ok)) { APP.toast('기본 점검 항목을 모두 확인하세요', 'warn'); return; }
        if (!j.work.after.length && !na) { APP.toast('작업 후 사진을 올리거나 사유를 선택하세요', 'warn'); return; }
        const rawAmount = U.qs('#rca').value.trim(); const amt = rawAmount ? APP.money(rawAmount) : null; if (rawAmount && (!amt || !APP.validDate(U.qs('#rcd').value))) { APP.toast('수령 금액과 일시를 확인해 주세요', 'warn'); return; }
        APP.once('rep-' + j.id, () => {
          j.completion = { at: Date.now(), checklist: cl.map((x) => Object.assign({}, x)), note: '', photos: j.work.after.slice(), noPhoto: j.work.after.length ? '' : na };
          if (amt) APP.addPay(j, '협력업체', { amount: amt, date: U.qs('#rcd').value.replace('T', ' '), method: U.qs('#rcm').value }, '협력업체', p.id);
          const open = j.cos.filter(APP.coOpen).length;
          APP.transition(j, open ? '완료 보류' : '고객 확인 대기', '협력업체', p.id, open ? `완료 보고 · 미해결 추가 작업 ${open}건으로 보류` : '완료 보고 · 고객 확인 요청');
          APP.toast(open ? '완료 보류 · 추가 작업 승인이 끝나면 고객 확인으로 넘어갑니다' : '완료 보고 · 고객에게 확인 요청 문자를 보냅니다', open ? 'warn' : 'ok', 4500);
        }); draw(); return;
      }
      if (ds.revdone != null) { const n = U.qs('#rvN').value.trim(); if (!n && !revPh.length) { APP.toast('보완 내용이나 사진을 남겨 주세요', 'warn'); return; } j.completion.photos = j.completion.photos.concat(revPh.splice(0)); j.completion.note = n; APP.transition(j, '고객 확인 대기', '협력업체', p.id, '보완 보고 · ' + n); draw(); return; }
      if (ds.rc != null) { const amt = APP.money(U.qs('#rc2a').value); if (!amt) { APP.toast('금액을 입력하세요', 'warn'); return; } APP.once('rc-' + j.id + '-' + j.pays.length, () => { if (!APP.addPay(j, '협력업체', { amount: amt, date: U.qs('#rc2d').value.replace('T', ' '), method: U.qs('#rc2m').value }, '협력업체', p.id)) return false; const st = APP.payStatus(j); APP.toast('수령 기록 완료 · 수금 상태: ' + st.label, st.cls === 'r' ? 'warn' : 'ok', 4500); }); draw(); return; }
      if (ds.asdone) { const a = j.as.find((x) => x.id === ds.asdone); a.status = 'A/S 완료'; a.doneAt = Date.now(); APP.log(j, '협력업체', p.id, a.id + ' 처리 완료 보고', 'ok'); draw(); }
    };
  }

  APP.route(/^\/p\/?$/, home);
  APP.route(/^\/p\/join$/, join);
  APP.route(/^\/p\/req\/([\w-]+)$/, req);
  APP.route(/^\/p\/work$/, () => workList(false));
  APP.route(/^\/p\/done$/, () => workList(true));
  APP.route(/^\/p\/work\/([\w-]+)$/, work);
})();
