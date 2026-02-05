// Alante Dashboard - static GitHub Pages/SharePoint-friendly
// Data files live in ./data/*.json

function fmtNum(n){
  const x = Number(n);
  if (Number.isNaN(x)) return '';
  return x.toLocaleString(undefined, {maximumFractionDigits: 0});
}
function fmtPct(n){
  const x = Number(n);
  if (Number.isNaN(x)) return '';
  return `${x.toFixed(1)}%`;
}
function uniq(arr){ return Array.from(new Set(arr)); }

async function loadJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status} loading ${path}`);
  return await res.json();
}

function populateSelect(select, values, allLabel){
  select.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = allLabel;
  select.appendChild(optAll);
  values.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function renderPerformanceTable(rows){
  const tbody = document.getElementById('performanceTbody');
  tbody.innerHTML = '';

  // Section header
  const trSection = document.createElement('tr');
  trSection.className = 'section-row';
  trSection.innerHTML = `<td colspan="5">UTILIZATION</td>`;
  tbody.appendChild(trSection);

  const order = ['Readmission Rate (%)','INP Admits/1,000','ER Admits/1,000'];

  order.forEach(kpi=>{
    const r = rows.find(x=>x.KPI===kpi);
    if(!r) return;

    const isPct = kpi.includes('Rate');
    const mom = Number(r.MoM);
    const momGood = (kpi.includes('Admits') || kpi.includes('Readmission')) ? mom < 0 : mom > 0;
    const arrow = momGood ? '↓' : '↑';
    const cls = momGood ? 'good' : 'bad';

    const momText = isPct ? `${mom>0?'+':''}${mom.toFixed(1)} pts` : `${mom>0?'+':''}${mom.toFixed(0)}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-metric">${kpi}</td>
      <td class="num">${isPct ? fmtPct(r.Last3) : fmtNum(r.Last3)}</td>
      <td class="num"><b>${isPct ? fmtPct(r.Current) : fmtNum(r.Current)}</b></td>
      <td class="num"><span class="${cls}">${momText} ${arrow}</span></td>
      <td class="num">${isPct ? fmtPct(r.YTD) : fmtNum(r.YTD)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProgramOutcomes(rows){
  const tbody = document.getElementById('programTbody');
  tbody.innerHTML = '';

  rows.forEach(r=>{
    const completion = Number(r.CompletionPct);
    const trend = (r.MoM||'').toLowerCase();
    const arrow = trend==='down' ? '↓' : (trend==='up' ? '↑' : '—');
    const cls = trend==='down' ? 'bad' : (trend==='up' ? 'good' : 'muted');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-program"><b>${r.Program}</b></td>
      <td class="num">${fmtNum(r.Eligible)}</td>
      <td class="num">${fmtNum(r.Engaged)}</td>
      <td class="num">${fmtNum(r.Completed)}</td>
      <td class="num"><span class="pct">${completion.toFixed(1)}%</span></td>
      <td class="num"><span class="${cls}">${arrow}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function pill(label, cls){
  return `<span class="tag ${cls||''}">${label}</span>`;
}

function renderFeed(rows){
  const feed = document.getElementById('feed');
  feed.innerHTML = '';

  const total = document.getElementById('totalCount');
  total.textContent = `${rows.length} Total`;

  rows.forEach(r=>{
    const tags = Array.isArray(r.Tags) ? r.Tags : (typeof r.Tags === 'string' ? r.Tags.split(',').map(s=>s.trim()).filter(Boolean) : []);
    // program tags as colored pills
    const tagHtml = tags.map(t=>{
      const key=t.toUpperCase();
      const cls = key==='TCM' ? 'tcm' :
                  key==='CCM' ? 'ccm' :
                  key==='RPM' ? 'rpm' :
                  key==='AWV' ? 'awv' :
                  key==='ACP' ? 'acp' :
                  key==='SDOH' ? 'sdoh' : '';
      return pill(key, cls);
    }).join('');

    const tr = document.createElement('div');
    tr.className = 'tile';
    tr.innerHTML = `
      <div class="tile-top">
        <div class="row gap10">
          <div class="avatar">👤</div>
          <div>
            <div class="patient">
              <span class="name">${r.Patient}</span>
              <span class="tags">${tagHtml}</span>
            </div>
            <div class="meta">
              <span class="icon">📅</span> ${r.Date}
              <span class="pill org">${r.Org}</span>
              <span class="pill event">${r.Event}</span>
            </div>
          </div>
        </div>
        <div class="icd">${r.ICD10||''}</div>
      </div>

      <div class="line"></div>

      <div class="block">
        <div class="label">FACILITY</div>
        <div class="value">${r.Facility}</div>
      </div>

      <div class="block diag">
        <div class="label">DIAGNOSIS</div>
        <div class="value"><i>${r.Diagnosis}</i></div>
      </div>
    `;
    feed.appendChild(tr);
  });
}

async function init(){
  try{
    const [pmRows, poRows, logRows] = await Promise.all([
      loadJSON('./data/performance_metrics.json'),
      loadJSON('./data/program_outcomes.json'),
      loadJSON('./data/utilization_log.json')
    ]);

    // ACN-only dashboard
    const org = 'ACN';

    // Event dropdown
    const eventSelect = document.getElementById('eventFilter');
    const events = uniq(logRows.map(r=>r.Event).filter(Boolean));
    populateSelect(eventSelect, events, 'All Events');

    // Initial render
    renderPerformanceTable(pmRows.filter(r=>r.Org===org));
    renderProgramOutcomes(poRows.filter(r=>r.Org===org));

    function apply(){
      const ev = eventSelect.value;
      let filtered = logRows.filter(r=>r.Org===org);
      if(ev) filtered = filtered.filter(r=>r.Event===ev);

      // sort by date desc (MM/DD/YYYY)
      filtered.sort((a,b)=>{
        const pa = Date.parse(a.Date);
        const pb = Date.parse(b.Date);
        if(!Number.isNaN(pa) && !Number.isNaN(pb)) return pb-pa;
        return 0;
      });

      renderFeed(filtered);
    }

    eventSelect.addEventListener('change', apply);
    apply();
  }catch(err){
    console.error(err);
    alert('Failed to load dashboard data. Check console for details.');
  }
}

document.addEventListener('DOMContentLoaded', init);
