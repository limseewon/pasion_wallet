/* ═══════════════════════════════════════════════
   파시온 회계장부 2026 — app.js (Google Sheets 연동)
   
   ★ SCRIPT_URL에 Apps Script 배포 URL을 붙여넣으세요
   ═══════════════════════════════════════════════ */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyP6N6m_nsV64IGsd3U5bbAt031d2eTm9Stt-Yj3iauHvwLnxtZGoX3rskwl0lx4pQ/exec";

const FEE = { 직장인: 400000, 학생: 240000 };

const INIT_MEMBERS = [
  { name: "오민구", type: "직장인", payStatus: "완납", paid: 400000, active: true, note: "" },
  { name: "이경민", type: "직장인", payStatus: "완납", paid: 400000, active: true, note: "" },
  { name: "김채린", type: "직장인", payStatus: "완납", paid: 400000, active: true, note: "" },
  { name: "김재중", type: "직장인", payStatus: "완납", paid: 400000, active: true, note: "" },
  { name: "김서연", type: "직장인", payStatus: "완납", paid: 400000, active: true, note: "" },
  { name: "성규빈", type: "직장인", payStatus: "반납", paid: 0, active: true, note: "20만 반납" },
  { name: "임시원", type: "직장인", payStatus: "분할", paid: 66000, active: true, note: "총무" },
  { name: "조승완", type: "학생", payStatus: "분할", paid: 20000, active: true, note: "" },
  { name: "윤석현", type: "학생", payStatus: "분할", paid: 20000, active: true, note: "" },
  { name: "임규태", type: "학생", payStatus: "분할", paid: 20000, active: true, note: "" },
  { name: "허혁", type: "학생", payStatus: "분할", paid: 20000, active: true, note: "" },
  { name: "나성우", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "김영준", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "한태건", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "문정규", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "이창기", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "한승훈", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "한재연", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "김문정", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "황태호", type: "직장인", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "이현수", type: "학생", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "이봉수", type: "학생", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "지경서", type: "학생", payStatus: "미납", paid: 0, active: true, note: "" },
  { name: "임정석", type: "직장인", payStatus: "미납", paid: 0, active: false, note: "청주" },
  { name: "신상원", type: "학생", payStatus: "미납", paid: 0, active: false, note: "군인" },
];

const BADGE_MAP = {
  완납: "badge-paid", 미납: "badge-unpaid", 분할: "badge-partial",
  반납: "badge-refund", 일시정지: "badge-paused"
};
const STATUS_CYCLE = ["재직중", "휴직중", "퇴직", "재학중", "졸업", "휴학중"];

const won = n => Number(n || 0).toLocaleString("ko-KR") + "원";
const wonShort = n => {
  const v = Math.abs(n), sign = n < 0 ? "-" : "";
  return sign + (v >= 10000 ? (v / 10000).toFixed(0) + "만원" : v.toLocaleString("ko-KR") + "원");
};
const defStatus = m => m.type === "직장인" ? "재직중" : "재학중";

function calcPaid(m) { return Number(m.paid || 0); }
function calcMissing(m) { return Math.max(0, FEE[m.type] - calcPaid(m)); }

/* ── DB (로컬스토리지 + 구글 시트 동기화) ── */
let db = { members: [] };

function initLocalDB() {
  return { members: INIT_MEMBERS.map(m => ({ status: defStatus(m), ...m })) };
}

function loadLocalDB() {
  try {
    const raw = localStorage.getItem("pasion2026");
    if (!raw) return initLocalDB();
    const saved = JSON.parse(raw);
    const names = new Set(saved.members.map(m => m.name));
    INIT_MEMBERS.forEach(nm => {
      if (!names.has(nm.name)) saved.members.push({ status: defStatus(nm), ...nm });
    });
    return saved;
  } catch (e) { return initLocalDB(); }
}

function saveLocal() {
  localStorage.setItem("pasion2026", JSON.stringify(db));
}

/* ── 구글 시트 연동 ── */
function isScriptReady() {
  return SCRIPT_URL && !SCRIPT_URL.includes("여기에");
}

