/* FIXFLOW [프로토타입] — 모바일 공통 틀 + 고객 화면 */
(function () {
  'use strict';
  const U = APP.U; const esc = U.esc; const I = APP.icon;
  const S = () => APP.get();
  const app = () => document.getElementById('app');

  /* ---------- 고객·협력업체 반응형 공통 화면 ---------- */
  APP.mshell = function (o) {
    const role = o.role; const tabs = o.tabs || [];
    const localMenu = tabs.length ? `<nav class="workspace-tabs" aria-label="화면 이동">${tabs.map((t) => `<a href="${t[0]}" class="${o.tab === t[0] ? 'on' : ''}" ${o.tab === t[0] ? 'aria-current="page"' : ''}>${I(t[2])}<span>${t[1]}</span>${t[3] ? `<b>${t[3]}</b>` : ''}</a>`).join('')}</nav>` : '';
    const navigation = `<header class="workspace-header"><div class="workspace-primary"><a class="workspace-brand" href="#/">${I('tool')}<b>FIXFLOW 홈</b></a>${APP.serviceNav(role)}</div>${localMenu || o.back || o.right ? `<div class="workspace-tools">${o.back ? `<a class="workspace-back" href="${o.back}" aria-label="뒤로">${I('back')}<span>이전</span></a>` : ''}${localMenu}<div class="workspace-account">${o.right || ''}</div></div>` : ''}</header>`;
    app().innerHTML = `<div class="m-stage workspace ${role}">${navigation}<div class="phone ${tabs.length ? '' : 'workspace-entry'}"><div class="phone-in">
      <h1 class="workspace-sr-title">${o.title}</h1>
      <main class="m-body" id="mbody">${o.body}</main>
    </div></div></div>`;
    return document.getElementById('mbody');
  };

  const me = () => (S().session.cust ? APP.custById(S().session.cust) : null);
  function tabs() {
    const m = me(); const need = m ? S().jobs.filter((j) => j.custId === m.id && custAction(j)).length : 0;
    return [['#/c', '홈', 'home'], ['#/c/new', '접수하기', 'plus'], ['#/c/jobs', '내 접수', 'list', need || '']];
  }
  function custAction(j) {
    if (j.stage === '견적 공개') return '견적 비교·선택';
    if (j.cos.some((c) => APP.coStatus(c) === '고객 승인 대기')) return '추가 작업 승인';
    if (j.stage === '고객 확인 대기') return '완료 확인';
    if (j.stage === '작업 완료' && !APP.latestPay(j, '고객')) return '지급 기록';
    return '';
  }

  /* ---------- 문자 인증 ---------- */
  function otpBlock(onDone, phone) {
    return { html: `<div class="otp-box"><label for="otpPh">휴대폰 번호</label><div class="row"><input id="otpPh" inputmode="numeric" placeholder="010-0000-0000" value="${esc(phone || '')}"><button class="btn line" id="otpSend" type="button">인증번호</button></div>
      <label>인증번호<input id="otpCode" inputmode="numeric" maxlength="6" placeholder="6자리" disabled></label><p class="hint" id="otpHint">체험: <b>010-1234-5678</b>은 기존 고객(온담카페), 다른 번호는 새 고객으로 접수됩니다</p>
      <button class="btn pri block" id="otpOk" disabled>인증하고 계속</button></div>`,
      bind(root) {
        let code = null; let tries = 0; let sentPhone = ''; let expiresAt = 0;
        root.querySelector('#otpSend').onclick = () => {
          const ph = root.querySelector('#otpPh').value.replace(/\D/g, '');
          if (!/^01\d{8,9}$/.test(ph)) { APP.toast('휴대폰 번호를 확인해 주세요', 'warn'); return; }
          code = String(100000 + Math.floor(Math.random() * 899999)); tries = 0; sentPhone = ph; expiresAt = Date.now() + 180000;
          root.querySelector('#otpCode').disabled = false; root.querySelector('#otpOk').disabled = false;
          root.querySelector('#otpHint').innerHTML = `문자로 보낸 인증번호 (체험): <b class="code">${code}</b> · 유효시간 3분 · 5회 오류 시 재발송`;
          root.querySelector('#otpCode').focus();
        };
        root.querySelector('#otpOk').onclick = () => {
          if (!code || Date.now() >= expiresAt || root.querySelector('#otpPh').value.replace(/\D/g, '') !== sentPhone) { code = null; root.querySelector('#otpOk').disabled = true; APP.toast('인증번호가 만료되었거나 번호가 변경되었습니다. 다시 받아 주세요', 'warn'); return; }
          if (root.querySelector('#otpCode').value !== code) { tries++; APP.toast(tries >= 5 ? '5회 틀려 인증번호를 다시 받아야 합니다' : `인증번호가 맞지 않습니다 (${tries}/5)`, 'warn'); if (tries >= 5) { code = null; root.querySelector('#otpOk').disabled = true; } return; }
          const raw = root.querySelector('#otpPh').value.replace(/\D/g, ''); const ph = raw.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
          let c = S().customers.find((x) => x.phone === ph);
          if (!c) { c = { id: 'c' + (S().customers.length + 1), name: '새 고객', phone: ph, kind: '개인', siteIds: [], region: '사천 동부', addr: '' }; S().customers.push(c); }
          S().session.cust = c.id; APP.save(); onDone(c);
        };
      } };
  }

  /* ---------- 홈 ---------- */
  function home() {
    const m = me();
    const jobs = m ? S().jobs.filter((j) => j.custId === m.id) : [];
    const acts = jobs.filter(custAction);
    const active = jobs.filter(j => j.stage !== '작업 완료');
    const body = `<section class="service-overview"><div><span class="overview-kicker">우리 공간의 관리 파트너</span><h2>${m ? `${esc(m.name)}님, 반가워요.` : '공간의 불편을 간편하게 해결하세요.'}</h2><p>${m ? (acts.length ? `지금 확인할 일이 ${acts.length}건 있어요. 아래에서 이어서 처리하세요.` : '새로운 소식이 도착하면 이곳에서 확인할 수 있어요.') : '문자 인증으로 접수하고, 견적부터 작업 완료까지 한곳에서 확인하세요.'}</p></div><div class="overview-actions"><a class="btn pri" href="#/c/new">${I('plus')}서비스 요청하기</a>${m ? '' : `<a class="btn line" href="#/c/login">${I('user')}고객서비스</a>`}</div></section>
      ${m ? `<div class="overview-stats"><a href="#/c/jobs?filter=needs"><span>${I('bell')}확인할 일</span><b>${acts.length}<small>건</small></b><em>확인하기 ${I('arrow')}</em></a><a href="#/c/jobs?filter=progress"><span>${I('tool')}진행 중</span><b>${active.length}<small>건</small></b><em>진행 상황 ${I('arrow')}</em></a><a href="#/c/jobs"><span>${I('list')}전체 접수</span><b>${jobs.length}<small>건</small></b><em>내역 보기 ${I('arrow')}</em></a></div>
      <section class="task-section"><div class="task-heading"><h3>지금 확인할 일</h3><a href="#/c/jobs?filter=needs">모두 보기 ${I('arrow')}</a></div><div class="task-grid">${acts.length ? acts.map(card).join('') : '<p class="quiet-empty">지금 확인할 일이 없어요. 진행 상황은 내 접수에서 확인하세요.</p>'}</div></section>
      <section class="task-section"><div class="task-heading"><h3>진행 중인 접수</h3><a href="#/c/jobs?filter=progress">모두 보기 ${I('arrow')}</a></div><div class="task-grid">${jobs.filter((j) => !custAction(j) && j.stage !== '작업 완료').map(card).join('') || '<p class="quiet-empty">진행 중인 접수가 없어요. 도움이 필요하면 서비스를 요청해 주세요.</p>'}</div></section>`
        : `<section class="task-section"><div class="task-heading"><h3>이렇게 이용하세요</h3></div><ol class="howto">${['문자 인증 후 증상과 사진 접수', '운영자가 적격 업체에 견적 요청', '최대 3개 견적 비교 후 선택', '방문·작업, 추가 작업은 승인 후 진행', '완료 확인 · 지급 기록 · A/S'].map((t, i) => `<li><b>${i + 1}</b>${t}</li>`).join('')}</ol></section>`}`;
    APP.mshell({ role: 'cust', title: '홈', body, tabs: tabs(), tab: '#/c', right: m ? `<button class="m-ib" data-logout aria-label="로그아웃">${I('out')}</button>` : '' });
    bindLogout();
  }
  function bindLogout() { const b = U.qs('[data-logout]'); if (b) b.onclick = () => { S().session.cust = null; APP.save(); APP.toast('로그아웃했습니다'); APP.go('#/c'); }; }
  function card(j) {
    const cat = APP.cat(j.cat); const a = custAction(j); const site = APP.siteById(j.siteId);
    return `<a class="jcard" href="#/c/job/${j.id}" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.name : '개인')}</b><span>${esc(j.id)} · ${U.ago(j.at)} 접수</span>${a ? `<em class="need">${I('bell')}${a}</em>` : ''}</div>${APP.stageBadge(j)}</a>`;
  }

  function login() {
    const o = otpBlock(() => { APP.toast('인증되었습니다'); APP.go('#/c/jobs'); }, '010-1234-5678');
    const b = APP.mshell({ role: 'cust', title: '고객서비스', back: '#/c', body: `<p class="lead">접수할 때 쓴 휴대폰 번호로 인증하면 내 접수만 볼 수 있습니다.</p>${o.html}`, tabs: tabs(), tab: '' });
    o.bind(b);
  }

  /* ---------- 접수 ---------- */
  const W = { step: 0, cat: null, siteId: null, addr: '', answers: {}, photos: [], noPhoto: '', memo: '' };
  function newReq() {
    const m = me();
    if (W.owner !== (m && m.id) && W.owner != null) Object.assign(W, { owner: m && m.id, step: m ? 1 : 0, cat: null, siteId: null, addr: '', answers: {}, photos: [], noPhoto: '', memo: '' });
    const steps = ['본인 인증', '서비스', '장소', '질문', '사진', '확인'];
    W.owner = m && m.id;
    if (m && W.step === 0) W.step = 1;
    if (!m) W.step = 0;
    if (APP.prefillCategory) { Object.assign(W, { step: m ? 1 : 0, cat: APP.prefillCategory, siteId: null, addr: '', answers: {}, photos: [], noPhoto: '', memo: '' }); APP.prefillCategory = null; }
    const cat = W.cat ? APP.cat(W.cat) : null;
    let body = `<div class="wiz"><div class="wiz-bar"><i style="width:${(W.step / 5) * 100}%"></i></div><p class="wiz-s">${W.step + 1}/6 · ${steps[W.step]}</p>`;
    let o = null;
    if (W.step === 0) { o = otpBlock(() => { W.step = 1; newReq(); }); body += `<h2 class="q">휴대폰으로 본인 확인을 할게요</h2><p class="lead">회원가입은 필요 없습니다. 진행 안내도 이 번호로 문자를 보냅니다.</p>${o.html}`; }
    if (W.step === 1) body += `<h2 class="q">어떤 일이 필요하세요?</h2><div class="cats">${D.CATS.map((c) => `<button class="cat ${W.cat === c.id ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">${I(c.icon)}<b>${c.name}</b></button>`).join('')}</div>`;
    if (W.step === 2) {
      const sites = m.siteIds.map(APP.siteById);
      body += `<h2 class="q">어디에서 작업하나요?</h2>${sites.length ? `<div class="opts">${sites.map((s) => `<button class="opt ${W.siteId === s.id ? 'on' : ''}" data-site="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.kind)} · ${esc(s.addr)}</span></button>`).join('')}<button class="opt ${W.siteId === 'other' ? 'on' : ''}" data-site="other"><b>다른 장소</b><span>주소 직접 입력</span></button></div>` : ''}
        ${!sites.length || W.siteId === 'other' ? `<label class="fld">주소<input id="wAddr" value="${esc(W.addr)}" placeholder="예) 사천시 가상로 12, 2층"></label>` : ''}`;
    }
    if (W.step === 3) body += `<h2 class="q">${esc(cat.name)} — 몇 가지만 알려 주세요</h2>${cat.q.map((qq, i) => `<fieldset class="qf"><legend>${esc(qq[0])}</legend><div class="chips">${qq[1].map((a) => `<button class="chip ${W.answers[i] === a ? 'on' : ''}" data-ans="${i}" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></fieldset>`).join('')}<label class="fld">추가로 알려 주실 내용 (선택)<textarea id="wMemo" rows="2" placeholder="예) 영업시간 전 방문 희망">${esc(W.memo)}</textarea></label>`;
    if (W.step === 4) body += `<h2 class="q">사진을 올려 주세요</h2><p class="lead">사진이 있으면 견적이 정확해집니다. 최대 6장, 장당 15MB 이하 (JPG·PNG·WEBP·HEIC). 올리기 전에 휴대폰에서 크기를 줄여 데이터를 아낍니다.</p>
      <label class="upl">${I('camera')}<b>카메라·갤러리에서 선택</b><input type="file" id="wFile" accept="image/*" multiple></label>
      <div class="phs">${W.photos.map((p, i) => `<div class="phw">${APP.photo(p, 'sm')}<button class="ph-x" data-rmph="${i}" aria-label="삭제">×</button>${p.small ? `<em>${p.small}</em>` : ''}</div>`).join('')}</div>
      <button class="btn line sm" data-sample>${I('play')}체험용 예시 사진 넣기</button>
      <details class="nophoto" ${W.noPhoto ? 'open' : ''}><summary>사진을 올리기 어려워요</summary><select id="wNo"><option value="">사유 선택</option><option ${W.noPhoto === '사진 촬영이 어려움' ? 'selected' : ''}>사진 촬영이 어려움</option><option ${W.noPhoto === '전화로 설명하고 싶음' ? 'selected' : ''}>전화로 설명하고 싶음</option></select><p class="hint">사진 없이 접수하면 운영자가 전화로 확인해 내용을 보완합니다.</p></details>`;
    if (W.step === 5) {
      const site = W.siteId && W.siteId !== 'other' ? APP.siteById(W.siteId) : null;
      body += `<h2 class="q">이대로 접수할까요?</h2><dl class="kv"><div><dt>서비스</dt><dd>${esc(cat.name)}</dd></div><div><dt>장소</dt><dd>${esc(site ? site.name + ' · ' + site.addr : W.addr || m.addr || '-')}</dd></div>${cat.q.map((qq, i) => `<div><dt>${esc(qq[0])}</dt><dd>${esc(W.answers[i])}</dd></div>`).join('')}<div><dt>사진</dt><dd>${W.photos.length ? W.photos.length + '장' : '없음 · ' + esc(W.noPhoto)}</dd></div>${W.memo ? `<div><dt>메모</dt><dd>${esc(W.memo)}</dd></div>` : ''}</dl><p class="hint">접수 후 운영자가 분야·지역이 맞는 협력업체에 견적을 요청합니다. 견적이 도착하면 문자로 알려 드립니다.</p>`;
    }
    body += `</div>`;
    const canNext = [false, !!W.cat, !!(W.siteId && W.siteId !== 'other') || !!(W.addr || '').trim() || (!(m && m.siteIds.length) && !!(W.addr || '').trim()), cat && cat.q.every((_, i) => W.answers[i]), W.photos.length > 0 || !!W.noPhoto, true][W.step];
    const foot = W.step === 0 ? '' : `<div class="wiz-f"><button class="btn line" data-prev ${W.step <= 1 ? 'disabled' : ''}>이전</button><button class="btn pri" data-next ${canNext ? '' : 'disabled'}>${W.step === 5 ? `${I('check')}접수하기` : '다음'}</button></div>`;
    const root = APP.mshell({ role: 'cust', title: '접수하기', back: '#/c', body: body + foot, tabs: tabs(), tab: '#/c/new' });
    if (o) o.bind(root);
    root.onclick = (e) => {
      const t = e.target.closest('[data-cat],[data-site],[data-ans],[data-rmph],[data-sample],[data-prev],[data-next]'); if (!t) return;
      if (t.dataset.cat) { W.cat = t.dataset.cat; W.answers = {}; }
      if (t.dataset.site) W.siteId = t.dataset.site;
      if (t.dataset.ans != null) W.answers[t.dataset.ans] = t.dataset.v;
      if (t.dataset.rmph != null) W.photos.splice(+t.dataset.rmph, 1);
      if (t.dataset.sample != null && W.photos.length < 6) W.photos.push({ id: U.uid('ph'), kind: 'ph', label: '접수 사진 ' + (W.photos.length + 1), tone: W.photos.length });
      if (t.dataset.prev != null) W.step--;
      if (t.dataset.next != null) { if (W.step === 5) { submit(); return; } W.step++; }
      newReq();
    };
    root.oninput = (e) => { if (e.target.id === 'wAddr') { W.addr = e.target.value; const nx = U.qs('[data-next]'); if (nx) nx.disabled = !W.addr.trim(); } if (e.target.id === 'wMemo') W.memo = e.target.value; };
    root.onchange = (e) => {
      if (e.target.id === 'wNo') { W.noPhoto = e.target.value; newReq(); }
      if (e.target.id === 'wFile') APP.readPhotos(e.target.files, '접수 사진', (ok, errs) => { W.photos = W.photos.concat(ok).slice(0, 6); errs.forEach((x) => APP.toast(x, 'warn', 4500)); if (ok.length) APP.toast(`${ok.length}장을 줄여서 올릴 준비를 했습니다`); newReq(); });
    };
  }
  function submit() {
    const m = me(); const cat = APP.cat(W.cat);
    if (!m || W.owner !== m.id || !cat || !cat.q.every((_, i) => W.answers[i]) || (!W.photos.length && !W.noPhoto) || W.siteId && W.siteId !== 'other' && !m.siteIds.includes(W.siteId)) { APP.toast('접수 정보를 다시 확인해 주세요', 'warn'); APP.go('#/c/new'); return; }
    const site = W.siteId && W.siteId !== 'other' ? APP.siteById(W.siteId) : null;
    const now = Date.now(); const st = S();
    const j = { id: 'J-2611-' + (++st.seq - 1000), custId: m.id, siteId: site ? site.id : null, region: site ? site.region : m.region || '사천 동부', addr: site ? '' : W.addr, cat: W.cat, answers: cat.q.map((qq, i) => ({ q: qq[0], a: W.answers[i] })), memo: W.memo, photos: W.photos.slice(), noPhoto: W.noPhoto, via: '고객', consent: null,
      at: now, stage: '접수', stageAt: now, hist: [{ at: now, from: '', to: '접수', role: '고객', by: m.name, reason: '문자 인증 후 비회원 접수' }], log: [], reqs: [], quotes: [], selectedQuote: null, visits: [], work: { before: [], after: [], noPhoto: null, startedAt: null }, cos: [], completion: null, revisions: [], pays: [], payReview: null, as: [] };
    st.jobs.unshift(j); APP.save();
    Object.assign(W, { step: 1, cat: null, siteId: null, addr: '', answers: {}, photos: [], noPhoto: '', memo: '' });
    APP.toast('접수되었습니다. 견적이 도착하면 안내해 드릴게요');
    APP.go('#/c/job/' + j.id);
  }

  /* ---------- 내 접수 ---------- */
  function jobs(_, params = {}) {
    const m = me(); if (!m) { APP.go('#/c/login'); return; }
    const filters = [['all', '전체'], ['needs', '확인 필요'], ['progress', '진행 중'], ['done', '완료']];
    let filter = filters.some(([key]) => key === params.filter) ? params.filter : 'all', query = '';
    const root = APP.mshell({ role: 'cust', title: '내 접수', back: '#/c', body: `<section class="list-intro"><div><span class="overview-kicker">MY REQUESTS</span><h2>내 접수</h2><p>${esc(m.name)} · ${U.maskPhone(m.phone)}</p></div><a class="btn pri" href="#/c/new">${I('plus')}새 접수</a></section><div class="request-controls"><label class="request-search" for="requestSearch">${I('search')}<input id="requestSearch" type="search" aria-label="접수 검색" placeholder="접수번호, 서비스, 장소 검색" autocomplete="off"></label><div class="request-filters" aria-label="접수 상태 필터">${filters.map(([key,label]) => `<button type="button" data-request-filter="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div></div><p class="result-count" id="requestCount" role="status"></p><div id="requestResults" class="task-grid"></div>`, tabs: tabs(), tab: '#/c/jobs' });
    const draw = () => {
      const all = S().jobs.filter(j => j.custId === m.id);
      const norm = value => String(value).toLowerCase().replace(/\s/g, '');
      const found = all.filter(j => (filter === 'all' || filter === 'needs' && custAction(j) || filter === 'progress' && j.stage !== '작업 완료' || filter === 'done' && j.stage === '작업 완료') && norm([j.id, APP.cat(j.cat).name, (APP.siteById(j.siteId) || {}).name || '개인', j.stage].join(' ')).includes(norm(query)));
      root.querySelector('#requestCount').textContent = `${filters.find(([key]) => key === filter)[1]} ${found.length}건 · 전체 ${all.length}건`;
      root.querySelector('#requestResults').innerHTML = found.length ? found.map(card).join('') : `<div class="search-empty">${I('search')}<b>조건에 맞는 접수가 없어요</b><p>검색어나 상태를 바꾸어 다시 확인해 주세요.</p><button type="button" class="btn line" data-request-reset>전체 접수 보기</button></div>`;
      root.querySelectorAll('[data-request-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.requestFilter === filter)));
    };
    root.querySelector('#requestSearch').oninput = e => { query = e.target.value; draw(); };
    root.onclick = e => {
      const button = e.target.closest('[data-request-filter]');
      if (button) { filter = button.dataset.requestFilter; draw(); }
      if (e.target.closest('[data-request-reset]')) { filter = 'all'; query = ''; root.querySelector('#requestSearch').value = ''; draw(); root.querySelector('#requestSearch').focus(); }
    };
    draw();
  }

  /* ---------- 접수 상세 ---------- */
  function job(mm) {
    const j = APP.jobById(mm[1]); const m = me();
    if (!j) { APP.go('#/c'); return; }
    if (!m || m.id !== j.custId) {
      APP.mshell({ role: 'cust', title: '접수 확인', back: '#/c', body: `<div class="locked">${I('shield')}<b>본인 접수만 볼 수 있습니다</b><p>접수할 때 쓴 휴대폰 번호로 인증해 주세요. 다른 고객의 접수와 사진은 열리지 않습니다.</p><button class="btn pri block" data-as>체험 계정으로 이 접수 확인</button></div>`, tabs: tabs(), tab: '' });
      U.qs('[data-as]').onclick = () => { S().session.cust = j.custId; APP.save(); APP.render(); };
      return;
    }
    const draw = () => {
      const cat = APP.cat(j.cat); const site = APP.siteById(j.siteId);
      let act = '';
      if (j.stage === '견적 공개') act = quotesPanel(j);
      if (j.selectedQuote) act += selectedPanel(j);
      j.cos.forEach((co) => { act += coPanel(j, co); });
      if (j.stage === '고객 확인 대기' || j.stage === '완료 보류' || j.stage === '보완 요청') act += donePanel(j);
      if (j.stage === '작업 완료') act += payPanel(j) + asPanel(j);
      const body = `<div class="jhead" style="--c:${cat.color}"><span class="jc-ic">${I(cat.icon)}</span><div><b>${esc(cat.name)} · ${esc(site ? site.name : '개인')}</b><span>${esc(j.id)} · ${U.dt(j.at)}</span></div>${APP.stageBadge(j)}</div>
        ${APP.stepper(j, true)}${APP.nextLine(j)}${act}
        <details class="sec-d"><summary>접수 내용</summary><dl class="kv">${j.answers.map((a) => `<div><dt>${esc(a.q)}</dt><dd>${esc(a.a)}</dd></div>`).join('')}${j.memo ? `<div><dt>메모</dt><dd>${esc(j.memo)}</dd></div>` : ''}</dl><div class="phs">${j.photos.map((p) => APP.photo(p, 'sm')).join('') || `<p class="hint">사진 없음${j.noPhoto ? ' · ' + esc(j.noPhoto) : ''}</p>`}</div></details>
        <details class="sec-d"><summary>진행 기록</summary><ol class="tl">${j.hist.slice().reverse().map((h) => `<li><time>${U.md(h.at)}</time><b>${esc(h.to)}</b><span>${esc(h.by)}${h.reason ? ' · ' + esc(h.reason) : ''}</span></li>`).join('')}</ol></details>`;
      APP.mshell({ role: 'cust', title: '접수 상세', back: '#/c/jobs', body, tabs: tabs(), tab: '#/c/jobs', focus: j });
    };
    draw();
    U.qs('#app').onclick = (e) => {
      const t = e.target.closest('[data-pick],[data-unpick],[data-coa],[data-cor],[data-done],[data-rev],[data-pay],[data-as-new]'); if (!t) return;
      if (t.dataset.pick) pickQuote(j, t.dataset.pick, draw);
      if (t.dataset.unpick != null) APP.modal('견적 선택 취소', '<p>업체가 방문 일정을 정하기 전까지 선택을 취소할 수 있습니다. 취소하면 다른 견적을 다시 고를 수 있고, 취소 기록이 남습니다.</p><label class="fld">취소 사유<input id="unR" value="일정이 맞지 않음"></label>', [{ label: '닫기', cls: 'line' }, { label: '선택 취소', cls: 'danger', fn: () => { if (!APP.require('고객', j.custId, j) || j.stage !== '업체 확정' || !j.selectedQuote) return false; const prev = j.selectedQuote; j.selectedQuote = null; APP.transition(j, '견적 공개', '고객', j.custId, '견적 선택 취소 · ' + U.qs('#unR').value); APP.log(j, '고객', j.custId, `${APP.partnerById(prev.partnerId).name} 견적 선택 취소`, 'warn'); draw(); } }]);
      if (t.dataset.coa) APP.modal('추가 작업 승인', `<p><b>${U.won(+t.dataset.amt)}원</b>이 청구 예정 금액에 더해집니다. 관리자 승인과 고객님의 승인이 모두 있어야 확정됩니다.</p>`, [{ label: '취소', cls: 'line' }, { label: '승인합니다', fn: () => { const co = j.cos.find((c) => c.id === t.dataset.coa); APP.once('co-c-' + co.id, () => { if (!APP.approveCO(j, co, '고객', j.custId, '승인')) return false; APP.toast('승인이 기록되었습니다'); }); draw(); } }]);
      if (t.dataset.cor) APP.modal('추가 작업 반려', '<label class="fld">반려 사유<select id="corR"><option>금액이 예상보다 큼</option><option>지금은 필요하지 않음</option><option>설명이 더 필요함</option></select></label>', [{ label: '취소', cls: 'line' }, { label: '반려', cls: 'danger', fn: () => { const co = j.cos.find((c) => c.id === t.dataset.cor); APP.approveCO(j, co, '고객', j.custId, '반려', { reason: U.qs('#corR').value }); draw(); } }]);
      if (t.dataset.done != null) APP.modal('작업 완료 확인', '<p>완료 보고 내용과 사진을 확인하셨나요? 확인하면 작업이 완료로 바뀌고, 수금 확인은 따로 진행됩니다.</p>', [{ label: '취소', cls: 'line' }, { label: '완료 확인', fn: () => { if (APP.transition(j, '작업 완료', '고객', j.custId, '고객 완료 확인')) APP.toast('완료 확인이 기록되었습니다'); draw(); } }]);
      if (t.dataset.rev != null) APP.modal('보완 요청', '<label class="fld">보완이 필요한 내용<textarea id="revR" rows="3" placeholder="예) 창틀 물때가 남아 있습니다"></textarea></label>', [{ label: '취소', cls: 'line' }, { label: '보완 요청', fn: () => { const r = U.qs('#revR').value.trim(); if (!r) { APP.toast('내용을 적어 주세요', 'warn'); return false; } j.revisions.push({ at: Date.now(), reason: r, by: me().name }); APP.transition(j, '보완 요청', '고객', j.custId, r); draw(); } }]);
      if (t.dataset.pay != null) {
        const f = U.qs('#payF'); const amt = APP.money(f.amt.value); if (!amt || !f.dt.value || !f.method.value) { APP.toast('금액·일시·방법을 모두 입력해 주세요', 'warn'); return; }
        APP.once('pay-c-' + j.id + '-' + j.pays.length, () => { if (!APP.addPay(j, '고객', { amount: amt, date: f.dt.value.replace('T', ' '), method: f.method.value }, '고객', j.custId)) return false; const st = APP.payStatus(j); APP.toast(`지급 기록 완료 · 현재 수금 상태: ${st.label}`, st.cls === 'r' ? 'warn' : 'ok', 4500); });
        draw();
      }
      if (t.dataset.asNew != null) asForm(j, draw);
    };
  }

  function quotesPanel(j) {
    const qs = j.quotes.filter((q) => q.published && !q.canceled);
    return `<section class="panel-m"><h3>${I('clip')}견적 ${qs.length}개 비교</h3><p class="hint">응답하지 않으면 자동 선택되지 않습니다. 유효기간이 지난 견적은 선택할 수 없습니다.</p><div class="qcmp">${qs.slice(0, 3).map((q) => {
      const p = APP.partnerById(q.partnerId); const st = APP.quoteState(j, q); const exp = st === '유효기간 경과';
      return `<article class="qc ${exp ? 'off' : ''}"><header><b>${esc(p.name)}</b><span class="qt t-${q.type}">${q.type}</span></header><p class="qamt">${U.won(q.total)}<small>원</small></p>
        <ul class="qbr"><li><span>작업비</span>${U.won(q.labor)}</li><li><span>자재비</span>${U.won(q.material)}</li><li><span>세금</span>${U.won(q.tax)}</li></ul>
        <dl><dt>일정</dt><dd>${esc(q.schedule)}</dd><dt>포함 범위</dt><dd>${esc(q.scope)}</dd>${q.cond ? `<dt>조건</dt><dd class="cond">${esc(q.cond)}</dd>` : ''}<dt>유효기간</dt><dd>${exp ? '<b class="neg">경과</b>' : U.md(q.validUntil) + '까지'}</dd></dl>
        <button class="btn ${exp ? 'line' : 'pri'} block" data-pick="${q.id}" ${exp ? 'disabled' : ''}>${exp ? '선택 불가' : '이 견적 선택'}</button></article>`; }).join('')}</div></section>`;
  }
  function pickQuote(j, qid, draw) {
    const q = j.quotes.find((x) => x.id === qid); const p = APP.partnerById(q.partnerId);
    APP.modal('견적 선택', `<p><b>${esc(p.name)}</b> · ${q.type} · <b>${U.won(q.total)}원</b></p><p class="hint">선택한 금액·항목·조건이 작업에 그대로 고정됩니다. ${q.type !== '확정' ? '<b>조건부는 적용 조건을 확인해 주세요. 진단형의 표시 금액은 진단 방문비이며, 본작업 비용은 별도 협의가 필요합니다.</b>' : '이후 작업 범위가 늘어나면 별도 추가 작업 승인을 받습니다.'}</p>`,
      [{ label: '취소', cls: 'line' }, { label: '선택 확정', fn: () => {
        APP.once('pick-' + j.id + '-' + qid + '-' + j.hist.length, () => {
          if (!APP.require('고객', j.custId, j) || j.stage !== '견적 공개' || q.canceled || !q.published || q.validUntil <= Date.now() || p.status !== '승인') { APP.toast('견적 상태나 유효기간이 변경되었습니다', 'warn'); return false; }
          if (j.selectedQuote) { APP.toast('이미 선택된 견적이 있습니다', 'warn'); return; }
          j.selectedQuote = { quoteId: q.id, partnerId: q.partnerId, ver: q.ver, type: q.type, labor: q.labor, material: q.material, tax: q.tax, total: q.total, scope: q.scope, cond: q.cond, at: Date.now() };
          APP.transition(j, '업체 확정', '고객', j.custId, `${p.name} 견적 선택 · ${U.won(q.total)}원 고정`);
          APP.toast('견적을 선택했습니다 · 업체가 방문 일정을 등록합니다');
        }); draw();
      } }]);
  }
  function selectedPanel(j) {
    const s = j.selectedQuote; const p = APP.partnerById(s.partnerId); const v = j.visits[j.visits.length - 1]; const b = APP.billed(j);
    return `<section class="panel-m"><h3>${I('check')}선택한 견적</h3><div class="sel"><b>${esc(p.name)}</b><span class="qt t-${s.type}">${s.type}</span><p>${esc(s.scope)}</p>${s.cond ? `<p class="cond">${esc(s.cond)}</p>` : ''}</div>
      <div class="sum"><div><span>견적 확정 금액</span><b>${U.won(b.base)}원</b></div>${b.add ? `<div><span>확정 추가 작업</span><b>+${U.won(b.add)}원</b></div>` : ''}<div class="tot"><span>청구 예정 금액</span><b>${U.won(b.total)}원</b></div></div>
      ${v ? `<p class="visit">${I('cal')}방문 ${U.dt(v.when)}${j.visits.length > 1 ? ` <em>(일정 변경 ${j.visits.length - 1}회)</em>` : ''}</p>` : '<p class="hint">업체가 방문 일정을 등록하면 문자로 알려 드립니다.</p>'}
      ${j.stage === '업체 확정' ? '<button class="btn line sm" data-unpick>선택 취소</button>' : ''}</section>`;
  }
  function coPanel(j, co) {
    const st = APP.coStatus(co); const a = co.approvals.find((x) => x.role === '관리자' && x.seq === co.seq); const c = co.approvals.find((x) => x.role === '고객' && x.seq === co.seq);
    const can = st === '고객 승인 대기';
    return `<section class="panel-m co ${can ? 'hot' : ''}"><h3>${I('plus')}추가 작업 ${co.seq}차 ${APP.coBadge(co)}</h3><p>${esc(co.reason)}</p><p class="qamt sm">+${U.won(co.amount)}<small>원</small></p><div class="phs">${co.photos.map((p) => APP.photo(p, 'sm')).join('')}</div>
      <ul class="aps"><li class="${a ? (a.decision === '승인' ? 'ok' : 'no') : ''}">${I(a ? (a.decision === '승인' ? 'check' : 'x') : 'clock')}관리자 ${a ? a.decision + ' · ' + U.md(a.at) : '검토 중'}</li><li class="${c ? (c.decision === '승인' ? 'ok' : 'no') : ''}">${I(c ? (c.decision === '승인' ? 'check' : 'x') : 'clock')}고객 ${c ? c.decision + ' · ' + U.md(c.at) + (c.method === '전화 대리' ? ' (전화)' : '') : st === '응답 기한 경과' ? '응답 기한 경과 (승인 아님)' : '대기'}</li></ul>
      ${can ? `<p class="hint">응답 기한 ${U.dt(co.deadline)} · 응답하지 않으면 승인으로 처리되지 않습니다.</p><div class="row2"><button class="btn line" data-cor="${co.id}">반려</button><button class="btn pri" data-coa="${co.id}" data-amt="${co.amount}">승인</button></div>` : st === '요청됨' ? '<p class="hint">관리자가 먼저 검토한 뒤 승인 요청을 보내 드립니다.</p>' : ''}</section>`;
  }
  function donePanel(j) {
    const c = j.completion; if (!c) return '';
    const hold = j.stage === '완료 보류';
    return `<section class="panel-m ${j.stage === '고객 확인 대기' ? 'hot' : ''}"><h3>${I('check')}완료 보고</h3>
      <div class="ba"><div><span>작업 전</span><div class="phs">${j.work.before.map((p) => APP.photo(p, 'sm')).join('') || '<em class="hint">' + esc((j.work.noPhoto || {}).reason || '사진 없음') + '</em>'}</div></div><div><span>작업 후</span><div class="phs">${c.photos.map((p) => APP.photo(p, 'sm')).join('') || '<em class="hint">' + esc(c.noPhoto || '사진 없음') + '</em>'}</div></div></div>
      <ul class="chk">${c.checklist.map((x) => `<li class="${x.ok ? 'ok' : ''}">${I(x.ok ? 'check' : 'x')}${esc(x.item)}</li>`).join('')}</ul>${c.note ? `<p class="hint">${esc(c.note)}</p>` : ''}
      ${hold ? '<p class="warnbox">추가 작업 승인이 끝나지 않아 완료 확인을 할 수 없습니다.</p>' : j.stage === '보완 요청' ? `<p class="warnbox">보완 요청: ${esc(j.revisions[j.revisions.length - 1].reason)} · 업체가 보완 후 다시 보고합니다</p>` : `<p class="hint">확인하지 않으면 자동 완료되지 않습니다.</p><div class="row2"><button class="btn line" data-rev>보완 요청</button><button class="btn pri" data-done>완료 확인</button></div>`}</section>`;
  }
  function payPanel(j) {
    const b = APP.billed(j); const mine = APP.latestPay(j, '고객'); const st = APP.payStatus(j);
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return `<section class="panel-m"><h3>${I('won')}수금 확인 <span class="bdg ${st.cls}">${st.label}</span></h3>
      <div class="sum"><div><span>견적 확정 금액</span><b>${U.won(b.base)}원</b></div>${b.add ? `<div><span>확정 추가 작업</span><b>+${U.won(b.add)}원</b></div>` : ''}<div class="tot"><span>청구 예정 금액</span><b>${U.won(b.total)}원</b></div></div>
      ${mine ? `<p class="paid">${I('check')}내 지급 기록 · ${U.won(mine.amount)}원 · ${esc(mine.date)} · ${esc(mine.method)}</p><p class="hint">업체 수령 기록과 자동으로 대조합니다. 다른 점이 있으면 운영자가 연락드립니다.</p>`
        : `<form id="payF" class="payf" onsubmit="return false"><label class="fld">지급 금액<input name="amt" inputmode="numeric" value="${U.won(b.total)}"></label><label class="fld">지급 일시<input name="dt" type="datetime-local" value="${now}"></label><label class="fld">방법<select name="method">${D.PAY_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label><button class="btn pri block" data-pay>지급 기록 남기기</button></form><p class="hint">이미 지급한 금액과 일시를 기록해 주세요. 여기서는 결제가 진행되지 않습니다.</p>`}</section>`;
  }
  function asPanel(j) {
    return `<section class="panel-m"><h3>${I('tool')}A/S</h3>${(j.as || []).map((a) => `<div class="asr"><b>${esc(a.id)}</b> <span class="bdg ${a.status === 'A/S 완료' ? 'g' : 'a'}">${a.status}</span><p>${esc(a.desc)}</p></div>`).join('')}<button class="btn line block" data-as-new>${I('plus')}이 작업에 연결해 A/S 요청</button><p class="hint">원래 작업의 사진·점검 결과가 함께 전달됩니다. 수금 상태와 관계없이 접수할 수 있습니다.</p></section>`;
  }
  function asForm(j, draw) {
    let photos = [], busy = false;
    const valid = APP.scope();
    const w = APP.modal('A/S 요청', `<p class="hint">원작업 ${esc(j.id)}에 연결됩니다.</p><label class="fld">증상<textarea id="asD" rows="3" placeholder="예) 같은 위치에서 다시 물이 샙니다"></textarea></label><label class="upl sm">${I('camera')}<b>사진 추가 (선택)</b><input type="file" id="asF" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple></label><p class="hint" id="asStatus" role="status">최대 6장 · 장당 15MB 이하. 사진 없이도 요청할 수 있습니다.</p><div class="phs" id="asP"></div>`,
      [{ label: '취소', cls: 'line' }, { label: 'A/S 요청', fn: () => {
        if (busy) { APP.toast('사진 처리가 끝난 뒤 요청해 주세요', 'warn'); return false; }
        if (!valid() || !w.isConnected || !APP.require('고객', j.custId, j) || j.stage !== '작업 완료') return false;
        const d = w.querySelector('#asD').value.trim();
        if (!d) { APP.toast('증상을 적어 주세요', 'warn'); return false; }
        j.as.push({ id: 'AS-' + j.id.slice(2) + (j.as.length ? '-' + (j.as.length + 1) : ''), at: Date.now(), desc: d, photos: photos.slice(), status: 'A/S 접수', by: me().name });
        APP.log(j, '고객', j.custId, 'A/S 접수 · 원작업 연결 · ' + d, 'warn'); APP.toast('A/S가 접수되었습니다'); draw();
      } }]);
    const input = w.querySelector('#asF'), submit = w.querySelector('[data-act="1"]'), status = w.querySelector('#asStatus');
    input.onchange = e => {
      if (!valid() || !w.isConnected || busy) return;
      const files = Array.from(e.target.files || []), remaining = 6 - photos.length;
      if (!files.length) return;
      if (!remaining) { APP.toast('사진은 최대 6장까지 추가할 수 있습니다', 'warn'); input.value = ''; return; }
      if (files.length > remaining) APP.toast(`사진은 최대 6장까지 추가됩니다. 선택한 사진 중 ${remaining}장을 처리합니다`, 'info');
      busy = true; input.disabled = true; submit.disabled = true; status.textContent = '사진을 처리하고 있습니다. 잠시만 기다려 주세요.';
      APP.readPhotos(files.slice(0, remaining), 'A/S 사진', (ok, errs) => {
        if (!valid() || !w.isConnected) return;
        photos = photos.concat(ok).slice(0, 6); busy = false; input.disabled = false; submit.disabled = false; input.value = '';
        w.querySelector('#asP').innerHTML = photos.map(p => APP.photo(p, 'sm')).join('');
        const errors = errs || [];
        status.textContent = errors.length ? `사진 ${photos.length}장 준비됨 · 일부 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.` : `사진 ${photos.length}장 준비됨 · A/S를 요청할 수 있습니다.`;
        errors.forEach(message => APP.toast(message, 'warn', 4500));
      });
    };
  }

  APP.route(/^\/c\/?$/, home);
  APP.route(/^\/c\/login$/, login);
  APP.route(/^\/c\/new$/, newReq);
  APP.route(/^\/c\/jobs$/, jobs);
  APP.route(/^\/c\/job\/([\w-]+)$/, job);
  APP.custAction = custAction;
})();
