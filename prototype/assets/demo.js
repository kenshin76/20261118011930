/* FIXFLOW [프로토타입] — 체험 첫 화면 · 체험 도구 */
(function () {
  'use strict';
  const U = APP.U; const esc = U.esc; const I = APP.icon;
  const S = () => APP.get();

  /* 시나리오: 해당 상태의 건을 찾아 역할 세션을 맞춘 뒤 이동 */
  const SC = [
    { id: 'quote', role: 'cust', t: '견적 3개 비교·선택', d: '확정·조건부·진단형 견적을 나란히 비교하고 선택하면 금액·조건이 고정됩니다', f: (j) => j.stage === '견적 공개', to: (j) => '#/c/job/' + j.id },
    { id: 'cocust', role: 'cust', t: '추가 작업 고객 승인', d: '관리자 승인이 끝난 추가 작업을 고객이 승인하면 두 승인이 모여 확정됩니다', f: (j) => j.cos.some((c) => APP.coStatus(c) === '고객 승인 대기'), to: (j) => '#/c/job/' + j.id },
    { id: 'coadmin', role: 'admin', t: '이중 승인 · 전화 동의 대리 입력', d: '관리자 승인과 고객 승인을 따로 기록하고, 전화 동의는 시각·방식·근거와 함께 남깁니다', f: (j) => j.cos.some((c) => APP.coStatus(c) === '요청됨'), to: (j) => '#/a/job/' + j.id + '?tab=co' },
    { id: 'upload', role: 'partner', t: '현장 사진 · 끊기는 네트워크', d: '네트워크 불안정을 켠 채 작업 전 사진을 올리면 3회까지 자동 재시도하고 이후 「다시 보내기」가 나타납니다', f: (j) => j.stage === '방문 예정', to: (j) => '#/p/work/' + j.id, pre: () => { S().demo.netFail = true; } },
    { id: 'done', role: 'cust', t: '완료 확인 · 보완 요청', d: '업체 완료 보고를 고객이 전·후 사진과 점검 항목으로 확인하거나 보완을 요청합니다', f: (j) => j.stage === '고객 확인 대기', to: (j) => '#/c/job/' + j.id },
    { id: 'pay', role: 'admin', t: '수금 불일치 대조', d: '청구 예정·고객 지급·업체 수령 기록을 나란히 놓고 다른 칸을 강조합니다. 정정해도 원래 기록은 남습니다', f: (j) => j.stage === '작업 완료' && APP.payStatus(j).label === '불일치', to: (j) => '#/a/job/' + j.id + '?tab=pay' },
    { id: 'hold', role: 'admin', t: '완료 보류 · 응답 기한 경과', d: '고객이 답하지 않은 유상 추가 작업은 승인으로 처리하지 않고 완료를 보류합니다', f: (j) => j.stage === '완료 보류', to: (j) => '#/a/job/' + j.id + '?tab=co' },
    { id: 'pquote', role: 'partner', t: '협력업체 견적서 작성', d: '작업비·자재비를 넣으면 세금과 합계가 자동 계산되고, 수정하면 새 버전으로 보존됩니다', f: (j) => j.via !== '고객' && ['접수', '견적 요청'].includes(j.stage) && j.cat === 'elec', to: (j) => '#/p/req/' + j.id,
      pre: (j) => { if (!j.reqs.some((r) => r.partnerId === 'p3')) { j.reqs.push({ id: U.uid('rq'), partnerId: 'p3', at: Date.now(), deadline: Date.now() + 24 * APP.HOUR, quoteId: null, closed: false }); if (j.stage === '접수') APP.transition(j, '견적 요청', '관리자', null, '체험: 바른전기에 견적 요청'); } return 'p3'; } },
    { id: 'todo', role: 'admin', t: '「확인 필요」 한 목록', d: '미응답·마감 경과·승인 미결·수금 불일치·A/S·가입 승인을 시스템이 찾아 모읍니다', to: () => '#/a' }
  ];
  function runSc(id) {
    const sc = SC.find((x) => x.id === id); const s = S();
    const j = sc.f ? s.jobs.find(sc.f) : null;
    if (sc.f && !j) { APP.modal('이미 처리된 장면입니다', '<p>체험 중에 이 상태의 건을 모두 처리했습니다. 체험 데이터를 처음 상태로 되돌리면 다시 볼 수 있습니다.</p>', [{ label: '닫기', cls: 'line' }, { label: '체험 데이터 초기화', fn: () => { reset(); runSc(id); } }]); return; }
    let pid = null;
    if (sc.pre) {
      // This explicit demo shortcut prepares a virtual quote request as the operator.
      const area = document.body.dataset.area, admin = s.session.admin;
      if (sc.id === 'pquote') { s.session.admin = 'admin'; document.body.dataset.area = 'admin'; }
      try { pid = sc.pre(j); } finally { if (sc.id === 'pquote') { s.session.admin = admin; document.body.dataset.area = area; } }
    }
    if (sc.role === 'cust') s.session.cust = j.custId;
    if (sc.role === 'partner') s.session.partner = pid || (j.selectedQuote ? j.selectedQuote.partnerId : 'p1');
    if (sc.role === 'admin') s.session.admin = 'admin';
    APP.save(); closeDock(); APP.go(sc.to(j));
    if (sc.id === 'upload') APP.defer(() => APP.toast('네트워크 불안정 체험을 켰습니다 · 「예시 사진」을 눌러 보세요', 'info', 5000), 300);
  }
  function reset() { if (APP.clearUploads) APP.clearUploads(); APP.reset(); APP.toast('체험 데이터를 처음 상태로 되돌렸습니다'); }

  const FLOW = [['접수', '문자 인증 · 고정 질문 · 사진', 'cust'], ['견적', '적격 업체 요청 · 마감', 'admin'], ['선택', '최대 3개 비교 · 금액 고정', 'cust'], ['일정', '방문 등록 · 변경 이력', 'partner'], ['작업', '전·후 사진 · 추가 작업 이중 승인', 'partner'], ['완료', '업체 보고 → 고객 확인', 'cust'], ['수금', '두 기록 대조', 'admin'], ['A/S', '원작업 연결', 'cust']];
  const ROLE = { cust: ['고객', 'user', '#1F6FEB'], partner: ['협력업체', 'tool', '#FF7A1A'], admin: ['관리자', 'grid', '#12B886'] };
  const REQ = [
    ['상태 일원화', '고객과 담당 업체가 진행 상황을 함께 확인합니다', '#/a/design', '상태 흐름'],
    ['고객 무가입 접수', '문자 인증 · 고정 질문 · 사진 축소 업로드', '#/c/new', '접수하기'],
    ['견적 비교 · 미응답 처리', '확정·조건부·진단형 · 유효기간 · 자동 선택 없음', 'quote', ''],
    ['추가 작업 이중 승인', '같은 차수·금액에 관리자·고객 승인이 모두 있어야 확정', 'coadmin', ''],
    ['전화 대리 입력 · 동의 기록', '실제 입력자와 고객 동의(시각·방식·근거)를 분리 기록', '#/a/proxy', '대리접수'],
    ['완료 확인 분리', '업체 완료 보고와 고객 완료 확인을 따로 · 자동 완료 없음', 'done', ''],
    ['수금 대조', '청구 예정·고객 지급·업체 수령 · 정정은 추가 기록', 'pay', ''],
    ['현장 사진 · 재시도', '끊기는 네트워크에서 3회 자동 재시도 · 다시 보내기', 'upload', ''],
    ['확인 필요 목록', '엇갈림·대기를 시스템이 찾아 한 곳에', 'todo', ''],
    ['협력업체 승인', '가입 신청 → 관리자 승인 · 보완 요청', '#/a/partners', '협력업체'],
    ['A/S 원작업 연결', '완료된 작업에서 요청 · 원작업 사진·업체 연결', '#/a/jobs', '전체 건'],
    ['업무 처리 기준', '추가 비용 승인·수금 확인·완료 처리 기준을 확인합니다', '#/a/design', '처리 기준']
  ];

  function hub() {
    const cards = [
      ['plumb', '설비·배관', '누수부터 배수 문제까지', 'plumbing'],
      ['clean', '청소·위생', '쾌적한 공간을 위한 관리', 'care'],
      ['fix', '공간 보수', '작은 불편도 꼼꼼하게', 'repair']
    ];
    document.getElementById('app').innerHTML = `<div class="service-home">
      <header class="service-header"><a class="service-brand" href="#/">${I('tool')}<b>FIXFLOW</b><span>공간을 돌보는 일</span></a><a class="home-link" href="../index.html" title="메인 화면으로 이동">${I('back')}메인으로</a>${APP.serviceNav()}</header>
      <main>
        <section class="service-hero"><div class="hero-copy"><span class="service-kicker">YOUR SPACE, WELL CARED FOR</span><h1>공간의 작은 불편,<br><em>믿고 맡길 수 있도록.</em></h1><p>수리부터 청소, 작업 후 관리까지.<br>필요한 서비스를 요청하고 모든 과정을 한곳에서 확인하세요.</p><div class="hero-actions"><a class="btn pri lg" href="#/c/new">서비스 요청하기 ${I('arrow')}</a><a class="btn line lg" href="#/c">고객서비스</a></div><div class="hero-notes"><span>${I('check')}회원가입 없이 간편 접수</span><span>${I('check')}견적 비교 후 직접 선택</span></div></div><div class="hero-photo"><img src="assets/images/space.jpg" alt="햇살이 들어오는 단정한 카페 공간" fetchpriority="high"><div class="photo-note"><i>${I('shield')}</i><div><b>시작부터 마무리까지</b><span>작업 기록과 확인 내역을 한곳에</span></div></div></div></section>
        <section class="service-section"><div class="section-head"><div><span class="service-kicker">WHAT WE CARE FOR</span><h2>어떤 도움이 필요하세요?</h2></div><p>공간에 맞는 서비스를 찾아보세요.</p></div><div class="service-cards">${cards.map(([id,name,desc,photo])=>`<a class="service-card" href="#/c/new" data-service="${id}"><div class="service-card-img"><img src="assets/images/${photo}.jpg" alt="${esc(name)} 서비스 예시" loading="lazy"></div><div><span>${esc(desc)}</span><h3>${esc(name)} ${I('arrow')}</h3></div></a>`).join('')}</div><div class="service-other">${D.CATS.filter(c=>!['plumb','clean','fix'].includes(c.id)).map(c=>`<a href="#/c/new" data-service="${c.id}">${I(c.icon)}${c.name}${I('arrow')}</a>`).join('')}</div></section>
        <section class="service-guide"><div><span class="service-kicker">SIMPLY, STEP BY STEP</span><h2>처음 요청해도,<br>복잡하지 않게.</h2><p>필요한 순간마다 다음 진행 상황을 안내해 드려요.</p><img class="guide-photo" src="assets/images/repair.jpg" alt="문 경첩을 조정하는 보수 작업 예시" width="1536" height="1024" loading="lazy"></div><ol>${[['증상과 사진을 남겨 주세요','문자 인증 후 필요한 서비스를 요청하세요.'],['견적을 비교하고 선택하세요','가격·일정·포함 범위를 확인하고 결정하세요.'],['작업 결과까지 확인하세요','추가 작업은 승인 후 진행하고, 완료 후에도 A/S를 요청할 수 있어요.']].map((x,i)=>`<li><b>0${i+1}</b><div><h3>${x[0]}</h3><p>${x[1]}</p></div></li>`).join('')}</ol></section>
        <section class="partner-invite"><img src="assets/images/plumbing.jpg" alt="현장에서 배관을 점검하는 작업자" loading="lazy"><div><span class="service-kicker">FOR OUR PARTNERS</span><h2>현장에 집중할 수 있도록.</h2><p>견적부터 일정, 작업 보고까지.<br>협력업체의 하루를 더 간편하게 연결합니다.</p><a class="btn line" href="#/p">협력업체 시작하기 ${I('arrow')}</a></div></section>
      </main><footer class="service-footer"><div><a class="service-brand" href="#/">${I('tool')}<b>FIXFLOW</b></a><p>우리 공간의 든든한 관리 파트너</p></div><p>가상 데이터 체험 서비스 · 문자 발송과 실제 결제는 진행되지 않습니다.<br>입력 내용은 현재 브라우저에만 저장됩니다. 서비스 사진은 AI로 제작한 예시입니다.</p></footer></div>`;
    document.getElementById('app').onclick = e => { const link = e.target.closest('[data-service]'); if (link) APP.prefillCategory = link.dataset.service; };
  }

  function tour() {
    APP.modal('서비스 이용 안내', `<p class="hint">체험할 업무 흐름을 선택하면 해당 화면으로 이동합니다.</p><ol class="tourl">${REQ.map((r) => `<li><b>${r[0]}</b><span>${r[1]}</span>${r[2][0] === '#' ? `<a class="btn line xs" href="${r[2]}" data-tgo="${r[2]}">${r[3]}</a>` : `<button class="btn line xs" data-tsc="${r[2]}">장면 보기</button>`}</li>`).join('')}</ol>`, [{ label: '닫기', cls: 'line' }], { wide: true });
    const m = document.getElementById('modal');
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tsc]'); if (b) { APP.closeModal(); runSc(b.dataset.tsc); return; }
      const a = e.target.closest('[data-tgo]'); if (a) { if (a.dataset.tgo.startsWith('#/a')) { S().session.admin = 'admin'; APP.save(); } APP.closeModal(); closeDock(); }
    });
  }

  /* ---------- 체험 도구 (모든 화면 공통) ---------- */
  let open = false;
  function closeDock() { open = false; const d = document.getElementById('dock'); if (d) d.classList.remove('open'); }
  APP.demoBar = function () {
    let d = document.getElementById('dock');
    if (!d) { d = document.createElement('div'); d.id = 'dock'; document.body.appendChild(d); d.addEventListener('click', onDock); document.addEventListener('click', (e) => { const path = e.composedPath(); if (open && !path.includes(d) && !document.getElementById('modal')) closeDock(); }); }
    const area = document.body.dataset.area; const s = S();
    d.className = (open ? 'open ' : '') + 'area-' + area;
    d.innerHTML = `<button class="dk-fab" data-dk aria-label="체험 도구" aria-expanded="${open}" aria-controls="dkp">${I('sliders')}<span>체험 도구</span></button>
      <div class="dk-p" id="dkp" role="dialog" aria-label="체험 도구"><header><b>체험 도구</b><span>[프로토타입] 가상 데이터</span></header>
        <div class="dk-roles"><a href="#/" class="${area === 'hub' ? 'on' : ''}">${I('home')}첫 화면</a><a href="#/c" class="${area === 'cust' ? 'on' : ''}">${I('user')}고객</a><a href="#/p" class="${area === 'partner' ? 'on' : ''}">${I('tool')}협력업체</a><a href="#/a" data-dkadmin class="${area === 'admin' ? 'on' : ''}">${I('grid')}관리자</a></div>
        <span class="dk-k">핵심 장면</span><div class="dk-sc">${SC.map((x) => `<button data-dsc="${x.id}" style="--rc:${ROLE[x.role][2]}"><i></i>${x.t}</button>`).join('')}</div>
        <span class="dk-k">환경</span><label class="dk-sw"><input type="checkbox" data-net ${s.demo.netFail ? 'checked' : ''}><span></span>네트워크 불안정 (사진 전송 실패 70%)</label>
        <div class="dk-f"><button class="btn line sm" data-dtour>${I('list')}서비스 이용 안내</button><button class="btn ghost sm" data-dreset>${I('refresh')}초기화</button></div></div>`;
  };
  function onDock(e) {
    const t = e.target;
    if (t.closest('[data-dk]')) { open = !open; APP.demoBar(); return; }
    const sc = t.closest('[data-dsc]'); if (sc) { runSc(sc.dataset.dsc); return; }
    if (t.closest('[data-dkadmin]')) { S().session.admin = 'admin'; APP.save(); }
    if (t.closest('.dk-roles a')) { closeDock(); return; }
    if (t.matches('[data-net]')) { S().demo.netFail = t.checked; APP.save(); APP.toast(t.checked ? '네트워크 불안정 체험을 켰습니다 · 사진 전송이 자주 실패합니다' : '네트워크 불안정 체험을 껐습니다', 'info'); return; }
    if (t.closest('[data-dtour]')) { closeDock(); tour(); return; }
    if (t.closest('[data-dreset]')) { APP.modal('체험 데이터 초기화', '<p>체험 중 입력한 내용을 지우고 처음 상태로 되돌립니다.</p>', [{ label: '취소', cls: 'line' }, { label: '초기화', cls: 'danger', fn: () => { reset(); closeDock(); APP.go('#/'); } }]); }
  }

  APP.route(/^\/?$/, hub);
})();
