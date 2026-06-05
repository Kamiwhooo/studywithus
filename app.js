// StudyWithUs — app.js  (load AFTER supabase.js)

const QUOTES = [
  "You're doing amazing 💖","Stay focused, future you will thank you ✨",
  "Every minute counts — keep going! 🌸","Small steps, big dreams 🎀",
  "Consistency is your superpower 💪","You showed up today. That's everything 🌷",
  "Progress over perfection, always 🌟","You've got this, brilliant one 💫"
];

// ── TOASTS ──
let _toastEl = null;
function _toast(msg, type="success", ms=3500) {
  if (!_toastEl) {
    _toastEl = document.getElementById("toast-container") || (() => {
      const d = document.createElement("div");
      d.id = "toast-container"; d.className = "toast-container";
      document.body.appendChild(d); return d;
    })();
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = `<span>${{success:"🌸",error:"❌",info:"💫"}[type]||"✨"}</span><span>${msg}</span>`;
  _toastEl.appendChild(t);
  requestAnimationFrame(() => t.classList.add("toast-visible"));
  setTimeout(() => { t.classList.add("fade-out"); setTimeout(() => t.remove(), 400); }, ms);
}
// alias
function showToast(msg, type, ms) { _toast(msg, type, ms); }

// ── TIMER ──
let _timerInterval = null, sessionStart = null, isStudying = false;
function formatElapsed(s) {
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60]
    .map(n => String(n).padStart(2,"0")).join(":");
}
function formatDuration(m) {
  if (!m || m <= 0) return "0m";
  return m < 60 ? m+"m" : Math.floor(m/60)+"h"+(m%60>0?" "+m%60+"m":"");
}
function formatTime(d) { return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
function startTimerUI(startDate, el) {
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => {
    if (el) el.textContent = formatElapsed(Math.floor((Date.now()-startDate)/1000));
  }, 1000);
}
function stopTimerUI() { clearInterval(_timerInterval); _timerInterval = null; }

// ── WEEKLY STATS ──
function buildWeeklyBreakdown(sessions) {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const dateStr = d.toISOString().split("T")[0];
    return {
      dayLabel: d.toLocaleDateString([],{weekday:"short"}),
      dateStr, isToday: i===6,
      minutes: sessions.filter(s=>s.date===dateStr).reduce((sum,s)=>sum+(s.duration||0),0)
    };
  });
}
function totalMinutes(sessions) { return sessions.reduce((s,x)=>s+(x.duration||0),0); }
function getMotivationalQuote() { return QUOTES[Math.floor(Math.random()*QUOTES.length)]; }

