const LS_KEY = 'ponto.state.v1';
const WD = ['日', '月', '火', '水', '木', '金', '土'];

const JP_HOLIDAYS = {
  '2026-01-01': '元日', '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日', '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日', '2026-05-06': '振替休日',
  '2026-07-20': '海の日', '2026-08-11': '山の日',
  '2026-09-21': '敬老の日', '2026-09-22': '国民の休日',
  '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
  '2027-01-01': '元日', '2027-01-11': '成人の日',
  '2027-02-11': '建国記念の日', '2027-02-23': '天皇誕生日',
  '2027-03-21': '春分の日', '2027-04-29': '昭和の日',
  '2027-05-03': '憲法記念日', '2027-05-04': 'みどりの日',
  '2027-05-05': 'こどもの日', '2027-07-19': '海の日',
  '2027-08-11': '山の日', '2027-09-20': '敬老の日',
  '2027-09-23': '秋分の日', '2027-10-11': 'スポーツの日',
  '2027-11-03': '文化の日', '2027-11-23': '勤労感謝の日',
};

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');

function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function keyOf(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }

function minutesFromTime(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function nowHHMM() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function durationMinutes(a, b) {
  const x = minutesFromTime(a), y = minutesFromTime(b);
  if (x == null || y == null) return null;
  let d = y - x;
  if (d <= 0) d += 1440;
  return d;
}

function fmtHM(min) {
  if (min == null || isNaN(min)) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}:${pad(m)}`;
}

function fmtYen(val) {
  if (val == null || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('ja-JP');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function defaultState() {
  return {
    profile: { name: 'クリハラ チアゴ', supervisor: '' },
    places: [
      { name: '日向電子所', hourlyRate: 1400, standardHours: 8, defaultBreak: 60, commuteDaily: 0 },
      { name: 'ダイフク', hourlyRate: 1450, standardHours: 8, defaultBreak: 60, commuteDaily: 0 }
    ],
    defaultPlace: '日向電子所',
    standardHours: 8,
    rates: {
      overtime: 0.25,      // +25% (125%)
      night: 0.25,         // +25% (125%)
      holiday: 0.35,       // +35% (135%)
      overtimeOver60: 0.50 // +50% (150%)
    },
    entries: {},
  };
}

let storageOk = true;

function normalizePlace(p) {
  if (typeof p === 'string') {
    return { name: p, hourlyRate: 1400, standardHours: 8, defaultBreak: 60, commuteDaily: 0 };
  }
  return {
    name: p.name || 'Local',
    hourlyRate: Number(p.hourlyRate) || 1400,
    standardHours: Number(p.standardHours) || 8,
    defaultBreak: p.defaultBreak != null ? Number(p.defaultBreak) : 60,
    commuteDaily: Number(p.commuteDaily) || 0
  };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const base = defaultState();
    
    // Migração de lugares caso seja array de strings
    let places = base.places;
    if (Array.isArray(s.places) && s.places.length > 0) {
      places = s.places.map(normalizePlace);
    }

    const rates = Object.assign({}, base.rates, s.rates || {});
    const profile = Object.assign({}, base.profile, s.profile || {});

    return {
      profile,
      places,
      defaultPlace: s.defaultPlace || (places[0] ? places[0].name : '日向電子所'),
      standardHours: Number(s.standardHours) || 8,
      rates,
      entries: s.entries || {}
    };
  } catch (e) {
    storageOk = false;
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    storageOk = false;
    $('#persistWarn').classList.remove('hidden');
  }
}

let state = load();
const ui = {
  tab: 'today',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  todayPlace: '',
  todayMark: '',
  editingPlaceIndex: -1
};

function getPlaceConfig(placeName) {
  const p = state.places.find((x) => x.name === placeName);
  if (p) return p;
  return {
    name: placeName || 'Padrão',
    hourlyRate: 1400,
    standardHours: state.standardHours || 8,
    defaultBreak: 60,
    commuteDaily: 0
  };
}

/* ---------- Cálculos da Legislação Trabalhista Japonesa ---------- */

function calcDayShift(entry, placeConfig, rates) {
  if (!entry || !entry.in || !entry.out) return null;
  const inMin = minutesFromTime(entry.in);
  let outMin = minutesFromTime(entry.out);
  if (inMin == null || outMin == null) return null;

  if (outMin <= inMin) outMin += 1440; // Turno noturno atravessando a meia-noite
  const totalSpan = outMin - inMin;

  const breakMin = (entry.break != null && entry.break !== '') ? Number(entry.break) : (placeConfig.defaultBreak || 60);
  const netWorkMin = Math.max(0, totalSpan - breakMin);

  const hourlyRate = (entry.rate != null && entry.rate !== '') ? Number(entry.rate) : placeConfig.hourlyRate;
  const standardMin = (placeConfig.standardHours || state.standardHours || 8) * 60;
  const isHoliday = !!entry.holiday;

  // Cálculo de minutos no horário noturno oficial (22:00 às 05:00)
  let grossNightMin = 0;
  for (let m = inMin; m < outMin; m++) {
    const mod = m % 1440;
    if (mod >= 1320 || mod < 300) { // 22:00 = 1320, 05:00 = 300
      grossNightMin++;
    }
  }

  // Desconto de descanso proporcional
  let netNightMin = grossNightMin;
  if (totalSpan > 0 && breakMin > 0 && grossNightMin > 0) {
    const nightRatio = grossNightMin / totalSpan;
    netNightMin = Math.max(0, Math.round(grossNightMin - (breakMin * nightRatio)));
  }

  let regularMin = 0;
  let overtimeMin = 0;

  if (isHoliday) {
    regularMin = 0;
    overtimeMin = 0;
  } else {
    regularMin = Math.min(netWorkMin, standardMin);
    overtimeMin = Math.max(0, netWorkMin - standardMin);
  }

  const ratePerMin = hourlyRate / 60;
  let basePay = 0;
  let overtimePay = 0;
  let nightPay = 0;
  let holidayPay = 0;

  if (isHoliday) {
    // 休日出勤: Horas trabalhadas com adicional de feriado (+35% ou taxa configurada)
    holidayPay = Math.round(netWorkMin * ratePerMin * (1 + rates.holiday));
    // Adicional noturno em feriado acumula (+25%)
    nightPay = Math.round(netNightMin * ratePerMin * rates.night);
  } else {
    // Horas normais
    basePay = Math.round(regularMin * ratePerMin);
    // Horas extras (+25%)
    overtimePay = Math.round(overtimeMin * ratePerMin * (1 + rates.overtime));
    // Adicional noturno (+25%)
    nightPay = Math.round(netNightMin * ratePerMin * rates.night);
  }

  const commute = (entry.in && entry.out) ? (placeConfig.commuteDaily || 0) : 0;
  const totalDayPay = basePay + overtimePay + nightPay + holidayPay + commute;

  return {
    totalSpan,
    breakMin,
    netWorkMin,
    regularMin,
    overtimeMin,
    nightMin: netNightMin,
    isHoliday,
    hourlyRate,
    basePay,
    overtimePay,
    nightPay,
    holidayPay,
    commute,
    totalDayPay
  };
}

function monthStats(year, month) {
  const days = new Date(year, month, 0).getDate();
  let workedDays = 0;
  let totalMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let holidayDays = 0;
  let holidayMinutes = 0;
  let nightShifts = 0;

  let totalBasePay = 0;
  let totalOvertimePay = 0;
  let totalNightPay = 0;
  let totalHolidayPay = 0;
  let totalCommute = 0;
  let weightedHourlyRates = 0;
  let totalPaidMinutes = 0;

  const rates = state.rates;

  for (let d = 1; d <= days; d++) {
    const key = keyOf(year, month, d);
    const e = state.entries[key];
    if (!e || (!e.in && !e.out)) continue;

    const placeConfig = getPlaceConfig(e.place || state.defaultPlace);
    const calc = calcDayShift(e, placeConfig, rates);
    if (!calc) continue;

    workedDays++;
    totalMinutes += calc.netWorkMin;
    regularMinutes += calc.regularMin;
    overtimeMinutes += calc.overtimeMin;
    nightMinutes += calc.nightMin;

    totalBasePay += calc.basePay;
    totalOvertimePay += calc.overtimePay;
    totalNightPay += calc.nightPay;
    totalHolidayPay += calc.holidayPay;
    totalCommute += calc.commute;

    weightedHourlyRates += calc.hourlyRate * calc.netWorkMin;
    totalPaidMinutes += calc.netWorkMin;

    if (calc.isHoliday) {
      holidayDays++;
      holidayMinutes += calc.netWorkMin;
    }

    if (minutesFromTime(e.out) <= minutesFromTime(e.in)) {
      nightShifts++;
    }
  }

  // Regra das 60h extras mensais (60時間超割増 - 労働基準法):
  // Horas extras acima de 60h ganham adicional maior (ex.: +50% em vez de +25%, gerando +25% de bônus adicional)
  let over60Minutes = 0;
  let over60Pay = 0;
  const avgHourlyRate = totalPaidMinutes > 0 ? (weightedHourlyRates / totalPaidMinutes) : 1400;

  if (overtimeMinutes > 3600) { // 60 horas = 3600 minutos
    over60Minutes = overtimeMinutes - 3600;
    const extraRateBonus = Math.max(0, rates.overtimeOver60 - rates.overtime);
    over60Pay = Math.round(over60Minutes * (avgHourlyRate / 60) * extraRateBonus);
  }

  const grandTotalSalary = totalBasePay + totalOvertimePay + totalNightPay + totalHolidayPay + over60Pay + totalCommute;

  return {
    workedDays,
    totalMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    holidayDays,
    holidayMinutes,
    nightShifts,
    totalBasePay,
    totalOvertimePay,
    totalNightPay,
    totalHolidayPay,
    over60Minutes,
    over60Pay,
    totalCommute,
    grandTotalSalary,
    avgHourlyRate
  };
}

function setEntry(key, patch) {
  const e = Object.assign({}, state.entries[key], patch);
  const meaningful = e.in || e.out || (e.note && e.note.trim()) || e.holiday;
  if (meaningful) state.entries[key] = e;
  else delete state.entries[key];
  save();
}

function findOpenShift() {
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const e = state.entries[k];
    if (e && e.in && !e.out) return k;
  }
  return null;
}

function renderOpenShift() {
  const box = $('#openShift');
  const k = findOpenShift();
  if (!k) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  const e = state.entries[k];
  box.classList.remove('hidden');
  box.innerHTML = `Turno em aberto: <b>${k}</b> — 出社 ${esc(e.in)}${e.place ? ` (${esc(e.place)})` : ''}
    <div class="actions" style="margin-top:8px"><button id="closeShift" class="btn primary">退社 agora / Registrar saída</button></div>`;
  $('#closeShift').onclick = () => {
    setEntry(k, { out: nowHHMM() });
    toast('Saída registrada');
    renderAll();
  };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2400);
}

/* ---------- Today Tab ---------- */

function renderToday() {
  const now = new Date();
  const key = dateKey(now);
  const e = state.entries[key] || {};
  ui.todayPlace = e.place || state.defaultPlace;
  ui.todayMark = e.mark || '';

  const placeConfig = getPlaceConfig(ui.todayPlace);

  $('#todayTitle').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  $('#todayWeekday').textContent = WD[now.getDay()] + '曜日';
  $('#inTime').value = e.in || '';
  $('#outTime').value = e.out || '';
  $('#breakTime').value = e.break != null ? e.break : (placeConfig.defaultBreak || 60);
  $('#todayRate').value = e.rate != null ? e.rate : '';
  $('#note').value = e.note || '';
  $('#holidayFlag').checked = !!e.holiday;

  renderPlaceChips();
  renderMarkChips();
  updatePunchButtons();
  renderTodaySummary();
  renderOpenShift();
}

function renderPlaceChips() {
  const c = $('#placeChips');
  c.innerHTML = '';
  state.places.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip place' + (p.name === ui.todayPlace ? ' active' : '');
    b.innerHTML = `${esc(p.name)} <small style="opacity:0.85">¥${p.hourlyRate}</small>`;
    b.onclick = () => {
      ui.todayPlace = p.name;
      const targetConfig = getPlaceConfig(p.name);
      if (!$('#todayRate').value || $('#todayRate').value == 0) {
        $('#breakTime').value = targetConfig.defaultBreak || 60;
      }
      renderPlaceChips();
      commitToday();
    };
    c.appendChild(b);
  });
}

function renderMarkChips() {
  document.querySelectorAll('#markChips .chip').forEach((b) => {
    b.classList.toggle('active', b.dataset.mark === ui.todayMark);
    b.onclick = () => {
      ui.todayMark = (ui.todayMark === b.dataset.mark) ? '' : b.dataset.mark;
      renderMarkChips();
      commitToday();
    };
  });
}

function updatePunchButtons() {
  const now = new Date();
  const key = dateKey(now);
  const e = state.entries[key] || {};
  $('#btnIn').classList.toggle('done', !!e.in);
  $('#btnOut').classList.toggle('done', !!e.out);
}

function renderTodaySummary() {
  const key = dateKey(new Date());
  const e = state.entries[key];
  const box = $('#todaySummary');
  if (!e || (!e.in && !e.out)) {
    box.innerHTML = '<span class="muted">Nenhum registro ainda hoje. Toque em 出社 (Entrada) ao iniciar.</span>';
    return;
  }

  const placeConfig = getPlaceConfig(e.place || state.defaultPlace);
  const calc = calcDayShift(e, placeConfig, state.rates);

  if (!calc) {
    box.innerHTML = `<div><span class="k">Entrada</span><b>${e.in || '—'}</b></div>
      <div><span class="k">Saída</span><b>${e.out || '—'}</b></div>
      <div><span class="k">Fábrica</span><b>${esc(placeConfig.name)} (¥${placeConfig.hourlyRate}/h)</b></div>`;
    return;
  }

  box.innerHTML = `
    <div><span class="k">Presença (拘束)</span><b>${fmtHM(calc.totalSpan)}</b></div>
    <div><span class="k">Descanso (休憩)</span><b>${calc.breakMin}m</b></div>
    <div><span class="k">Efetivo (実働)</span><b>${fmtHM(calc.netWorkMin)}</b></div>
    ${calc.overtimeMin > 0 ? `<div><span class="k">Horas Extras (+25%)</span><b style="color:#fbbf24">${fmtHM(calc.overtimeMin)}</b></div>` : ''}
    ${calc.nightMin > 0 ? `<div><span class="k">Noturno (+25%)</span><b style="color:#60a5fa">${fmtHM(calc.nightMin)}</b></div>` : ''}
    <div style="flex-basis: 100%; border-top: 1px dashed var(--line); padding-top: 6px; margin-top: 4px; display:flex; justify-content:space-between; align-items:center;">
      <span class="k" style="font-size:0.82rem;">Remuneração Estimada do Dia:</span>
      <b style="color:#38bdf8; font-size:1.15rem;">¥ ${fmtYen(calc.totalDayPay)}</b>
    </div>
  `;
}

function commitToday() {
  const key = dateKey(new Date());
  setEntry(key, {
    in: $('#inTime').value || '',
    out: $('#outTime').value || '',
    break: $('#breakTime').value !== '' ? Number($('#breakTime').value) : null,
    rate: $('#todayRate').value !== '' ? Number($('#todayRate').value) : null,
    place: ui.todayPlace || state.defaultPlace,
    mark: ui.todayMark || '',
    holiday: $('#holidayFlag').checked,
    note: $('#note').value || '',
  });
  updatePunchButtons();
  renderTodaySummary();
}

/* ---------- Month Tab ---------- */

function renderMonth() {
  const { year, month } = ui;
  $('#monthLabel').textContent = `${year}年 ${month}月`;
  $('#salaryMonthLabel').textContent = `${year}年 ${month}月度`;

  const st = monthStats(year, month);

  // Card de Salário
  $('#salaryTotalAmount').textContent = fmtYen(st.grandTotalSalary);

  const breakdownBox = $('#salaryBreakdownList');
  breakdownBox.innerHTML = `
    <div class="salary-item">
      <div class="k"><span>基本給 (Base)</span> <span class="rate-badge">100%</span></div>
      <div class="v">¥ ${fmtYen(st.totalBasePay)}</div>
      <span class="sub">${fmtHM(st.regularMinutes)} (${st.workedDays} dias)</span>
    </div>
    <div class="salary-item">
      <div class="k"><span>残業手当 (Extra)</span> <span class="rate-badge amber">+${Math.round(state.rates.overtime * 100)}%</span></div>
      <div class="v">¥ ${fmtYen(st.totalOvertimePay)}</div>
      <span class="sub">${fmtHM(st.overtimeMinutes)}</span>
    </div>
    <div class="salary-item">
      <div class="k"><span>深夜手当 (Noturno)</span> <span class="rate-badge">+${Math.round(state.rates.night * 100)}%</span></div>
      <div class="v">¥ ${fmtYen(st.totalNightPay)}</div>
      <span class="sub">${fmtHM(st.nightMinutes)} (22h-5h)</span>
    </div>
    <div class="salary-item">
      <div class="k"><span>休日手当 (Feriado)</span> <span class="rate-badge red">+${Math.round(state.rates.holiday * 100)}%</span></div>
      <div class="v">¥ ${fmtYen(st.totalHolidayPay)}</div>
      <span class="sub">${fmtHM(st.holidayMinutes)} (${st.holidayDays} dias)</span>
    </div>
    ${st.over60Pay > 0 ? `
    <div class="salary-item" style="grid-column: span 2;">
      <div class="k"><span>60時間超割増 (Extra >60h)</span> <span class="rate-badge red">+${Math.round(state.rates.overtimeOver60 * 100)}%</span></div>
      <div class="v">¥ ${fmtYen(st.over60Pay)}</div>
      <span class="sub">${fmtHM(st.over60Minutes)} além de 60h</span>
    </div>` : ''}
    ${st.totalCommute > 0 ? `
    <div class="salary-item" style="grid-column: span 2;">
      <div class="k"><span>交通費 (Transporte)</span> <span class="rate-badge green">非課税</span></div>
      <div class="v">¥ ${fmtYen(st.totalCommute)}</div>
      <span class="sub">Total no mês</span>
    </div>` : ''}
  `;

  // Grid de Estatísticas Gerais
  const statsBox = $('#monthStats');
  statsBox.innerHTML = `
    <div class="stat green"><div class="v">${st.workedDays}</div><div class="k">出勤日数 (Dias Trabalhados)</div></div>
    <div class="stat"><div class="v">${fmtHM(st.totalMinutes)}</div><div class="k">総実働時間 (Horas Totais)</div></div>
    <div class="stat amber"><div class="v">${fmtHM(st.overtimeMinutes)}</div><div class="k">時間外 (Horas Extras)</div></div>
    <div class="stat"><div class="v">${st.nightShifts}</div><div class="k">夜勤回数 (Plantões Noturnos)</div></div>
  `;

  renderDayList(year, month);
}

function renderDayList(year, month) {
  const list = $('#dayList');
  list.innerHTML = '';
  const days = new Date(year, month, 0).getDate();

  for (let d = 1; d <= days; d++) {
    const key = keyOf(year, month, d);
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const hol = JP_HOLIDAYS[key];
    const e = state.entries[key] || {};

    const placeConfig = getPlaceConfig(e.place || state.defaultPlace);
    const calc = calcDayShift(e, placeConfig, state.rates);

    const el = document.createElement('div');
    let cls = 'day';
    if (dow === 6) cls += ' sat';
    if (dow === 0) cls += ' sun';
    if (hol) cls += ' holiday';
    el.className = cls;
    el.dataset.key = key;

    let mainText = '';
    if (e.in || e.out) {
      const dur = durationMinutes(e.in, e.out);
      mainText = `<b>${e.in || '—'}</b> 〜 <b>${e.out || '—'}</b>`;
      if (dur != null) mainText += ` <span class="muted">(${fmtHM(dur)})</span>`;
      if (e.place) mainText += ` <span class="pill" style="font-size:0.7rem; padding:1px 6px;">${esc(e.place)}</span>`;
      if (calc) mainText += ` <span style="color:#38bdf8; font-weight:700; font-size:0.8rem; margin-left:auto;">¥${fmtYen(calc.totalDayPay)}</span>`;
    } else if (e.note) {
      mainText = `<span class="muted">${esc(e.note)}</span>`;
    } else {
      mainText = `<span class="day-empty">—</span>`;
    }

    el.innerHTML = `
      <div class="day-head">
        <span class="day-num">${d}</span>
        <span class="day-wd">${WD[dow]}</span>
        <div class="day-main" style="display:flex; align-items:center; gap:6px;">${mainText}</div>
        ${e.mark ? `<span class="pill" style="font-size:0.75rem; padding:2px 8px;">${e.mark}</span>` : ''}
      </div>
      <div class="day-body">
        <div class="grid2">
          <label class="field"><span>出社時 / Entrada</span><input type="time" class="d-in" value="${e.in || ''}"></label>
          <label class="field"><span>退社時 / Saída</span><input type="time" class="d-out" value="${e.out || ''}"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>休憩 / Descanso (min)</span><input type="number" class="d-break" value="${e.break != null ? e.break : placeConfig.defaultBreak}" step="15"></label>
          <label class="field"><span>時給 / Taxa (¥)</span><input type="number" class="d-rate" value="${e.rate || ''}" placeholder="${placeConfig.hourlyRate}"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>主な行き先 / Local</span>
            <select class="d-place">
              ${state.places.map((p) => `<option value="${esc(p.name)}" ${(e.place || state.defaultPlace) === p.name ? 'selected' : ''}>${esc(p.name)} (¥${p.hourlyRate})</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>勤怠 / Marca</span>
            <select class="d-mark">
              <option value="">(nenhuma)</option>
              <option value="○" ${e.mark === '○' ? 'selected' : ''}>○ 出勤</option>
              <option value="△" ${e.mark === '△' ? 'selected' : ''}>△ 半休</option>
              <option value="×" ${e.mark === '×' ? 'selected' : ''}>× 欠勤</option>
            </select>
          </label>
        </div>
        <label class="field switch" style="margin-bottom:12px;">
          <input type="checkbox" class="d-hol" ${e.holiday ? 'checked' : ''}>
          <span>休日出勤 (Trabalho em feriado/folga +35%)</span>
        </label>
        <label class="field"><span>備考 / Observações</span><input type="text" class="d-note" value="${esc(e.note || '')}"></label>
        <div class="actions">
          <button class="btn primary d-save">Salvar Dia</button>
          <button class="btn ghost danger d-clear">Limpar</button>
        </div>
      </div>
    `;

    const head = el.querySelector('.day-head');
    head.onclick = () => el.classList.toggle('open');

    el.querySelector('.d-save').onclick = () => {
      const p = el.querySelector('.d-place').value;
      const bk = el.querySelector('.d-break').value;
      const rt = el.querySelector('.d-rate').value;
      setEntry(key, {
        in: el.querySelector('.d-in').value || '',
        out: el.querySelector('.d-out').value || '',
        break: bk !== '' ? Number(bk) : null,
        rate: rt !== '' ? Number(rt) : null,
        place: p,
        mark: el.querySelector('.d-mark').value || '',
        holiday: el.querySelector('.d-hol').checked,
        note: el.querySelector('.d-note').value || '',
      });
      toast(`Dia ${d} salvo`);
      renderMonth();
      if (key === dateKey(new Date())) renderToday();
    };

    el.querySelector('.d-clear').onclick = () => {
      setEntry(key, { in: '', out: '', break: null, rate: null, mark: '', holiday: false, note: '' });
      toast(`Dia ${d} limpo`);
      renderMonth();
      if (key === dateKey(new Date())) renderToday();
    };

    list.appendChild(el);
  }
}

/* ---------- Config Tab & Factory Manager ---------- */

function renderConfig() {
  $('#cfgName').value = state.profile.name || '';
  $('#cfgSupervisor').value = state.profile.supervisor || '';

  // Alíquotas
  $('#rateOvertime').value = Math.round((state.rates.overtime || 0.25) * 100);
  $('#rateNight').value = Math.round((state.rates.night || 0.25) * 100);
  $('#rateHoliday').value = Math.round((state.rates.holiday || 0.35) * 100);
  $('#rateOver60').value = Math.round((state.rates.overtimeOver60 || 0.50) * 100);

  renderPlacesManager();
}

function renderPlacesManager() {
  const box = $('#placesListContainer');
  box.innerHTML = '';

  state.places.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'place-card-item';
    card.innerHTML = `
      <div class="place-card-top">
        <span class="place-card-title">${esc(p.name)}</span>
        <span class="pill" style="color:#38bdf8; font-weight:700;">¥ ${p.hourlyRate} / h</span>
      </div>
      <div class="place-card-meta">
        <span>Jornada: <b>${p.standardHours}h/dia</b></span>
        <span>Descanso: <b>${p.defaultBreak || 60}m</b></span>
        ${p.commuteDaily ? `<span>Transporte: <b>¥${p.commuteDaily}/dia</b></span>` : ''}
      </div>
      <div class="place-card-actions">
        <button class="btn ghost p-edit" style="padding:6px 12px; font-size:0.8rem; min-height:36px;">Editar</button>
        ${state.places.length > 1 ? `<button class="btn ghost danger p-del" style="padding:6px 12px; font-size:0.8rem; min-height:36px;">Remover</button>` : ''}
      </div>
    `;

    card.querySelector('.p-edit').onclick = () => {
      openPlaceForm(idx);
    };

    const delBtn = card.querySelector('.p-del');
    if (delBtn) {
      delBtn.onclick = () => {
        if (confirm(`Remover "${p.name}"?`)) {
          state.places.splice(idx, 1);
          if (state.defaultPlace === p.name) state.defaultPlace = state.places[0].name;
          save();
          renderConfig();
          renderPlaceChips();
        }
      };
    }

    box.appendChild(card);
  });
}

