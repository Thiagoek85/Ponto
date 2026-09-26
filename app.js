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
  if (min == null) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}:${pad(m)}`;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function defaultState() {
  return {
    profile: { name: 'クリハラ チアゴ', supervisor: '' },
    places: ['日向電子所', 'ダイフク'],
    defaultPlace: '日向電子所',
    standardHours: 8,
    entries: {},
  };
}

let storageOk = true;
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const base = defaultState();
    return Object.assign(base, s, { profile: Object.assign(base.profile, s.profile || {}) });
  } catch (e) { storageOk = false; return defaultState(); }
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { storageOk = false; $('#persistWarn').classList.remove('hidden'); }
}

let state = load();
const ui = { tab: 'today', year: new Date().getFullYear(), month: new Date().getMonth() + 1, todayPlace: '', todayMark: '' };
let lastTodayKey = dateKey(new Date());

function setEntry(key, patch) {
  const e = Object.assign({}, state.entries[key], patch);
  const meaningful = e.in || e.out || (e.note && e.note.trim()) || e.holiday;
  if (meaningful) state.entries[key] = e; else delete state.entries[key];
  save();
}

function monthStats(year, month) {
  const days = new Date(year, month, 0).getDate();
  let workedDays = 0, totalMinutes = 0, overtimeMinutes = 0, nightShifts = 0, holidayDays = 0;
  const std = state.standardHours * 60;
  for (let d = 1; d <= days; d++) {
    const e = state.entries[keyOf(year, month, d)];
    if (!e) continue;
    if (e.in || e.out) {
      workedDays++;
      const dur = durationMinutes(e.in, e.out);
      if (dur != null) {
        totalMinutes += dur;
        if (dur > std) overtimeMinutes += dur - std;
        if (minutesFromTime(e.out) <= minutesFromTime(e.in)) nightShifts++;
      }
    }
    if (e.holiday) holidayDays++;
  }
  return { workedDays, totalMinutes, overtimeMinutes, nightShifts, holidayDays };
}

function findOpenShift() {
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const e = state.entries[k];
    if (e && e.in && !e.out) return k;
  }
  return null;
}

function renderOpenShift() {
  const box = $('#openShift');
  const k = findOpenShift();
  if (!k) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const e = state.entries[k];
  box.classList.remove('hidden');
  box.innerHTML = `Turno em aberto: <b>${k}</b> — 出社 ${esc(e.in)}${e.place ? ` (${esc(e.place)})` : ''}
    <div class="actions" style="margin-top:8px"><button id="closeShift" class="btn primary">退社 agora / Registrar saída</button></div>`;
  $('#closeShift').onclick = () => { setEntry(k, { out: nowHHMM() }); toast('Saída registrada'); renderAll(); };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------- Today ---------- */

function renderToday() {
  const now = new Date();
  const key = dateKey(now);
  const e = state.entries[key] || {};
  ui.todayPlace = e.place || state.defaultPlace;
  ui.todayMark = e.mark || '';

  $('#todayTitle').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  $('#todayWeekday').textContent = WD[now.getDay()] + '曜日';
  $('#inTime').value = e.in || '';
  $('#outTime').value = e.out || '';
  $('#note').value = e.note || '';
  $('#holidayFlag').checked = !!e.holiday;

  renderPlaceChips();
  renderMarkChips();
  updatePunchButtons();
  renderTodaySummary();
  renderOpenShift();
}

function renderPlaceChips() {
  const box = $('#placeChips');
  box.innerHTML = '';
  state.places.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip' + (p === ui.todayPlace ? ' active' : '');
    b.textContent = p;
    b.onclick = () => { ui.todayPlace = p; renderPlaceChips(); commitToday(); };
    box.appendChild(b);
  });
}

function renderMarkChips() {
  document.querySelectorAll('#markChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.mark === ui.todayMark);
  });
}

function updatePunchButtons() {
  const hasIn = !!$('#inTime').value;
  const hasOut = !!$('#outTime').value;
  $('#btnIn').classList.toggle('done', hasIn);
  $('#btnOut').classList.toggle('done', hasOut);
}

function renderTodaySummary() {
  const dur = durationMinutes($('#inTime').value, $('#outTime').value);
  const std = state.standardHours * 60;
  const ot = dur != null && dur > std ? dur - std : 0;
  const night = dur != null && minutesFromTime($('#outTime').value) <= minutesFromTime($('#inTime').value);
  $('#todaySummary').innerHTML = `
    <div><span class="k">実働 / Trabalhado</span><b>${dur != null ? fmtHM(dur) : '—'}</b></div>
    <div><span class="k">時間外 / Extra</span><b>${ot ? fmtHM(ot) : '—'}</b></div>
    <div><span class="k">夜勤 / Noturno</span><b>${night ? 'Sim' : '—'}</b></div>
    <div><span class="k">勤怠 / Marca</span><b>${esc(ui.todayMark || (dur != null ? '○' : '—'))}</b></div>`;
}

function commitToday(silent) {
  const key = dateKey(new Date());
  const inV = $('#inTime').value || '';
  const outV = $('#outTime').value || '';
  const note = $('#note').value || '';
  const holiday = $('#holidayFlag').checked;
  let mark = ui.todayMark || '';
  if (!mark && (inV || outV) && !holiday) mark = '○';
  setEntry(key, { in: inV, out: outV, place: ui.todayPlace, mark, note, holiday });
  updatePunchButtons();
  renderTodaySummary();
  if (!silent) toast('Dia salvo');
}

/* ---------- Month ---------- */

function renderMonth() {
  const { year, month } = ui;
  const days = new Date(year, month, 0).getDate();
  $('#monthLabel').textContent = `${year}年 ${month}月`;
  const st = monthStats(year, month);
  $('#monthStats').innerHTML = `
    <div class="stat green"><div class="v">${st.workedDays}</div><div class="k">出勤日数 / Dias</div></div>
    <div class="stat"><div class="v">${fmtHM(st.totalMinutes)}</div><div class="k">総労働 / Total</div></div>
    <div class="stat amber"><div class="v">${st.overtimeMinutes ? fmtHM(st.overtimeMinutes) : '—'}</div><div class="k">時間外 / Extra</div></div>
    <div class="stat red"><div class="v">${st.holidayDays}</div><div class="k">休日出勤 / Feriados</div></div>`;

  const list = $('#dayList');
  list.innerHTML = '';
  const placeOpts = ['', ...state.places].map((p) => `<option value="${esc(p)}">${p ? esc(p) : '—'}</option>`).join('');
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const key = keyOf(year, month, d);
    const e = state.entries[key] || {};
    const hol = JP_HOLIDAYS[key];
    const cls = ['day'];
    if (hol) cls.push('holiday'); else if (dow === 0) cls.push('sun'); else if (dow === 6) cls.push('sat');

    let main = '<span class="day-empty">—</span>';
    if (e.in || e.out) {
      const dur = durationMinutes(e.in, e.out);
      main = `<b>${esc(e.in || '--:--')}</b> → <b>${esc(e.out || '--:--')}</b>
        <span class="ph">${esc(e.place || '')}</span>
        ${dur != null ? `<span class="ph">(${fmtHM(dur)})</span>` : ''}
        ${e.note ? `<div class="nt">${esc(e.note)}</div>` : ''}`;
    } else if (e.note) {
      main = `<span class="nt">${esc(e.note)}</span>`;
    }

    const el = document.createElement('div');
    el.className = cls.join(' ');
    el.innerHTML = `
      <div class="day-head" data-toggle="${d}">
        <div class="day-num">${d}</div>
        <div class="day-wd">${WD[dow]}</div>
        <div class="day-main">${main}</div>
        ${hol ? `<span class="pill">${esc(hol)}</span>` : ''}
      </div>
      <div class="day-body">
        <div class="grid2">
          <label class="field"><span>出社 / Entrada</span><input type="time" data-day="${d}" data-f="in" value="${esc(e.in || '')}"></label>
          <label class="field"><span>退社 / Saída</span><input type="time" data-day="${d}" data-f="out" value="${esc(e.out || '')}"></label>
        </div>
        <label class="field"><span>行き先 / Local</span><select data-day="${d}" data-f="place">${placeOpts}</select></label>
        <div class="grid2">
          <label class="field"><span>勤怠 / Marca</span>
            <select data-day="${d}" data-f="mark">
              <option value="">—</option>
              <option value="○">○ 出勤</option>
              <option value="△">△ 半休</option>
              <option value="×">× 欠勤</option>
            </select>
          </label>
          <label class="field switch" style="margin-top:22px"><input type="checkbox" data-day="${d}" data-f="holiday"><span>休日出勤</span></label>
        </div>
        <label class="field"><span>備考 / Observações</span><input type="text" data-day="${d}" data-f="note" value="${esc(e.note || '')}"></label>
      </div>`;
    el.querySelector('[data-f="place"]').value = e.place || '';
    el.querySelector('[data-f="mark"]').value = e.mark || '';
    el.querySelector('[data-f="holiday"]').checked = !!e.holiday;
    list.appendChild(el);
  }
}

function onMonthEdit(ev) {
  const f = ev.target.dataset.f;
  if (!f) return;
  const d = +ev.target.dataset.day;
  const key = keyOf(ui.year, ui.month, d);
  let val;
  if (ev.target.type === 'checkbox') val = ev.target.checked;
  else val = ev.target.value;
  setEntry(key, { [f]: val });
  if (f === 'in' || f === 'out') {
    const cur = state.entries[key] || {};
    if ((cur.in || cur.out) && !cur.mark) setEntry(key, { mark: '○' });
  }
  const card = ev.target.closest('.day');
  const main = card.querySelector('.day-main');
  const e = state.entries[key] || {};
  if (e.in || e.out) {
    const dur = durationMinutes(e.in, e.out);
    main.innerHTML = `<b>${esc(e.in || '--:--')}</b> → <b>${esc(e.out || '--:--')}</b>
      <span class="ph">${esc(e.place || '')}</span>${dur != null ? ` <span class="ph">(${fmtHM(dur)})</span>` : ''}
      ${e.note ? `<div class="nt">${esc(e.note)}</div>` : ''}`;
  } else if (e.note) {
    main.innerHTML = `<span class="nt">${esc(e.note)}</span>`;
  } else {
    main.innerHTML = '<span class="day-empty">—</span>';
  }
  const st = monthStats(ui.year, ui.month);
  const stats = $('#monthStats').children;
  stats[0].querySelector('.v').textContent = st.workedDays;
  stats[1].querySelector('.v').textContent = fmtHM(st.totalMinutes);
  stats[2].querySelector('.v').textContent = st.overtimeMinutes ? fmtHM(st.overtimeMinutes) : '—';
  stats[3].querySelector('.v').textContent = st.holidayDays;
}

/* ---------- Config ---------- */

function renderConfig() {
  $('#cfgName').value = state.profile.name || '';
  $('#cfgSupervisor').value = state.profile.supervisor || '';
  $('#cfgHours').value = state.standardHours;
  const box = $('#cfgPlaces');
  box.innerHTML = '';
  state.places.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip remove';
    b.textContent = p + '  ✕';
    b.onclick = () => {
      state.places = state.places.filter((x) => x !== p);
      if (state.defaultPlace === p) state.defaultPlace = state.places[0] || '';
      save(); renderConfig(); renderPlaceChips();
    };
    box.appendChild(b);
  });
}

/* ---------- Export XLSX ---------- */

async function exportXlsx() {
  const { year, month } = ui;
  const days = new Date(year, month, 0).getDate();
  const wb = new ExcelJS.Workbook();
  wb.creator = state.profile.name || '出勤簿';
  wb.created = new Date();

  const ws = wb.addWorksheet('出勤簿', { properties: { defaultRowHeight: 20 } });
  ws.columns = [{ width: 6 }, { width: 11 }, { width: 11 }, { width: 26 }, { width: 9 }, { width: 32 }];

  const thin = { style: 'thin', color: { argb: 'FF9AA5B1' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const center = { vertical: 'middle', horizontal: 'center' };
  const left = { vertical: 'middle', horizontal: 'left' };
  const satFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
  const redFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4E4' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };

  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = `${year} 年`;
  ws.getCell('A1').alignment = left;
  ws.getCell('A1').font = { size: 12 };
  ws.getCell('C1').value = month;
  ws.getCell('C1').alignment = center;
  ws.getCell('D1').value = '月度';
  ws.getCell('D1').alignment = left;
  ws.getCell('E1').value = '所属長';
  ws.getCell('E1').font = { size: 9 };
  ws.getCell('E1').alignment = center;
  ws.getCell('F1').value = state.profile.supervisor || '';
  ws.getCell('F1').font = { size: 11 };

  ws.mergeCells('A3:F3');
  const title = ws.getCell('A3');
  title.value = '出 勤 簿';
  title.font = { size: 20, bold: true };
  title.alignment = center;
  ws.getRow(3).height = 34;

  ws.mergeCells('A4:F4');
  const nm = ws.getCell('A4');
  nm.value = state.profile.name || '';
  nm.font = { size: 12 };
  nm.alignment = center;

  const headers = ['日', '出社時', '退社時', '主な行き先', '勤怠', '備考'];
  const hrow = ws.getRow(5);
  headers.forEach((h, i) => {
    const c = hrow.getCell(i + 1);
    c.value = h; c.font = { bold: true, size: 10 }; c.alignment = center; c.fill = headFill; c.border = border;
  });
  hrow.height = 22;

  for (let d = 1; d <= days; d++) {
    const row = ws.getRow(5 + d);
    const date = new Date(year, month - 1, d);
    const key = keyOf(year, month, d);
    const dow = date.getDay();
    const hol = JP_HOLIDAYS[key];
    const isRed = dow === 0 || !!hol;
    const isSat = dow === 6;
    const fill = isRed ? redFill : (isSat ? satFill : null);
    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.border = border; cell.alignment = center;
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
    ws.mergeCells(`A${nr + i}:F${nr + i}`);
    const c = ws.getCell(`A${nr + i}`);
    c.value = t; c.font = { size: 9, color: { argb: 'FF555555' } }; c.alignment = left;
  });

  ws.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  const st = monthStats(year, month);
  const ws2 = wb.addWorksheet('集計');
  ws2.columns = [{ width: 26 }, { width: 20 }];
  const rows = [
    ['月', `${year}年${month}月`],
    ['氏名', state.profile.name || ''],
    ['所属長', state.profile.supervisor || ''],
    ['出勤日数', st.workedDays],
    ['総労働時間', fmtHM(st.totalMinutes)],
    ['時間外合計', st.overtimeMinutes ? fmtHM(st.overtimeMinutes) : '0:00'],
    ['夜勤回数', st.nightShifts],
    ['休日出勤日数', st.holidayDays],
    ['作成日', dateKey(new Date())],
  ];
  rows.forEach((r, i) => {
    const row = ws2.getRow(i + 1);
    row.getCell(1).value = r[0]; row.getCell(1).font = { bold: true };
    row.getCell(2).value = r[1];
  });

  const buf = await wb.xlsx.writeBuffer();
  download(`shukkinbo_${year}-${pad(month)}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  toast('Excel gerado');
}

