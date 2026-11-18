// ===================== ENGINE =====================
function compute(tr = state.transfers) {
  const weather = state.scenario === 'weather';
  const wf = { 'DTR-01': weather?1.04:1, 'DTR-02': weather?1.12:1, 'DTR-03': weather?1.09:1 };
  const out = {}; let totStress = 0, totPost = 0;
  const delta = { 'DTR-01': tr.t12 + tr.t13, 'DTR-02': -tr.t12 - tr.t23, 'DTR-03': -tr.t13 + tr.t23 };
  for (const k in state.dtrs) {
    const d = state.dtrs[k];
    const stress = +(d.base * state.mult * wf[k]).toFixed(1);
    const post = Math.max(0, +(stress + delta[k]).toFixed(1));
    const r = { ...d, stressKva:stress, post, delta:delta[k],
      basePct: Math.round(d.base/d.rating*100),
      stressPct: Math.round(stress/d.rating*100),
      postPct: Math.round(post/d.rating*100) };
    r.forecastKva = +(stress * (state.scenario==='baseline'?1.015:1.032)).toFixed(1);
    r.forecastPct = Math.round(r.forecastKva/d.rating*100);
    const tie = (k === 'DTR-01' && delta[k] > 30) ? 0.012 : 0;
    const vd = (r.postPct / 100) * 0.038 + tie + (weather ? 0.008 : 0);
    r.vDev = +(vd * 100).toFixed(1);
    r.ltKv = +(0.415 * (1 - vd)).toFixed(3);
    if (r.stressPct >= 100) {
      r.risk = weather ? 0.94 : 0.89;
      r.why = weather
        ? 'Heavy rain surge raises moisture and fault risk'
        : (k === 'DTR-02'
          ? 'Evening EV charging is 21% above the 7-day median'
          : 'Running above its rated capacity for a sustained period');
    } else if (r.stressPct >= 90) {
      r.risk = 0.72;
      r.why = weather ? 'Weather is pushing up reactive demand' : 'Getting close to the 90% watchline; phase B looks unbalanced';
    } else {
      r.risk = 0.18;
      r.why = 'Load pattern is normal for this time of day';
    }
    out[k]=r; totStress+=stress; totPost+=post;
  }
  const arr = Object.values(out);
  const maxV = Math.max(...arr.map(d=>d.vDev));
  return {
    dtrs:out, totStress:+totStress.toFixed(1), totPost:+totPost.toFixed(1),
    feederPct:+(totPost/RATED_TOTAL*100).toFixed(1),
    busKv:+(11.08 - (totPost/RATED_TOTAL)*.065).toFixed(2),
    stressOver100: arr.filter(d=>d.stressPct>=100), stressOver90: arr.filter(d=>d.stressPct>=90),
    postOver100: arr.filter(d=>d.postPct>=100), postOver90: arr.filter(d=>d.postPct>=90),
    maxV, vOk: maxV<=6, anyTransfer: Object.values(tr).some(v=>v!==0)
  };
}
function verdictOf(m) {
  if (m.postOver100.length || !m.vOk) return 'stop';
  if (m.postOver90.length) return 'caution';
  return 'go';
}
function st(pct) {
  if (pct>=100) return { key:'bad', label:'Overloaded', icon:'✕', hex:uiColor('--app-alert'), txt:'text-terracotta', bg:'bg-terracotta/10', bd:'border-terracotta/40' };
  if (pct>=90) return { key:'warn', label:'Near limit', icon:'!', hex:uiColor('--app-watch'), txt:'text-amberWatch', bg:'bg-amberWatch/10', bd:'border-amberWatch/40' };
  return { key:'ok', label:'OK', icon:'✓', hex:uiColor('--app-good'), txt:'text-sage', bg:'bg-sage/10', bd:'border-sage/40' };
}
function planText(tr = state.transfers) {
  const p=[];
  if (tr.t12) p.push(`${Math.abs(tr.t12)} kVA from ${tr.t12>0?'DTR-02 to DTR-01':'DTR-01 to DTR-02'}`);
  if (tr.t13) p.push(`${Math.abs(tr.t13)} kVA from ${tr.t13>0?'DTR-03 to DTR-01':'DTR-01 to DTR-03'}`);
  if (tr.t23) p.push(`${Math.abs(tr.t23)} kVA from ${tr.t23>0?'DTR-02 to DTR-03':'DTR-03 to DTR-02'}`);
  return p.length ? 'Move ' + p.join(' and ') : 'No load moved';
}

// Auto-suggest: search all slider combos, minimise the worst transformer, then the smallest move
function suggestFix() {
  const saved = { ...state.transfers };
  let best=null;
  for (let a=-50;a<=60;a+=5) for (let b=-40;b<=50;b+=5) for (let c=-40;c<=40;c+=5) {
    const m = compute({t12:a,t13:b,t23:c});
    if (!m.vOk) continue;
    const worst = Math.max(...Object.values(m.dtrs).map(d=>d.post/d.rating));
    const effort = Math.abs(a)+Math.abs(b)+Math.abs(c);
    const score = Math.round(worst*1000) + effort*0.01;
    if (!best || score<best.score) best={score,a,b,c,worst};
  }
  state.transfers = best ? { t12:best.a, t13:best.b, t23:best.c } : saved;
  renderAll();
  const m = compute();
  const v = verdictOf(m);
  if (v==='stop') showToast('No safe transfer exists', 'Even the most balanced split leaves a transformer overloaded. Total demand is too high; consider curtailing load or using a neighbouring feeder.');
  else showToast('Best fix found', `${planText()}. Highest transformer is now ${Math.max(...Object.values(m.dtrs).map(d=>d.postPct))}%.`);
  document.getElementById('step3').scrollIntoView();
}
