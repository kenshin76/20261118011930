/* FIXFLOW [프로토타입] — 관리자 웹 */
(function () {
  'use strict';
  const U = APP.U; const esc = U.esc; const I = APP.icon;
  const S = () => APP.get();
  const app = () => document.getElementById('app');

  function login() {
    app().innerHTML = `<div class="admin-entry"><header class="admin-entry-header"><a class="workspace-brand" href="#/">${I('tool')}<b>FIXFLOW 홈</b></a>${APP.serviceNav('admin')}</header><div class="a-login"><aside class="admin-welcome"><img src="assets/images/care.jpg" alt="공간을 정돈하는 서비스 작업자"><div><span class="service-kicker">FIXFLOW WORKSPACE</span><h1>좋은 관리는,<br>빠짐없는 기록에서.</h1><p>접수와 작업, 승인과 수금 내역을<br>한곳에서 확인하세요.</p></div></aside><div class="al-card"><a class="al-brand" href="#/"><span class="logo-m">${I('tool')}</span><div><b>FIXFLOW 관리자</b><span>시설 관리 운영 콘솔</span></div></a>
      <form id="alf" onsubmit="return false"><label class="fld">아이디<input name="id" value="admin" autocomplete="username"></label><label class="fld">비밀번호<input name="pw" type="password" value="demo1234" autocomplete="current-password"></label><button class="btn pri block" data-alog>로그인</button></form>
      <p class="hint">체험 계정 admin / demo1234 · 가상 데이터로 운영 흐름을 확인할 수 있습니다.</p><a class="link" href="#/">← FIXFLOW 홈으로</a></div></div></div>`;
    U.qs('[data-alog]').onclick = () => { const f = U.qs('#alf'); if (f.id.value !== 'admin' || f.pw.value !== 'demo1234') { APP.toast('아이디 또는 비밀번호가 맞지 않습니다 (admin / demo1234)', 'err'); return; } S().session.admin = 'admin'; APP.save(); APP.go('#/a'); };
  }

  function layout(menu, title, sub, body) {
    const todo = APP.todo(); const pend = S().partners.filter((p) => p.status === '승인 대기').length;
    const menus = [['/a', '확인 필요', 'bell', todo.length], ['/a/jobs', '전체 건 · A/S', 'list'], ['/a/proxy', '전화 대리접수', 'phone'], ['/a/partners', '협력업체', 'users', pend], ['/a/sites', '고객 · 사업장', 'home'], ['/a/design', '업무 기준', 'layers']];
    app().innerHTML = `<div class="adm"><aside class="aside"><a class="a-brand" href="#/a"><span class="logo-m">${I('tool')}</span><div><b>FIXFLOW</b><span>시설 관리 운영 콘솔</span></div></a>
      <nav>${menus.map((m) => `<a href="#${m[0]}" class="${menu === m[0] ? 'on' : ''}" ${menu === m[0] ? 'aria-current="page"' : ''}>${I(m[2])}<span>${m[1]}</span>${m[3] ? `<b class="cnt">${m[3]}</b>` : ''}</a>`).join('')}</nav>
      <div class="a-foot"><div class="a-quick"><span>관련 화면</span><a href="#/">${I('home')}FIXFLOW 홈</a><a href="#/c">${I('user')}고객</a><a href="#/p">${I('tool')}협력업체</a></div><button class="link" data-alogout>${I('out')}로그아웃</button></div></aside>
      <div class="amain"><header class="atop"><button class="a-menu" data-amenu aria-label="메뉴">${I('list')}</button><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="atop-r">${APP.serviceNav('admin')}</div></header><div class="acont" id="acont">${body}</div></div></div>`;
    const root = app();
    root.onclick = (e) => {
      if (e.target.closest('[data-alogout]')) { S().session.admin = null; APP.save(); APP.go('#/a'); return; }
      if (e.target.closest('[data-amenu]')) { U.qs('.adm').classList.toggle('nav-open'); return; }
      if (e.target.closest('.aside nav a')) U.qs('.adm').classList.remove('nav-open');
      if (root._h && APP.require('관리자')) root._h(e);
    };
    root.onchange = (e) => { if (root._c && APP.require('관리자')) root._c(e); };
    root.oninput = (e) => { if (root._i && APP.require('관리자')) root._i(e); };
    root._h = root._c = root._i = null;
    return U.qs('#acont');
  }

  /* ---------- 확인 필요 ---------- */
  let todoF = '';
  function todoPage() {
    const draw = () => {
      const all = APP.todo(); const list = todoF ? all.filter((t) => t.lv === todoF) : all;
      const js = S().jobs; const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const box = layout('/a', '확인 필요', '승인 대기와 기록 불일치 등 확인할 일을 한곳에 모았습니다', `
        <div class="kpis"><div class="kpi"><span>진행 중인 건</span><b>${js.filter((j) => j.stage !== '작업 완료').length}</b><em>시범 사업장 ${S().sites.length}곳</em></div>
        <div class="kpi"><span>오늘 접수</span><b>${js.filter((j) => j.at >= t0.getTime()).length}</b><em>대리접수 ${js.filter((j) => j.at >= t0.getTime() && j.via !== '고객').length}건 포함</em></div>
        <div class="kpi warn"><span>추가 작업 승인 미결</span><b>${js.reduce((a, j) => a + j.cos.filter((c) => APP.coOpen(c) || APP.coStatus(c) === '응답 기한 경과').length, 0)}</b><em>두 승인 모두 있어야 확정</em></div>
        <div class="kpi red"><span>수금 불일치·미기록</span><b>${js.filter((j) => j.stage === '작업 완료' && ['수금 대기', '불일치', '한쪽 기록됨', '청구 금액 차이', '확인 처리됨'].includes(APP.payStatus(j).label)).length}</b><em>정정해도 원래 기록 보존</em></div></div>
        <div class="tfilter">${[['', '전체', all.length], ['r', '바로 처리', all.filter((t) => t.lv === 'r').length], ['a', '확인 필요', all.filter((t) => t.lv === 'a').length], ['b', '진행 안내', all.filter((t) => t.lv === 'b').length]].map((f) => `<button class="${todoF === f[0] ? 'on' : ''} lv-${f[0] || 'all'}" data-tf="${f[0]}">${f[1]}<b>${f[2]}</b></button>`).join('')}</div>
        <ul class="todo">${list.map((t) => `<li class="lv-${t.lv}"><i></i><div class="t-main"><b>${esc(t.kind)}</b><span>${t.job ? `<a href="#/a/job/${t.job.id}?tab=${t.tab}">${esc(t.job.id)}</a> · ${esc(t.name)} · ${esc(APP.cat(t.job.cat).name)}` : esc(t.name)}</span><p>${esc(t.reason)}</p></div><time>${U.ago(t.since)}</time>${t.job ? `<a class="btn sm ${t.lv === 'r' ? 'pri' : 'line'}" href="#/a/job/${t.job.id}?tab=${t.tab}">처리 ${I('arrow')}</a>` : `<a class="btn sm line" href="#/a/partners">확인 ${I('arrow')}</a>`}</li>`).join('') || '<li class="empty">확인할 일이 없습니다</li>'}</ul>`);
      app()._h = (e) => { const f = e.target.closest('[data-tf]'); if (f) { todoF = f.dataset.tf; draw(); } };
    };
    draw();
    let last = 0; APP.live = () => { if (Date.now() - last > 15000) { last = Date.now(); if (!U.qs('#modal') && !U.qs('.adm.nav-open')) draw(); } };
  }

  /* ---------- 전체 건 ---------- */
  const JF = { stage: '', pay: '', q: '' };
  function jobsPage() {
    const draw = () => {
      let js = S().jobs.slice();
      if (JF.stage) js = js.filter((j) => j.stage === JF.stage);
      if (JF.pay) js = js.filter((j) => j.stage === '작업 완료' && APP.payStatus(j).label === JF.pay);
      if (JF.q) js = js.filter((j) => (j.id + (APP.siteById(j.siteId) || {}).name + APP.custById(j.custId).name).includes(JF.q));
      const box = layout('/a/jobs', '전체 건 · A/S', '접수부터 A/S까지 모든 건 · 엑셀 내보내기', `
        <div class="filters"><select data-jf="stage"><option value="">전체 단계</option>${APP.STAGES.map((s) => `<option ${JF.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select data-jf="pay"><option value="">전체 수금 상태</option>${['수금 대기', '한쪽 기록됨', '수금 일치', '불일치', '청구 금액 차이', '확인 처리됨'].map((s) => `<option ${JF.pay === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input data-jf="q" value="${esc(JF.q)}" placeholder="건번호·사업장·고객"><span class="sp"></span><button class="btn line sm" data-xls>${I('down')}엑셀 내보내기</button></div>
        <div class="tw"><table class="tbl"><thead><tr><th>건번호</th><th>사업장·고객</th><th>분류</th><th>단계</th><th>업체</th><th class="r">청구 예정</th><th>수금</th><th>추가 작업</th><th>A/S</th><th>접수</th></tr></thead><tbody>
        ${js.map((j) => { const site = APP.siteById(j.siteId); const pq = j.selectedQuote ? APP.partnerById(j.selectedQuote.partnerId).name : '—'; const b = APP.billed(j);
          return `<tr data-go="${j.id}"><td class="mono">${esc(j.id)}${j.via !== '고객' ? ' <span class="bdg n xs">대리</span>' : ''}</td><td>${esc(site ? site.name : APP.custById(j.custId).name)}</td><td><span class="cdot" style="--c:${APP.cat(j.cat).color}"></span>${esc(APP.cat(j.cat).name)}</td><td>${APP.stageBadge(j)}</td><td>${esc(pq)}</td><td class="r">${b.total ? U.won(b.total) : '—'}</td><td>${j.stage === '작업 완료' ? APP.payBadge(j) : '—'}</td><td>${j.cos.length ? j.cos.map((c) => APP.coBadge(c)).join(' ') : '—'}</td><td>${(j.as || []).length ? `<span class="bdg a">${j.as[0].status}</span>` : '—'}</td><td class="sm">${U.md(j.at)}</td></tr>`; }).join('') || '<tr><td colspan="10" class="empty">해당하는 건이 없습니다</td></tr>'}</tbody></table></div>`);
      app()._h = (e) => {
        if (e.target.closest('[data-xls]')) { U.xlsx(`fixflow_jobs_${U.d(Date.now())}.xlsx`, [['건번호', '접수 경로', '사업장·고객', '분류', '단계', '업체', '견적 확정', '확정 추가 작업', '청구 예정', '고객 지급', '업체 수령', '수금 상태', '접수 일시']].concat(js.map((j) => { const b = APP.billed(j); const c = APP.latestPay(j, '고객'); const p = APP.latestPay(j, '협력업체'); return [j.id, j.via, (APP.siteById(j.siteId) || APP.custById(j.custId)).name, APP.cat(j.cat).name, j.stage, j.selectedQuote ? APP.partnerById(j.selectedQuote.partnerId).name : '', b.base, b.add, b.total, c ? c.amount : '', p ? p.amount : '', j.stage === '작업 완료' ? APP.payStatus(j).label : '', U.dt(j.at)]; })), '건 목록'); return; }
        const r = e.target.closest('[data-go]'); if (r) APP.go('#/a/job/' + r.dataset.go);
      };
      app()._c = (e) => { const k = e.target.dataset.jf; if (k && k !== 'q') { JF[k] = e.target.value; draw(); } };
      app()._i = (e) => { if (e.target.dataset.jf === 'q') { JF.q = e.target.value; clearTimeout(JF._t); JF._t = APP.defer(() => { draw(); const i = U.qs('[data-jf=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); } };
    };
    draw();
  }

  /* ---------- 건 상세 ---------- */
  function jobPage(mm, params) {
    const j = APP.jobById(mm[1]); if (!j) { APP.go('#/a/jobs'); return; }
    let tab = params.tab || 'sum';
    const draw = () => {
      const cat = APP.cat(j.cat); const site = APP.siteById(j.siteId); const c = APP.custById(j.custId);
      const tabs = [['sum', '개요'], ['quote', '견적'], ['work', '작업·완료'], ['co', '추가 작업', j.cos.filter((x) => APP.coOpen(x) || APP.coStatus(x) === '응답 기한 경과').length], ['pay', '수금 대조', j.stage === '작업 완료' && !['수금 일치'].includes(APP.payStatus(j).label) ? '!' : ''], ['as', 'A/S', (j.as || []).filter((a) => a.status !== 'A/S 완료').length], ['hist', '이력']];
      const body = `<div class="jd-head" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(j.id)} · ${esc(cat.name)}</b><span>${esc(site ? site.name + ' (' + site.kind + ')' : c.name + ' (개인)')} · ${esc(c.name)} ${U.maskPhone(c.phone)} · ${esc(j.region)} · ${j.via === '고객' ? '고객 직접 접수' : '전화 대리접수'}</span></div>${APP.stageBadge(j)}${j.stage === '작업 완료' ? APP.payBadge(j) : ''}</div>
        ${APP.stepper(j)}<div class="jtabs">${tabs.map((t) => `<button class="${tab === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}${t[2] ? `<b>${t[2]}</b>` : ''}</button>`).join('')}</div><div class="jpane">${({ sum, quote, work, co, pay, as: asP, hist })[tab](j)}</div>`;
      layout('/a/jobs', '건 상세', `<a href="#/a/jobs">전체 건</a> › ${esc(j.id)}`, body);
      app()._h = (e) => onClick(e, j, () => draw(), (t) => { tab = t; draw(); });
    };
    draw();
  }

  function sum(j) {
    const s = j.selectedQuote;
    return `<div class="g2"><section class="card"><h3>접수 내용</h3><dl class="kv">${j.answers.map((a) => `<div><dt>${esc(a.q)}</dt><dd>${esc(a.a)}</dd></div>`).join('')}${j.memo ? `<div><dt>메모</dt><dd>${esc(j.memo)}</dd></div>` : ''}<div><dt>접수 경로</dt><dd>${j.via}${j.consent ? ` · 동의 ${esc(j.consent.time)} · ${esc(j.consent.method)} · ${esc(j.consent.note)}` : ''}</dd></div></dl><div class="phs">${j.photos.map((p) => APP.photo(p)).join('') || '<p class="hint">사진 없음' + (j.noPhoto ? ' · ' + esc(j.noPhoto) : '') + '</p>'}</div></section>
      <section class="card"><h3>선택된 견적 · 청구 예정</h3>${s ? `<p><b>${esc(APP.partnerById(s.partnerId).name)}</b> <span class="qt t-${s.type}">${s.type}</span> v${s.ver}</p><p class="hint">${esc(s.scope)}${s.cond ? ' · 조건: ' + esc(s.cond) : ''}</p>${billTable(j)}<p class="hint">고객이 선택한 금액·항목·조건을 작업에 고정했습니다 (${U.dt(s.at)}).</p>` : '<p class="hint">아직 선택된 견적이 없습니다.</p>'}
      <h3>지금 할 일</h3><ul class="nexts">${APP.todo().filter((t) => t.job === j || (t.job && t.job.id === j.id)).map((t) => `<li class="lv-${t.lv}"><b>${esc(t.kind)}</b> ${esc(t.reason)} <button class="link" data-tab="${t.tab}">이동</button></li>`).join('') || '<li>대기 중인 확인 사항이 없습니다</li>'}</ul></section></div>`;
  }
  function billTable(j) {
    const b = APP.billed(j);
    return `<table class="mini"><tr><td>견적 확정 금액</td><td class="r">${U.won(b.base)}</td></tr>${j.cos.map((co) => `<tr class="${APP.coStatus(co) === '확정' ? '' : 'mute'}"><td>추가 작업 ${co.seq}차 ${APP.coBadge(co)}</td><td class="r">${APP.coStatus(co) === '확정' ? '+' + U.won(co.amount) : '(' + U.won(co.amount) + ' 미포함)'}</td></tr>`).join('')}<tr class="tot"><td>청구 예정 금액</td><td class="r">${U.won(b.total)}</td></tr></table>`;
  }

  function quote(j) {
    const el = APP.eligible(j); const req = new Set(j.reqs.map((r) => r.partnerId));
    const canReq = ['접수', '견적 요청'].includes(j.stage);
    return `<div class="g2 w"><section class="card"><h3>견적 요청 현황</h3>${j.reqs.length ? `<p class="table-scroll-hint">표를 좌우로 밀어 전체 내용을 확인하세요.</p><div class="tw detail-table" role="region" aria-label="상세 내역 표" tabindex="0"><table class="tbl sm"><thead><tr><th>업체</th><th>요청</th><th>응답 마감</th><th>상태</th><th class="r">견적</th></tr></thead><tbody>${j.reqs.map((r) => { const q = j.quotes.find((x) => x.id === r.quoteId); const st = APP.reqState(r); return `<tr><td>${esc(APP.partnerById(r.partnerId).name)}</td><td>${U.md(r.at)}</td><td>${U.md(r.deadline)}</td><td><span class="bdg ${st === '응답' ? 'g' : st === '응답 대기' ? 'a' : 'r'}">${st}</span></td><td class="r">${q ? `${U.won(q.total)} <em class="sm">${q.type} v${q.ver}</em>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="hint">아직 견적을 요청하지 않았습니다.</p>'}
      <div class="btns">${j.stage === '견적 요청' ? `<button class="btn line sm" data-close>${I('clock')}마감 경과 업체 마감 처리</button><button class="btn pri sm" data-pub ${j.quotes.some((q) => !q.canceled) ? '' : 'disabled'}>${I('check')}견적 공개 (${j.quotes.filter((q) => !q.canceled).length}개)</button>` : ''}${j.stage === '견적 공개' ? `<span class="hint">고객 선택 대기 · ${U.dur(Date.now() - j.stageAt)} 경과 · 미응답은 선택으로 처리하지 않습니다</span>` : ''}</div>
      ${j.quotes.length ? `<h3>제출된 견적 (버전 보존)</h3><div class="qrow">${j.quotes.map((q) => `<div class="qmini ${q.canceled ? 'old' : ''}"><b>${esc(APP.partnerById(q.partnerId).name)} v${q.ver}</b><span class="qt t-${q.type}">${q.type}</span><p>${U.won(q.total)}원</p><em>${q.canceled ? '이전 버전' : APP.quoteState(j, q)}</em></div>`).join('')}</div>` : ''}</section>
      <section class="card"><h3>적격 업체 ${canReq ? '선택 · 견적 요청' : ''}</h3><p class="hint">분야(${esc(APP.cat(j.cat).name)}) · 지역(${esc(j.region)}) · 승인 상태가 맞는 업체만 표시합니다.</p>
      <ul class="elig">${el.map((p) => { const rq = S().jobs.reduce((a, x) => a + x.reqs.filter((r) => r.partnerId === p.id).length, 0); const rs = S().jobs.reduce((a, x) => a + x.reqs.filter((r) => r.partnerId === p.id && r.quoteId).length, 0);
        return `<li><label><input type="checkbox" data-el="${p.id}" ${req.has(p.id) ? 'checked disabled' : ''} ${canReq ? '' : 'disabled'}><b>${esc(p.name)}</b></label><span>${p.cats.map((c) => APP.cat(c).name).join('·')} · 응답률 ${rq ? Math.round((rs / rq) * 100) : '-'}%</span>${req.has(p.id) ? '<em class="bdg n xs">요청함</em>' : ''}</li>`; }).join('') || '<li class="hint">조건에 맞는 승인 업체가 없습니다</li>'}</ul>
      ${canReq ? `<div class="row"><label class="sm">응답 마감<select id="dl"><option value="12">12시간</option><option value="24" selected>24시간</option><option value="48">48시간</option></select></label><button class="btn pri sm" data-req>${j.stage === '접수' ? '견적 요청' : '대체 업체 재요청'}</button></div>` : ''}</section></div>`;
  }

  function work(j) {
    const c = j.completion;
    return `<div class="g2"><section class="card"><h3>방문 일정</h3>${j.visits.length ? `<ul class="mini-l">${j.visits.slice().reverse().map((v, i) => `<li><b>${U.dt(v.when)}</b> ${i ? '<em>이전</em>' : '<em class="bdg v xs">현재</em>'} · ${esc(v.by)} 등록 ${U.md(v.at)}</li>`).join('')}</ul>` : '<p class="hint">일정 미등록</p>'}
      <h3>작업 전 사진</h3><div class="phs">${j.work.before.map((p) => APP.photo(p)).join('') || `<p class="hint">${j.work.noPhoto ? '사진 없음 · ' + esc(j.work.noPhoto.reason) : '없음'}</p>`}</div></section>
      <section class="card"><h3>완료 보고 ${c ? `<em class="sm">${U.dt(c.at)}</em>` : ''}</h3>${c ? `<ul class="chk">${c.checklist.map((x) => `<li class="${x.ok ? 'ok' : ''}">${I(x.ok ? 'check' : 'x')}${esc(x.item)}</li>`).join('')}</ul><div class="phs">${c.photos.map((p) => APP.photo(p)).join('') || '<p class="hint">결과 사진 없음 · ' + esc(c.noPhoto || '') + '</p>'}</div>${c.note ? `<p class="hint">${esc(c.note)}</p>` : ''}` : '<p class="hint">아직 완료 보고가 없습니다.</p>'}
      ${j.revisions.length ? `<h3>보완 요청</h3><ul class="mini-l">${j.revisions.map((r) => `<li>${U.md(r.at)} · ${esc(r.by)} · ${esc(r.reason)}</li>`).join('')}</ul>` : ''}
      ${j.stage === '고객 확인 대기' ? `<div class="infobox">${I('clock')}고객 완료 확인 대기 ${U.dur(Date.now() - j.stageAt)} · 자동 완료하지 않습니다<div class="btns"><button class="btn line sm" data-remind="done">완료 확인 재안내 문자</button><button class="btn line sm" data-proxydone>전화 확인 대리 입력</button></div></div>` : ''}
      ${j.stage === '완료 보류' ? `<div class="infobox red">${I('alert')}미해결 유상 추가 작업이 있어 완료 보류 중입니다 <button class="link" data-tab="co">추가 작업으로</button></div>` : ''}</section></div>`;
  }

  function co(j) {
    if (!j.cos.length) return `<div class="card"><p class="hint">추가 작업 요청이 없습니다. 협력업체가 현장에서 원작업에 연결해 요청하면 여기에 표시됩니다.</p></div>`;
    return `<p class="lead-a">관리자 승인과 고객 승인을 <b>각각 기록</b>하고, <b>같은 차수·금액에 둘 다 있을 때만 확정</b>합니다. 고객 미응답은 승인으로 처리하지 않습니다.</p>` + j.cos.slice().reverse().map((c) => {
      const st = APP.coStatus(c); const a = c.approvals.find((x) => x.role === '관리자' && x.seq === c.seq); const cu = c.approvals.find((x) => x.role === '고객' && x.seq === c.seq); const prev = c.prevId ? j.cos.find((x) => x.id === c.prevId) : null;
      const ap = (x, role) => x ? `<div class="apc ${x.decision === '승인' ? 'ok' : 'no'}">${I(x.decision === '승인' ? 'check' : 'x')}<div><b>${role} ${x.decision}</b><span>${U.dt(x.at)} · 기록 ${esc(x.by)} · ${esc(x.method)}</span>${x.consent ? `<span class="cons">고객 동의 ${esc(x.consent.time)} · ${esc(x.consent.way)} · 근거: ${esc(x.consent.note)}</span>` : ''}${x.reason ? `<span>사유: ${esc(x.reason)}</span>` : ''}<span>승인 금액 ${U.won(x.amount)}원 · ${x.seq}차</span></div></div>` : `<div class="apc wait">${I('clock')}<div><b>${role} 대기</b><span>${role === '고객' && st === '응답 기한 경과' ? '응답 기한 경과 · 승인 아님' : role === '고객' ? '응답 기한 ' + U.dt(c.deadline) : '관리자 검토 필요'}</span></div></div>`;
      const open = APP.coOpen(c) || st === '응답 기한 경과';
      return `<section class="card co-card ${st === '확정' ? 'ok' : st === '반려' || st === '철회' ? 'mute' : 'hot'}"><header><b>${c.seq}차 추가 작업</b>${APP.coBadge(c)}${prev ? `<em class="sm">${prev.seq}차 반려 후 금액·범위 변경 재요청</em>` : ''}<span class="amt">+${U.won(c.amount)}원</span></header><p>${esc(c.reason)} · 요청 ${U.dt(c.at)} · ${esc(APP.partnerById(j.selectedQuote.partnerId).name)}</p><div class="phs">${c.photos.map((p) => APP.photo(p, 'sm')).join('')}</div>
        <div class="apgrid">${ap(a, '관리자')}<span class="plus">+</span>${ap(cu, '고객')}<span class="eq">=</span><div class="apr ${st === '확정' ? 'ok' : ''}"><b>${st}</b><span>${st === '확정' ? '청구 예정 금액에 합산' : st === '반려' ? '금액 제외 · 재요청 시 새 차수' : st === '철회' ? '금액 제외 · 이력 보존' : '확정 전 · 완료로 넘어가지 않음'}</span></div></div>
        ${c.withdrawn ? `<p class="hint">철회 ${U.dt(c.withdrawn.at)} · ${esc(c.withdrawn.by)} · ${esc(c.withdrawn.reason)}</p>` : ''}
        ${open ? `<div class="btns">${!a ? `<button class="btn line sm" data-coar="${c.id}">관리자 반려</button><button class="btn pri sm" data-coa="${c.id}">관리자 승인</button>` : ''}${!cu ? `<button class="btn line sm" data-coproxy="${c.id}">${I('phone')}고객 전화 동의 대리 입력</button><button class="btn line sm" data-coremind="${c.id}">${I('bell')}고객 재안내 문자</button>` : ''}<button class="btn ghost sm" data-cowd="${c.id}">미수행 철회</button></div>` : ''}</section>`;
    }).join('');
  }

  function pay(j) {
    if (j.stage !== '작업 완료' && !j.pays.length) return `<div class="card"><p class="hint">작업 완료 후 고객 지급 기록과 협력업체 수령 기록을 대조합니다. 지금 단계: ${j.stage}</p>${j.selectedQuote ? billTable(j) : ''}</div>`;
    const s = APP.payStatus(j); const c = s.c; const p = s.p; const d = new Set(s.diffs);
    const cell = (r, k, f) => r ? `<td class="${d.has(k) && !(k === '금액' && r.amount === s.billed) ? 'diff' : ''}">${f(r)}</td>` : '<td class="none">기록 없음</td>';
    return `<div class="g2 w"><section class="card"><h3>수금 대조 <span class="bdg ${s.cls}">${s.label}</span></h3>
      <p class="table-scroll-hint">표를 좌우로 밀어 전체 내용을 확인하세요.</p><div class="tw detail-table" role="region" aria-label="수금 기록 비교 표" tabindex="0"><table class="cmp"><thead><tr><th></th><th>청구 예정</th><th>고객 지급 기록</th><th>협력업체 수령 기록</th></tr></thead><tbody>
      <tr><th>금액</th><td><b>${U.won(s.billed)}원</b></td>${cell(c, '금액', (r) => `<b>${U.won(r.amount)}원</b>${r.amount !== s.billed ? `<em class="neg">${r.amount > s.billed ? '+' : ''}${U.won(r.amount - s.billed)}</em>` : ''}`)}${cell(p, '금액', (r) => `<b>${U.won(r.amount)}원</b>${r.amount !== s.billed ? `<em class="neg">${r.amount > s.billed ? '+' : ''}${U.won(r.amount - s.billed)}</em>` : ''}`)}</tr>
      <tr><th>일시</th><td>—</td>${cell(c, '일시', (r) => esc(r.date))}${cell(p, '일시', (r) => esc(r.date))}</tr>
      <tr><th>방법</th><td>—</td>${cell(c, '방법', (r) => esc(r.method))}${cell(p, '방법', (r) => esc(r.method))}</tr>
      <tr><th>입력</th><td>견적 + 확정 추가 작업</td>${cell(c, '', (r) => esc(r.by) + ' · ' + U.md(r.at))}${cell(p, '', (r) => esc(r.by) + ' · ' + U.md(r.at))}</tr></tbody></table></div>
      ${s.diffs.length ? `<p class="warnbox">${s.diffs.join('·')} 기록이 서로 다릅니다. 어느 기록이 맞는지는 아래 이력과 증빙으로 확인하세요.</p>` : s.gap ? `<p class="warnbox">두 기록은 같지만 청구 예정 금액과 ${U.won(Math.abs(s.gap))}원 차이가 있습니다 (부분 지급·할인 등).</p>` : s.missing ? `<p class="warnbox">${s.missing}이 없습니다.</p>` : ''}
      ${j.payReview ? `<div class="infobox">${I('clip')}<div><b>확인 처리 · ${esc(j.payReview.by)} · ${U.dt(j.payReview.at)}</b><span>${esc(j.payReview.reason)} · 근거: ${esc(j.payReview.evidence)}</span><span class="sm">처리 사유만으로 수금 일치나 결제 완료로 바꾸지 않으며, 차이는 계속 표시합니다.</span></div></div>` : ''}
      <div class="btns">${s.label !== '수금 일치' ? `<button class="btn line sm" data-preq>${I('bell')}정정·입력 요청 문자</button><button class="btn line sm" data-pproxy>${I('plus')}대리 입력·정정 기록</button>` : ''}${['불일치', '청구 금액 차이'].includes(s.label) ? `<button class="btn pri sm" data-preview>${I('check')}증빙 검토 후 확인 처리</button>` : ''}</div>
      <p class="hint">실제 지급·수령 내역을 기록하는 화면입니다. 차이가 있으면 근거를 확인하고 정정 기록을 남겨 주세요.</p></section>
      <section class="card"><h3>기록 이력 (덮어쓰지 않고 추가)</h3><ol class="tl">${j.pays.slice().reverse().map((r) => { const sup = j.pays.some((x) => x.supersedes === r.id); return `<li class="${sup ? 'old' : ''}"><time>${U.md(r.at)}</time><b>${r.side === '고객' ? '고객 지급' : '협력업체 수령'} ${U.won(r.amount)}원</b><span>${esc(r.date)} · ${esc(r.method)} · ${esc(r.by)}${r.supersedes ? ' · 정정 기록' : ''}${sup ? ' · <em>정정됨(보존)</em>' : ''}${r.note ? ' · ' + esc(r.note) : ''}</span></li>`; }).join('') || '<li class="hint">기록 없음</li>'}</ol>
      <h3>청구 예정 금액 구성</h3>${billTable(j)}</section></div>`;
  }

  function asP(j) {
    if (!(j.as || []).length) return `<div class="card"><p class="hint">A/S 요청이 없습니다. 고객이 완료된 작업을 골라 요청하면 원작업과 연결되어 표시됩니다.</p></div>`;
    return j.as.map((a) => `<section class="card"><header class="row"><b>${esc(a.id)}</b><span class="bdg ${a.status === 'A/S 완료' ? 'g' : a.status === 'A/S 접수' ? 'r' : 'a'}">${a.status}</span><em class="sm">원작업 ${esc(j.id)} · ${U.dt(a.at)} · ${esc(a.by)}</em></header><p>${esc(a.desc)}</p><div class="phs">${(a.photos || []).map((p) => APP.photo(p, 'sm')).join('')}</div>
      <div class="g2 tight"><div><h4>원작업 결과</h4><div class="phs">${(j.completion ? j.completion.photos : []).map((p) => APP.photo(p, 'sm')).join('')}</div></div><div><h4>원작업 정보</h4><p class="sm">${esc(APP.partnerById(j.selectedQuote.partnerId).name)} · 완료 ${U.md((j.hist.find((h) => h.to === '작업 완료') || {}).at || j.at)} · 수금 ${APP.payStatus(j).label}</p></div></div>
      ${a.status === 'A/S 접수' ? `<div class="btns"><button class="btn pri sm" data-asgo="${a.id}">원작업 업체(${esc(APP.partnerById(j.selectedQuote.partnerId).name)})에 배정</button></div>` : ''}</section>`).join('');
  }

  function hist(j) {
    const rows = j.hist.map((h, i) => ({ h, dur: i ? h.at - j.hist[i - 1].at : 0 }));
    const aps = []; j.cos.forEach((c) => c.approvals.forEach((a) => aps.push(Object.assign({ co: c }, a))));
    return `<div class="g2 w"><section class="card"><h3>상태 전이 이력 · 단계별 처리 시간</h3><p class="table-scroll-hint">표를 좌우로 밀어 전체 내용을 확인하세요.</p><div class="tw detail-table" role="region" aria-label="상세 내역 표" tabindex="0"><table class="tbl sm"><thead><tr><th>시각</th><th>이전 → 다음</th><th>주체</th><th>사유</th><th class="r">이전 단계 소요</th></tr></thead><tbody>${rows.map(({ h, dur }) => `<tr><td class="nw">${U.dt(h.at)}</td><td>${h.from ? esc(h.from) + ' → ' : ''}<b>${esc(h.to)}</b></td><td>${esc(h.role)} · ${esc(h.by)}</td><td class="sm">${esc(h.reason)}</td><td class="r">${dur ? U.dur(dur) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <h3>승인 기록</h3>${aps.length ? `<p class="table-scroll-hint">표를 좌우로 밀어 전체 내용을 확인하세요.</p><div class="tw detail-table" role="region" aria-label="상세 내역 표" tabindex="0"><table class="tbl sm"><thead><tr><th>대상</th><th>주체</th><th>판단</th><th>방식</th><th>기록자</th><th>시각</th></tr></thead><tbody>${aps.map((a) => `<tr><td>추가 작업 ${a.seq}차 · ${U.won(a.amount)}원</td><td>${a.role}</td><td>${a.decision}</td><td>${esc(a.method)}${a.consent ? ' (동의 ' + esc(a.consent.time) + ')' : ''}</td><td>${esc(a.by)}</td><td>${U.dt(a.at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">없음</p>'}</section>
      <section class="card"><h3>업무 기록</h3><ol class="tl">${j.log.slice().reverse().map((l) => `<li class="k-${l.kind}"><time>${U.md(l.at)}</time><b>${esc(l.role)} · ${esc(l.by)}</b><span>${esc(l.text)}</span></li>`).join('') || '<li class="hint">없음</li>'}</ol></section></div>`;
  }

  function onClick(e, j, draw, setTab) {
    const t = e.target.closest('[data-tab],button'); if (!t) return;
    const ds = t.dataset;
    if (ds.tab) { setTab(ds.tab); return; }
    if (ds.req != null) {
      const ids = U.qsa('[data-el]:checked:not(:disabled)').map((x) => x.dataset.el); if (!ids.length) { APP.toast('견적을 요청할 업체를 선택하세요', 'warn'); return; }
      const dl = +U.qs('#dl').value * APP.HOUR; ids.forEach((pid) => j.reqs.push({ id: U.uid('rq'), partnerId: pid, at: Date.now(), deadline: Date.now() + dl, quoteId: null, closed: false }));
      if (j.stage === '접수') APP.transition(j, '견적 요청', '관리자', null, `적격 업체 ${ids.length}곳에 견적 요청`); else APP.log(j, '관리자', null, `대체 업체 재요청 · ${ids.map((x) => APP.partnerById(x).name).join(', ')}`);
      APP.toast(`${ids.length}곳에 견적 요청 문자를 보냈습니다 (체험)`); draw(); return;
    }
    if (ds.close != null) { let n = 0; j.reqs.forEach((r) => { if (APP.reqState(r) === '응답 마감 경과') { r.closed = true; n++; } }); APP.log(j, '관리자', null, `응답 마감 처리 ${n}곳`); APP.toast(n ? `${n}곳을 미응답 마감했습니다` : '마감 경과 업체가 없습니다', n ? 'ok' : 'info'); draw(); return; }
    if (ds.pub != null) { const n = j.quotes.filter((q) => !q.canceled).length; APP.modal('견적 공개', `<p>제출된 견적 ${n}개를 고객에게 공개하고 문자로 안내합니다. 응답하지 않은 업체는 미응답으로 마감됩니다.</p>`, [{ label: '취소', cls: 'line' }, { label: '공개', fn: () => { const liveQuotes = j.quotes.filter(q => !q.canceled && q.validUntil > Date.now()); if (!APP.require('관리자') || j.stage !== '견적 요청' || !liveQuotes.length || liveQuotes.length > 3) { APP.toast('유효한 최신 견적을 1~3개 확인해 주세요', 'warn'); return false; } j.quotes.forEach((q) => (q.published = liveQuotes.includes(q))); j.quoteReview = null; j.reqs.forEach((r) => { if (!r.quoteId) r.closed = true; }); APP.transition(j, '견적 공개', '관리자', null, `견적 ${n}개 공개`); draw(); } }]); return; }
    if (ds.coa || ds.coar) { const c = j.cos.find((x) => x.id === (ds.coa || ds.coar)); if (ds.coa) { APP.once('co-a-' + c.id, () => { if (!APP.approveCO(j, c, '관리자', null, '승인')) return false; APP.toast(APP.coStatus(c) === '확정' ? '두 승인이 모두 기록되어 확정되었습니다' : '관리자 승인 기록 · 고객에게 승인 요청 문자를 보냅니다'); }); draw(); } else APP.modal('관리자 반려', '<label class="fld">반려 사유<input id="arR" value="금액 근거 사진 보완 필요"></label>', [{ label: '취소', cls: 'line' }, { label: '반려', cls: 'danger', fn: () => { APP.approveCO(j, c, '관리자', null, '반려', { reason: U.qs('#arR').value }); draw(); } }]); return; }
    if (ds.coproxy) {
      const c = j.cos.find((x) => x.id === ds.coproxy); const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      APP.modal('고객 전화 동의 대리 입력', `<p class="hint">고객의 승인 기록과 실제 입력자(운영 관리자)를 분리해 남깁니다. 동의가 확인되지 않으면 승인 대기로 유지됩니다.</p>
        <div class="infobox">${c.seq}차 · ${esc(c.reason)} · <b>${U.won(c.amount)}원</b></div>
        <label class="chk1"><input type="checkbox" id="cpA"> 고객에게 위 차수·금액·범위를 그대로 안내했습니다</label>
        <label class="fld">고객 결정<select id="cpD"><option>승인</option><option>반려</option></select></label><label class="fld">동의 시각<input type="datetime-local" id="cpT" value="${now}"></label><label class="fld">확인 방식<select id="cpW"><option>전화 통화</option><option>문자 회신</option></select></label><label class="fld">확인 근거<input id="cpN" placeholder="예) 대표 본인 통화, 통화 기록 14:20"></label>`,
        [{ label: '취소', cls: 'line' }, { label: '고객 결정 기록', fn: () => { if (!U.qs('#cpA').checked || !U.qs('#cpN').value.trim()) { APP.toast('안내 확인과 확인 근거를 입력하세요', 'warn'); return false; } APP.approveCO(j, c, '고객', j.custId, U.qs('#cpD').value, { method: '전화 대리', inputRole: '관리자', consent: { time: U.qs('#cpT').value.replace('T', ' '), way: U.qs('#cpW').value, note: U.qs('#cpN').value } }); draw(); } }]); return;
    }
    if (ds.coremind) { const c = j.cos.find((x) => x.id === ds.coremind); const exp = APP.coStatus(c) === '응답 기한 경과'; c.deadline = Date.now() + 24 * APP.HOUR; APP.log(j, '관리자', null, `추가 작업 ${c.seq}차 고객 재안내 문자 · 응답 기한 연장 ${U.dt(c.deadline)}`); APP.toast(exp ? '재안내했습니다 · 응답 기한을 24시간 연장했습니다 (승인으로 처리하지 않음)' : '재안내 문자를 보냈습니다 (체험)', 'info', 4500); draw(); return; }
    if (ds.cowd) { const c = j.cos.find((x) => x.id === ds.cowd); APP.modal('추가 작업 철회', '<p>미수행 요청만 철회할 수 있습니다. 이미 수행한 작업을 철회해 기록에서 빼지 않습니다.</p><label class="chk1"><input type="checkbox" id="wdC"> 협력업체에 미수행을 확인했습니다</label><label class="fld">철회 사유<input id="wdR" value="고객 미응답 · 이번에는 진행하지 않기로 협의"></label>', [{ label: '취소', cls: 'line' }, { label: '철회', cls: 'danger', fn: () => { if (!U.qs('#wdC').checked) { APP.toast('미수행 확인이 필요합니다', 'warn'); return false; } APP.withdrawCO(j, c, '관리자', null, U.qs('#wdR').value); draw(); } }]); return; }
    if (ds.remind) { APP.log(j, '관리자', null, '고객 완료 확인 재안내 문자'); APP.toast('완료 확인 재안내 문자를 보냈습니다 (체험)', 'info'); draw(); return; }
    if (ds.proxydone != null) { APP.modal('고객 완료 확인 대리 입력', '<label class="chk1"><input type="checkbox" id="pdC"> 고객이 전화로 결과를 확인하고 완료에 동의했습니다</label><label class="fld">확인 근거<input id="pdN" placeholder="예) 대표 통화 · 15:10"></label>', [{ label: '취소', cls: 'line' }, { label: '완료 확인 기록', fn: () => { if (!U.qs('#pdC').checked || !U.qs('#pdN').value.trim()) { APP.toast('고객 동의와 근거가 필요합니다', 'warn'); return false; } APP.transition(j, '작업 완료', '고객', j.custId, '전화 완료 확인 · 운영 관리자 대리 입력 · ' + U.qs('#pdN').value); draw(); } }]); return; }
    if (ds.preq != null) { const s = APP.payStatus(j); APP.log(j, '관리자', null, `수금 정정·입력 요청 문자 · ${s.label}`); APP.toast('고객·협력업체에 확인 요청 문자를 보냈습니다 (체험)', 'info'); draw(); return; }
    if (ds.pproxy != null) {
      const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); const b = APP.billed(j).total;
      APP.modal('대리 입력·정정 기록', `<p class="hint">기존 기록은 지우지 않고 정정 기록을 새로 추가합니다. 입력자는 운영 관리자로 남습니다.</p><label class="fld">대상<select id="ppS"><option>고객</option><option>협력업체</option></select></label><label class="fld">금액<input id="ppA" inputmode="numeric" value="${U.won(b)}"></label><label class="fld">일시<input id="ppD" type="datetime-local" value="${now}"></label><label class="fld">방법<select id="ppM">${D.PAY_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label><label class="fld">근거·사유<input id="ppN" placeholder="예) 업체 통장 입금 내역 확인"></label>`,
        [{ label: '취소', cls: 'line' }, { label: '기록 추가', fn: () => { const n = U.qs('#ppN').value.trim(); if (!n) { APP.toast('근거·사유를 입력하세요', 'warn'); return false; } const side = U.qs('#ppS').value; if (!APP.addPay(j, side, { amount: APP.money(U.qs('#ppA').value), date: U.qs('#ppD').value.replace('T', ' '), method: U.qs('#ppM').value }, side, side === '고객' ? j.custId : j.selectedQuote.partnerId, { inputRole: '관리자', correct: true, note: n })) return false; APP.toast('정정 기록을 추가했습니다 · 원래 기록은 보존됩니다 · 수금 상태: ' + APP.payStatus(j).label, 'ok', 4500); draw(); } }]); return;
    }
    if (ds.preview != null) { APP.modal('증빙 검토 후 확인 처리', '<p class="hint">처리 결과와 사유를 기록합니다. 처리 사유만으로 수금 일치나 결제 완료로 바꾸지 않으며, 미해결 차이는 계속 표시합니다.</p><label class="fld">처리 사유<input id="prR" placeholder="예) 은행 마감 후 입금되어 일자 차이"></label><label class="fld">확인 근거<input id="prE" placeholder="예) 이체 확인서·입금 내역"></label>', [{ label: '취소', cls: 'line' }, { label: '확인 처리', fn: () => { const r = U.qs('#prR').value.trim(); const ev = U.qs('#prE').value.trim(); if (!r || !ev) { APP.toast('사유와 근거가 모두 필요합니다', 'warn'); return false; } j.payReview = { at: Date.now(), by: '운영 관리자', reason: r, evidence: ev, after: j.pays.length }; APP.log(j, '관리자', null, '수금 확인 처리 · ' + r + ' (원래 기록 보존)', 'pay'); draw(); } }]); return; }
    if (ds.pdup != null) { const key = 'dup-' + j.id + '-' + j.pays.length; const before = j.pays.length; APP.once(key, () => { APP.log(j, '관리자', null, '중복 전송 시험: 1회차 반영 확인(기록 변화 없음)'); }); APP.once(key, () => {}); APP.toast(`같은 요청 고유 키로 2회 전송 → 1회만 처리 · 수금 기록 수 ${before} → ${j.pays.length}`, 'info', 5000); draw(); return; }
    if (ds.asgo) { const a = j.as.find((x) => x.id === ds.asgo); a.status = 'A/S 처리 중'; APP.log(j, '관리자', null, `${a.id} 원작업 업체 배정`); APP.toast('원작업 업체에 배정했습니다 · 협력업체 화면에서 처리 완료를 보고합니다'); draw(); }
  }

  /* ---------- 전화 대리접수 ---------- */
  function proxy() {
    const F = { cust: 'c2', site: 's2', cat: 'plumb', ans: {}, memo: '', addr: '' };
    const draw = () => {
      const c = APP.custById(F.cust); const cat = APP.cat(F.cat); const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      layout('/a/proxy', '전화 대리접수', '사진을 올리기 어려운 고객의 전화 접수 · 고객 동의와 대리 입력 기록', `<div class="g2 w"><section class="card"><h3>1. 고객·장소</h3>
        <label class="fld">고객<select data-p="cust">${S().customers.map((x) => `<option value="${x.id}" ${x.id === F.cust ? 'selected' : ''}>${esc(x.name)} · ${U.maskPhone(x.phone)}${x.siteIds.length ? ' · ' + esc(APP.siteById(x.siteIds[0]).name) : ' · 개인'}</option>`).join('')}</select></label>
        ${c.siteIds.length ? `<label class="fld">사업장<select data-p="site">${c.siteIds.map((s) => `<option value="${s}" ${F.site === s ? 'selected' : ''}>${esc(APP.siteById(s).name)}</option>`).join('')}</select></label>` : `<label class="fld">주소<input id="prAddr" value="${esc(F.addr)}" placeholder="작업할 주소"></label>`}
        <h3>2. 서비스·질문</h3><div class="chips">${D.CATS.map((x) => `<button class="chip ${x.id === F.cat ? 'on' : ''}" data-pc="${x.id}">${x.name}</button>`).join('')}</div>
        ${cat.q.map((qq, i) => `<fieldset class="qf"><legend>${esc(qq[0])}</legend><div class="chips">${qq[1].map((a) => `<button class="chip ${F.ans[i] === a ? 'on' : ''}" data-pa="${i}" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></fieldset>`).join('')}
        <label class="fld">통화 메모<textarea id="prMemo" rows="2" placeholder="예) 사진 없음 · 전화로 누수 위치 확인">${esc(F.memo)}</textarea></label></section>
        <section class="card"><h3>3. 고객 동의</h3><label class="chk1"><input type="checkbox" id="prOk"> 고객이 전화로 대리 접수와 문자 안내 수신에 동의했습니다</label><label class="fld">동의 시각<input type="datetime-local" id="prT" value="${now}"></label><label class="fld">확인 근거<input id="prN" placeholder="예) 대표 본인 통화 · 휴대폰 뒤 4자리 확인"></label>
        <div class="infobox">${I('shield')}<div><b>기록되는 내용</b><span>접수 경로(전화 대리접수), 실제 입력자(운영 관리자), 고객 동의 시각·방식·근거가 건 이력에 남습니다. 사진이 없으면 전화로 증상을 확인하고 통화 메모에 남겨 주세요.</span></div></div>
        <button class="btn pri block" data-prsave>${I('check')}대리 접수 등록</button></section></div>`);
      app()._h = (e) => {
        const pc = e.target.closest('[data-pc]'); if (pc) { F.cat = pc.dataset.pc; F.ans = {}; keep(); return; }
        const pa = e.target.closest('[data-pa]'); if (pa) { F.ans[pa.dataset.pa] = pa.dataset.v; keep(); return; }
        if (e.target.closest('[data-prsave]')) {
          const details = APP.proxyDetails({ custId: F.cust, cat: F.cat, siteId: F.site || null, addr: F.addr, answers: F.ans, consent: { custId: F.cust, confirmed: U.qs('#prOk').checked, time: U.qs('#prT').value, note: U.qs('#prN').value } });
          if (!details) return;
          const c2 = details.customer, cat2 = details.cat, site = details.site, siteId = site ? site.id : null;
          const t = Date.now(); const st = S();
          const j = { id: 'J-2611-' + (++st.seq - 1000), custId: c2.id, siteId, region: site ? site.region : c2.region || '사천 동부', addr: site ? '' : details.addr, cat: F.cat, answers: cat2.q.map((qq, i) => ({ q: qq[0], a: F.ans[i] })), memo: U.qs('#prMemo').value, photos: [], noPhoto: '전화 접수', via: '전화 대리접수', consent: details.consent,
            at: t, stage: '접수', stageAt: t, hist: [{ at: t, from: '', to: '접수', role: '관리자', by: '운영 관리자', reason: `전화 대리접수 · 고객 ${c2.name} 동의 ${U.qs('#prT').value.replace('T', ' ')}` }], log: [], reqs: [], quotes: [], selectedQuote: null, visits: [], work: { before: [], after: [], noPhoto: null, startedAt: null }, cos: [], completion: null, revisions: [], pays: [], payReview: null, as: [] };
          st.jobs.unshift(j); APP.save(); APP.toast('대리 접수를 등록했습니다 · 이어서 견적을 요청하세요'); APP.go('#/a/job/' + j.id + '?tab=quote');
        }
      };
      app()._c = (e) => { if (e.target.dataset.p === 'cust') { F.cust = e.target.value; const current = APP.custById(F.cust); F.site = current.siteIds[0] || null; F.addr = ''; F.memo = ''; F.ans = {}; draw(); } if (e.target.dataset.p === 'site') F.site = e.target.value; };
      app()._i = (e) => { if (e.target.id === 'prMemo') F.memo = e.target.value; if (e.target.id === 'prAddr') F.addr = e.target.value; };
      function keep() { const ids = ['prOk', 'prT', 'prN']; const v = {}; ids.forEach((k) => { const el = U.qs('#' + k); v[k] = el.type === 'checkbox' ? el.checked : el.value; }); draw(); ids.forEach((k) => { const el = U.qs('#' + k); if (el.type === 'checkbox') el.checked = v[k]; else el.value = v[k]; }); }
    };
    draw();
  }

  /* ---------- 협력업체 ---------- */
  function partners() {
    const draw = () => {
      const ps = S().partners;
      layout('/a/partners', '협력업체', '가입 승인 · 분야·지역 · 견적 응답률', `${ps.filter((p) => p.status !== '승인').map((p) => `<section class="card pend"><header class="row"><b>${esc(p.name)}</b><span class="bdg ${p.status === '승인 대기' ? 'a' : 'r'}">${p.status}</span><em class="sm">신청 ${esc(p.joined)}</em></header><dl class="kv"><div><dt>대표·연락처</dt><dd>${esc(p.owner)} · ${esc(p.phone)}</dd></div><div><dt>전문 분야</dt><dd>${p.cats.map((c) => APP.cat(c).name).join(', ')}</dd></div><div><dt>지역</dt><dd>${p.regions.join(', ')}</dd></div><div><dt>증빙</dt><dd>${p.docs.map(esc).join(', ') || '<b class="neg">없음</b>'}</dd></div>${p.memo ? `<div><dt>보완 요청</dt><dd>${esc(p.memo)}</dd></div>` : ''}</dl>
          ${p.status === '승인 대기' ? `<div class="btns"><button class="btn line sm" data-pfix="${p.id}">보완 요청</button><button class="btn pri sm" data-pok="${p.id}">승인</button></div>` : '<p class="hint">업체가 서류를 다시 제출하면 승인 대기로 돌아옵니다.</p>'}</section>`).join('')}
        <section class="card"><h3>활동 업체</h3><div class="tw"><table class="tbl"><thead><tr><th>업체</th><th>분야</th><th>지역</th><th class="r">요청</th><th class="r">응답률</th><th class="r">진행</th><th class="r">완료</th><th>증빙</th></tr></thead><tbody>${ps.filter((p) => p.status === '승인').map((p) => { const rq = S().jobs.reduce((a, x) => a + x.reqs.filter((r) => r.partnerId === p.id).length, 0); const rs = S().jobs.reduce((a, x) => a + x.reqs.filter((r) => r.partnerId === p.id && r.quoteId).length, 0); const mine = S().jobs.filter((x) => x.selectedQuote && x.selectedQuote.partnerId === p.id);
          return `<tr><td><b>${esc(p.name)}</b><div class="sm">${esc(p.owner)}</div></td><td>${p.cats.map((c) => `<span class="cdot" style="--c:${APP.cat(c).color}"></span>${APP.cat(c).name}`).join(' ')}</td><td class="sm">${p.regions.join(', ')}</td><td class="r">${rq}</td><td class="r">${rq ? Math.round((rs / rq) * 100) + '%' : '—'}</td><td class="r">${mine.filter((x) => x.stage !== '작업 완료').length}</td><td class="r">${mine.filter((x) => x.stage === '작업 완료').length}</td><td class="sm">${p.docs.map(esc).join(', ')}</td></tr>`; }).join('')}</tbody></table></div></section>`);
      app()._h = (e) => {
        const ok = e.target.closest('[data-pok]'); if (ok) { const p = APP.partnerById(ok.dataset.pok); if (!p.docs.length) { APP.toast('증빙 서류를 확인한 뒤 승인해 주세요', 'warn'); return; } p.status = '승인'; APP.save(); APP.toast(`${p.name} 승인 · 이제 적격 업체 목록에 나타납니다`); draw(); return; }
        const fx = e.target.closest('[data-pfix]'); if (fx) { const p = APP.partnerById(fx.dataset.pfix); APP.modal('보완 요청', '<label class="fld">보완 내용<input id="pfR" value="사업자등록증 사본을 다시 첨부해 주세요"></label>', [{ label: '취소', cls: 'line' }, { label: '보완 요청', fn: () => { p.status = '보완 요청'; p.memo = U.qs('#pfR').value; APP.save(); draw(); } }]); }
      };
    };
    draw();
  }

  /* ---------- 고객·사업장 ---------- */
  function sites() {
    const counts = (js) => `<td class="r">${js.length}</td><td class="r">${js.filter(j => j.stage !== '작업 완료').length}</td><td>${js.some(j => j.stage === '작업 완료' && APP.payStatus(j).label !== '수금 일치') ? '<span class="bdg r">확인 필요</span>' : '—'}</td>`;
    const rows = S().sites.map(s => { const c = APP.custById(s.owner), js = S().jobs.filter(j => j.siteId === s.id); return `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.kind)}</td><td>${esc(s.region)}</td><td>${esc(c.name)} · ${U.maskPhone(c.phone)}</td>${counts(js)}</tr>`; }).join('');
    const personal = S().customers.filter(c => !c.siteIds.length);
    const individuals = personal.map(c => { const js = S().jobs.filter(j => j.custId === c.id); return `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.kind || '개인')}</td><td>${U.maskPhone(c.phone)}</td><td>${esc(c.addr || '접수 시 입력')}<div class="sm">${esc(c.region || '')}</div></td>${counts(js)}</tr>`; }).join('');
    layout('/a/sites', '고객 · 사업장', `사업장 ${S().sites.length}곳 · 사업장 미등록 고객 ${personal.length}명`, `<section class="card"><h3>사업장 고객</h3><div class="tw"><table class="tbl"><thead><tr><th>사업장</th><th>업종</th><th>지역</th><th>대표·연락처</th><th class="r">전체 건</th><th class="r">진행</th><th>수금</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="card"><h3>개인·사업장 미등록 고객</h3><div class="tw"><table class="tbl"><thead><tr><th>고객</th><th>구분</th><th>연락처</th><th>주소·지역</th><th class="r">전체 건</th><th class="r">진행</th><th>수금</th></tr></thead><tbody>${individuals || '<tr><td colspan="7" class="empty">등록된 고객이 없습니다</td></tr>'}</tbody></table></div></section>`);
  }

  /* ---------- 상태 흐름 · 데이터 구조 ---------- */
  function design() {
    const flow = ['접수', '견적 요청', '견적 공개', '업체 확정', '방문 예정', '작업 중', '고객 확인 대기', '작업 완료'];
    const box = (x, y, w, t, cls) => `<g class="nd ${cls || ''}"><rect x="${x}" y="${y}" width="${w}" height="38" rx="10"/><text x="${x + w / 2}" y="${y + 24}" text-anchor="middle">${t}</text></g>`;
    let svg = `<svg class="flow" viewBox="0 0 1000 250" role="img" aria-label="건 상태 전이도"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#6B7A90"/></marker></defs>`;
    flow.forEach((s, i) => { const x = 10 + i * 124; svg += box(x, 20, 108, s, i === 7 ? 'g' : ''); if (i < 7) svg += `<line x1="${x + 108}" y1="39" x2="${x + 124}" y2="39" marker-end="url(#ar)"/>`; });
    svg += box(630, 120, 108, '완료 보류', 'r') + `<path d="M684 58 V118" marker-end="url(#ar)"/><path d="M738 139 H775 V60" marker-end="url(#ar)"/><text class="lb" x="678" y="96" text-anchor="end">미해결 추가 작업</text><text class="lb" x="770" y="100" text-anchor="end">종결 시</text>`;
    svg += box(800, 120, 108, '보완 요청', 'a') + `<path d="M815 58 V118" marker-end="url(#ar)"/><path d="M850 118 V60" marker-end="url(#ar)"/><text class="lb" x="914" y="100">보완 후 재보고</text>`;
    svg += box(320, 120, 160, '견적 재요청·선택 취소', 'n') + `<path d="M380 58 V118" marker-end="url(#ar)"/><text class="lb" x="80" y="200">진행 단계가 바뀔 때 담당자와 시각, 사유가 이력에 남습니다. 담당 권한과 현재 단계가 맞을 때만 다음 단계로 진행합니다.</text><text class="lb" x="80" y="222">고객 미응답은 어떤 단계에서도 승인·선택·완료로 처리하지 않습니다.</text></svg>`;
    layout('/a/design', '업무 기준', '진행 상태와 승인·수금 처리 기준을 확인합니다', `
      <section class="card"><h3>건 상태 전이</h3>${svg}</section>
      <div class="g3"><section class="card"><h3>추가 작업 (이중 승인)</h3><ol class="sflow"><li><b>요청됨</b>협력업체 · 원작업 연결</li><li><b>한쪽 승인</b>관리자 또는 고객 기록만</li><li class="g"><b>확정</b>같은 차수·금액에 두 승인</li><li class="r"><b>반려 · 응답 기한 경과 · 철회</b>미응답은 승인 아님 · 재요청은 새 차수</li></ol></section>
      <section class="card"><h3>수금 확인 (대조)</h3><ol class="sflow"><li><b>수금 대기</b>두 기록 없음</li><li><b>한쪽 기록됨</b>누가 미입력인지 표시</li><li class="g"><b>수금 일치</b>금액·일시·방법·청구 예정 일치</li><li class="r"><b>불일치 · 청구 금액 차이</b>다른 칸 강조</li><li><b>확인 처리됨</b>근거 기록 후에도 차이는 재확인 대상으로 유지</li></ol></section>
      <section class="card"><h3>작업 완료 (확인 분리)</h3><ol class="sflow"><li><b>작업 중</b>전·후 사진, 사진 없음 사유</li><li><b>업체 완료 보고</b>점검 항목·수령 금액</li><li><b>고객 확인 대기</b>자동 완료하지 않음</li><li class="g"><b>고객 완료 확인</b>또는 보완 요청</li></ol></section></div>
      <section class="card"><h3>확인 기록을 남기는 기준</h3><div class="g3 tight"><div><h4>추가 비용</h4><p>같은 작업 범위와 금액에 대한 관리자·고객 승인을 각각 남깁니다. 금액이 바뀌면 새 요청으로 다시 확인합니다.</p></div><div><h4>수금 정정</h4><p>원래 기록을 지우지 않고 새 기록과 확인 근거를 추가합니다. 차이가 남아 있으면 재확인 목록에서 계속 관리합니다.</p></div><div><h4>완료와 A/S</h4><p>고객이 결과를 확인한 뒤 작업을 완료합니다. A/S는 원작업과 연결해 이전 기록을 함께 확인합니다.</p></div></div></section>`);
  }

  function guard(fn) { return (m, p) => { if (!S().session.admin) { login(); return; } fn(m, p); }; }
  APP.route(/^\/a\/?$/, guard(todoPage));
  APP.route(/^\/a\/jobs$/, guard(jobsPage));
  APP.route(/^\/a\/job\/([\w-]+)$/, guard(jobPage));
  APP.route(/^\/a\/proxy$/, guard(proxy));
  APP.route(/^\/a\/partners$/, guard(partners));
  APP.route(/^\/a\/sites$/, guard(sites));
  APP.route(/^\/a\/design$/, guard(design));
})();