function exportCsv() {
  const { year, month } = ui;
  const days = new Date(year, month, 0).getDate();
  const rows = [[`${year}年${month}月度 出勤簿`], ['日', '出社時', '退社時', '主な行き先', '勤怠', '備考']];
  for (let d = 1; d <= days; d++) {
    const e = state.entries[keyOf(year, month, d)] || {};
    rows.push([d, e.in || '', e.out || '', e.place || '', e.mark || ((e.in || e.out) ? '○' : ''), e.note || '']);
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
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}

/* ---------- Backup ---------- */

function backupJson() {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
  download(`ponto_backup_${dateKey(new Date())}.json`, new Blob([data], { type: 'application/json' }));
  toast('Backup exportado');
}

function importJson(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const parsed = JSON.parse(fr.result);
      const incoming = parsed.state || parsed;
      if (!incoming || !incoming.entries) throw new Error('formato');
      state = Object.assign(defaultState(), incoming, { profile: Object.assign(defaultState().profile, incoming.profile || {}) });
      save(); renderAll();
      toast('Backup restaurado');
    } catch (e) { toast('Arquivo inválido'); }
  };
  fr.readAsText(file);
}

function loadSample() {
  const data = {
    '2026-06-01': ['06:45', '20:15', '日向電子所'], '2026-06-02': ['06:45', '20:15', '日向電子所'],
    '2026-06-03': ['06:45', '18:15', '日向電子所'], '2026-06-04': ['06:45', '20:15', '日向電子所'],
    '2026-06-05': ['06:45', '18:15', '日向電子所'],
    '2026-06-08': ['06:45', '18:15', '日向電子所'], '2026-06-09': ['06:45', '18:15', '日向電子所'],
    '2026-06-10': ['06:45', '18:15', '日向電子所'], '2026-06-11': ['06:45', '18:15', '日向電子所'],
    '2026-06-12': ['06:45', '18:15', '日向電子所'],
    '2026-06-15': ['18:30', '06:30', 'ダイフク'], '2026-06-16': ['18:30', '07:15', 'ダイフク'],
    '2026-06-17': ['18:30', '06:30', 'ダイフク'], '2026-06-18': ['18:30', '06:30', 'ダイフク'],
    '2026-06-19': ['18:30', '07:30', 'ダイフク'],
    '2026-06-22': ['06:45', '18:15', '日向電子所'], '2026-06-23': ['06:45', '18:15', '日向電子所'],
    '2026-06-24': ['06:45', '18:15', '日向電子所'], '2026-06-25': ['06:45', '18:15', '日向電子所'],
    '2026-06-26': ['12:00', '18:15', '日向電子所'],
    '2026-06-29': ['06:45', '18:15', '日向電子所'], '2026-06-30': ['06:45', '18:15', '日向電子所'],
  };
  Object.entries(data).forEach(([k, v]) => {
    setEntry(k, { in: v[0], out: v[1], place: v[2], mark: '○', note: '', holiday: false });
  });
  save(); renderAll();
  toast('Exemplo de junho/2026 carregado');
}

