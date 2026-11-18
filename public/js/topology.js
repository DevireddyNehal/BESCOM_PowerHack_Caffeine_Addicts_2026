// ===================== TOPOLOGY & GRID RENDERERS =====================
function renderTransformerAlerts(m) {
  const alerts = Object.values(m.dtrs)
    .filter(d => d.stressPct >= 90)
    .sort((a, b) => b.stressPct - a.stressPct);
  const badge = document.getElementById('adminTransformerBadge');
  if (badge) badge.textContent = String(alerts.length);
  const summary = document.getElementById('transformerAlertSummary');
  const list = document.getElementById('transformerAlertList');
  if (!summary || !list) return;
  summary.textContent = alerts.length
    ? `${alerts.length} simulated transformer${alerts.length === 1 ? '' : 's'} need attention.`
    : 'No simulated transformer alerts at the current load.';
  list.innerHTML = alerts.length ? alerts.map(d => {
    const overloaded = d.stressPct >= 100;
    const severity = overloaded ? 'Overloaded' : 'Near limit';
    const className = overloaded
      ? 'border-terracotta/40 bg-terracotta/10'
      : 'border-amberWatch/40 bg-amberWatch/10';
    return `<article class="rounded-xl border ${className} p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="font-bold">${severity}: ${escapeHtml(d.id)}</h4>
        <span class="rounded-full border border-current px-2.5 py-1 text-xs font-bold">${d.stressPct}% loading</span>
      </div>
      <p class="mt-2 text-sm">${escapeHtml(d.name)} is carrying <b class="mono">${d.stressKva} kVA</b> of a <b class="mono">${d.rating} kVA</b> rating.</p>
      <p class="mt-1 text-xs text-ink/70">This is a simulated reading; it does not monitor live equipment or notify a utility crew.</p>
    </article>`;
  }).join('') : '<div class="rounded-xl border border-sage/40 bg-sage/10 p-4 text-sm font-semibold">All simulated transformers are below the 90% alert threshold.</div>';
}

function nextStep(m, v) {
  if (!m.stressOver90.length && !m.anyTransfer) return 4;
  if (v==='stop') return 3;
  if (m.stressOver100.length && !m.anyTransfer) return 3;
  return 4;
}

function renderStepNav(m, v) {
  const steps = [
    ['step1','1','Choose situation'],['step2','2','Check transformers'],['step3','3','Test a fix'],['step4','4','Decide']
  ];
  const n = nextStep(m, v);
  document.getElementById('stepNav').innerHTML = steps.map(([id,num,label]) => {
    const isNext = Number(num)===n;
    return `<a href="#${id}" class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${isNext?'bg-action text-white border-action':'bg-cardWhite border-hairline hover:bg-softStone'}">
      <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isNext?'bg-white text-ink':'bg-softStone'}">${num}</span>
      <span class="truncate">${label}</span>
      ${isNext?'<span class="ml-auto text-[10px] font-bold uppercase tracking-wide bg-white/20 rounded px-1.5 py-0.5">Next</span>':''}
    </a>`;
  }).join('');
}

