// StudyWithUs — supabase.js
const SUPABASE_URL      = "https://seutduakvxxehzvbjpvf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldXRkdWFrdnh4ZWh6dmJqcHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM5NzIsImV4cCI6MjA5NjE0OTk3Mn0.ilb8hITHwk3VlqMNPrbDPbghkZE6Wb-Y0Rt8pJ6yHqQ";
const RESEND_API_KEY    = "re_UWGUEsGt_8P4E7cwnPYDqBqFiWzaXrpzB";
const NOTIFY_EMAIL      = "zorouchiha1234k@gmail.com";

// Init Supabase client (UMD build exposes window.supabase)
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

// ── AUTH ──
async function signUp(email, password) {
  const { data, error } = await _sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
async function signIn(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function signInWithGoogle() {
  const { data, error } = await _sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://studywithus2107.vercel.app/dashboard.html",
      queryParams: { access_type: "offline", prompt: "consent" }
    }
  });
  if (error) throw error;
  return data;
}
async function signOut() {
  const { error } = await _sb.auth.signOut();
  if (error) throw error;
}
async function getSession() {
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}
function onAuthChange(cb) { return _sb.auth.onAuthStateChange(cb); }

// ── PROFILES ──
async function getSettings(uid) {
  const { data, error } = await _sb.from("profiles")
    .select("display_name,email_updates,partner_email,avatar_url")
    .eq("id", uid).maybeSingle();
  if (error) throw error;
  if (!data) return { displayName: "", emailUpdates: true, partnerEmail: "", avatarUrl: "" };
  return {
    displayName:  data.display_name  || "",
    emailUpdates: data.email_updates !== null ? data.email_updates : true,
    partnerEmail: data.partner_email || "",
    avatarUrl:    data.avatar_url    || ""
  };
}
async function saveSettings(uid, s) {
  const row = { id: uid };
  if (s.displayName  !== undefined) row.display_name  = s.displayName;
  if (s.emailUpdates !== undefined) row.email_updates = s.emailUpdates;
  if (s.partnerEmail !== undefined) row.partner_email = s.partnerEmail;
  if (s.avatarUrl    !== undefined) row.avatar_url    = s.avatarUrl;
  const { error } = await _sb.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

// ── SESSIONS ──
async function saveSession(uid, d) {
  const { error } = await _sb.from("sessions").insert({
    user_id: uid, start_time: d.startTime, end_time: d.endTime,
    duration_min: d.duration, date: d.date
  });
  if (error) throw error;
}
async function getRecentSessions(uid, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);
  const { data, error } = await _sb.from("sessions").select("*")
    .eq("user_id", uid).gte("start_time", since.toISOString())
    .order("start_time", { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).map(_normSession);
}
async function getLatestSessions(uid, limit = 10) {
  const { data, error } = await _sb.from("sessions").select("*")
    .eq("user_id", uid).order("start_time", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map(_normSession);
}
function _normSession(r) {
  const s = r.start_time ? new Date(r.start_time) : null;
  const e = r.end_time   ? new Date(r.end_time)   : null;
  return {
    id: r.id, date: r.date || (s ? s.toISOString().split("T")[0] : ""),
    duration: r.duration_min || 0,
    startTimeLabel: s ? s.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "",
    endTimeLabel:   e ? e.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : ""
  };
}

// ── ACTIVE SESSION ──
async function saveActiveSession(uid, startTime) {
  const { error } = await _sb.from("profiles")
    .upsert({ id: uid, active_session_start: startTime }, { onConflict: "id" });
  if (error) throw error;
}
async function clearActiveSession(uid) {
  const { error } = await _sb.from("profiles")
    .upsert({ id: uid, active_session_start: null }, { onConflict: "id" });
  if (error) throw error;
}
async function getActiveSession(uid) {
  const { data } = await _sb.from("profiles")
    .select("active_session_start").eq("id", uid).maybeSingle();
  return data?.active_session_start ? { startTime: data.active_session_start } : null;
}

// ── GOALS ──
async function saveGoal(uid, text) {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await _sb.from("goals")
    .insert({ user_id: uid, text, completed: false, date: today })
    .select("id").single();
  if (error) throw error;
  return data.id;
}
async function getGoals(uid, date) {
  const d = date || new Date().toISOString().split("T")[0];
  const { data, error } = await _sb.from("goals").select("*")
    .eq("user_id", uid).eq("date", d).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(g => ({ id: g.id, text: g.text, completed: g.completed, date: g.date }));
}
async function updateGoal(uid, gid, u) {
  const row = {};
  if (u.completed !== undefined) row.completed = u.completed;
  if (u.text      !== undefined) row.text      = u.text;
  const { error } = await _sb.from("goals").update(row).eq("id", gid).eq("user_id", uid);
  if (error) throw error;
}
async function deleteGoal(uid, gid) {
  const { error } = await _sb.from("goals").delete().eq("id", gid).eq("user_id", uid);
  if (error) throw error;
}

// ── EMAIL via Resend (direct browser call) ──
// Sends to hardcoded NOTIFY_EMAIL (zorouchiha1234k@gmail.com) + optional partner email
async function sendStudyEmail(subject, htmlBody, extraTo) {
  const recipients = [NOTIFY_EMAIL];
  if (extraTo && extraTo !== NOTIFY_EMAIL) recipients.push(extraTo);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "StudyWithUs <onboarding@resend.dev>",
        to:   recipients,
        subject,
        html: htmlBody
      })
    });
    const json = await res.json();
    if (!res.ok) {
      console.warn("Resend error:", json);
      throw new Error(json.message || "Email failed");
    }
    return json;
  } catch(err) {
    console.warn("Email send failed:", err.message);
    throw err;
  }
}

function buildEmailHtml(name, subject, lines) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    body{font-family:system-ui,sans-serif;background:#fff0f6;margin:0;padding:0}
    .w{max-width:520px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(235,47,150,.15)}
    .h{background:linear-gradient(135deg,#ff85ba,#f759ab);padding:28px 24px;text-align:center}
    .h h1{color:#fff;font-size:22px;margin:0 0 4px;font-family:Georgia,serif}
    .h p{color:rgba(255,255,255,.85);margin:0;font-size:13px}
    .b{padding:24px 28px}
    .b p{color:#3d1a2e;font-size:15px;line-height:1.8;margin:0 0 12px}
    .hl{background:#fff0f6;border-left:4px solid #f759ab;padding:12px 16px;border-radius:8px;margin:14px 0;font-size:14px;color:#5c3d5e}
    .f{text-align:center;padding:14px;font-size:12px;color:#b07090;border-top:1px solid #ffe4f0}
  </style>
  </head>
  <body><div class="w">
    <div class="h"><h1>🎀 StudyWithUs</h1><p>${subject}</p></div>
    <div class="b">${lines.map(l => `<p>${l}</p>`).join("")}</div>
    <div class="f">Sent with 💖 from StudyWithUs · studywithus2107.vercel.app</div>
  </div></body></html>`;
}