async function loadFromSheet() {
  if (!isScriptReady()) return false;
  setStatus("🔄 구글 시트에서 불러오는 중...");
  try {
    const res = await fetch(SCRIPT_URL + "?action=load");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.members && data.members.length > 0) {
      db.members = data.members;
      saveLocal();
      setStatus("✅ 구글 시트 연동됨");
      return true;
    }
    // 시트가 비어있으면 로컬 데이터로 시트 초기화
    await saveToSheet();
    setStatus("✅ 구글 시트에 초기 데이터 저장됨");
    return true;
  } catch (e) {
    setStatus("⚠️ 시트 연결 실패 — 로컬 데이터 사용 중");
    return false;
  }
}

async function saveToSheet() {
  if (!isScriptReady()) return;
  try {
    const params = new URLSearchParams({
      action: "save",
      members: JSON.stringify(db.members)
    });
    await fetch(SCRIPT_URL, { method: "POST", body: params });
  } catch (e) {
    console.warn("시트 저장 실패:", e);
  }
}

async function saveDB() {
  saveLocal();
  await saveToSheet();
}

/* ── UI 상태 표시 ── */
function setStatus(msg) {
  const el = document.getElementById("sync-status");
  if (el) el.textContent = msg;
}

/* ── RENDER ── */
function render() { renderCards(); renderMembers(); }

function renderCards() {
  const active = db.members.filter(m => m.active);
  const expected = active.reduce((a, m) => a + FEE[m.type], 0);
  const collected = active.reduce((a, m) => a + calcPaid(m), 0);
  const miss = active.reduce((a, m) => a + calcMissing(m), 0);

  setText("s-total", active.length + "명");
  setText("s-worker", active.filter(m => m.type === "직장인").length + "명");
  setText("s-student", active.filter(m => m.type === "학생").length + "명");
  setText("s-expected", wonShort(expected));
  setText("s-paid", active.filter(m => m.payStatus === "완납").length + "명");
  setText("s-unpaid", active.filter(m => m.payStatus === "미납").length + "명");
  setText("s-collected", wonShort(collected));
  setText("s-missing", wonShort(miss));
}

function renderMembers() {
  const q = val("search-name");
  const typeF = val("filter-type");
  const payF = val("filter-pay");
  const activeF = val("filter-active") || "all";

  const list = db.members
    .map((m, i) => ({ ...m, _i: i }))
    .filter(m => activeF === "all" ? true : activeF === "inactive" ? !m.active : m.active)
    .filter(m => !q || m.name.includes(q))
    .filter(m => !typeF || m.type === typeF)
    .filter(m => !payF || m.payStatus === payF);

  const tbody = document.getElementById("members-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  list.forEach((m, seq) => {
    const fee = FEE[m.type], tp = calcPaid(m), mis = calcMissing(m);
    const isTreas = m.name === "임시원";
    const isActive = m.status === "재직중" || m.status === "재학중";
    const tr = document.createElement("tr");
    tr.style.opacity = m.active ? "1" : "0.45";
    tr.innerHTML = `
      <td style="color:#b0bac8;font-size:11px">${seq + 1}</td>
      <td class="left" style="font-weight:${isTreas ? 700 : 400};color:${isTreas ? "var(--gold)" : "var(--text)"}">
        ${isTreas ? "★ " : ""}${m.name}
        ${!m.active ? '<span class="badge badge-inactive" style="margin-left:4px">비활성</span>' : ""}
      </td>
      <td><span class="badge ${m.type === "직장인" ? "badge-worker" : "badge-student"}">${m.type}</span></td>
      <td>
        <span class="status-btn ${isActive ? "status-active" : "status-inactive"}"
          onclick="cycleStatus(${m._i})" title="클릭하여 변경">${m.status}</span>
      </td>
      <td class="num">${won(fee)}</td>
      <td><span class="badge ${BADGE_MAP[m.payStatus] || "badge-unpaid"}">${m.payStatus}</span></td>
      <td class="num amount-positive">${won(tp)}</td>
      <td class="num ${mis > 0 ? "amount-negative" : ""}">${mis > 0 ? won(mis) : "✅"}</td>
      <td class="left" style="color:var(--gray4);font-size:12px">${m.note || ""}</td>
      <td>
        <button class="icon-btn" onclick="openEditMember(${m._i})" title="수정">✏️</button>
        <button class="icon-btn" onclick="hideToggle(${m._i})" title="${m.active ? "비활성화" : "활성화"}">${m.active ? "🔕" : "🔔"}</button>
      </td>`;
    tbody.appendChild(tr);
  });

  const all = db.members.filter(m => m.active);
  setText("tf-fee", won(all.reduce((a, m) => a + FEE[m.type], 0)));
  setText("tf-collected", won(all.reduce((a, m) => a + calcPaid(m), 0)));
  setText("tf-missing", won(all.reduce((a, m) => a + calcMissing(m), 0)));
}