function renderHero(m, v) {
  const hero = document.getElementById('hero');
  const prob = m.stressOver100.map(d=>d.id);
  const near = m.stressOver90.filter(d=>d.stressPct<100).map(d=>d.id);
  let cls, icon, title, body, cta;
  if (prob.length) {
    cls='bg-terracotta/10 border-terracotta/50'; icon='🛑';
    title = `Action needed: ${prob.join(', ')} ${prob.length>1?'are':'is'} overloaded`;
    body = `With this situation, ${prob.map(id=>`${id} would run at ${m.dtrs[id].stressPct}% of its rating`).join('; ')}. ` +
      (v==='stop' ? 'Your current plan does not fix this yet.' : (m.anyTransfer ? 'Your current plan brings every transformer back within limits.' : ''));
    cta = v==='stop'
      ? `<button onclick="suggestFix()" class="px-5 py-3 rounded-xl bg-action text-white font-semibold hover:bg-actionHover shadow">✨ Show me a fix</button>`
      : `<a href="#step4" class="inline-block px-5 py-3 rounded-xl bg-action text-white font-semibold hover:bg-actionHover shadow">Review &amp; decide →</a>`;
  } else if (near.length) {
    cls='bg-amberWatch/10 border-amberWatch/50'; icon='⚠️';
    title = `Keep an eye on ${near.join(', ')}`;
    body = `${near.map(id=>`${id} is at ${m.dtrs[id].stressPct}%`).join(', ')}. Nothing is overloaded, but it is above the 90% early-warning level.`;
    cta = `<button onclick="suggestFix()" class="px-5 py-3 rounded-xl bg-action text-white font-semibold hover:bg-actionHover shadow">✨ Balance the load</button>`;
  } else {
    cls='bg-sage/10 border-sage/50'; icon='✅';
    title='All clear: every transformer is comfortably within limits';
    body='No action is required in this situation. Try a different scenario in Step 1 to stress-test the feeder.';
    cta = `<a href="#step1" class="inline-block px-5 py-3 rounded-xl bg-action text-white font-semibold hover:bg-actionHover shadow">Try another scenario</a>`;
  }
  hero.className = `rounded-2xl border-2 p-5 sm:p-6 ${cls}`;
  hero.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-start gap-4">
        <div class="text-4xl leading-none" aria-hidden="true">${icon}</div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-ink/60 mb-1">Current status</div>
          <h2 class="text-xl sm:text-2xl font-extrabold leading-tight">${title}</h2>
          <p class="text-sm sm:text-base text-ink/80 mt-1.5 max-w-3xl">${body}</p>
        </div>
      </div>
      <div class="shrink-0">${cta}</div>
    </div>`;
}

function renderScenarios() {
  document.getElementById('scenarioCards').innerHTML = Object.entries(SCENARIOS).map(([k,s]) => {
    const on = state.scenario===k;
    return `<button onclick="setScenario('${k}')" aria-pressed="${on}" class="text-left p-4 rounded-xl border-2 transition ${on?'border-ink bg-stoneBg':'border-hairline bg-cardWhite hover:border-ink/50'}">
      <div class="flex items-center justify-between"><span class="text-2xl">${s.icon}</span>${on?'<span class="text-[11px] font-bold bg-action text-white rounded px-2 py-0.5">SELECTED</span>':''}</div>
      <div class="font-bold mt-2">${s.title}</div>
      <div class="text-sm text-ink/70 mt-0.5">${s.desc}</div>
    </button>`;
  }).join('');
  const pct = Math.round((state.mult-1)*100);
  document.getElementById('multSlider').value = Math.round(state.mult*100);
  document.getElementById('multLabel').textContent = `${pct>=0?'+':''}${pct}%`;
}

function renderTopology(m) {
  const colors = {
    ink:uiColor('--app-ink'), good:uiColor('--app-good'), alert:uiColor('--app-alert'),
    card:uiColor('--app-card'), soft:uiColor('--app-soft')
  };
  document.getElementById('svgSubLoad').textContent = `Total ${m.totPost} kVA`;
  // Tie links
  const ties = [
    { id:'12', v:state.transfers.t12, d:'M 340 335 L 470 335', bx:372, by:322, w:66, lbl:(v)=>v>0?`→ 01 · ${v}`:`→ 02 · ${-v}` },
    { id:'23', v:state.transfers.t23, d:'M 560 335 L 690 335', bx:592, by:322, w:66, lbl:(v)=>v>0?`→ 03 · ${v}`:`→ 02 · ${-v}` },
    { id:'13', v:state.transfers.t13, d:'M 295 362 Q 515 402 735 362', bx:477, by:372, w:76, lbl:(v)=>v>0?`→ 01 · ${v}`:`→ 03 · ${-v}` }
  ];
  document.getElementById('tieLayer').innerHTML = ties.map(t => {
    const on = t.v!==0;
    return `<path d="${t.d}" fill="none" stroke="${on?colors.alert:colors.good}" stroke-width="2.5" stroke-dasharray="5 4" class="${on?'tie-flow':''}"/>
      <rect x="${t.bx}" y="${t.by}" width="${t.w}" height="22" rx="5" fill="${on?colors.soft:colors.card}" stroke="${on?colors.alert:colors.ink}" stroke-width="1.5"/>
      <text x="${t.bx+t.w/2}" y="${t.by+15}" text-anchor="middle" font-family="JetBrains Mono" font-size="9.5" font-weight="700" fill="${on?colors.alert:colors.ink}">${on?t.lbl(t.v):'LINK OFF'}</text>`;
  }).join('');

  let h='';
  Object.values(m.dtrs).forEach(d => {
    const s = st(d.postPct), sel = state.sel===d.id;
    h += `<g class="cursor-pointer" tabindex="0" role="button" aria-label="${d.id} ${d.postPct}% ${s.label}" onclick="selectDtr('${d.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')selectDtr('${d.id}')">
      ${d.postPct>=100?`<circle cx="${d.x}" cy="${d.y}" r="38" fill="none" stroke="${colors.alert}" stroke-width="3" class="pulse-alert"/>`:''}
      ${sel?`<circle cx="${d.x}" cy="${d.y}" r="44" fill="none" stroke="${colors.ink}" stroke-width="1.8" stroke-dasharray="3 3"/>`:''}
      <circle cx="${d.x}" cy="${d.y}" r="35" fill="${colors.card}" stroke="${s.hex}" stroke-width="${d.postPct>=90?4:2.5}"/>
      <text x="${d.x}" y="${d.y-2}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="16" fill="${s.hex}">${d.postPct}%</text>
      <text x="${d.x}" y="${d.y+14}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${s.hex}">${s.icon} ${s.label}</text>
      <text x="${d.x}" y="${d.y+56}" text-anchor="middle" font-weight="700" font-size="13" fill="${colors.ink}">${d.id}</text>
      <text x="${d.x}" y="${d.y+71}" text-anchor="middle" font-family="JetBrains Mono" font-size="10.5" fill="${colors.ink}" opacity=".9">${d.post} of ${d.rating} kVA</text>`;
    [-44,0,44].forEach((off,i) => {
      const cx=d.x+off, cy=d.y+112;
      h += `<line x1="${cx}" y1="${d.y+78}" x2="${cx}" y2="${cy-11}" stroke="${colors.ink}" stroke-width="1.3" opacity=".75"/>
        <circle cx="${cx}" cy="${cy}" r="12" fill="${colors.soft}" stroke="${colors.alert}" stroke-width="1.4"/>
        <text x="${cx}" y="${cy+3}" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" font-weight="700" fill="${colors.ink}">${(d.post*d.clusters[i].share).toFixed(0)}</text>`;
    });
    h += `</g>`;
  });
  document.getElementById('svgDtrLayer').innerHTML = h;

  const s = m.dtrs[state.sel], ss = st(s.postPct);
  document.getElementById('nodeInspector').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-3">
      <span class="px-2.5 py-1 rounded-md text-sm font-bold border ${ss.bg} ${ss.txt} ${ss.bd}">${ss.icon} ${s.id} · ${ss.label}</span>
      <span class="text-sm text-ink/70">${s.name} · rated ${s.rating} kVA · ${s.node}</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
      <div class="rounded-lg bg-stoneBg p-3"><div class="text-xs text-ink/60">Before your plan</div><div class="mono font-bold">${s.stressKva} kVA (${s.stressPct}%)</div></div>
      <div class="rounded-lg bg-stoneBg p-3"><div class="text-xs text-ink/60">After your plan</div><div class="mono font-bold ${ss.txt}">${s.post} kVA (${s.postPct}%)</div></div>
      <div class="rounded-lg bg-stoneBg p-3"><div class="text-xs text-ink/60">Low-voltage side</div><div class="mono font-bold">${s.ltKv} kV (−${s.vDev}%)</div></div>
    </div>
    <div class="mt-3 text-sm"><b>Neighbourhoods fed:</b> <span class="text-ink/80">${s.clusters.map(c=>`${c.name} (${(s.post*c.share).toFixed(0)} kVA)`).join(' · ')}</span></div>`;
}

function renderWatchlist(m) {
  const list = Object.values(m.dtrs).sort((a,b)=>b.stressPct-a.stressPct);
  document.getElementById('watchlist').innerHTML = list.map(d => {
    const s = st(d.stressPct);
    return `<button onclick="selectDtr('${d.id}')" class="w-full text-left p-3.5 rounded-xl border-2 transition ${state.sel===d.id?'border-ink bg-stoneBg/60':'border-hairline hover:border-ink/40'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <b>${d.id}</b><span class="text-xs mono text-ink/60">${d.rating} kVA</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded border ${s.bg} ${s.txt} ${s.bd}">${s.icon} ${s.label}</span>
        </div>
        <div class="mono text-lg font-bold ${s.txt}">${d.stressPct}%</div>
      </div>
      <div class="relative w-full h-2.5 bg-softStone rounded-full mt-2.5 overflow-hidden">
        <div class="h-full rounded-full" style="width:${Math.min(100,d.stressPct)}%;background:${s.hex}"></div>
        <div class="absolute top-0 bottom-0 w-0.5 bg-action" style="left:90%"></div>
      </div>
      <div class="mt-2 text-sm text-ink/80"><b>Why:</b> ${d.why}</div>
      <div class="mt-1 flex items-center justify-between text-xs text-ink/65 mono">
        <span>Estimated in 15 min: <b class="text-ink">${d.forecastPct}%</b></span>
        <span class="${d.risk>=.7?'text-terracotta':'text-sage'} font-semibold">${d.risk>=.7?'Higher':'Lower'} demo risk · ${d.risk.toFixed(2)}</span>
      </div>
    </button>`;
  }).join('');
}

function sliderBlock(key, title, from, to, min, max, val) {
  return `<div class="p-4 rounded-xl bg-stoneBg/70 border border-hairline">
    <div class="flex flex-wrap items-center justify-between gap-1 mb-2">
      <span class="text-sm font-semibold">${title}</span>
      <span id="transferLabel-${key}" class="text-xs mono font-bold px-2 py-1 rounded bg-cardWhite border border-hairline">${transferLabel(key)}</span>
    </div>
    <input type="range" min="${min}" max="${max}" step="5" value="${val}" aria-label="${title}" oninput="setTransfer('${key}', this.value)" />
    <div class="flex justify-between text-[11px] text-ink/60 mt-1.5"><span>← more to ${from}</span><span>0</span><span>more to ${to} →</span></div>
  </div>`;
}
function renderTransfers() {
  const t = state.transfers;
  document.getElementById('transferControls').innerHTML =
    sliderBlock('t12','Link between DTR-02 and DTR-01','DTR-02','DTR-01',-50,60,t.t12) +
    sliderBlock('t13','Link between DTR-03 and DTR-01','DTR-03','DTR-01',-40,50,t.t13) +
    sliderBlock('t23','Link between DTR-02 and DTR-03','DTR-02','DTR-03',-40,40,t.t23);
}
function transferLabel(key) {
  const val = state.transfers[key];
  if (val === 0) return 'Not moving anything';
  const destinations = { t12: val > 0 ? 'DTR-01' : 'DTR-02', t13: val > 0 ? 'DTR-01' : 'DTR-03', t23: val > 0 ? 'DTR-03' : 'DTR-02' };
  return `Moving ${Math.abs(val)} kVA → ${destinations[key]}`;
}

function renderChecks(m, v) {
  const over = m.postOver100.map(d=>`${d.id} ${d.postPct}%`).join(', ');
  const row = (ok, warn, label, detail) => `<li class="flex items-start gap-2"><span class="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${ok?'bg-sage':(warn?'bg-amberWatch':'bg-terracotta')}">${ok?'✓':(warn?'!':'✕')}</span><div><div class="font-semibold">${label}</div><div class="text-ink/75">${detail}</div></div></li>`;
  const box = document.getElementById('checks');
  box.className = `rounded-xl border-2 p-4 ${v==='stop'?'bg-terracotta/10 border-terracotta/40':(v==='caution'?'bg-amberWatch/10 border-amberWatch/40':'bg-sage/10 border-sage/40')}`;
  box.innerHTML = `
    <div class="flex items-center justify-between mb-3"><h3 class="text-sm font-bold uppercase tracking-wide">Safety checks for this plan</h3>
      <span class="text-sm font-bold ${v==='stop'?'text-terracotta':(v==='caution'?'text-amberWatch':'text-sage')}">${v==='stop'?'Not safe':(v==='caution'?'Acceptable, watch closely':'All checks pass')}</span></div>
    <ul class="space-y-2.5 text-sm">
      ${row(!m.postOver100.length,false,'No transformer above its rating', m.postOver100.length ? `Overloaded: ${over}` : 'Every transformer is at or below 100%.')}
      ${row(!m.postOver90.length, !!m.postOver90.length && !m.postOver100.length, 'Early-warning level (90%)', m.postOver90.length ? `${m.postOver90.length} of 3 transformers are at 90% or more.` : 'All three are below 90%.')}
      ${row(m.vOk,false,'Voltage drop within ±6%', `Worst low-voltage drop is −${m.maxV}%.`)}
    </ul>
    <div class="mt-3 pt-3 border-t border-ink/10 text-sm text-ink/80">Total feeder load: <b class="mono">${m.totPost} / ${RATED_TOTAL} kVA (${m.feederPct}%)</b></div>`;
}

function renderVerdict(m, v) {
  const box = document.getElementById('verdict');
  const btn = document.getElementById('approveBtn');
  const hint = document.getElementById('approveHint');
  const cfg = {
    go:{ c:'bg-sage/10 border-sage/40', t:'✅ Safe to approve', tc:'text-sage' },
    caution:{ c:'bg-amberWatch/10 border-amberWatch/40', t:'⚠️ Acceptable, but keep monitoring', tc:'text-amberWatch' },
    stop:{ c:'bg-terracotta/10 border-terracotta/40', t:'🛑 Do not approve this plan', tc:'text-terracotta' }
  }[v];
  box.className = `rounded-xl border-2 p-4 ${cfg.c}`;
  const d = m.dtrs;
  box.innerHTML = `<div class="font-bold ${cfg.tc} text-base">${cfg.t}</div>
    <div class="text-sm mt-2"><span class="text-ink/60">Plan:</span> <b>${planText()}</b></div>
    <div class="text-sm mt-1"><span class="text-ink/60">Result:</span> <span class="mono font-semibold">DTR-01 ${d['DTR-01'].postPct}% · DTR-02 ${d['DTR-02'].postPct}% · DTR-03 ${d['DTR-03'].postPct}%</span></div>
    ${v==='stop' ? '<div class="text-sm mt-2">Go back to <a class="underline font-semibold" href="#step3">Step 3</a> and adjust, or press <b>Suggest the best fix</b>.</div>' : ''}`;
  btn.disabled = v==='stop';
  hint.textContent = v==='stop' ? 'Approve is switched off because this plan would overload a transformer or break the voltage limit. You can still reject.' : 'This only adds a demo record to the page. It does not notify an operator or control equipment.';
}

function renderAudit() {
  document.getElementById('auditCount').textContent = `${state.audit.length} entries`;
  document.getElementById('auditBody').innerHTML = state.audit.map(e => `
    <tr class="hover:bg-stoneBg/50">
      <td class="py-2.5 px-3 mono"><div class="font-semibold">${e.time}</div><div class="text-xs text-ink/60">${e.op}</div></td>
      <td class="py-2.5 px-3"><div class="font-medium">${e.action}</div><div class="text-xs text-ink/60">${e.scen}</div></td>
      <td class="py-2.5 px-3 mono font-semibold">${e.post}</td>
      <td class="py-2.5 px-3 text-right"><span class="px-2 py-0.5 rounded text-xs font-bold ${e.status==='APPROVED'?'bg-sage/15 text-sage':'bg-terracotta/15 text-terracotta'}">${e.status==='APPROVED'?'✓ Approved':'✕ Rejected'}</span></td>
    </tr>`).join('');
}
