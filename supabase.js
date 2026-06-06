// StudyWithUs — supabase.js
const SUPABASE_URL      = "https://seutduakvxxehzvbjpvf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldXRkdWFrdnh4ZWh6dmJqcHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM5NzIsImV4cCI6MjA5NjE0OTk3Mn0.ilb8hITHwk3VlqMNPrbDPbghkZE6Wb-Y0Rt8pJ6yHqQ";

// Hardcoded notification email
const NOTIFY_EMAIL          = "zorouchiha1234k@gmail.com";

// EmailJS credentials (from original app setup)
const EMAILJS_SERVICE_ID    = "service_eyo11ze";
const EMAILJS_TEMPLATE_ID   = "template_05rp9mi";
const EMAILJS_PUBLIC_KEY    = "PHCXeL4ptLkvlhwFf";

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

// ── EMAIL via EmailJS (your original working keys) ──
// Always sends to NOTIFY_EMAIL (zorouchiha1234k@gmail.com)
function _initEmailJS() {
  if (typeof emailjs !== "undefined") {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    return true;
  }
  return false;
}

async function sendStudyEmail(subject, messageText, extraTo) {
  if (!_initEmailJS()) {
    console.warn("EmailJS not loaded");
    return;
  }
  try {
    // Always send to hardcoded email
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: NOTIFY_EMAIL,
      subject:  subject,
      message:  messageText
    });
    // Also send to partner email if set and different
    if (extraTo && extraTo !== NOTIFY_EMAIL) {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: extraTo,
        subject:  subject,
        message:  messageText
      });
    }
  } catch(err) {
    console.warn("EmailJS send failed:", err);
  }
}

function buildEmailHtml(name, subject, lines) {
  // EmailJS uses plain text template — strip HTML tags
  return lines.map(l => l.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&")).join("\n\n");
}