/* ── ACTIONS ── */
function cycleStatus(idx) {
  const cur = db.members[idx].status;
  const i = STATUS_CYCLE.indexOf(cur);
  db.members[idx].status = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
  saveDB(); renderMembers();
}

function hideToggle(idx) {
  db.members[idx].active = !db.members[idx].active;
  saveDB(); render();
  showToast(db.members[idx].active ? "🔔 활성화됨" : "🔕 비활성화됨");
}

function openEditMember(idx) {
  const m = db.members[idx];
  document.getElementById("edit-idx").value = idx;
  document.getElementById("edit-name").value = m.name;
  document.getElementById("edit-payStatus").value = m.payStatus;
  document.getElementById("edit-status").value = m.status;
  document.getElementById("edit-paid").value = m.paid || 0;
  document.getElementById("edit-note").value = m.note || "";
  openModal("modal-member");
}

function saveMember() {
  const idx = parseInt(document.getElementById("edit-idx").value);
  const m = db.members[idx];
  m.payStatus = document.getElementById("edit-payStatus").value;
  m.status = document.getElementById("edit-status").value;
  m.paid = Number(document.getElementById("edit-paid").value) || 0;
  m.note = document.getElementById("edit-note").value;
  saveDB(); closeModal("modal-member"); render();
  showToast("✅ 저장됨 — 구글 시트 동기화 중...");
}

/* ── MODAL ── */
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll(".modal-overlay").forEach(el => {
  el.addEventListener("click", e => { if (e.target === el) el.classList.remove("open"); });
});

/* ── TOAST ── */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ── BACKUP / RESTORE / RESET ── */
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "파시온_백업_" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  showToast("📥 백업 완료");
}

function importData() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json";
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        db = JSON.parse(ev.target.result);
        await saveDB(); render();
        showToast("📤 복원 완료!");
      } catch { showToast("⚠️ 파일 형식 오류"); }
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
}

function resetDB() {
  if (!confirm("⚠️ 모든 데이터를 초기화할까요?\n먼저 백업을 권장합니다.")) return;
  localStorage.removeItem("pasion2026");
  db = initLocalDB();
  saveDB(); render();
  showToast("🔄 초기화 완료!");
}

async function syncNow() {
  setStatus("🔄 동기화 중...");
  await loadFromSheet();
  render();
}

/* ── EXCEL ── */
function exportExcel() {
  const wb = XLSX.utils.book_new();
  const active = db.members.filter(m => m.active);
  const rows = [["No", "이름", "구분", "현황", "연회비", "납부상태", "납부액", "미납액", "비고"]];
  active.forEach((m, i) => rows.push([
    i + 1, m.name, m.type, m.status, FEE[m.type],
    m.payStatus, calcPaid(m), calcMissing(m), m.note || ""
  ]));
  rows.push(["합계", "", "", "",
    active.reduce((a, m) => a + FEE[m.type], 0), "",
    active.reduce((a, m) => a + calcPaid(m), 0),
    active.reduce((a, m) => a + calcMissing(m), 0), ""
  ]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [4, 12, 8, 8, 10, 8, 10, 10, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "회원 납부 현황");
  XLSX.writeFile(wb, "파시온_회계장부_" + new Date().toISOString().slice(0, 10) + ".xlsx");
  showToast("📊 엑셀 다운로드됨");
}

/* ── UTIL ── */
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

/* ── INIT ── */
db = loadLocalDB();
render();
loadFromSheet().then(() => render());