// ── HEARTS ──
function initDecoHearts() {
  const c = document.querySelector(".deco-hearts");
  if (!c) return;
  ["💖","🌸","✨","💕","🎀","🌷","⭐","💫"].forEach((e,i) => {
    const el = document.createElement("span");
    el.className = "deco-heart"; el.textContent = e;
    el.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;--dur:${10+Math.random()*14}s;--delay:${-Math.random()*12}s;font-size:${0.7+Math.random()*1.1}rem`;
    c.appendChild(el);
  });
}

// ── GOALS ──
let _goals = [];
async function loadGoals(uid) {
  try { _goals = await getGoals(uid); renderGoals(uid); }
  catch(e) { console.error(e); _toast("Could not load goals","error"); }
}
async function addGoal(uid, text) {
  const t = text.trim(); if (!t) return;
  const tmp = "tmp-"+Date.now();
  _goals.push({id:tmp,text:t,completed:false,date:new Date().toISOString().split("T")[0]});
  renderGoals(uid);
  try {
    const id = await saveGoal(uid, t);
    const g = _goals.find(x=>x.id===tmp); if (g) g.id = id;
    renderGoals(uid);
  } catch(e) {
    _goals = _goals.filter(x=>x.id!==tmp); renderGoals(uid);
    _toast("Could not save goal","error");
  }
}
async function toggleGoal(uid, gid) {
  const g = _goals.find(x=>x.id===gid); if (!g) return;
  g.completed = !g.completed; renderGoals(uid);
  try { await updateGoal(uid, gid, {completed:g.completed}); }
  catch(e) { g.completed=!g.completed; renderGoals(uid); }
}
async function removeGoal(uid, gid) {
  const bak=[..._goals]; _goals=_goals.filter(x=>x.id!==gid); renderGoals(uid);
  try { await deleteGoal(uid, gid); }
  catch(e) { _goals=bak; renderGoals(uid); _toast("Delete failed","error"); }
}
function startEditGoal(uid, gid) {
  const g=_goals.find(x=>x.id===gid); if(!g) return;
  const li=document.querySelector(`.goal-item[data-id="${gid}"]`); if(!li) return;
  li.innerHTML=`<input class="goal-edit-input" value="${_esc(g.text)}" maxlength="120"/>
    <div class="goal-edit-actions">
      <button class="btn btn-primary btn-sm" onclick="commitEditGoal('${uid}','${gid}')">Save</button>
      <button class="btn btn-ghost btn-sm" onclick="renderGoals('${uid}')">Cancel</button>
    </div>`;
  const inp=li.querySelector(".goal-edit-input"); inp.focus(); inp.select();
  inp.onkeydown=e=>{if(e.key==="Enter")commitEditGoal(uid,gid);if(e.key==="Escape")renderGoals(uid);};
}
async function commitEditGoal(uid, gid) {
  const li=document.querySelector(`.goal-item[data-id="${gid}"]`);
  const val=li?.querySelector(".goal-edit-input")?.value?.trim();
  if (!val) { _toast("Goal can\'t be empty","error"); return; }
  const g=_goals.find(x=>x.id===gid); if(g) g.text=val;
  renderGoals(uid);
  try { await updateGoal(uid, gid, {text:val}); }
  catch(e) { _toast("Save failed","error"); }
}
function renderGoals(uid) {
  const list=document.getElementById("goals-list");
  const bar=document.getElementById("goals-progress-bar");
  const pct=document.getElementById("goals-pct");
  const tot=document.getElementById("goals-total");
  const don=document.getElementById("goals-done");
  if (!list) return;
  const total=_goals.length, done=_goals.filter(g=>g.completed).length;
  const p=total>0?Math.round(done/total*100):0;
  if(bar) bar.style.width=p+"%";
  if(pct) pct.textContent=p+"%";
  if(tot) tot.textContent=total;
  if(don) don.textContent=done;
  if (!total) {
    list.innerHTML=`<div class="goals-empty"><span class="goals-empty-icon">🌸</span>
      <p>Add your first goal for today!</p>
      <p class="goals-empty-sub">Every big achievement starts with one small step ✨</p></div>`;
    return;
  }
  list.innerHTML=_goals.map(g=>`
    <li class="goal-item${g.completed?" goal-done":""}" data-id="${g.id}">
      <label class="goal-check-label">
        <input type="checkbox" class="goal-checkbox"${g.completed?" checked":""}
          onchange="toggleGoal('${uid}','${g.id}')"/>
        <span class="goal-checkmark"><svg viewBox="0 0 14 11" fill="none">
          <path d="M1 5.5L5 9.5L13 1.5" stroke="white" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </label>
      <span class="goal-text">${_esc(g.text)}</span>
      <div class="goal-actions">
        <button class="goal-action-btn" onclick="startEditGoal('${uid}','${g.id}')" title="Edit">✏️</button>
        <button class="goal-action-btn goal-action-delete" onclick="removeGoal('${uid}','${g.id}')" title="Delete">🗑️</button>
      </div>
    </li>`).join("");
  if (total>0 && done===total) _toast("All goals done! You\'re amazing 🎉","success",4000);
}
function _esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── AUTH GUARD ──
async function requireAuth(cb) {
  try {
    const session = await getSession();
    if (!session?.user) { window.location.href = "index.html"; return; }
    cb(session.user);
  } catch(e) { console.error(e); window.location.href = "index.html"; }
}

document.addEventListener("DOMContentLoaded", () => {
  initDecoHearts();
  // init toast container
  if (!document.getElementById("toast-container")) {
    const d=document.createElement("div");
    d.id="toast-container"; d.className="toast-container";
    document.body.appendChild(d);
  }
  _toastEl = document.getElementById("toast-container");
});
