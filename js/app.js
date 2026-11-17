/* Campus Housing Explorer
 * Every figure on the page is computed here, in the browser, from data/site_sales.csv
 * (all rows of data/college_town_home_sales.csv, fewer columns). See README.md, "Data notes".
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Cleaning rules (documented in README.md and in the Methodology section)
  // ---------------------------------------------------------------------------
  const PRICE_MIN = 10000;      // sales below this are implausible
  const PRICE_MAX = 5000000;    // sales above this are implausible
  const DATA_URL = "data/site_sales.csv";   // relative path for GitHub Pages
  const UIUC = "University of Illinois Urbana-Champaign";
  const CU_CITIES = ["Champaign", "Urbana", "Savoy"];
  const PAGE_SIZE = 25;

  const UNI_SHORT = {
    "University of Illinois Urbana-Champaign": "Illinois (UIUC)",
    "Purdue University": "Purdue",
    "The Pennsylvania State University": "Penn State",
    "The University of Iowa": "Iowa",
    "The University of North Carolina at Chapel Hill": "UNC Chapel Hill",
    "University of California, Davis": "UC Davis",
    "University of Florida": "Florida",
    "University of Georgia": "Georgia",
    "University of Michigan": "Michigan",
    "University of Virginia": "Virginia",
    "University of Wisconsin-Madison": "Wisconsin–Madison",
  };
  const shortUni = (u) => UNI_SHORT[u] || u;

  // Colors
  const C = {
    navy: "#13315c", navyLight: "#8da9c4", navySoft: "rgba(19,49,92,0.12)",
    orange: "#e84a27", gray: "#9aa5b5", grid: "#eef1f6", text: "#5b6779",
    cu: { Champaign: "#13315c", Urbana: "#2f5d9a", Savoy: "#8da9c4" },
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const num = (s) => (s === "" || s == null ? null : Number(s));
  const dayNumber = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };

  /** Median of a list of numbers: middle value, or mean of the two middle values. */
  function median(values) {
    const v = values.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  const fmtInt = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const fmtMoney = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
  const fmtMoneyShort = (n) => {
    if (n == null) return "—";
    if (Math.abs(n) >= 1e6) return "$" + (n % 1e6 === 0 ? String(n / 1e6) : (n / 1e6).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")) + "M";
    if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + Math.round(n);
  };
  const fmtPct = (x, digits = 1) => (x == null ? "—" : (x * 100).toFixed(digits) + "%");
  const fmtDays = (n) => (n == null ? "—" : (Number.isInteger(n) ? n : n.toFixed(1)) + (n === 1 ? " day" : " days"));
  const fmtDate = (s) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  };
  const fmtDateLong = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  };
  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const setStat = (key, text) => $$(`[data-stat="${key}"]`).forEach((el) => (el.textContent = text));
  const unique = (arr) => Array.from(new Set(arr));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /** Summary statistics for a set of rows. Callers pass rows that already meet the price rule. */
  function summarize(rows) {
    const domRows = rows.filter((r) => r.dom != null);
    const ppsf = rows.map((r) => r.ppsf).filter((x) => x != null);
    return {
      sales: rows.length,
      medianPrice: median(rows.map((r) => r.sale_price)),
      medianPpsf: median(ppsf),
      ppsfN: ppsf.length,
      medianDom: median(domRows.map((r) => r.dom)),
      domN: domRows.length,
      domCoverage: rows.length ? domRows.length / rows.length : null,
      medianSqft: median(rows.map((r) => (r.living_area_sqft > 0 ? r.living_area_sqft : null))),
      medianMiles: median(rows.map((r) => r.miles_to_campus)),
    };
  }

  function groupBy(rows, keyFn) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let ALL = [];        // every row
  let VALID = [];      // rows that meet the price rule (the analysis set)
  const charts = {};

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  function load() {
    Papa.parse(DATA_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,      // keep zipcode and ids as text
      complete: (res) => {
        try {
          if (!res.data.length) throw new Error("The data file is empty.");
          prepare(res.data);
          init();
          $("#loading").hidden = true;
          $("#app").hidden = false;
          // Charts size themselves after the container becomes visible
          Object.values(charts).forEach((c) => c.resize());
        } catch (e) { showError(e); }
      },
      error: (e) => showError(e),
    });
  }

  function showError(e) {
    console.error(e);
    $("#loading").hidden = true;
    const box = $("#load-error");
    box.hidden = false;
    box.innerHTML = "<strong>The data could not be loaded.</strong> Please refresh the page. <br><small>" +
      escapeHtml(e && e.message ? e.message : String(e)) + "</small>";
  }

  function prepare(raw) {
    ALL = raw.map((d) => {
      const price = num(d.sale_price);
      const sqft = num(d.living_area_sqft);
      const listDay = dayNumber(d.list_date);
      const contractDay = dayNumber(d.contract_date);
      const valid = price != null && price >= PRICE_MIN && price <= PRICE_MAX;
      return {
        listing_id: d.listing_id,
        address_street: d.address_street,
        city: d.city,
        state: d.state,
        zipcode: d.zipcode,
        university: d.university,
        miles_to_campus: num(d.miles_to_campus),
        list_date: d.list_date || null,
        contract_date: d.contract_date || null,
        sale_date: d.sale_date || null,
        sale_price: price,
        beds: num(d.beds),
        baths: num(d.baths),
        living_area_sqft: sqft,
        year_built: num(d.year_built),
        valid,
        // Price per sq ft: only where living area is recorded and above zero
        ppsf: price != null && sqft != null && sqft > 0 ? price / sqft : null,
        // Days on market: contract date minus list date; null (never 0) when either is missing
        dom: listDay != null && contractDay != null ? contractDay - listDay : null,
        _search: [d.address_street, d.city, d.state, d.zipcode, d.listing_id].join(" ").toLowerCase(),
      };
    });
    VALID = ALL.filter((r) => r.valid);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    setupChartDefaults();
    setupNav();
    fillHeroAndMethod();
    initOverview();
    initUniversities();
    initSpotlight();
    initExplorer();
  }

  function setupChartDefaults() {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = C.text;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = "#0b2545";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 450;
  }

  function setupNav() {
    const nav = $("#site-nav"), btn = $(".nav-toggle");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
    }));
    if ("IntersectionObserver" in window) {
      const links = new Map(nav.querySelectorAll("a").length ? Array.from(nav.querySelectorAll("a")).map((a) => [a.getAttribute("href").slice(1), a]) : []);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((a) => a.classList.remove("active"));
            const a = links.get(e.target.id); if (a) a.classList.add("active");
          }
        });
      }, { rootMargin: "-40% 0px -55% 0px" });
      links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  function fillHeroAndMethod() {
    const dates = ALL.map((r) => r.sale_date).filter(Boolean).sort();
    setStat("hero-total", fmtInt(ALL.length));
    setStat("hero-cities", fmtInt(unique(ALL.map((r) => r.city + "|" + r.state)).length));
    setStat("hero-unis", fmtInt(unique(ALL.map((r) => r.university)).length));
    setStat("hero-from", fmtDateLong(dates[0]));
    setStat("hero-to", fmtDateLong(dates[dates.length - 1]));

    const low = ALL.filter((r) => r.sale_price != null && r.sale_price < PRICE_MIN).length;
    const high = ALL.filter((r) => r.sale_price != null && r.sale_price > PRICE_MAX).length;
    setStat("m-total", fmtInt(ALL.length));
    setStat("m-low", fmtInt(low));
    setStat("m-high", fmtInt(high));
    setStat("m-valid", fmtInt(VALID.length));
    setStat("m-sqft-missing", fmtInt(VALID.filter((r) => r.living_area_sqft == null).length));
    setStat("m-sqft-zero", fmtInt(VALID.filter((r) => r.living_area_sqft === 0).length));
    setStat("m-ppsf", fmtInt(VALID.filter((r) => r.ppsf != null).length));
    const domN = VALID.filter((r) => r.dom != null).length;
    setStat("m-dom", fmtInt(domN));
    setStat("m-dom-pct", fmtPct(domN / VALID.length) + " of the analysis set");
    setStat("m-ids", fmtInt(unique(ALL.map((r) => r.listing_id)).length));
  }

  function fillSelect(sel, options, allLabel) {
    const current = sel.value;
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    sel.value = options.some((o) => o.value === current) ? current : "";
  }

  const uniOptions = () => unique(ALL.map((r) => r.university)).sort((a, b) => shortUni(a).localeCompare(shortUni(b)))
    .map((u) => ({ value: u, label: u }));
  const cityOptions = (uni) => unique(ALL.filter((r) => !uni || r.university === uni).map((r) => r.city + ", " + r.state))
    .sort().map((c) => ({ value: c, label: c }));
  const cityKey = (r) => r.city + ", " + r.state;

  // ---------------------------------------------------------------------------
  // 1. Market overview
  // ---------------------------------------------------------------------------
  function initOverview() {
    const uSel = $("#ov-university"), cSel = $("#ov-city");
    fillSelect(uSel, uniOptions(), "All universities");
    fillSelect(cSel, cityOptions(""), "All cities");
    uSel.addEventListener("change", () => { fillSelect(cSel, cityOptions(uSel.value), "All cities"); renderOverview(); });
    cSel.addEventListener("change", renderOverview);
    $("#ov-reset").addEventListener("click", () => { uSel.value = ""; fillSelect(cSel, cityOptions(""), "All cities"); renderOverview(); });

    charts.trend = new Chart($("#chart-trend"), {
      data: { labels: [], datasets: [
        { type: "bar", label: "Sales", data: [], backgroundColor: C.navySoft, hoverBackgroundColor: "rgba(19,49,92,0.25)", borderRadius: 3, yAxisID: "y", order: 2 },
        { type: "line", label: "Median price", data: [], borderColor: C.navy, backgroundColor: C.navy, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.3, yAxisID: "y1", order: 1, spanGaps: true },
      ] },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: { tooltip: { callbacks: { label: (c) => c.dataset.yAxisID === "y1" ? ` Median price: ${fmtMoney(c.raw)}` : ` Sales: ${fmtInt(c.raw)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } },
          y: { position: "left", beginAtZero: true, grid: { color: C.grid }, title: { display: true, text: "Sales" } },
          y1: { position: "right", grid: { display: false }, ticks: { callback: (v) => fmtMoneyShort(v) }, title: { display: true, text: "Median price" } },
        },
      },
    });

    charts.dist = new Chart($("#chart-dist"), {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Share of sales", data: [], backgroundColor: C.navy, borderRadius: 3, categoryPercentage: 0.92, barPercentage: 0.95 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmtPct(c.raw / 100)} of sales (${fmtInt(c.dataset.counts[c.dataIndex])})` } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: (v) => v + "%" } },
        },
      },
    });

    renderOverview();
  }

  function renderOverview() {
    const u = $("#ov-university").value, c = $("#ov-city").value;
    const recorded = ALL.filter((r) => (!u || r.university === u) && (!c || cityKey(r) === c));
    const rows = recorded.filter((r) => r.valid);
    const s = summarize(rows);
    const excluded = recorded.length - rows.length;

    $("#kpi-sales").textContent = fmtInt(s.sales);
    $("#kpi-sales-note").textContent = excluded
      ? `${fmtInt(recorded.length)} recorded; ${fmtInt(excluded)} outside the $10K–$5M price rule`
      : `${fmtInt(recorded.length)} recorded; none outside the price rule`;
    $("#kpi-price").textContent = fmtMoney(s.medianPrice);
    $("#kpi-price-note").textContent = `Middle sale of ${fmtInt(s.sales)}`;
    $("#kpi-ppsf").textContent = s.medianPpsf == null ? "—" : fmtMoney(s.medianPpsf);
    $("#kpi-ppsf-note").textContent = `${fmtInt(s.ppsfN)} sales with living area recorded`;
    $("#kpi-dom").textContent = s.medianDom == null ? "—" : fmtDays(s.medianDom);
    $("#kpi-dom-note").textContent = `List to contract · ${fmtInt(s.domN)} sales with both dates (${fmtPct(s.domCoverage, 0)})`;

    // Monthly trend (rows without a sale date cannot be placed in a month)
    const byMonth = groupBy(rows.filter((r) => r.sale_date), (r) => r.sale_date.slice(0, 7));
    const months = monthRange(ALL);
    charts.trend.data.labels = months.map((m) => {
      const [y, mo] = m.split("-").map(Number);
      return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    });
    charts.trend.data.datasets[0].data = months.map((m) => (byMonth.get(m) || []).length);
    charts.trend.data.datasets[1].data = months.map((m) => median((byMonth.get(m) || []).map((r) => r.sale_price)));
    charts.trend.update();

    // Price distribution in $100K bands, with $1.5M+ grouped
    const bands = [];
    for (let lo = 0; lo < 1500000; lo += 100000) bands.push([lo, lo + 100000]);
    bands.push([1500000, Infinity]);
    const counts = bands.map(([lo, hi]) => rows.filter((r) => r.sale_price >= lo && r.sale_price < hi).length);
    charts.dist.data.labels = bands.map(([lo, hi]) => (hi === Infinity ? "$1.5M+" : lo === 0 ? "<$100K" : fmtMoneyShort(lo)));
    charts.dist.data.datasets[0].data = counts.map((n) => (rows.length ? (n / rows.length) * 100 : 0));
    charts.dist.data.datasets[0].counts = counts;
    charts.dist.update();
  }

  function monthRange(rows) {
    const ds = rows.map((r) => r.sale_date).filter(Boolean).sort();
    let [y, m] = ds[0].split("-").map(Number);
    const [y2, m2] = ds[ds.length - 1].split("-").map(Number);
    const out = [];
    while (y < y2 || (y === y2 && m <= m2)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 2. University comparison
  // ---------------------------------------------------------------------------
  let UNI_STATS = [];
  const UNI_METRICS = {
    medianPrice: { title: "Median sale price by campus area", fmt: fmtMoney, axis: fmtMoneyShort, sub: "Ranked from highest to lowest. Hover a bar for details." },
    medianPpsf: { title: "Median price per square foot by campus area", fmt: fmtMoney, axis: (v) => "$" + v, sub: "Sales with living area recorded and above zero." },
    medianDom: { title: "Median days on market by campus area", fmt: fmtDays, axis: (v) => v + "d", sub: "List date to contract date, sales with both dates only." },
    medianSqft: { title: "Median home size by campus area", fmt: (v) => fmtInt(v) + " sq ft", axis: (v) => fmtInt(v), sub: "Finished living area in square feet." },
  };

  function initUniversities() {
    UNI_STATS = Array.from(groupBy(VALID, (r) => r.university), ([name, rows]) => ({ name, short: shortUni(name), ...summarize(rows) }));

    charts.uni = new Chart($("#chart-uni"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, barPercentage: 0.78 }] },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => items[0].dataset.full[items[0].dataIndex], label: (c) => uniTooltip(c) } } },
        scales: { x: { beginAtZero: true, grid: { color: C.grid } }, y: { grid: { display: false }, ticks: { font: { weight: "600" } } } },
      },
    });

    const vol = [...UNI_STATS].sort((a, b) => b.sales - a.sales);
    charts.uniVol = new Chart($("#chart-uni-volume"), {
      type: "bar",
      data: { labels: vol.map((d) => d.short), datasets: [{ data: vol.map((d) => d.sales), backgroundColor: vol.map((d) => (d.name === UIUC ? C.orange : C.navyLight)), borderRadius: 4, barPercentage: 0.78, full: vol.map((d) => d.name) }] },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => items[0].dataset.full[items[0].dataIndex], label: (c) => ` ${fmtInt(c.raw)} sales (${fmtPct(c.raw / VALID.length)} of all)` } } },
        scales: { x: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: (v) => fmtInt(v) } }, y: { grid: { display: false }, ticks: { font: { weight: "600" } } } },
      },
    });

    $$("#uni-metric button").forEach((b) => b.addEventListener("click", () => {
      $$("#uni-metric button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      renderUniChart(b.dataset.metric);
    }));
    renderUniChart("medianPrice");
    setupSortableTable($("#uni-table"), UNI_STATS, renderUniTable, "medianPrice", "desc");
  }

  let uniMetric = "medianPrice";
  function uniTooltip(c) {
    const d = UNI_STATS.find((x) => x.name === c.dataset.full[c.dataIndex]);
    const lines = [` ${UNI_METRICS[uniMetric].fmt(c.raw)}`, ` ${fmtInt(d.sales)} sales`];
    if (uniMetric === "medianDom") lines.push(` Based on ${fmtInt(d.domN)} sales with both dates (${fmtPct(d.domCoverage, 0)})`);
    if (uniMetric === "medianPpsf") lines.push(` Based on ${fmtInt(d.ppsfN)} sales with living area`);
    return lines;
  }

  function renderUniChart(metric) {
    uniMetric = metric;
    const m = UNI_METRICS[metric];
    const data = [...UNI_STATS].sort((a, b) => b[metric] - a[metric]);
    $("#uni-chart-title").textContent = m.title;
    $("#uni-chart-sub").textContent = m.sub;
    const ds = charts.uni.data.datasets[0];
    charts.uni.data.labels = data.map((d) => d.short);
    ds.data = data.map((d) => d[metric]);
    ds.full = data.map((d) => d.name);
    ds.backgroundColor = data.map((d) => (d.name === UIUC ? C.orange : C.navy));
    charts.uni.options.scales.x.ticks = { callback: m.axis };
    charts.uni.update();
  }

  function renderUniTable(rows) {
    $("#uni-table tbody").innerHTML = rows.map((d) => `
      <tr class="${d.name === UIUC ? "highlight" : ""}">
        <td class="text">${escapeHtml(d.name)}</td>
        <td>${fmtInt(d.sales)}</td>
        <td>${fmtMoney(d.medianPrice)}</td>
        <td>${fmtMoney(d.medianPpsf)}</td>
        <td>${fmtInt(d.medianSqft)}</td>
        <td>${fmtDays(d.medianDom)}</td>
        <td>${fmtPct(d.domCoverage, 0)}</td>
        <td>${d.medianMiles == null ? "—" : d.medianMiles.toFixed(1)}</td>
      </tr>`).join("");
  }

  /** Click-to-sort for a summary table. */
  function setupSortableTable(table, data, render, key, dir) {
    const state = { key, dir };
    const apply = () => {
      const sorted = [...data].sort((a, b) => {
        const x = a[state.key], y = b[state.key];
        const cmp = typeof x === "string" ? x.localeCompare(y) : x - y;
        return state.dir === "asc" ? cmp : -cmp;
      });
      table.querySelectorAll("th").forEach((th) => {
        if (th.dataset.key === state.key) th.setAttribute("aria-sort", state.dir === "asc" ? "ascending" : "descending");
        else th.removeAttribute("aria-sort");
      });
      render(sorted);
    };
    table.querySelectorAll("th[data-key]").forEach((th) => th.addEventListener("click", () => {
      if (state.key === th.dataset.key) state.dir = state.dir === "asc" ? "desc" : "asc";
      else { state.key = th.dataset.key; state.dir = th.classList.contains("text") ? "asc" : "desc"; }
      apply();
    }));
    apply();
  }

  // ---------------------------------------------------------------------------
  // 3. Champaign–Urbana spotlight
  // ---------------------------------------------------------------------------
  function initSpotlight() {
    const uiucRows = VALID.filter((r) => r.university === UIUC);
    const others = VALID.filter((r) => r.university !== UIUC);
    const uiuc = summarize(uiucRows), other = summarize(others);
    const ranked = [...UNI_STATS].sort((a, b) => a.medianPrice - b.medianPrice);
    const rankLow = ranked.findIndex((d) => d.name === UIUC) + 1;
    const lowestText = (n) => (n === 1 ? "the lowest" : `the ${ordinal(n)}-lowest`);
    const rankText = lowestText(rankLow);
    const ppsfRank = [...UNI_STATS].sort((a, b) => a.medianPpsf - b.medianPpsf).findIndex((d) => d.name === UIUC) + 1;
    const diff = uiuc.medianPrice / other.medianPrice - 1;
    $("#cu-summary").textContent =
      `The University of Illinois campus area recorded ${fmtInt(uiuc.sales)} sales with a median price of ${fmtMoney(uiuc.medianPrice)}, ` +
      `${rankText} of the 11 campus areas and ${fmtPct(Math.abs(diff), 0)} ${diff < 0 ? "below" : "above"} the ${fmtMoney(other.medianPrice)} median across the other ten. ` +
      `Its median price per square foot, ${fmtMoney(uiuc.medianPpsf)}, is ${lowestText(ppsfRank)} of the 11.`;

    const cityStats = CU_CITIES.map((city) => {
      const rows = VALID.filter((r) => r.city === city && r.state === "IL");
      return { city, rows, ...summarize(rows), medianYear: median(rows.map((r) => r.year_built)) };
    });
    const cuTotal = cityStats.reduce((s, d) => s + d.sales, 0);

    $("#cu-cards").innerHTML = cityStats.map((d) => `
      <article class="city-card">
        <h3>${d.city} <small>IL</small></h3>
        <p class="big">${fmtMoney(d.medianPrice)}</p>
        <p class="big-label">Median sale price</p>
        <dl>
          <dt>Sales</dt><dd>${fmtInt(d.sales)} <span style="color:#8da9c4;font-weight:500">(${fmtPct(d.sales / cuTotal, 0)})</span></dd>
          <dt>Median $ / sq ft</dt><dd>${fmtMoney(d.medianPpsf)}</dd>
          <dt>Median size</dt><dd>${fmtInt(d.medianSqft)} sq ft</dd>
          <dt>Median days on market</dt><dd>${fmtDays(d.medianDom)}</dd>
          <dt>Days-on-market coverage</dt><dd>${fmtPct(d.domCoverage, 0)}</dd>
          <dt>Median year built</dt><dd>${d.medianYear == null ? "—" : Math.round(d.medianYear)}</dd>
          <dt>Median miles to campus</dt><dd>${d.medianMiles.toFixed(1)}</dd>
        </dl>
      </article>`).join("");

    charts.cu = new Chart($("#chart-cu"), {
      data: {
        labels: CU_CITIES,
        datasets: [
          { type: "bar", label: "Median sale price", data: cityStats.map((d) => d.medianPrice), backgroundColor: CU_CITIES.map((c) => C.cu[c]), borderRadius: 6, yAxisID: "y", barPercentage: 0.6, order: 2 },
          { type: "line", label: "Median $ / sq ft", data: cityStats.map((d) => d.medianPpsf), borderColor: C.orange, backgroundColor: C.orange, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2, yAxisID: "y1", order: 1 },
        ],
      },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.raw)}`, afterBody: (items) => ` ${fmtInt(cityStats[items[0].dataIndex].sales)} sales` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { weight: "600", size: 13 } } },
          y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: fmtMoneyShort }, title: { display: true, text: "Median sale price" } },
          y1: { position: "right", beginAtZero: true, grid: { display: false }, ticks: { callback: (v) => "$" + v }, title: { display: true, text: "Median $ / sq ft" } },
        },
      },
    });

    const buckets = [["0–7", 0, 7], ["8–30", 8, 30], ["31–90", 31, 90], ["91–180", 91, 180], ["181+", 181, Infinity]];
    charts.cuDom = new Chart($("#chart-cu-dom"), {
      type: "bar",
      data: {
        labels: buckets.map((b) => b[0] + " days"),
        datasets: cityStats.map((d) => {
          const dom = d.rows.filter((r) => r.dom != null).map((r) => r.dom);
          const counts = buckets.map(([, lo, hi]) => dom.filter((x) => x >= lo && x <= hi).length);
          return { label: `${d.city} (n = ${fmtInt(dom.length)})`, data: counts.map((n) => (n / dom.length) * 100), counts, backgroundColor: C.cu[d.city], borderRadius: 3 };
        }),
      },
      options: {
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label.split(" (")[0]}: ${fmtPct(c.raw / 100)} (${fmtInt(c.dataset.counts[c.dataIndex])} sales)` } } },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 0 } }, y: { beginAtZero: true, grid: { color: C.grid }, ticks: { callback: (v) => v + "%" } } },
      },
    });

    // All cities
    const allCities = Array.from(groupBy(VALID, cityKey), ([name, rows]) => ({ name, cu: rows[0].state === "IL" && CU_CITIES.includes(rows[0].city), uni: rows[0].university, ...summarize(rows) }));
    charts.cities = new Chart($("#chart-cities"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, barPercentage: 0.8 }] },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => cityTooltip(c, allCities) } } },
        scales: { x: { beginAtZero: true, grid: { color: C.grid } }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
      },
    });
    const renderCities = (metric) => {
      const data = [...allCities].sort((a, b) => b[metric] - a[metric]);
      const ds = charts.cities.data.datasets[0];
      charts.cities.data.labels = data.map((d) => d.name);
      ds.data = data.map((d) => d[metric]);
      ds.backgroundColor = data.map((d) => (d.cu ? C.orange : C.navyLight));
      ds.metric = metric;
      charts.cities.options.scales.x.ticks = { callback: metric === "sales" ? (v) => fmtInt(v) : metric === "medianPpsf" ? (v) => "$" + v : fmtMoneyShort };
      charts.cities.update();
    };
    $$("#city-metric button").forEach((b) => b.addEventListener("click", () => {
      $$("#city-metric button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      renderCities(b.dataset.metric);
    }));
    renderCities("medianPrice");
  }

  function cityTooltip(c, allCities) {
    const d = allCities.find((x) => x.name === c.label);
    const metric = c.dataset.metric;
    const main = metric === "sales" ? `${fmtInt(c.raw)} sales` : metric === "medianPpsf" ? `${fmtMoney(c.raw)} per sq ft` : `${fmtMoney(c.raw)} median price`;
    return [` ${main}`, ` Campus area: ${shortUni(d.uni)}`, metric === "sales" ? "" : ` ${fmtInt(d.sales)} sales`].filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // 4. Property explorer
  // ---------------------------------------------------------------------------
  const ex = { page: 0, sortKey: "sale_price", sortDir: "desc", results: [] };

  function initExplorer() {
    const uSel = $("#ex-university"), cSel = $("#ex-city");
    fillSelect(uSel, uniOptions(), "All universities");
    fillSelect(cSel, cityOptions(""), "All cities");
    uSel.addEventListener("change", () => { fillSelect(cSel, cityOptions(uSel.value), "All cities"); runExplorer(true); });

    const miles = $("#ex-miles");
    const maxMiles = Math.ceil(Math.max(...ALL.map((r) => r.miles_to_campus)) * 2) / 2;
    miles.max = String(maxMiles); miles.value = String(maxMiles);
    const updateMilesLabel = () => { $("#ex-miles-label").textContent = Number(miles.value) >= maxMiles ? "Any" : `${Number(miles.value).toFixed(1)} mi`; };
    miles.addEventListener("input", () => { updateMilesLabel(); runExplorerDebounced(true); });
    updateMilesLabel();

    ["#ex-city", "#ex-beds", "#ex-include-excluded"].forEach((s) => $(s).addEventListener("change", () => runExplorer(true)));
    ["#ex-search", "#ex-min", "#ex-max"].forEach((s) => $(s).addEventListener("input", () => runExplorerDebounced(true)));

    $("#ex-sort").addEventListener("change", (e) => {
      const [k, d] = e.target.value.split(":"); ex.sortKey = k; ex.sortDir = d; runExplorer(true);
    });
    $$("#ex-table th[data-sort]").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.sort;
      if (ex.sortKey === k) ex.sortDir = ex.sortDir === "asc" ? "desc" : "asc";
      else { ex.sortKey = k; ex.sortDir = th.classList.contains("text") ? "asc" : "desc"; }
      const opt = `${ex.sortKey}:${ex.sortDir}`;
      $("#ex-sort").value = Array.from($("#ex-sort").options).some((o) => o.value === opt) ? opt : $("#ex-sort").value;
      runExplorer(true);
    }));

    $("#ex-prev").addEventListener("click", () => { if (ex.page > 0) { ex.page--; renderExplorerPage(); } });
    $("#ex-next").addEventListener("click", () => { if ((ex.page + 1) * PAGE_SIZE < ex.results.length) { ex.page++; renderExplorerPage(); } });
    $("#ex-reset").addEventListener("click", () => {
      $("#ex-form").reset();
      fillSelect(cSel, cityOptions(""), "All cities");
      miles.value = String(maxMiles); updateMilesLabel();
      ex.sortKey = "sale_price"; ex.sortDir = "desc"; $("#ex-sort").value = "sale_price:desc";
      runExplorer(true);
    });
    $("#ex-download").addEventListener("click", downloadResults);

    runExplorer(true);
  }

  const runExplorerDebounced = debounce(runExplorer, 180);

  function runExplorer(resetPage) {
    const q = $("#ex-search").value.trim().toLowerCase();
    const u = $("#ex-university").value, c = $("#ex-city").value;
    const minP = $("#ex-min").value === "" ? null : Number($("#ex-min").value);
    const maxP = $("#ex-max").value === "" ? null : Number($("#ex-max").value);
    const beds = $("#ex-beds").value;
    const milesEl = $("#ex-miles");
    const maxMi = Number(milesEl.value) >= Number(milesEl.max) ? null : Number(milesEl.value);
    const includeExcluded = $("#ex-include-excluded").checked;
    const terms = q ? q.split(/\s+/) : [];

    const source = includeExcluded ? ALL : VALID;
    ex.results = source.filter((r) =>
      (!u || r.university === u) &&
      (!c || cityKey(r) === c) &&
      (minP == null || r.sale_price >= minP) &&
      (maxP == null || r.sale_price <= maxP) &&
      (!beds || (beds === "5+" ? r.beds >= 5 : r.beds === Number(beds))) &&
      (maxMi == null || r.miles_to_campus <= maxMi) &&
      (!terms.length || terms.every((t) => r._search.includes(t)))
    );

    const k = ex.sortKey, dir = ex.sortDir === "asc" ? 1 : -1;
    ex.results.sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;          // missing values always last
      if (y == null) return -1;
      const cmp = typeof x === "string" ? x.localeCompare(y) : x - y;
      return cmp * dir || a.listing_id.localeCompare(b.listing_id);
    });

    $$("#ex-table th[data-sort]").forEach((th) => {
      if (th.dataset.sort === k) th.setAttribute("aria-sort", ex.sortDir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });

    if (resetPage) ex.page = 0;
    const valid = ex.results.filter((r) => r.valid);
    const med = median(valid.map((r) => r.sale_price));
    const excludedShown = ex.results.length - valid.length;
    $("#ex-summary").innerHTML = ex.results.length
      ? `<strong>${fmtInt(ex.results.length)}</strong> matching sales · median price <strong>${fmtMoney(med)}</strong>` +
        ` · median $/sq ft <strong>${fmtMoney(median(valid.map((r) => r.ppsf)))}</strong>` +
        (excludedShown ? ` · includes ${fmtInt(excludedShown)} outside the price rule (not in the medians)` : "")
      : "No sales match these filters. Try widening the price range or distance.";
    renderExplorerPage();
  }

  function renderExplorerPage() {
    const start = ex.page * PAGE_SIZE;
    const page = ex.results.slice(start, start + PAGE_SIZE);
    const cell = (label, v, text) => (v == null ? `<td class="na" data-label="${label}">—</td>` : `<td data-label="${label}">${text}</td>`);
    $("#ex-table tbody").innerHTML = page.map((r) => `
      <tr>
        <td class="text cell-address" data-label="Address" title="${escapeHtml(r.address_street)} · listing ${escapeHtml(r.listing_id)}">${escapeHtml(r.address_street)}${r.valid ? "" : '<span class="tag">Outside price rule</span>'}</td>
        <td class="text" data-label="City">${escapeHtml(r.city)}, ${escapeHtml(r.state)} ${escapeHtml(r.zipcode || "")}</td>
        <td class="text" data-label="University">${escapeHtml(shortUni(r.university))}</td>
        ${cell("Sale date", r.sale_date, fmtDate(r.sale_date))}
        ${cell("Sale price", r.sale_price, fmtMoney(r.sale_price))}
        ${cell("Beds", r.beds, r.beds)}
        ${cell("Baths", r.baths, r.baths)}
        ${cell("Sq ft", r.living_area_sqft, fmtInt(r.living_area_sqft))}
        ${cell("$/sq ft", r.ppsf, fmtMoney(r.ppsf))}
        ${cell("Built", r.year_built, r.year_built)}
        ${cell("Miles", r.miles_to_campus, r.miles_to_campus.toFixed(1))}
        ${cell("Days on market", r.dom, fmtInt(r.dom))}
      </tr>`).join("");
    const pages = Math.max(1, Math.ceil(ex.results.length / PAGE_SIZE));
    $("#ex-page").textContent = ex.results.length
      ? `${fmtInt(start + 1)}–${fmtInt(start + page.length)} of ${fmtInt(ex.results.length)}`
      : "";
    $("#ex-prev").disabled = ex.page === 0;
    $("#ex-next").disabled = start + PAGE_SIZE >= ex.results.length;
  }

  function downloadResults() {
    const cols = ["listing_id", "address_street", "city", "state", "zipcode", "university", "miles_to_campus", "list_date", "contract_date", "sale_date", "sale_price", "beds", "baths", "living_area_sqft", "year_built"];
    const header = [...cols, "price_per_sqft", "days_on_market", "meets_price_rule"];
    const esc = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(",")].concat(ex.results.map((r) =>
      [...cols.map((c) => esc(r[c])), r.ppsf == null ? "" : r.ppsf.toFixed(2), esc(r.dom), r.valid ? "yes" : "no"].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "campus_housing_explorer_results.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  load();
})();
