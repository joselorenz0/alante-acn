async function loadJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function uniq(arr){ return [...new Set(arr)].sort(); }

function fmtPct(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
}
function fmtNum(v){
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(0);
}

function pillTagClass(t){
  const k = String(t||'').toLowerCase();
  if(k==='tcm') return 'tcm';
  if(k==='ccm') return 'ccm';
  if(k==='rpm') return 'rpm';
  if(k==='awv') return 'awv';
  if(k==='acp') return 'acp';
  if(k==='sdoh') return 'sdoh';
  return '';
}

// Program outcomes data (sample data based on org)
const programOutcomesBase = {
  'AWV': { eligible: 12840, engaged: 5912, completed: 5104, completionPct: 39.7, mom: 'up' },
  'CCM': { eligible: 6420, engaged: 2188, completed: 1964, completionPct: 30.6, mom: 'up' },
  'TCM': { eligible: 1084, engaged: 642, completed: 598, completionPct: 55.2, mom: 'down' },
  'ACP': { eligible: 1084, engaged: 712, completed: 648, completionPct: 59.8, mom: 'flat' },
  'SDOH': { eligible: 9100, engaged: 3420, completed: 3112, completionPct: 34.2, mom: 'up' }
};

function renderPerformanceTable(pmRows, org){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  const utilization = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];
  const quality = pmRows.map(r=>r.KPI).filter(k=>!utilization.includes(k));

  function addSection(title){
    const tr = document.createElement('tr');
    tr.className = 'section-row';
    tr.innerHTML = `<td colspan="6">${title}</td>`;
    tbody.appendChild(tr);
  }

  // Seed random for consistent values per session
  const randomSeed = {};
  function seededRandom(key) {
    if (!(key in randomSeed)) {
      randomSeed[key] = Math.random();
    }
    return randomSeed[key];
  }

  // Compute derived values
  function derived(row){
    const current = Number(row.Current);
    const bench = Number(row.Benchmark);
    const variance = current - bench;
    const isUtilMetric = row.KPI.includes('Admits') || row.KPI.includes('Readmission');
    // For utilization metrics, negative variance is good (below benchmark)
    // For quality metrics, positive variance is good (above benchmark)
    const varianceGood = isUtilMetric ? variance < 0 : variance > 0;
    
    // Compute last 3 month avg and YTD avg based on current (seeded for consistency)
    const seed1 = seededRandom(row.KPI + row.Org + '1');
    const seed2 = seededRandom(row.KPI + row.Org + '2');
    const last3 = current + (seed1 * 2 - 1) * (isUtilMetric ? 15 : 3);
    const ytd = current - (seed2 * 2 - 1) * (isUtilMetric ? 10 : 2);
    
    return {last3, variance, ytd, varianceGood, bench, isUtilMetric};
  }

  function addRow(row){
    const {last3, variance, ytd, varianceGood, bench, isUtilMetric} = derived(row);
    const isPct = row.KPI.includes('%') && !row.KPI.includes('Admits');
    
    // Format variance with sign
    let varianceText;
    if (isPct) {
      varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`;
    } else {
      varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(0)}`;
    }
    
    const varianceClass = varianceGood ? 'good' : 'bad';
    // For utilization: negative variance (good) shows ↓, positive (bad) shows ↑
    // For quality: positive variance (good) shows ↑, negative (bad) shows ↓
    const arrow = isUtilMetric ? (variance < 0 ? '↓' : '↑') : (variance > 0 ? '↑' : '↓');
    
    // Format benchmark
    let benchText;
    if (isPct) {
      benchText = `${bench}%`;
    } else {
      benchText = fmtNum(bench);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${row.KPI}</td>
      <td class="num">${isPct ? fmtPct(last3) : fmtNum(last3)}</td>
      <td class="num"><b>${isPct ? fmtPct(row.Current) : fmtNum(row.Current)}</b></td>
      <td class="num">${benchText}</td>
      <td class="num"><span class="${varianceClass}">${varianceText} ${arrow}</span></td>
      <td class="num">${isPct ? fmtPct(ytd) : fmtNum(ytd)}</td>
    `;
    tbody.appendChild(tr);
  }

  const byOrg = org ? pmRows.filter(r=>r.Org===org) : pmRows;

  // Get unique KPIs for the filtered org
  const uniqueKPIs = [...new Set(byOrg.map(r => r.KPI))];

  addSection('UTILIZATION');
  utilization.forEach(k=>{
    const r = byOrg.find(x=>x.KPI===k);
    if(r) addRow(r);
  });

  addSection('CLINICAL QUALITY');
  uniqueKPIs.filter(k => !utilization.includes(k)).forEach(k=>{
    const r = byOrg.find(x=>x.KPI===k);
    if(r) addRow(r);
  });
}

function renderProgramOutcomes(org){
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';
  
  // Slightly vary the data based on org
  const orgMultipliers = {
    'PCCA': 1.0,
    'Novum': 0.92,
    'ACN': 1.08,
    'DKA': 0.95
  };
  
  const mult = orgMultipliers[org] || 1.0;
  
  Object.keys(programOutcomesBase).forEach(program => {
    const base = programOutcomesBase[program];
    const eligible = Math.round(base.eligible * mult);
    const engaged = Math.round(base.engaged * mult);
    const completed = Math.round(base.completed * mult);
    const completionPct = base.completionPct;
    
    let momIcon = '';
    if(base.mom === 'up') momIcon = '<span class="good">↑</span>';
    else if(base.mom === 'down') momIcon = '<span class="bad">↓</span>';
    else momIcon = '—';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${program}</td>
      <td class="num">${eligible.toLocaleString()}</td>
      <td class="num">${engaged.toLocaleString()}</td>
      <td class="num">${completed.toLocaleString()}</td>
      <td class="num"><span class="completion-pct">${completionPct.toFixed(1)}%</span></td>
      <td class="num">${momIcon}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFeed(items){
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  document.getElementById('totalCount').textContent = `${items.length} Total`;

  items.forEach(it=>{
    const programs = Array.isArray(it.Programs) ? it.Programs : [];
    const tagsHtml = programs.map(p=>`<span class="tag ${pillTagClass(p)}">${p}</span>`).join('');

    const ev = String(it.Event||'');
    const evClass = ev.toLowerCase().includes('inp') ? 'inp' : '';

    const tile = document.createElement('div');
    tile.className='tile';
    tile.innerHTML = `
      <div class="tile-top">
        <div class="row gap8">
          <div class="avatar">👤</div>
          <div>
            <div class="name">${it.Patient || ''} ${tagsHtml}</div>
            <div class="meta">
              <span>📅 ${it.Date || ''}</span>
              <span class="badge org">${it.Org || ''}</span>
              <span class="badge event ${evClass}">${ev}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="kv">
        <div class="kv-row">
          <div>
            <div class="k">FACILITY</div>
            <div class="v">${it.Facility || ''}</div>
          </div>
        </div>
        <div class="kv-row" style="margin-top:10px">
          <div style="flex:1">
            <div class="k">DIAGNOSIS</div>
            <div class="v"><i>${it.Diagnosis || ''}</i></div>
          </div>
          <div class="kv-right">
            <span class="icd">${it.ICD10 || ''}</span>
          </div>
        </div>
      </div>
    `;
    feed.appendChild(tile);
  });
}

function populateSelect(selectEl, values, placeholder){
  selectEl.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = placeholder;
  selectEl.appendChild(optAll);
  values.forEach(v=>{
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    selectEl.appendChild(o);
  });
}

(async function main(){
  const [pmRows, logRows] = await Promise.all([
    loadJSON('data/performance_metrics.json'),
    loadJSON('data/utilization_log.json')
  ]);

  // Add good/bad styles
  const style = document.createElement('style');
  style.innerHTML = `
    .good{color:var(--green);font-weight:800}
    .bad{color:var(--red);font-weight:800}
    .completion-pct{color:var(--blue);font-weight:700}
  `;
  document.head.appendChild(style);

  const orgs = uniq(pmRows.map(r=>r.Org).filter(Boolean));
  const events = uniq(logRows.map(r=>r.Event).filter(Boolean));

  const globalOrgSelect = document.getElementById('globalOrgFilter');
  const orgSelect = document.getElementById('orgFilter');
  const eventSelect = document.getElementById('eventFilter');

  populateSelect(globalOrgSelect, orgs, 'All Orgs');
  populateSelect(orgSelect, orgs, 'All Orgs');
  populateSelect(eventSelect, events, 'All Events');

  function apply(){
    // Global org filter affects all tables
    const globalOrg = globalOrgSelect.value;
    // Right panel org filter (if set, it takes precedence for the feed)
    const panelOrg = orgSelect.value;
    const ev = eventSelect.value;

    // Use global org for all tables
    const orgForTables = globalOrg;
    
    // LEFT: Performance Metrics filtered by Global Org
    renderPerformanceTable(pmRows, orgForTables);
    
    // LEFT: Program Outcomes filtered by Global Org
    renderProgramOutcomes(orgForTables);

    // RIGHT: Utilization feed filtered by Org (panel if set, else global) + Event
    let filtered = logRows.slice();
    const feedOrg = panelOrg || globalOrg;
    if(feedOrg) filtered = filtered.filter(r=>String(r.Org||'').trim()===String(feedOrg).trim());
    if(ev) filtered = filtered.filter(r=>String(r.Event||'').trim()===String(ev).trim());

    filtered.sort((a,b)=>{
      const da = Date.parse(a.Date) || 0;
      const db = Date.parse(b.Date) || 0;
      return db-da;
    });

    renderFeed(filtered);
  }

  // Sync org filters
  globalOrgSelect.addEventListener('change', ()=>{
    orgSelect.value = globalOrgSelect.value;
    apply();
  });
  
  orgSelect.addEventListener('change', ()=>{
    globalOrgSelect.value = orgSelect.value;
    apply();
  });
  
  eventSelect.addEventListener('change', apply);

  // Initial render
  apply();
})();
