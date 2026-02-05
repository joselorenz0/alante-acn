
async function loadJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function uniq(arr){ return [...new Set(arr.filter(Boolean))].sort(); }

function fmtPct(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  return `${n.toFixed(1)}%`;
}
function fmtNum(v){
  if(v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if(Number.isNaN(n)) return String(v);
  // show 0 decimals for large counts, 1 for smaller
  return (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));
}

const lowerIsBetter = new Set(['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000']);

let pmRows = [];
let programRows = [];
let logRows = [];

function pillTagClass(p){
  const key = String(p||'').toUpperCase();
  if(key==='TCM') return 'tcm';
  if(key==='CCM') return 'ccm';
  if(key==='RPM') return 'rpm';
  if(key==='AWV') return 'awv';
  if(key==='ACP') return 'acp';
  if(key==='SDOH') return 'sdoh';
  return 'neutral';
}


// Single-org deployment (ACN only)
const FIXED_ORG = "ACN";

function renderPerformanceTable(pmRows){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  const utilization = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];

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
    const isUtilMetric = true; // this table only shows utilization metrics
    const varianceGood = variance < 0; // lower than benchmark is good
    const seed1 = seededRandom(row.KPI + row.Org + '1');
    const seed2 = seededRandom(row.KPI + row.Org + '2');
    const last3 = current + (seed1 * 2 - 1) * 15;
    const ytd = current - (seed2 * 2 - 1) * 10;
    return {last3, variance, ytd, varianceGood, bench};
  }

  function addRow(row){
    const {last3, variance, ytd, varianceGood, bench} = derived(row);

    // Variance formatted with sign and arrow
    const varianceText = `${variance > 0 ? '+' : ''}${variance.toFixed(1)} pts`;
    const varianceClass = varianceGood ? 'good' : 'bad';
    const arrow = variance < 0 ? '↓' : '↑';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${row.KPI}</td>
      <td class="num">${row.KPI.includes('Rate') ? fmtPct(last3) : fmtNum(last3)}</td>
      <td class="num"><b>${row.KPI.includes('Rate') ? fmtPct(row.Current) : fmtNum(row.Current)}</b></td>
      <td class="num">${row.KPI.includes('Rate') ? `${bench}%` : fmtNum(bench)}</td>
      <td class="num"><span class="${varianceClass}">${varianceText} ${arrow}</span></td>
      <td class="num">${row.KPI.includes('Rate') ? fmtPct(ytd) : fmtNum(ytd)}</td>
    `;
    tbody.appendChild(tr);
  }

  // ACN only
  const rows = pmRows.filter(r=>String(r.Org||'').trim()===FIXED_ORG);

  addSection('UTILIZATION');
  utilization.forEach(k=>{
    const r = rows.find(x=>x.KPI===k);
    if(r) addRow(r);
  });
}

function renderProgramOutcomes(rows){
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';

  function varianceHtml(curPct, bmkPct){
    const c = Number(curPct), b = Number(bmkPct);
    if(Number.isNaN(c) || Number.isNaN(b)) return '';
    const v = c - b;
    const cls = v >= 0 ? 'good' : 'bad';
    const txt = `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`;
    return `<span class="${cls}">${txt}</span>`;
  }

  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${r.Program}</b></td>
      <td class="num">${Number(r.Eligible).toLocaleString()}</td>
      <td class="num">${Number(r.Engaged).toLocaleString()}</td>
      <td class="num">${Number(r.Completed).toLocaleString()}</td>
      <td class="num"><b>${fmtPct(r.Completion_Pct)}</b></td>
      <td class="num">${fmtPct(r.Benchmark)}</td>
      <td class="num">${varianceHtml(r.Completion_Pct, r.Benchmark)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFeed(items){
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  document.getElementById('totalCount').textContent = `${items.length} Total`;

  items.forEach(it=>{
    const programsRaw = it.Programs ?? '';
    const programs = Array.isArray(programsRaw)
      ? programsRaw
      : String(programsRaw).split(',').map(s=>s.trim()).filter(Boolean);

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
              <span class="mini">📅 ${it.Date || ''}</span>
              <span class="pill">${it.Org || ''}</span>
              <span class="pill ${evClass}">${ev || ''}</span>
            </div>
          </div>
        </div>
        <div class="icd">${it.ICD10 || ''}</div>
      </div>
      <div class="tile-body">
        <div class="label">FACILITY</div>
        <div class="value">${it.Facility || ''}</div>
        <div class="label">DIAGNOSIS</div>
        <div class="value ital">${it.Diagnosis || ''}</div>
      </div>
    `;
    feed.appendChild(tile);
  });
}

function setOptions(selectEl, values, allLabel){
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = allLabel;
  selectEl.appendChild(opt0);

  values.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function applyFilters(){
  const ev = document.getElementById('eventFilter').value || '';
  const org = FIXED_ORG;

  // left tables
  const pmF = pmRows.filter(r=>String(r.Org||'').trim()===org);
  renderPerformanceTable(pmF);

  const progF = programRows.filter(r=>String(r.Org||'').trim()===org);
  renderProgramOutcomes(progF);

  // right feed
  let feed = logRows.filter(r=>String(r.Org||'').trim()===org);
  if(ev) feed = feed.filter(r=>r.Event===ev);
  feed.sort((a,b)=>String(b.Date).localeCompare(String(a.Date)));
  renderFeed(feed);
}

async function init(){
  pmRows = await loadJSON('./data/performance_metrics.json');
  programRows = await loadJSON('./data/program_outcomes.json');
  logRows = await loadJSON('./data/utilization_log.json');

  // Event filter only
  const events = uniq(logRows.filter(r=>String(r.Org||'').trim()===FIXED_ORG).map(r=>r.Event));

  const evSel = document.getElementById('eventFilter');
  setOptions(evSel, events, 'All Events');
  evSel.addEventListener('change', applyFilters);

  // Initial render
  applyFilters();
}

init().catch(err=>{
  console.error(err);
  alert('Failed to load dashboard data. Check console for details.');
});
