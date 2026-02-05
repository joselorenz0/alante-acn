// Alante Performance Dashboard (static)
// Data files in /data: performance_metrics.json, program_outcomes.json, utilization_log.json

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function $(id) { return document.getElementById(id); }

function isPercentMetric(metric) {
  return /%|\(\%\)|Rate/i.test(metric);
}

function formatValue(metric, value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (isPercentMetric(metric)) return `${n.toFixed(1)}%`;
  // admits/1,000 etc
  if (Math.abs(n) >= 1000) return n.toLocaleString();
  // keep up to 1 decimal if needed
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function lowerIsBetter(metric) {
  return /Readmission|Admits|ER|INP/i.test(metric);
}

function varianceText(metric, current, benchmark) {
  const c = Number(current), b = Number(benchmark);
  if (Number.isNaN(c) || Number.isNaN(b)) return { text: "—", cls: "" };
  const diff = c - b;
  const good = lowerIsBetter(metric) ? diff <= 0 : diff >= 0;
  const cls = good ? "good" : "bad";

  // show pts for percent, else raw
  if (isPercentMetric(metric)) {
    const pts = Math.abs(diff).toFixed(1);
    const arrow = good ? "↓" : "↑"; // for % metrics we still use arrow to indicate direction vs benchmark
    // But if higher is better, good might be ↑; handle explicitly
    const arrow2 = lowerIsBetter(metric) ? (good ? "↓" : "↑") : (good ? "↑" : "↓");
    return { text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts ${arrow2}`, cls };
  } else {
    const arrow2 = lowerIsBetter(metric) ? (good ? "↓" : "↑") : (good ? "↑" : "↓");
    const val = Math.abs(diff);
    const txt = Number.isInteger(val) ? val.toString() : val.toFixed(1);
    return { text: `${diff >= 0 ? "+" : "-"}${txt} ${arrow2}`, cls };
  }
}

function buildPerformanceTable(rows) {
  const tbody = document.querySelector("#performanceTable tbody");
  tbody.innerHTML = "";

  // group by Section
  const bySection = {};
  rows.forEach(r => {
    const s = (r.Section || "").toUpperCase();
    bySection[s] = bySection[s] || [];
    bySection[s].push(r);
  });

  const order = ["UTILIZATION", "CLINICAL QUALITY"];
  const sections = order.filter(s => bySection[s] && bySection[s].length).concat(
    Object.keys(bySection).filter(s => !order.includes(s))
  );

  sections.forEach(section => {
    // section header row
    const trH = document.createElement("tr");
    trH.className = "section-row";
    trH.innerHTML = `<td colspan="6">${section}</td>`;
    tbody.appendChild(trH);

    bySection[section].forEach(r => {
      const tr = document.createElement("tr");
      const v = varianceText(r.Metric, r.CurrentMonth, r.Benchmark);
      tr.innerHTML = `
        <td class="metric">${r.Metric}</td>
        <td class="num muted">${formatValue(r.Metric, r.Last3MoAvg)}</td>
        <td class="num strong">${formatValue(r.Metric, r.CurrentMonth)}</td>
        <td class="num">${formatValue(r.Metric, r.Benchmark)}</td>
        <td class="num ${v.cls}">${v.text}</td>
        <td class="num muted">${formatValue(r.Metric, r.YTDAvg)}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function buildProgramTable(rows) {
  const tbody = document.querySelector("#programTable tbody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const completion = Number(r.CompletionPct);
    const bench = Number(r.BenchmarkPct);
    const diff = completion - bench;
    const good = diff >= 0;
    const cls = good ? "good" : "bad";
    const arrow = good ? "↑" : "↓";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="metric"><strong>${r.Program}</strong></td>
      <td class="num muted">${Number(r.Eligible).toLocaleString()}</td>
      <td class="num muted">${Number(r.Engaged).toLocaleString()}</td>
      <td class="num muted">${Number(r.Completed).toLocaleString()}</td>
      <td class="num strong">${completion.toFixed(1)}%</td>
      <td class="num">${bench.toFixed(1)}%</td>
      <td class="num ${cls}">${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts ${arrow}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLogCards(rows) {
  const feed = $("logFeed");
  feed.innerHTML = "";

  rows.forEach(r => {
    const tags = (r.Tags || "").split(",").map(s => s.trim()).filter(Boolean);

    const tagHtml = tags.map(t => `<span class="pill pill-${t.toLowerCase()}">${t}</span>`).join("");
    const icdHtml = r.ICD10 ? `<span class="pill pill-icd">${r.ICD10}</span>` : "";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-top">
        <div class="avatar">👤</div>
        <div class="card-main">
          <div class="name-row">
            <div class="name">${r.Patient}</div>
            <div class="pills">${tagHtml}${icdHtml}</div>
          </div>
          <div class="meta">
            <span class="date">📅 ${r.Date}</span>
            <span class="pill pill-org">${r.Org}</span>
            <span class="pill pill-event">${r.Event}</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="label">FACILITY</div>
        <div class="value">${r.Facility}</div>
        <div class="label" style="margin-top:10px;">DIAGNOSIS</div>
        <div class="value italic">${r.Diagnosis}</div>
      </div>
    `;
    feed.appendChild(card);
  });

  $("totalCount").textContent = `${rows.length} Total`;
}

function populateEventFilter(allRows) {
  const select = $("eventSelect");
  const events = Array.from(new Set(allRows.map(r => r.Event))).sort();
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "All Events";
  select.appendChild(optAll);

  events.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    select.appendChild(opt);
  });
}

function filterLog(allRows) {
  const ev = $("eventSelect").value;
  return allRows.filter(r => (ev === "ALL" ? true : r.Event === ev));
}

function wireExport(excelFilename) {
  const btn = $("exportBtn");
  btn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = excelFilename;
    link.download = excelFilename.split("/").pop();
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}

(async function init() {
  try {
    const [pmRows, poRows, logRows] = await Promise.all([
      loadJSON("./data/performance_metrics.json"),
      loadJSON("./data/program_outcomes.json"),
      loadJSON("./data/utilization_log.json"),
    ]);

    buildPerformanceTable(pmRows);
    buildProgramTable(poRows);

    populateEventFilter(logRows);
    $("eventSelect").addEventListener("change", () => renderLogCards(filterLog(logRows)));

    renderLogCards(filterLog(logRows));

    wireExport("./data/Alante_Performance_Data.xlsx");
  } catch (e) {
    console.error(e);
    alert("Failed to load dashboard data. Check console for details.");
  }
})();