/* ---------- Wiring ---------- */

function renderAll() { renderToday(); renderMonth(); renderConfig(); }

function switchTab(name) {
  ui.tab = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'month') renderMonth();
  if (name === 'config') renderConfig();
  if (name === 'today') renderToday();
}

function tick() {
  const now = new Date();
  $('#liveClock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('#liveDate').textContent = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} (${WD[now.getDay()]})`;
  const k = dateKey(now);
  if (k !== lastTodayKey) { lastTodayKey = k; renderToday(); }
}

function init() {
  if (!storageOk) $('#persistWarn').classList.remove('hidden');

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#btnIn').onclick = () => { $('#inTime').value = nowHHMM(); if (!ui.todayMark) ui.todayMark = '○'; renderMarkChips(); commitToday(); };
  $('#btnOut').onclick = () => {
    const open = findOpenShift();
    if (!$('#inTime').value && open) {
      setEntry(open, { out: nowHHMM() });
      toast('Saída registrada no turno de ' + open);
      renderAll();
      return;
    }
    $('#outTime').value = nowHHMM();
    commitToday();
  };
  $('#inTime').addEventListener('change', () => commitToday(true));
  $('#outTime').addEventListener('change', () => commitToday(true));
  $('#note').addEventListener('input', () => commitToday(true));
  $('#holidayFlag').addEventListener('change', () => commitToday(true));
  document.querySelectorAll('#markChips .chip').forEach((c) => {
    c.onclick = () => { ui.todayMark = (ui.todayMark === c.dataset.mark) ? '' : c.dataset.mark; renderMarkChips(); commitToday(); };
  });
  $('#addPlace').onclick = () => {
    const v = $('#newPlace').value.trim();
    if (!v) return;
    if (!state.places.includes(v)) state.places.push(v);
    ui.todayPlace = v; $('#newPlace').value = '';
    save(); renderPlaceChips(); renderConfig(); commitToday();
  };
  $('#saveToday').onclick = () => commitToday();
  $('#clearToday').onclick = () => {
    if (!confirm('Limpar os dados de hoje?')) return;
    delete state.entries[dateKey(new Date())]; save(); renderToday(); toast('Dia limpo');
  };

  $('#prevMonth').onclick = () => { ui.month--; if (ui.month < 1) { ui.month = 12; ui.year--; } renderMonth(); };
  $('#nextMonth').onclick = () => { ui.month++; if (ui.month > 12) { ui.month = 1; ui.year++; } renderMonth(); };
  $('#dayList').addEventListener('click', (ev) => {
    const h = ev.target.closest('[data-toggle]');
    if (h) h.closest('.day').classList.toggle('open');
  });
  $('#dayList').addEventListener('change', onMonthEdit);
  $('#exportXlsx').onclick = () => exportXlsx().catch((e) => { console.error(e); toast('Erro ao gerar Excel'); });
  $('#exportCsv').onclick = exportCsv;

  $('#saveConfig').onclick = () => {
    state.profile.name = $('#cfgName').value.trim();
    state.profile.supervisor = $('#cfgSupervisor').value.trim();
    const h = parseFloat($('#cfgHours').value);
    state.standardHours = (h > 0 && h <= 24) ? h : 8;
    save(); renderAll(); toast('Configurações salvas');
  };
  $('#backupJson').onclick = backupJson;
  $('#importJson').addEventListener('change', (ev) => { if (ev.target.files[0]) importJson(ev.target.files[0]); ev.target.value = ''; });
  $('#loadSample').onclick = loadSample;
  $('#wipeAll').onclick = () => {
    if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
    state = defaultState(); save(); renderAll(); toast('Dados apagados');
  };

  renderAll();
  tick();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