function openPlaceForm(index = -1) {
  ui.editingPlaceIndex = index;
  const form = $('#placeForm');
  form.classList.remove('hidden');

  if (index >= 0) {
    const p = state.places[index];
    $('#placeFormTitle').textContent = `Editar: ${p.name}`;
    $('#pfName').value = p.name;
    $('#pfRate').value = p.hourlyRate;
    $('#pfHours').value = p.standardHours;
    $('#pfBreak').value = p.defaultBreak != null ? p.defaultBreak : 60;
    $('#pfCommute').value = p.commuteDaily || 0;
  } else {
    $('#placeFormTitle').textContent = 'Nova Fábrica / Local';
    $('#pfName').value = '';
    $('#pfRate').value = '1400';
    $('#pfHours').value = '8';
    $('#pfBreak').value = '60';
    $('#pfCommute').value = '0';
  }
}

function closePlaceForm() {
  $('#placeForm').classList.add('hidden');
  ui.editingPlaceIndex = -1;
}

/* ---------- Exportação Excel Completa (3 Abas) ---------- */

async function exportXlsx() {
  if (typeof ExcelJS === 'undefined') {
    alert('Biblioteca ExcelJS não encontrada');
    return;
  }

  const { year, month } = ui;
  const days = new Date(year, month, 0).getDate();
  const wb = new ExcelJS.Workbook();
  wb.creator = state.profile.name || '出勤簿アプリ';
  wb.created = new Date();

  const border = {
    top: { style: 'thin', color: { argb: 'FF888888' } },
    left: { style: 'thin', color: { argb: 'FF888888' } },
    bottom: { style: 'thin', color: { argb: 'FF888888' } },
    right: { style: 'thin', color: { argb: 'FF888888' } },
  };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  const satFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
  const redFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
  const center = { vertical: 'middle', horizontal: 'center' };
  const left = { vertical: 'middle', horizontal: 'left' };
  const right = { vertical: 'middle', horizontal: 'right' };

  /* ===== ABA 1: 出勤簿 (Layout Oficial) ===== */
  const ws1 = wb.addWorksheet('出勤簿');
  ws1.columns = [
    { width: 5 }, { width: 10 }, { width: 10 }, { width: 22 }, { width: 11 }, { width: 32 },
  ];

  ws1.mergeCells('A1:B1');
  ws1.getCell('A1').value = `${year} 年`;
  ws1.getCell('A1').alignment = left;
  ws1.getCell('A1').font = { size: 12 };
  ws1.getCell('C1').value = month;
  ws1.getCell('C1').alignment = center;
  ws1.getCell('D1').value = '月度';
  ws1.getCell('D1').alignment = left;
  ws1.getCell('E1').value = '所属長';
  ws1.getCell('E1').font = { size: 9 };
  ws1.getCell('E1').alignment = center;
  ws1.getCell('F1').value = state.profile.supervisor || '';
  ws1.getCell('F1').font = { size: 11 };

  ws1.mergeCells('A3:F3');
  const title = ws1.getCell('A3');
  title.value = '出 勤 簿';
  title.font = { size: 20, bold: true };
  title.alignment = center;
  ws1.getRow(3).height = 34;

  ws1.mergeCells('A4:F4');
  const nm = ws1.getCell('A4');
  nm.value = state.profile.name || '';
  nm.font = { size: 12 };
  nm.alignment = center;

  const headers = ['日', '出社時', '退社時', '主な行き先', '勤怠', '備考'];
  const hrow = ws1.getRow(5);
  headers.forEach((h, i) => {
    const c = hrow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = center;
    c.fill = headFill;
    c.border = border;
  });
  hrow.height = 22;

  for (let d = 1; d <= days; d++) {
    const row = ws1.getRow(5 + d);
    const date = new Date(year, month - 1, d);
    const key = keyOf(year, month, d);
    const dow = date.getDay();
    const hol = JP_HOLIDAYS[key];
    const isRed = dow === 0 || !!hol;
    const isSat = dow === 6;
    const fill = isRed ? redFill : (isSat ? satFill : null);

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.border = border;
      cell.alignment = center;
      if (fill) cell.fill = fill;
    }
    row.getCell(1).value = d;
    row.getCell(1).font = { bold: true };

    const e = state.entries[key];
    if (e) {
      if (e.holiday) {
        const dur = durationMinutes(e.in, e.out);
        row.getCell(5).value = dur != null ? fmtHM(dur) : '';
        row.getCell(5).font = { color: { argb: 'FFB45309' }, bold: true };
        row.getCell(6).value = [e.in && e.out ? `${e.in}〜${e.out}` : '', e.note || ''].filter(Boolean).join('   ');
        row.getCell(6).alignment = left;
      } else {
        row.getCell(2).value = e.in || '';
        row.getCell(3).value = e.out || '';
        row.getCell(4).value = e.place || '';
        row.getCell(4).alignment = left;
        const mk = e.mark || ((e.in || e.out) ? '○' : '');
        row.getCell(5).value = mk;
        if (mk === '×') row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true };
        else if (mk === '△') row.getCell(5).font = { color: { argb: 'FFB45309' }, bold: true };
        row.getCell(6).value = e.note || '';
        row.getCell(6).alignment = left;
      }
    }
    row.height = 20;
  }

  const notes = [
    '① 勤怠欄には、出勤⇒○、半休⇒△、休暇・欠勤⇒×を記入してください。',
    '② 休日出勤時は勤怠欄に実働時間を記入し、備考欄に出退勤時間を記入してください。',
    '③ 休日部分は色分けをして区別できるようにしてください。',
    '④ 毎月締日の翌日に各所属長に提出してください。',
  ];
  let nr = 5 + days + 2;
  notes.forEach((t, i) => {
    ws1.mergeCells(`A${nr + i}:F${nr + i}`);
    const c = ws1.getCell(`A${nr + i}`);
    c.value = t;
    c.font = { size: 9, color: { argb: 'FF555555' } };
    c.alignment = left;
  });

  ws1.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws1.views = [{ state: 'frozen', ySplit: 5 }];

  /* ===== ABA 2: 集計 (Resumo Geral) ===== */
  const st = monthStats(year, month);
  const ws2 = wb.addWorksheet('集計');
  ws2.columns = [{ width: 28 }, { width: 22 }];
  const rows2 = [
    ['月度', `${year}年${month}月`],
    ['氏名', state.profile.name || ''],
    ['所属長 / 派遣元', state.profile.supervisor || ''],
    ['出勤日数', `${st.workedDays} 日`],
    ['総実働時間', fmtHM(st.totalMinutes)],
    ['所定内時間 (通常)', fmtHM(st.regularMinutes)],
    ['時間外合計 (残業)', fmtHM(st.overtimeMinutes)],
    ['深夜労働時間 (22h〜5h)', fmtHM(st.nightMinutes)],
    ['休日出勤日数', `${st.holidayDays} 日`],
    ['休日出勤時間', fmtHM(st.holidayMinutes)],
    ['夜勤回数 (日跨ぎ)', `${st.nightShifts} 回`],
    ['推定総支給額', `¥ ${fmtYen(st.grandTotalSalary)}`],
    ['作成日時', new Date().toLocaleString('ja-JP')],
  ];
  rows2.forEach((r, i) => {
    const row = ws2.getRow(i + 1);
    row.getCell(1).value = r[0];
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = r[1];
    row.height = 22;
  });

  /* ===== ABA 3: 給与明細概算 (Demonstrativo Salarial Conforme Leis Japonesas) ===== */
  const ws3 = wb.addWorksheet('給与明細概算');
  ws3.columns = [
    { width: 6 },  // 日
    { width: 6 },  // 曜日
    { width: 18 }, // 工場/派遣先
    { width: 10 }, // 出社
    { width: 10 }, // 退社
    { width: 8 },  // 休憩(分)
    { width: 10 }, // 実働時間
    { width: 10 }, // 残業時間
    { width: 10 }, // 深夜時間
    { width: 12 }, // 時給(¥)
    { width: 14 }, // 日給概算(¥)
  ];

  ws3.mergeCells('A1:K1');
  const hTitle = ws3.getCell('A1');
  hTitle.value = `${year}年${month}月度 給与明細概算 (労働基準法準拠)`;
  hTitle.font = { size: 16, bold: true };
  hTitle.alignment = center;
  ws3.getRow(1).height = 30;

  const sHeaders = ['日', '曜日', '工場 / 勤務先', '出社', '退社', '休憩', '実働', '残業', '深夜', '基本時給', '概算日給'];
  const shRow = ws3.getRow(3);
  sHeaders.forEach((h, i) => {
    const c = shRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 9 };
    c.alignment = center;
    c.fill = headFill;
    c.border = border;
  });
  shRow.height = 22;

  for (let d = 1; d <= days; d++) {
    const row = ws3.getRow(3 + d);
    const date = new Date(year, month - 1, d);
    const key = keyOf(year, month, d);
    const dow = date.getDay();
    const hol = JP_HOLIDAYS[key];
    const isRed = dow === 0 || !!hol;
    const isSat = dow === 6;
    const fill = isRed ? redFill : (isSat ? satFill : null);

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.border = border;
      cell.alignment = center;
      if (fill) cell.fill = fill;
    }

    row.getCell(1).value = d;
    row.getCell(2).value = WD[dow];

    const e = state.entries[key];
    if (e && (e.in || e.out)) {
      const placeConfig = getPlaceConfig(e.place || state.defaultPlace);
      const calc = calcDayShift(e, placeConfig, state.rates);

      row.getCell(3).value = placeConfig.name;
      row.getCell(3).alignment = left;
      row.getCell(4).value = e.in || '';
      row.getCell(5).value = e.out || '';

      if (calc) {
        row.getCell(6).value = `${calc.breakMin}m`;
        row.getCell(7).value = fmtHM(calc.netWorkMin);
        row.getCell(8).value = calc.overtimeMin > 0 ? fmtHM(calc.overtimeMin) : '—';
        row.getCell(9).value = calc.nightMin > 0 ? fmtHM(calc.nightMin) : '—';
        row.getCell(10).value = calc.hourlyRate;
        row.getCell(10).alignment = right;
        row.getCell(11).value = calc.totalDayPay;
        row.getCell(11).font = { bold: true };
        row.getCell(11).alignment = right;
      }
    }
    row.height = 19;
  }

  // Bloco de Totais e Resumo das Porcentagens Legais
  let sumRowIdx = 3 + days + 2;
  const salarySum = [
    ['【給与内訳項目】', '【計算式・割増率】', '【金額 (円)】'],
    ['基本給 (所定内労働時間)', `${fmtHM(st.regularMinutes)} × 平均時給 ¥${Math.round(st.avgHourlyRate)}`, st.totalBasePay],
    [`時間外手当 (残業 +${Math.round(state.rates.overtime * 100)}%)`, `${fmtHM(st.overtimeMinutes)} × 1.25割増`, st.totalOvertimePay],
    [`深夜手当 (22時〜5時 +${Math.round(state.rates.night * 100)}%)`, `${fmtHM(st.nightMinutes)} × 0.25割増`, st.totalNightPay],
    [`休日手当 (法定休日 +${Math.round(state.rates.holiday * 100)}%)`, `${fmtHM(st.holidayMinutes)} × 1.35割増`, st.totalHolidayPay],
    ['60時間超残業割増 (+50%)', `${fmtHM(st.over60Minutes)} × 1.50割増差分`, st.over60Pay],
    ['通勤手当 (交通費)', `${st.workedDays} 日分`, st.totalCommute],
    ['総支給額 (概算総額)', '控除前総額 (Bruto)', st.grandTotalSalary],
  ];

  salarySum.forEach((sr, idx) => {
    const row = ws3.getRow(sumRowIdx + idx);
    row.getCell(2).value = sr[0];
    row.getCell(3).value = sr[1];
    row.getCell(4).value = typeof sr[2] === 'number' ? `¥ ${fmtYen(sr[2])}` : sr[2];

    const isHeader = idx === 0;
    const isTotal = idx === salarySum.length - 1;

    for (let c = 2; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.border = border;
      if (isHeader) {
        cell.fill = headFill;
        cell.font = { bold: true };
        cell.alignment = center;
      } else if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.font = { bold: true, size: 12 };
        if (c === 4) cell.alignment = right;
      } else {
        if (c === 4) cell.alignment = right;
      }
    }
    row.height = isTotal ? 26 : 21;
  });

  const buf = await wb.xlsx.writeBuffer();
  download(`出勤簿_${year}-${pad(month)}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  toast('Relatório Excel completo gerado!');
}

function exportCsv() {
  const { year, month } = ui;
  const days = new Date(year, month, 0).getDate();
  const rows = [
    [`${year}年${month}月度 出勤簿・給与概算`],
    ['日', '曜日', '出社時', '退社時', '休憩(分)', '工場/勤務先', '勤怠', '実働時間', '残業時間', '深夜時間', '概算日給(円)', '備考']
  ];

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d);
    const key = keyOf(year, month, d);
    const e = state.entries[key] || {};
    const placeConfig = getPlaceConfig(e.place || state.defaultPlace);
    const calc = calcDayShift(e, placeConfig, state.rates);

    rows.push([
      d,
      WD[date.getDay()],
      e.in || '',
      e.out || '',
      calc ? calc.breakMin : '',
      e.place || '',
      e.mark || ((e.in || e.out) ? '○' : ''),
      calc ? fmtHM(calc.netWorkMin) : '',
      calc && calc.overtimeMin > 0 ? fmtHM(calc.overtimeMin) : '',
      calc && calc.nightMin > 0 ? fmtHM(calc.nightMin) : '',
      calc ? calc.totalDayPay : '',
      e.note || ''
    ]);
  }

  const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(`shukkinbo_${year}-${pad(month)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  toast('CSV gerado');
}

function download(filename, blob) {
  if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result || '').split(',')[1];
      window.AndroidBridge.saveFile(filename, base64, blob.type);
    };
    reader.readAsDataURL(blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 4000);
}

