// ===================== STATE =====================
const RATED_TOTAL = 610;
const state = {
  minutes: 19*60+30,
  scenario: 'surge25',
  mult: 1.25,
  sel: 'DTR-02',
  transfers: { t12:0, t13:0, t23:0 },   // +t12: DTR-02→01, +t13: DTR-03→01, +t23: DTR-02→03
  dtrs: {
    'DTR-01': { id:'DTR-01', name:'Transformer 01', node:'Node 03', rating:250, base:170, x:295, y:190,
      clusters:[{id:'LC-1A',name:'Residential North',share:.38},{id:'LC-1B',name:'Commercial Retail',share:.34},{id:'LC-1C',name:'Clinic & Civic',share:.28}] },
    'DTR-02': { id:'DTR-02', name:'Transformer 02', node:'Node 05', rating:200, base:170, x:515, y:190,
      clusters:[{id:'LC-2A',name:'EV Charging Hub',share:.37},{id:'LC-2B',name:'High-Density Apts',share:.35},{id:'LC-2C',name:'Small Workshops',share:.28}] },
    'DTR-03': { id:'DTR-03', name:'Transformer 03', node:'Node 07', rating:160, base:120, x:735, y:190,
      clusters:[{id:'LC-3A',name:'IT Park Annex',share:.36},{id:'LC-3B',name:'Mixed Residential',share:.34},{id:'LC-3C',name:'Street & Metro Feed',share:.30}] }
  },
  audit: [
    { time:'19:15', op:'Demo operator', scen:'+25% surge', action:'Move 20 kVA DTR-02 → DTR-01', post:'93% / 96% / 94%', status:'REJECTED' },
    { time:'18:45', op:'Demo operator', scen:'Normal evening', action:'No transfer (monitor DTR-02)', post:'68% / 85% / 75%', status:'APPROVED' },
    { time:'18:00', op:'Demo operator', scen:'Data check', action:'15-min meter data quality OK', post:'64% / 79% / 71%', status:'APPROVED' }
  ]
};
const SCENARIOS = {
  baseline:{ icon:'☀️', title:'Normal evening', desc:'Typical load. Good for seeing the starting point.', mult:1.00 },
  surge25:{ icon:'⚡', title:'+25% demand surge', desc:'Evening peak with EV charging. Pushes DTR-02 over its limit.', mult:1.25 },
  weather:{ icon:'🌧️', title:'Heavy rain', desc:'Weather raises demand unevenly, hitting DTR-02 and DTR-03 hardest.', mult:1.16 },
  custom:{ icon:'🎚️', title:'Custom', desc:'Use the demand slider below to set your own level.', mult:null }
};
let barChart=null, fcChart=null;

function uiColor(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
