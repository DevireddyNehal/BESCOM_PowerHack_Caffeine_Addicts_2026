// ===================== APPLICATION BOOTSTRAPPER =====================
function renderAll(preserveTransferControls = false) {
  const m = compute();
  const v = verdictOf(m);
  const h = String(Math.floor(state.minutes/60)%24).padStart(2,'0'), mi = String(state.minutes%60).padStart(2,'0');
  document.getElementById('simClock').textContent = `${h}:${mi} IST`;
  document.getElementById('busVoltage').textContent = `${m.busKv} kV`;
  document.getElementById('feederLoadTop').textContent = `${m.totPost} / ${RATED_TOTAL} kVA`;
  renderHero(m, v); renderStepNav(m, v); renderScenarios(); renderTopology(m);
  renderWatchlist(m);
  renderTransformerAlerts(m);
  if (!preserveTransferControls) renderTransfers();
  renderChecks(m, v); renderVerdict(m, v); renderAudit(); renderDev(m);
  updateCharts(m);
}

// ===================== ACTIONS =====================
function setScenario(k) {
  state.scenario = k;
  if (SCENARIOS[k].mult) state.mult = SCENARIOS[k].mult;
  state.transfers = { t12:0, t13:0, t23:0 };
  renderAll();
}
function onCustomMult(v) { state.scenario='custom'; state.mult = Number(v)/100; state.transfers={t12:0,t13:0,t23:0}; renderAll(); }
function selectDtr(id) { state.sel = id; renderAll(); }
function setTransfer(k, v) {
  state.transfers[k] = Number(v);
  renderAll(true);
  document.getElementById(`transferLabel-${k}`).textContent = transferLabel(k);
}
function resetTransfers() { state.transfers={t12:0,t13:0,t23:0}; renderAll(); showToast('Plan cleared','No load is being moved.'); }
function applyDeck() { state.scenario='surge25'; state.mult=1.25; state.transfers={t12:35,t13:10,t23:0}; renderAll(); showToast('Pitch-deck example loaded','+25% surge with 35 kVA and 10 kVA moved onto DTR-01. Notice DTR-01 now becomes the problem.'); }
function advance15() {
  state.minutes += 15;
  state.mult = Math.min(1.35, Math.max(.8, +(state.mult + (Math.random()-.45)*.025).toFixed(3)));
  if (state.scenario!=='custom' && state.scenario!=='baseline' ) { /* keep label but demand drifted */ }
  renderAll(); showToast('New meter readings','15 minutes passed. Load changed slightly; re-check the status above.');
}
function logDecision(decision) {
  const m = compute();
  if (decision==='APPROVED' && verdictOf(m)==='stop') return;
  const h = String(Math.floor(state.minutes/60)%24).padStart(2,'0'), mi = String(state.minutes%60).padStart(2,'0');
  const d = m.dtrs;
  state.audit.unshift({ time:`${h}:${mi}`, op:'Demo operator', scen:`${SCENARIOS[state.scenario].title} (${Math.round((state.mult-1)*100)>=0?'+':''}${Math.round((state.mult-1)*100)}%)`,
    action:planText(), post:`${d['DTR-01'].postPct}% / ${d['DTR-02'].postPct}% / ${d['DTR-03'].postPct}%`, status:decision });
  if (decision==='REJECTED') { state.transfers={t12:0,t13:0,t23:0}; showToast('Plan rejected','Plan cleared and logged. Pick a new approach in Step 3.'); }
  else showToast('Demo approval recorded','Added to this page only. No operator or field crew is notified.');
  renderAll();
  document.getElementById('auditBody').closest('div').scrollTop = 0;
}

// ===================== UI HELPERS =====================
let toastT=null;
function showToast(t,m){ document.getElementById('toastTitle').textContent=t; document.getElementById('toastMsg').textContent=m; document.getElementById('toast').classList.remove('hidden'); clearTimeout(toastT); toastT=setTimeout(hideToast,5200); }
function hideToast(){ document.getElementById('toast').classList.add('hidden'); }
function openHelp(){ document.getElementById('helpModal').classList.remove('hidden'); }
function closeHelp(){ document.getElementById('helpModal').classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key==='Escape'){ closeHelp(); toggleDev(false); } });

function syncThemeButtons() {
  const explicitTheme = document.documentElement.dataset.theme;
  const isDark = explicitTheme ? explicitTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelectorAll('#authThemeToggle, #headerThemeToggle').forEach(button => {
    button.textContent = isDark ? '☀ Light mode' : '☾ Dark mode';
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    button.setAttribute('aria-pressed', String(isDark));
    button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  });
}
function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = currentTheme === 'dark' ? 'light' : 'dark';
  syncThemeButtons();
  applyChartTheme();
  if (signedInUser?.role === 'admin') renderAll();
}

