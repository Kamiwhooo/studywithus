// ============================================================
//  StudyWithUs — app.js  |  Core logic: timer, toasts, goals, auth guard
// ============================================================

const MOTIVATIONAL_QUOTES = [
  "You're doing amazing 💖","Stay focused, future you will thank you ✨",
  "Every minute counts — keep going! 🌸","Small steps, big dreams 🎀",
  "Consistency is your superpower 💪","You showed up today. That's everything 🌷",
  "Progress over perfection, always 🌟","You've got this, brilliant one 💫",
  "Deep work = deep rewards 🌺","Every expert was once a beginner 🌱"
];

let toastContainer=null;
function initToasts(){toastContainer=document.getElementById("toast-container");if(!toastContainer){toastContainer=document.createElement("div");toastContainer.id="toast-container";toastContainer.className="toast-container";document.body.appendChild(toastContainer);}}
function showToast(message,type="success",duration=3500){if(!toastContainer)initToasts();const toast=document.createElement("div");toast.className="toast "+type;const icons={success:"🌸",error:"❌",info:"💫"};toast.innerHTML=`<span class="toast-icon">${icons[type]||"✨"}</span><span>${message}</span>`;toastContainer.appendChild(toast);toast.getBoundingClientRect();toast.classList.add("toast-visible");setTimeout(()=>{toast.classList.add("fade-out");toast.addEventListener("animationend",()=>toast.remove(),{once:true});},duration);}

let timerInterval=null,sessionStart=null,isStudying=false;
function formatElapsed(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return[h,m,sec].map(n=>String(n).padStart(2,"0")).join(":");}
function formatDuration(m){if(!m||m<=0)return"0m";if(m<60)return m+"m";const h=Math.floor(m/60),r=m%60;return r>0?h+"h "+r+"m":h+"h";}
function formatTime(d){return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
function formatDate(d){return d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});}
function startTimerUI(startDate,displayEl){if(timerInterval)clearInterval(timerInterval);timerInterval=setInterval(()=>{const e=Math.floor((Date.now()-startDate.getTime())/1000);if(displayEl)displayEl.textContent=formatElapsed(e);},1000);}
function stopTimerUI(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function getMotivationalQuote(){return MOTIVATIONAL_QUOTES[Math.floor(Math.random()*MOTIVATIONAL_QUOTES.length)];}

function buildWeeklyBreakdown(sessions){const days=[],today=new Date();for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const label=d.toLocaleDateString([],{weekday:"short"}),dateStr=d.toISOString().split("T")[0],minutes=sessions.filter(s=>s.date===dateStr).reduce((sum,s)=>sum+(s.duration||0),0);days.push({dayLabel:label,minutes,isToday:i===0,dateStr});}return days;}
function totalMinutes(sessions){return sessions.reduce((sum,s)=>sum+(s.duration||0),0);}

