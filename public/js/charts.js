// ===================== CHARTS =====================
function chartPalette() {
  return {
    ink:uiColor('--app-ink'), grid:uiColor('--app-grid'), neutral:uiColor('--app-neutral'),
    good:uiColor('--app-good'), alert:uiColor('--app-alert'), watch:uiColor('--app-watch'),
    scenario:uiColor('--app-scenario'), plan:uiColor('--app-plan')
  };
}
function rgba(hex, alpha) {
  const value = hex.replace('#','');
  const number = parseInt(value,16);
  return `rgba(${(number>>16)&255},${(number>>8)&255},${number&255},${alpha})`;
}
function initCharts() {
  if (barChart || fcChart) return;
  if (typeof Chart === 'undefined') {
    document.getElementById('barChart').classList.add('hidden');
    document.getElementById('forecastChart').classList.add('hidden');
    document.getElementById('barChartFallback').classList.remove('hidden');
    document.getElementById('forecastFallback').classList.remove('hidden');
    return;
  }
  const lines = {
    id:'lines',
    afterDatasetsDraw(chart){
      const { ctx, chartArea:{left,right}, scales:{y} } = chart;
      ctx.save(); ctx.setLineDash([6,5]); ctx.lineWidth=2;
      [[90,uiColor('--app-watch'),'90% near limit'],[100,uiColor('--app-alert'),'100% overloaded']].forEach(([val,col,txt])=>{
        const yp=y.getPixelForValue(val);
        ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(left,yp); ctx.lineTo(right,yp); ctx.stroke();
        ctx.fillStyle=col; ctx.font='600 10px "JetBrains Mono"'; ctx.fillText(txt, right-98, yp+(val===90?13:-5));
      });
      ctx.restore();
    }
  };
  barChart = new Chart(document.getElementById('barChart'), {
    type:'bar',
    data:{ labels:['DTR-01 (250 kVA)','DTR-02 (200 kVA)','DTR-03 (160 kVA)'],
      datasets:[
        { label:'Normal day', data:[0,0,0], backgroundColor:chartPalette().neutral, borderRadius:5, borderColor:chartPalette().neutral, borderWidth:1 },
        { label:'This situation', data:[0,0,0], backgroundColor:chartPalette().scenario, borderRadius:5, borderColor:chartPalette().scenario, borderWidth:1 },
        { label:'After your plan', data:[0,0,0], backgroundColor:chartPalette().plan, borderRadius:5, borderColor:chartPalette().plan, borderWidth:1 }
      ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'start', labels:{ boxWidth:12, font:{family:'Inter',size:12,weight:'600'}, color:chartPalette().ink } },
        tooltip:{ callbacks:{ label:c=>`${c.dataset.label}: ${c.parsed.y}% full` } } },
      scales:{ y:{ beginAtZero:true, max:125, ticks:{ stepSize:25, callback:v=>v+'%', color:chartPalette().ink, font:{family:'JetBrains Mono',size:11} }, grid:{color:chartPalette().grid} },
               x:{ ticks:{ color:chartPalette().ink, font:{family:'Inter',size:12,weight:'700'} }, grid:{display:false} } } },
    plugins:[lines]
  });
  fcChart = new Chart(document.getElementById('forecastChart'), {
    type:'line',
    data:{ labels:['−45m','−30m','−15m','Now','+15m'],
      datasets:[{ data:[0,0,0,0,0], borderColor:chartPalette().plan, backgroundColor:rgba(chartPalette().good,.16), borderWidth:2, fill:true, tension:.35,
        pointBackgroundColor:[chartPalette().plan,chartPalette().plan,chartPalette().plan,chartPalette().good,chartPalette().scenario], pointRadius:4 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>`${c.parsed.y} kVA` } } },
      scales:{ y:{ min:350, max:700, ticks:{ stepSize:150, font:{family:'JetBrains Mono',size:10}, color:chartPalette().ink }, grid:{color:chartPalette().grid} },
               x:{ ticks:{ font:{family:'JetBrains Mono',size:10}, color:chartPalette().ink }, grid:{display:false} } } }
  });
}
function applyChartTheme() {
  if (!barChart || !fcChart) return;
  const colors = chartPalette();
  barChart.data.datasets[0].backgroundColor = barChart.data.datasets[0].borderColor = colors.neutral;
  barChart.data.datasets[1].backgroundColor = barChart.data.datasets[1].borderColor = colors.scenario;
  barChart.data.datasets[2].backgroundColor = barChart.data.datasets[2].borderColor = colors.plan;
  barChart.options.plugins.legend.labels.color = colors.ink;
  barChart.options.scales.y.ticks.color = barChart.options.scales.x.ticks.color = colors.ink;
  barChart.options.scales.y.grid.color = colors.grid;
  fcChart.data.datasets[0].borderColor = colors.plan;
  fcChart.data.datasets[0].backgroundColor = rgba(colors.good,.16);
  fcChart.data.datasets[0].pointBackgroundColor = [colors.plan,colors.plan,colors.plan,colors.good,colors.scenario];
  fcChart.options.scales.y.ticks.color = fcChart.options.scales.x.ticks.color = colors.ink;
  fcChart.options.scales.y.grid.color = colors.grid;
  barChart.update('none');
  fcChart.update('none');
}
function updateCharts(m) {
  if (!barChart || !fcChart) return;
  const d = m.dtrs;
  barChart.data.datasets[0].data = ['DTR-01','DTR-02','DTR-03'].map(k=>d[k].basePct);
  barChart.data.datasets[1].data = ['DTR-01','DTR-02','DTR-03'].map(k=>d[k].stressPct);
  barChart.data.datasets[2].data = ['DTR-01','DTR-02','DTR-03'].map(k=>d[k].postPct);
  barChart.update();
  const n = m.totStress;
  fcChart.data.datasets[0].data = [.85,.90,.96,1,1.03].map(f=>Math.round(n*f));
  fcChart.update();
}