function renderNotifications(targetId, notifications) {
  const target = document.getElementById(targetId);
  target.innerHTML = notifications.length ? notifications.map(item => `
    <article class="rounded-lg border border-hairline bg-stoneBg/50 p-3">
      <div class="text-sm">${escapeHtml(item.message)}</div>
      <div class="mt-1 text-[11px] text-ink/70">${escapeHtml(item.kind)} · ${escapeHtml(item.channel)} · ${escapeHtml(item.created_at)}</div>
    </article>`).join('') : '<p class="text-sm text-ink/70">No notifications yet.</p>';
}

// ===================== DEVELOPER DRAWER =====================
function toggleDev(o){ document.getElementById('devDrawer').classList.toggle('hidden', !o); }
function devTab(n){
  ['liveApi','php','sql'].forEach(t=>{
    document.getElementById('dev-'+t).classList.toggle('hidden', t!==n);
  });
  renderDevTabs(n);
}
function renderDevTabs(active='liveApi'){
  const tabs=[['liveApi','API examples'],['php','backend.php (PHP)'],['sql','schema.sql']];
  document.getElementById('devTabs').innerHTML = tabs.map(([k,l])=>`<button onclick="devTab('${k}')" class="px-3 py-1.5 rounded-md text-xs font-semibold ${k===active?'bg-action text-white':'bg-cardWhite border border-hairline'}">${l}</button>`).join('');
}
function renderDev(m){
  const loads = Object.fromEntries(Object.values(m.dtrs).map(d=>[d.id,d.stressKva]));
  const postLoads = Object.fromEntries(Object.values(m.dtrs).map(d=>[d.id,d.post]));
  const loading = Object.fromEntries(Object.values(m.dtrs).map(d=>[d.id,d.postPct]));
  const drops = Object.fromEntries(Object.values(m.dtrs).map(d=>[d.id,+d.vDev.toFixed(1)]));
  document.getElementById('jsonTel').textContent = JSON.stringify({ feeder_id:'BESCOM-F11-DEMO', source:'demo',
    transformers:Object.values(m.dtrs).map(d=>({ dtr_id:d.id, nameplate_kva:d.rating, active_load_kva:d.stressKva, loading_pct:d.stressPct, source:'simulated' })) }, null, 2);
  document.getElementById('jsonScen').textContent = JSON.stringify({ request:{ base_loads_kva:loads, tie_12_kva_to_dtr01:state.transfers.t12, tie_13_kva_to_dtr01:state.transfers.t13, tie_23_kva_to_dtr03:state.transfers.t23 },
    result:{ source:'demo_heuristic', post_transfer_load_kva:postLoads, post_transfer_loading_pct:loading, voltage_drop_pct:drops,
      max_voltage_drop_pct:m.maxV, voltage_within_6pct:m.vOk, overloaded_transformers:m.postOver100.map(d=>d.id),
      near_limit_transformers:m.postOver90.filter(d=>d.postPct<100).map(d=>d.id), requires_human_approval:true, autonomous_switching_permitted:false } }, null, 2);
  document.getElementById('jsonFc').textContent = JSON.stringify({ request:{ loads_kva:loads },
    result:{ horizon:'15_minutes', source:'demo_heuristic', predictions_kva:Object.fromEntries(Object.values(m.dtrs).map(d=>[d.id,+(d.stressKva*1.03).toFixed(1)])),
      note:'Illustrative estimate only; this is not a trained or live forecasting model.' } }, null, 2);
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('authThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('headerThemeToggle').addEventListener('click', toggleTheme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) {
      syncThemeButtons();
      applyChartTheme();
      if (signedInUser?.role === 'admin') renderAll();
    }
  });
  syncThemeButtons();
  document.getElementById('phpSrc').textContent = PHP;
  document.getElementById('sqlSrc').textContent = SQL;
  renderDevTabs();
  renderAll();
  document.getElementById('loginForm').addEventListener('submit', submitLogin);
  document.getElementById('otpForm').addEventListener('submit', submitOtp);
  document.getElementById('locationForm').addEventListener('submit', confirmCustomerLocation);
  document.getElementById('complaintForm').addEventListener('submit', submitCustomerComplaint);
  document.getElementById('workerCreateForm').addEventListener('submit', createWorker);
  initializePortal();
});