/* ---------- Inicialização e Eventos ---------- */

function renderAll() {
  renderToday();
  renderMonth();
  renderConfig();
}

function switchTab(name) {
  ui.tab = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'month') renderMonth();
  if (name === 'config') renderConfig();
  if (name === 'today') renderToday();
}

function updateClock() {
  const d = new Date();
  $('#liveClock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#liveDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WD[d.getDay()]})`;
}

function init() {
  if (!storageOk) $('#persistWarn').classList.remove('hidden');

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#btnIn').onclick = () => {
    $('#inTime').value = nowHHMM();
    if (!ui.todayMark) ui.todayMark = '○';
    renderMarkChips();
    commitToday();
  };

  $('#btnOut').onclick = () => {
    $('#outTime').value = nowHHMM();
    if (!ui.todayMark) ui.todayMark = '○';
    renderMarkChips();
    commitToday();
  };

  $('#inTime').onchange = commitToday;
  $('#outTime').onchange = commitToday;
  $('#breakTime').onchange = commitToday;
  $('#todayRate').onchange = commitToday;
  $('#holidayFlag').onchange = commitToday;
  $('#note').onchange = commitToday;

  $('#saveToday').onclick = () => {
    commitToday();
    toast('Dia salvo com sucesso!');
  };

  $('#clearToday').onclick = () => {
    const k = dateKey(new Date());
    setEntry(k, { in: '', out: '', break: null, rate: null, mark: '', holiday: false, note: '' });
    renderToday();
    toast('Dia limpo');
  };

  $('#prevMonth').onclick = () => {
    ui.month--;
    if (ui.month < 1) {
      ui.month = 12;
      ui.year--;
    }
    renderMonth();
  };

  $('#nextMonth').onclick = () => {
    ui.month++;
    if (ui.month > 12) {
      ui.month = 1;
      ui.year++;
    }
    renderMonth();
  };

  $('#exportXlsx').onclick = exportXlsx;
  $('#exportCsv').onclick = exportCsv;

  $('#saveConfig').onclick = () => {
    state.profile.name = $('#cfgName').value.trim();
    state.profile.supervisor = $('#cfgSupervisor').value.trim();
    save();
    toast('Perfil salvo');
  };

  // Botões de gerenciamento de fábrica
  $('#btnNewPlace').onclick = () => openPlaceForm(-1);
  $('#btnCancelPlace').onclick = closePlaceForm;

  $('#btnSavePlace').onclick = () => {
    const name = $('#pfName').value.trim();
    const rate = Number($('#pfRate').value) || 1400;
    const hours = Number($('#pfHours').value) || 8;
    const brk = Number($('#pfBreak').value) || 60;
    const commute = Number($('#pfCommute').value) || 0;

    if (!name) {
      alert('Informe o nome da fábrica');
      return;
    }

    if (ui.editingPlaceIndex >= 0) {
      state.places[ui.editingPlaceIndex] = {
        name,
        hourlyRate: rate,
        standardHours: hours,
        defaultBreak: brk,
        commuteDaily: commute
      };
      toast(`Fábrica "${name}" atualizada!`);
    } else {
      state.places.push({
        name,
        hourlyRate: rate,
        standardHours: hours,
        defaultBreak: brk,
        commuteDaily: commute
      });
      toast(`Fábrica "${name}" adicionada!`);
    }

    save();
    closePlaceForm();
    renderConfig();
    renderPlaceChips();
  };

  // Alíquotas Legais Japonesas
  $('#saveRates').onclick = () => {
    state.rates = {
      overtime: (Number($('#rateOvertime').value) || 25) / 100,
      night: (Number($('#rateNight').value) || 25) / 100,
      holiday: (Number($('#rateHoliday').value) || 35) / 100,
      overtimeOver60: (Number($('#rateOver60').value) || 50) / 100,
    };
    save();
    renderMonth();
    renderTodaySummary();
    toast('Alíquotas da lei atualizadas!');
  };

  // Backup
  $('#backupJson').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    download(`ponto_backup_${dateKey(new Date())}.json`, blob);
    toast('Backup exportado');
  };

  $('#importJson').onchange = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d && (d.entries || d.profile)) {
          state = Object.assign(defaultState(), d);
          if (Array.isArray(state.places)) {
            state.places = state.places.map(normalizePlace);
          }
          save();
          renderAll();
          toast('Backup importado com sucesso!');
        } else {
          alert('Arquivo de backup inválido');
        }
      } catch (e) {
        alert('Erro ao ler JSON: ' + e.message);
      }
    };
    r.readAsText(f);
  };

  $('#loadSample').onclick = () => {
    if (!confirm('Carregar mês de exemplo (junho/2026)? Seus dados atuais serão mantidos, mas dias de 2026-06 serão preenchidos.')) return;
    
    // Adiciona fábricas de exemplo se não existirem
    if (!state.places.some(p => p.name === '日向電子所')) {
      state.places.push({ name: '日向電子所', hourlyRate: 1400, standardHours: 8, defaultBreak: 60, commuteDaily: 500 });
    }
    if (!state.places.some(p => p.name === 'ダイフク')) {
      state.places.push({ name: 'ダイフク', hourlyRate: 1550, standardHours: 8, defaultBreak: 60, commuteDaily: 600 });
    }

    for (let d = 1; d <= 30; d++) {
      const dt = new Date(2026, 5, d);
      const dow = dt.getDay();
      const k = keyOf(2026, 6, d);
      if (dow === 0 || dow === 6) continue; // folga

      // Alterna entre dia normal e turno com hora extra
      if (d % 4 === 0) {
        state.entries[k] = { in: '08:30', out: '20:30', break: 60, place: 'ダイフク', mark: '○', holiday: false, note: '殘業2.5h' };
      } else if (d % 7 === 0) {
        state.entries[k] = { in: '20:00', out: '06:00', break: 60, place: '日向電子所', mark: '○', holiday: false, note: '夜勤' };
      } else {
        state.entries[k] = { in: '08:30', out: '17:30', break: 60, place: '日向電子所', mark: '○', holiday: false, note: '' };
      }
    }

    save();
    ui.year = 2026;
    ui.month = 6;
    switchTab('month');
    toast('Exemplo de Junho/2026 carregado!');
  };

  $('#wipeAll').onclick = () => {
    if (!confirm('ATENÇÃO: Isso apagará TODOS os registros de ponto salvos. Deseja continuar?')) return;
    if (!confirm('Tem certeza absoluta? Essa ação não pode ser desfeita.')) return;
    state = defaultState();
    save();
    renderAll();
    toast('Todos os dados foram apagados');
  };

  updateClock();
  setInterval(updateClock, 1000);
  renderAll();
}

window.addEventListener('DOMContentLoaded', init);
