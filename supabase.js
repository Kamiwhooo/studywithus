// ============================================================
//  StudyWithUs — supabase.js  |  Supabase v2 SDK config + helpers
// ============================================================

const SUPABASE_URL      = "https://seutduakvxxehzvbjpvf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldXRkdWFrdnh4ZWh6dmJqcHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM5NzIsImV4cCI6MjA5NjE0OTk3Mn0.ilb8hITHwk3VlqMNPrbDPbghkZE6Wb-Y0Rt8pJ6yHqQ";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storageKey: "studywithus-auth" }
});

async function signUp(e,p){const{data,error}=await _supabase.auth.signUp({email:e,password:p});if(error)throw error;return data;}
async function signIn(e,p){const{data,error}=await _supabase.auth.signInWithPassword({email:e,password:p});if(error)throw error;if(data.user&&!data.user.email_confirmed_at){await _supabase.auth.signOut();const err=new Error("Email not verified. Please check your inbox.");err.code="auth/email-not-verified";throw err;}return data;}
async function signInWithGoogle(){const redirectTo=window.location.origin+"/dashboard.html";const{data,error}=await _supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(error)throw error;return data;}
async function signOut(){const{error}=await _supabase.auth.signOut();if(error)throw error;}
async function getSession(){const{data:{session}}=await _supabase.auth.getSession();return session;}
async function getCurrentUser(){const s=await getSession();return s?s.user:null;}
function onAuthChange(cb){return _supabase.auth.onAuthStateChange(cb);}

async function getSettings(uid){const{data,error}=await _supabase.from("profiles").select("display_name,email_updates,partner_email,avatar_url").eq("id",uid).maybeSingle();if(error)throw error;if(!data)return{displayName:"",emailUpdates:true,partnerEmail:"",avatarUrl:""};return{displayName:data.display_name||"",emailUpdates:data.email_updates!==null?data.email_updates:true,partnerEmail:data.partner_email||"",avatarUrl:data.avatar_url||""};}
async function saveSettings(uid,s){const row={id:uid};if(s.displayName!==undefined)row.display_name=s.displayName;if(s.emailUpdates!==undefined)row.email_updates=s.emailUpdates;if(s.partnerEmail!==undefined)row.partner_email=s.partnerEmail;if(s.avatarUrl!==undefined)row.avatar_url=s.avatarUrl;const{error}=await _supabase.from("profiles").upsert(row,{onConflict:"id"});if(error)throw error;}

async function saveSession(uid,d){const{error}=await _supabase.from("sessions").insert({user_id:uid,start_time:d.startTime,end_time:d.endTime,duration_min:d.duration,date:d.date});if(error)throw error;}
async function getRecentSessions(uid,days=7){const since=new Date();since.setDate(since.getDate()-days);since.setHours(0,0,0,0);const{data,error}=await _supabase.from("sessions").select("*").eq("user_id",uid).gte("start_time",since.toISOString()).order("start_time",{ascending:false}).limit(50);if(error)throw error;return(data||[]).map(_ns);}
async function getLatestSessions(uid,limit=10){const{data,error}=await _supabase.from("sessions").select("*").eq("user_id",uid).order("start_time",{ascending:false}).limit(limit);if(error)throw error;return(data||[]).map(_ns);}
function _ns(r){const s=r.start_time?new Date(r.start_time):null,e=r.end_time?new Date(r.end_time):null;return{id:r.id,date:r.date||(s?s.toISOString().split("T")[0]:""),duration:r.duration_min||0,startTime:r.start_time,endTime:r.end_time,startTimeLabel:s?s.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"",endTimeLabel:e?e.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""};}

async function saveActiveSession(uid,t){const{error}=await _supabase.from("profiles").upsert({id:uid,active_session_start:t},{onConflict:"id"});if(error)throw error;}
async function clearActiveSession(uid){const{error}=await _supabase.from("profiles").upsert({id:uid,active_session_start:null},{onConflict:"id"});if(error)throw error;}
async function getActiveSession(uid){const{data,error}=await _supabase.from("profiles").select("active_session_start").eq("id",uid).maybeSingle();if(error||!data||!data.active_session_start)return null;return{startTime:data.active_session_start};}

async function saveGoal(uid,text){const today=new Date().toISOString().split("T")[0];const{data,error}=await _supabase.from("goals").insert({user_id:uid,text,completed:false,date:today}).select("id").single();if(error)throw error;return data.id;}
async function getGoals(uid,date){const d=date||new Date().toISOString().split("T")[0];const{data,error}=await _supabase.from("goals").select("*").eq("user_id",uid).eq("date",d).order("created_at",{ascending:true});if(error)throw error;return(data||[]).map(g=>({id:g.id,text:g.text,completed:g.completed,date:g.date}));}
async function updateGoal(uid,gid,u){const row={};if(u.completed!==undefined)row.completed=u.completed;if(u.text!==undefined)row.text=u.text;const{error}=await _supabase.from("goals").update(row).eq("id",gid).eq("user_id",uid);if(error)throw error;}
async function deleteGoal(uid,gid){const{error}=await _supabase.from("goals").delete().eq("id",gid).eq("user_id",uid);if(error)throw error;}

async function sendEmail(toEmail,subject,htmlBody){try{const session=await getSession();const token=session?session.access_token:"";const res=await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({to:toEmail,subject,html:htmlBody})});if(!res.ok){const t=await res.text();throw new Error("Email error: "+t);}return await res.json();}catch(err){console.warn("Email failed:",err);throw err;}}

function buildEmailHtml(name,subject,bodyLines){return \`<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',sans-serif;background:#fff0f6;margin:0;padding:0}.wrapper{max-width:520px;margin:40px auto;background:rgba(255,255,255,0.95);border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(235,47,150,0.12)}.header{background:linear-gradient(135deg,#ff85ba,#f759ab);padding:32px 28px;text-align:center}.header h1{color:white;font-size:22px;margin:0 0 4px}.header p{color:rgba(255,255,255,0.85);margin:0;font-size:14px}.body{padding:28px}.body p{color:#3d1a2e;font-size:15px;line-height:1.7;margin:0 0 12px}.highlight{background:#fff0f6;border-left:4px solid #f759ab;padding:12px 16px;border-radius:8px;margin:16px 0}.footer{text-align:center;padding:16px 28px 24px;font-size:12px;color:#b07090}</style></head><body><div class="wrapper"><div class="header"><h1>🎀 StudyWithUs</h1><p>\${subject}</p></div><div class="body">\${bodyLines.map(l=>\`<p>\${l}</p>\`).join("")}</div><div class="footer">Sent with 💖 from StudyWithUs</div></div></body></html>\`;}