function initDecoHearts(){const c=document.querySelector(".deco-hearts");if(!c)return;const emojis=["💖","🌸","✨","💕","🎀","🌷","⭐","💫"];for(let i=0;i<14;i++){const el=document.createElement("span");el.className="deco-heart";el.textContent=emojis[i%emojis.length];el.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;--dur:${10+Math.random()*14}s;--delay:${-Math.random()*12}s;font-size:${0.7+Math.random()*1.1}rem;`;c.appendChild(el);}}

let _goals=[];
async function loadGoals(uid){try{_goals=await getGoals(uid);renderGoals(uid);}catch(err){console.error("Failed to load goals:",err);showToast("Could not load goals 🌸","error");}}
async function addGoal(uid,text){const trimmed=text.trim();if(!trimmed)return;const tempId="temp-"+Date.now();_goals.push({id:tempId,text:trimmed,completed:false,date:new Date().toISOString().split("T")[0]});renderGoals(uid);try{const realId=await saveGoal(uid,trimmed);const g=_goals.find(g=>g.id===tempId);if(g)g.id=realId;renderGoals(uid);}catch(err){_goals=_goals.filter(g=>g.id!==tempId);renderGoals(uid);showToast("Could not save goal. Please try again.","error");}}
async function toggleGoal(uid,goalId){const goal=_goals.find(g=>g.id===goalId);if(!goal)return;goal.completed=!goal.completed;renderGoals(uid);try{await updateGoal(uid,goalId,{completed:goal.completed});}catch(err){goal.completed=!goal.completed;renderGoals(uid);showToast("Could not update goal.","error");}}
async function removeGoal(uid,goalId){const backup=[..._goals];_goals=_goals.filter(g=>g.id!==goalId);renderGoals(uid);try{await deleteGoal(uid,goalId);}catch(err){_goals=backup;renderGoals(uid);showToast("Could not delete goal.","error");}}
function startEditGoal(uid,goalId){const goal=_goals.find(g=>g.id===goalId);if(!goal)return;const li=document.querySelector(`.goal-item[data-id="${goalId}"]`);if(!li)return;li.innerHTML=`<input class="goal-edit-input" type="text" value="${escapeHtml(goal.text)}" maxlength="120" aria-label="Edit goal"/><div class="goal-edit-actions"><button class="btn btn-primary btn-sm" onclick="commitEditGoal('${uid}','${goalId}')">Save</button><button class="btn btn-ghost btn-sm" onclick="renderGoals('${uid}')">Cancel</button></div>`;const input=li.querySelector(".goal-edit-input");input.focus();input.select();input.addEventListener("keydown",(e)=>{if(e.key==="Enter")commitEditGoal(uid,goalId);if(e.key==="Escape")renderGoals(uid);});}
async function commitEditGoal(uid,goalId){const li=document.querySelector(`.goal-item[data-id="${goalId}"]`),input=li&&li.querySelector(".goal-edit-input");if(!input)return;const newText=input.value.trim();if(!newText){showToast("Goal text can't be empty 🌸","error");return;}const goal=_goals.find(g=>g.id===goalId);if(goal)goal.text=newText;renderGoals(uid);try{await updateGoal(uid,goalId,{text:newText});}catch(err){showToast("Could not save edit.","error");}}
function renderGoals(uid){const listEl=document.getElementById("goals-list"),barEl=document.getElementById("goals-progress-bar"),pctEl=document.getElementById("goals-pct"),totalEl=document.getElementById("goals-total"),doneEl=document.getElementById("goals-done");if(!listEl)return;const total=_goals.length,done=_goals.filter(g=>g.completed).length,pct=total>0?Math.round((done/total)*100):0;if(barEl)barEl.style.width=pct+"%";if(pctEl)pctEl.textContent=pct+"%";if(totalEl)totalEl.textContent=total;if(doneEl)doneEl.textContent=done;if(total===0){listEl.innerHTML=`<div class="goals-empty"><span class="goals-empty-icon">🌸</span><p>Add your first goal for today!</p><p class="goals-empty-sub">Every big achievement starts with one small step ✨</p></div>`;return;}listEl.innerHTML=_goals.map(g=>`<li class="goal-item ${g.completed?"goal-done":""}" data-id="${g.id}"><label class="goal-check-label"><input type="checkbox" class="goal-checkbox" ${g.completed?"checked":""} onchange="toggleGoal('${uid}','${g.id}')" aria-label="Mark complete"/><span class="goal-checkmark"><svg viewBox="0 0 14 11" fill="none"><path d="M1 5.5L5 9.5L13 1.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></label><span class="goal-text">${escapeHtml(g.text)}</span><div class="goal-actions"><button class="goal-action-btn" onclick="startEditGoal('${uid}','${g.id}')">✏️</button><button class="goal-action-btn goal-action-delete" onclick="removeGoal('${uid}','${g.id}')">🗑️</button></div></li>`).join("");if(total>0&&done===total)showToast("All goals complete! You're incredible 🎉💖","success",4500);}
function escapeHtml(str){return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

async function requireAuth(callback){try{const session=await getSession();if(!session||!session.user){window.location.href="index.html";return;}if(!session.user.email_confirmed_at){await signOut();window.location.href="index.html";return;}callback(session.user);}catch(err){console.error("Auth guard error:",err);window.location.href="index.html";}}

document.addEventListener("DOMContentLoaded",()=>{initToasts();initDecoHearts();});
