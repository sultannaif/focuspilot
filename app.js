import { supabase } from './supabase-client.js';

const STORAGE_KEY = 'focuspilot-demo-v1';
const demo = {
  jobs: [
    { id: 'job-1', name: 'التسويق الرئيسي', salary: 6500, color: '#f97316' },
    { id: 'job-2', name: 'التطوير', salary: 3000, color: '#275dad' },
    { id: 'job-3', name: 'التسويق الثاني', salary: 2000, color: '#159a70' },
    { id: 'job-4', name: 'التسويق الثالث', salary: 1500, color: '#a855f7' }
  ],
  tasks: [
    { id: 'task-1', jobId: 'job-1', title: 'تجهيز خطة محتوى الحملة القادمة', duration: 90, due: '2026-09-06T18:30', importance: 1.5, status: 'pending', startedAt: null, completedAt: null },
    { id: 'task-2', jobId: 'job-2', title: 'إصلاح شاشة تسجيل الدخول', duration: 75, due: '2026-09-06T20:00', importance: 1.25, status: 'pending', startedAt: null, completedAt: null },
    { id: 'task-3', jobId: 'job-3', title: 'مراجعة نتائج الإعلان الأسبوعي', duration: 45, due: '2026-09-07T12:00', importance: 1, status: 'pending', startedAt: null, completedAt: null },
    { id: 'task-4', jobId: 'job-4', title: 'جدولة المنشورات اليومية', duration: 40, due: '2026-09-06T22:30', importance: 1, status: 'pending', startedAt: null, completedAt: null }
  ]
};
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || demo;
state.breaks = state.breaks || [];
state.sessions = state.sessions || [];
let currentSession = null;
let googleCalendarConnected = false;
let authReady = false;
let activeSession = JSON.parse(localStorage.getItem('focuspilot-active-session') || 'null');
const $ = (selector) => document.querySelector(selector);
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const jobById = (id) => state.jobs.find((job) => job.id === id);
const money = (value) => new Intl.NumberFormat('ar-SA').format(value);
const minutes = (value) => value >= 60 ? `${Math.floor(value / 60)}س ${value % 60 ? `${value % 60}د` : ''}` : `${value}د`;

function priorityScore(task) {
  const job = jobById(task.jobId) || { salary: 0 };
  const hoursToDue = (new Date(task.due) - new Date()) / 36e5;
  const urgency = Math.max(0, Math.min(40, 24 / Math.max(1, hoursToDue + 2) * 4));
  const financial = Math.min(45, Math.log10(job.salary + 10) * 13);
  const effort = Math.max(0, 15 - task.duration / 10);
  return Math.round((financial + urgency + effort) * (task.importance || 1));
}
function orderedTasks() { return [...state.tasks].sort((a,b) => (a.status === 'done') - (b.status === 'done') || priorityScore(b) - priorityScore(a)); }

function render() {
  const tasks = orderedTasks();
  const focus = tasks.find((task) => task.status !== 'done');
  $('#focusContent').innerHTML = focus ? `<h2 class="focus-title">${focus.title}</h2><div class="focus-meta">${jobById(focus.jobId)?.name || 'بدون وظيفة'} · ${minutes(focus.duration)} · درجة الأولوية ${priorityScore(focus)}</div><div class="focus-actions"><button class="primary-button" data-action="start" data-id="${focus.id}">${focus.startedAt ? 'استمر في المهمة' : 'ابدأ الآن'}</button><button class="small-button secondary" data-action="skip" data-id="${focus.id}">أجّلها بسبب واضح</button></div>` : '<h2 class="focus-title">أنجزت كل شيء مجدول اليوم</h2><div class="focus-meta">خذ راحتك أو أضف مهمة جديدة.</div>';
  const completed = state.tasks.filter((task) => task.status === 'done').length;
  const score = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;
  $('#scoreValue').textContent = score;
  $('#scoreBar').style.width = `${score}%`;
  $('#scoreHint').textContent = completed ? `${completed} من ${state.tasks.length} مهام مكتملة. استمر على نفس الإيقاع.` : 'أكمل أول مهمة حتى يبدأ التقييم.';
  $('#queue').innerHTML = tasks.map(taskCard).join('');
  $('#allTasks').innerHTML = state.tasks.map(taskCard).join('');
  $('#jobsGrid').innerHTML = state.jobs.map((job) => `<article class="job-card" style="border-top-color:${job.color}"><div class="job-name">${job.name}</div><div class="job-salary">${money(job.salary)} <small>ريال / شهريًا</small></div><div class="job-stats">${state.tasks.filter((task) => task.jobId === job.id && task.status !== 'done').length} مهام مفتوحة</div><button class="small-button secondary" data-action="delete-job" data-id="${job.id}">حذف الوظيفة</button></article>`).join('');
  $('#taskJobSelect').innerHTML = state.jobs.map((job) => `<option value="${job.id}">${job.name}</option>`).join('');
  const breakLabels = { rest: 'راحة', driving: 'قيادة / مشوار', family: 'مشوار للأهل' };
  const today = new Date().toDateString();
  const todayBreaks = state.breaks.filter((item) => new Date(item.startedAt).toDateString() === today);
  $('#breaksList').innerHTML = todayBreaks.length ? todayBreaks.map((item) => `<div class="break-item"><strong>${breakLabels[item.type] || 'فترة خارج العمل'}</strong><span>${item.minutes} دقيقة · ${new Date(item.startedAt).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' })}</span></div>`).join('') : '<div class="break-empty">لم تسجل أي راحة أو مشوار اليوم.</div>';
  renderAnalytics();
}
function taskCard(task) {
  const job = jobById(task.jobId) || { name: 'غير مصنف', color: '#94a3b8' };
  const active = activeSession?.taskId === task.id;
  return `<article class="task-card ${task.status === 'done' ? 'done' : ''} ${orderedTasks()[0]?.id === task.id ? 'is-focus' : ''}"><div class="task-rank" style="color:${job.color}">${task.status === 'done' ? '✓' : priorityScore(task)}</div><div><div class="task-name">${task.title}</div><div class="task-meta"><span style="color:${job.color}">${job.name}</span> · ${minutes(task.duration)} · التسليم ${new Date(task.due).toLocaleString('ar-SA', { hour: 'numeric', minute: '2-digit' })}</div></div><div class="task-buttons">${task.status === 'done' ? '<span class="task-score">مكتملة</span>' : `<button class="small-button" data-action="done" data-id="${task.id}">أنجزتها</button><button class="small-button secondary" data-action="start" data-id="${task.id}">${active ? 'إيقاف المؤقت' : 'ابدأ'}</button>`}</div></article>`;
}
function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }
function showError(error) {
  console.error(error);
  window.alert('تعذر حفظ التغيير. تأكد من اتصالك ثم حاول مرة أخرى.');
}

async function calendarFunction(body) {
  if (!currentSession) throw new Error('يجب تسجيل الدخول أولًا.');
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'تعذرت مزامنة Google Calendar.');
  return data;
}

function periodStart(period) {
  const start = new Date();
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return start;
}

function analyticsFor(period = $('#analyticsPeriod')?.value || 'day') {
  const start = periodStart(period);
  const tasks = state.tasks.filter((task) => new Date(task.due) >= start);
  const completed = tasks.filter((task) => task.status === 'done');
  const onTime = completed.filter((task) => task.completedAt && new Date(task.completedAt) <= new Date(task.due));
  const sessions = state.sessions.filter((item) => new Date(item.startedAt) >= start && item.actualMinutes > 0);
  const breaks = state.breaks.filter((item) => new Date(item.startedAt) >= start);
  const weight = (task) => (task.importance || 1) * (1 + Math.min(1, (jobById(task.jobId)?.salary || 0) / 6500));
  const totalWeight = tasks.reduce((sum, task) => sum + weight(task), 0) || 1;
  const completedWeight = completed.reduce((sum, task) => sum + weight(task), 0);
  const completion = Math.round((completedWeight / totalWeight) * 100);
  const punctuality = completed.length ? Math.round((onTime.length / completed.length) * 100) : 0;
  const focusedMinutes = sessions.reduce((sum, item) => sum + item.actualMinutes, 0);
  const breakMinutes = breaks.reduce((sum, item) => sum + item.minutes, 0);
  const targetMinutes = period === 'day' ? 480 : period === 'week' ? 3360 : 14400;
  const focusRate = Math.min(100, Math.round((focusedMinutes / Math.max(1, targetMinutes - breakMinutes)) * 100));
  const wastedMinutes = Math.max(0, targetMinutes - breakMinutes - focusedMinutes);
  const score = Math.round(completion * .5 + punctuality * .25 + focusRate * .2 + (completed.length ? 5 : 0));
  return { score, completion, punctuality, focusedMinutes, breakMinutes, wastedMinutes, completed: completed.length };
}

function chartDayKey(date) {
  const day = new Date(date);
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
}

function renderFocusChart() {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return day;
  });
  const values = days.map((day) => {
    const key = chartDayKey(day);
    const focus = state.sessions.filter((item) => chartDayKey(item.startedAt) === key).reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0);
    const breaks = state.breaks.filter((item) => chartDayKey(item.startedAt) === key).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
    return { focus: Math.min(480, focus), breaks: Math.min(480 - Math.min(480, focus), breaks) };
  });
  if (!values.some((item) => item.focus || item.breaks)) { $('#focusChart').innerHTML = '<div class="chart-empty">ابدأ مؤقت المهام حتى يظهر إيقاع وقتك هنا.</div>'; return; }
  const width = 620, height = 220, baseline = 182, chartHeight = 145, max = 480;
  const bars = values.map((item, index) => {
    const x = 42 + index * 82;
    const focusHeight = (item.focus / max) * chartHeight;
    const breakHeight = (item.breaks / max) * chartHeight;
    const label = days[index].toLocaleDateString('ar-SA', { weekday: 'short' }).replace('،', '');
    return `<line class="chart-gridline" x1="32" y1="${baseline - chartHeight}" x2="604" y2="${baseline - chartHeight}"/><rect x="${x}" y="${baseline - focusHeight}" width="42" height="${focusHeight}" rx="5" fill="#52718a"/><rect x="${x}" y="${baseline - focusHeight - breakHeight}" width="42" height="${breakHeight}" rx="5" fill="#d5a65a"/><text class="chart-label" x="${x + 21}" y="205" text-anchor="middle">${label}</text>${item.focus ? `<text class="chart-value" x="${x + 21}" y="${baseline - focusHeight - breakHeight - 7}" text-anchor="middle">${item.focus}د</text>` : ''}`;
  }).join('');
  $('#focusChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="رسم وقت التركيز والراحة">${bars}</svg>`;
}

function renderJobChart() {
  const grouped = state.jobs.map((job) => {
    const tasks = state.tasks.filter((task) => task.jobId === job.id);
    const completed = tasks.filter((task) => task.status === 'done').length;
    return { job, total: tasks.length, completed, ratio: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 };
  }).filter((item) => item.total);
  if (!grouped.length) { $('#jobChart').innerHTML = '<div class="chart-empty">أضف مهامًا حتى يظهر الإنجاز حسب الوظيفة.</div>'; return; }
  $('#jobChart').innerHTML = grouped.map(({ job, total, completed, ratio }) => `<div class="job-bar"><div class="job-bar-head"><strong>${job.name}</strong><span>${completed} من ${total} · ${ratio}%</span></div><div class="job-bar-track"><div class="job-bar-fill" style="width:${ratio}%;background:${job.color}"></div></div></div>`).join('');
}

function renderAnalytics() {
  const data = analyticsFor();
  $('#analyticsCards').innerHTML = [
    ['النقاط', `${data.score}/100`, 'الالتزام العام'],
    ['الإنجاز', `${data.completion}%`, `${data.completed} مهام مكتملة`],
    ['التركيز', minutes(data.focusedMinutes), `${data.focusRate}% من الوقت المستهدف`],
    ['الوقت غير المفسر', minutes(data.wastedMinutes), `بعد خصم ${minutes(data.breakMinutes)} راحة ومشاوير`]
  ].map(([title, value, hint]) => `<article class="analytics-card"><span>${title}</span><strong>${value}</strong><span>${hint}</span></article>`).join('');
  renderFocusChart();
  renderJobChart();
}

async function updateRemoteTask(task, changes) {
  if (!currentSession || !task?.id || task.id.startsWith('task-') || task.id.startsWith('calendar-')) return;
  const { error } = await supabase.from('focus_tasks').update(changes).eq('id', task.id);
  if (error) throw error;
}

async function startSession(task) {
  if (activeSession) {
    if (activeSession.taskId === task.id) return stopSession(task, 'interrupted');
    throw new Error('هناك مؤقت يعمل لمهمة أخرى');
  }
  const startedAt = new Date().toISOString();
  const session = { taskId: task.id, startedAt, plannedMinutes: task.duration, actualMinutes: 0, outcome: null };
  if (currentSession && task.id && !task.id.startsWith('task-')) {
    const { data, error } = await supabase.from('focus_sessions').insert({ task_id: task.id, started_at: startedAt, planned_minutes: task.duration }).select().single();
    if (error) throw error;
    session.id = data.id;
  }
  activeSession = session;
  localStorage.setItem('focuspilot-active-session', JSON.stringify(activeSession));
  task.status = 'in_progress'; task.startedAt = startedAt;
  await updateRemoteTask(task, { status: 'in_progress', started_at: startedAt });
}

async function stopSession(task, outcome = 'interrupted') {
  if (!activeSession || activeSession.taskId !== task.id) return;
  const endedAt = new Date().toISOString();
  const actualMinutes = Math.max(1, Math.round((new Date(endedAt) - new Date(activeSession.startedAt)) / 60000));
  if (currentSession && activeSession.id) {
    const { error } = await supabase.from('focus_sessions').update({ ended_at: endedAt, actual_minutes: actualMinutes, outcome }).eq('id', activeSession.id);
    if (error) throw error;
  }
  state.sessions.push({ id: activeSession.id || `session-${Date.now()}`, taskId: task.id, startedAt: activeSession.startedAt, endedAt, plannedMinutes: activeSession.plannedMinutes, actualMinutes, outcome });
  activeSession = null;
  localStorage.removeItem('focuspilot-active-session');
}

async function deleteRemoteJob(jobId) {
  if (!currentSession || jobId.startsWith('job-')) return;
  const { error: tasksError } = await supabase.from('focus_tasks').delete().eq('job_id', jobId);
  if (tasksError) throw tasksError;
  const { error: jobError } = await supabase.from('focus_jobs').delete().eq('id', jobId);
  if (jobError) throw jobError;
}

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) { document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === nav)); document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden')); $(`#${nav.dataset.view}View`).classList.remove('hidden'); }
  const action = event.target.closest('[data-action]');
  if (action) {
    const task = state.tasks.find((item) => item.id === action.dataset.id);
    try {
      if (action.dataset.action === 'done' && task) {
        if (activeSession?.taskId === task.id) await stopSession(task, 'completed');
        const completedAt = new Date().toISOString();
        await updateRemoteTask(task, { status: 'done', completed_at: completedAt });
        task.status = 'done'; task.completedAt = completedAt;
      }
      if (action.dataset.action === 'start' && task) {
        await startSession(task);
      }
      if (action.dataset.action === 'skip' && task) {
        const due = new Date(Date.now() + 864e5).toISOString();
        await updateRemoteTask(task, { status: 'skipped', due_at: due });
        task.due = due; task.status = 'skipped';
      }
      if (action.dataset.action === 'delete-job') {
        await deleteRemoteJob(action.dataset.id);
        state.jobs = state.jobs.filter((job) => job.id !== action.dataset.id);
        state.tasks = state.tasks.filter((item) => item.jobId !== action.dataset.id);
      }
      save(); render();
    } catch (error) { showError(error); }
  }
  const closer = event.target.closest('[data-close]'); if (closer) closeModal(closer.dataset.close);
});
$('#addTaskTop').onclick = $('#addTaskList').onclick = () => openModal('taskModal');
$('#addJob').onclick = () => openModal('jobModal');
const resetDemo = $('#resetDemo');
if (resetDemo) resetDemo.onclick = () => { state = JSON.parse(JSON.stringify(demo)); save(); render(); };
$('#taskForm').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const task = { title: form.get('title'), jobId: form.get('jobId'), duration: Number(form.get('duration')), due: form.get('due'), importance: Number(form.get('importance')), status: 'pending', startedAt: null, completedAt: null };
  try {
    if (currentSession) {
      const { data, error } = await supabase.from('focus_tasks').insert({ job_id: task.jobId, title: task.title, duration_minutes: task.duration, due_at: task.due, importance: task.importance, status: task.status }).select().single();
      if (error) throw error;
      task.id = data.id;
    } else task.id = `task-${Date.now()}`;
    state.tasks.push(task); save(); event.target.reset(); closeModal('taskModal'); render();
    if (currentSession && googleCalendarConnected) {
      try {
        await calendarFunction({ action: 'push_task', task: { id: task.id, title: task.title, due: task.due, duration: task.duration } });
      } catch (calendarError) {
        console.error(calendarError);
        $('#calendarMessage').textContent = 'تم حفظ المهمة، لكن تعذرت إضافتها إلى Google Calendar.';
      }
    }
  } catch (error) { showError(error); }
};
$('#jobForm').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const job = { name: form.get('name'), salary: Number(form.get('salary')), color: form.get('color') };
  try {
    if (currentSession) {
      const { data, error } = await supabase.from('focus_jobs').insert({ name: job.name, monthly_salary: job.salary, color: job.color }).select().single();
      if (error) throw error;
      job.id = data.id;
    } else job.id = `job-${Date.now()}`;
    state.jobs.push(job); save(); event.target.reset(); closeModal('jobModal'); render();
  } catch (error) { showError(error); }
};
$('#breakForm').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const item = { type: form.get('type'), minutes: Number(form.get('minutes')), startedAt: new Date().toISOString(), endedAt: null };
  try {
    const { data, error } = await supabase.from('focus_breaks').insert({ break_type: item.type, planned_minutes: item.minutes, started_at: item.startedAt }).select().single();
    if (error) throw error;
    item.id = data.id; state.breaks.unshift(item); save(); event.target.reset(); closeModal('breakModal'); render();
  } catch (error) { showError(error); }
};
render();

function updateAccountButton() {
  $('#loginTop').textContent = currentSession ? 'تسجيل الخروج' : 'تسجيل الدخول';
  document.body.classList.toggle('authenticated', Boolean(currentSession));
  document.body.classList.toggle('auth-ready', authReady);
}

async function seedRemoteData() {
  if (!currentSession || state.jobs.length === 0) return;
  const { data: jobs, error: jobsError } = await supabase.from('focus_jobs').insert(state.jobs.map((job) => ({ name: job.name, monthly_salary: job.salary, color: job.color }))).select();
  if (jobsError) throw jobsError;
  const jobMap = new Map(state.jobs.map((job, index) => [job.id, jobs[index]?.id]));
  const remoteTasks = state.tasks.map((task) => ({ job_id: jobMap.get(task.jobId), title: task.title, duration_minutes: task.duration, due_at: task.due, importance: task.importance, status: task.status, started_at: task.startedAt }));
  const { error: tasksError } = await supabase.from('focus_tasks').insert(remoteTasks);
  if (tasksError) throw tasksError;
}

async function syncRemote() {
  if (!currentSession) return;
  const [{ data: remoteJobs, error: jobsError }, { data: remoteTasks, error: tasksError }, { data: remoteBreaks, error: breaksError }, { data: remoteSessions, error: sessionsError }] = await Promise.all([
    supabase.from('focus_jobs').select('*').order('created_at'),
    supabase.from('focus_tasks').select('*').order('due_at'),
    supabase.from('focus_breaks').select('*').order('started_at', { ascending: false }),
    supabase.from('focus_sessions').select('*').order('started_at', { ascending: false })
  ]);
  if (jobsError || tasksError || breaksError || sessionsError) throw jobsError || tasksError || breaksError || sessionsError;
  if (!remoteJobs?.length) {
    await seedRemoteData();
    return syncRemote();
  }
  const remoteJobsById = new Map(remoteJobs.map((job) => [job.id, job]));
  state.jobs = remoteJobs.map((job) => ({ id: job.id, name: job.name, salary: Number(job.monthly_salary), color: job.color }));
  state.tasks = (remoteTasks || []).map((task) => ({ id: task.id, jobId: task.job_id, title: task.title, duration: task.duration_minutes, due: task.due_at, importance: Number(task.importance), status: task.status, startedAt: task.started_at, completedAt: task.completed_at })).filter((task) => remoteJobsById.has(task.jobId));
  state.breaks = (remoteBreaks || []).map((item) => ({ id: item.id, type: item.break_type, minutes: item.planned_minutes, startedAt: item.started_at, endedAt: item.ended_at }));
  state.sessions = (remoteSessions || []).filter((item) => item.ended_at && item.actual_minutes).map((item) => ({ id: item.id, taskId: item.task_id, startedAt: item.started_at, endedAt: item.ended_at, plannedMinutes: item.planned_minutes, actualMinutes: item.actual_minutes, outcome: item.outcome }));
  save();
  render();
}

async function startAuth() {
  const form = new FormData($('#authForm'));
  const message = $('#authMessage');
  message.textContent = 'جارٍ الاتصال...';
  const { error } = await supabase.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
  if (error) { message.textContent = error.message; return; }
  closeModal('authModal');
  await refreshSession();
}

async function signUp() {
  const form = new FormData($('#authForm'));
  const message = $('#authMessage');
  message.textContent = 'جارٍ إنشاء الحساب...';
  const { error } = await supabase.auth.signUp({ email: form.get('email'), password: form.get('password'), options: { emailRedirectTo: window.location.origin } });
  message.textContent = error ? error.message : 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجل الدخول.';
}

async function connectGoogleCalendar() {
  if (!currentSession) { openModal('authModal'); return; }
  $('#calendarMessage').textContent = 'نجهز تفويض Google للتقويم...';
  const { data: identities } = await supabase.auth.getUserIdentities();
  const googleIdentity = identities?.identities?.find((identity) => identity.provider === 'google');
  if (googleIdentity) {
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
    if (unlinkError) {
      $('#calendarMessage').textContent = 'تعذر تجديد تفويض Google. تأكد أنك سجلت الدخول بالبريد وكلمة المرور ثم حاول مرة أخرى.';
      return;
    }
  }
  $('#calendarMessage').textContent = 'سيتم فتح Google للموافقة على قراءة وكتابة أحداث التقويم...';
  sessionStorage.setItem('focuspilot-google-link-pending', '1');
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) {
    sessionStorage.removeItem('focuspilot-google-link-pending');
    $('#calendarMessage').textContent = error.message;
  }
}

async function syncGoogleCalendar({ announce = true } = {}) {
  if (!currentSession) { openModal('authModal'); return; }
  if (announce) $('#calendarMessage').textContent = 'جارٍ قراءة أحداث Google Calendar...';
  try {
    const result = await calendarFunction({ action: 'sync' });
    googleCalendarConnected = true;
    await syncRemote();
    if (announce) $('#calendarMessage').textContent = `تمت المزامنة. تمت قراءة ${result.imported || 0} حدث جديد.`;
  } catch (error) {
    console.error(error);
    googleCalendarConnected = false;
    if (announce) $('#calendarMessage').textContent = error.message || 'تعذرت مزامنة Google Calendar.';
  }
}

async function refreshSession() {
  try {
    const { data } = await supabase.auth.getSession();
    currentSession = data.session;
    updateAccountButton();
    if (currentSession) {
      try { await syncRemote(); } catch (error) { console.error(error); }
      const { data: connection } = await supabase.from('focus_calendar_connections').select('user_id').maybeSingle();
      googleCalendarConnected = Boolean(connection);
      if (sessionStorage.getItem('focuspilot-google-link-pending')) {
        sessionStorage.removeItem('focuspilot-google-link-pending');
        const { data: identities } = await supabase.auth.getUserIdentities();
        const linked = identities?.identities?.some((identity) => identity.provider === 'google');
        if (linked) {
          openModal('calendarModal');
          const refreshToken = currentSession.provider_refresh_token;
          if (!refreshToken) {
            $('#calendarMessage').textContent = 'تم ربط Google، لكن لم يصل رمز المزامنة. أعد الربط مع تفعيل الموافقة مرة أخرى.';
          } else {
            try {
              await calendarFunction({ action: 'connect', refresh_token: refreshToken, calendar_id: 'primary' });
              googleCalendarConnected = true;
              await syncGoogleCalendar();
            } catch (error) {
              console.error(error);
              $('#calendarMessage').textContent = error.message || 'تم الربط لكن تعذرت تهيئة المزامنة.';
            }
          }
        }
      }
    }
  } finally {
    authReady = true;
    updateAccountButton();
  }
}

function parseIcsDate(value) {
  if (!value) return null;
  const clean = value.replace(/^.*:/, '').trim();
  if (/^\d{8}T\d{6}Z$/.test(clean)) return new Date(clean.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
  if (/^\d{8}T\d{6}$/.test(clean)) return new Date(clean.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
  return null;
}

async function importIcs(file) {
  const text = await file.text();
  const events = [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((match) => match[1]);
  const job = state.jobs[0];
  if (!job) { $('#calendarMessage').textContent = 'أضف وظيفة أولًا قبل استيراد أحداث التقويم.'; return; }
  let imported = 0;
  events.forEach((event) => {
    const title = event.match(/^SUMMARY(?:;[^:]+)?:([^\r\n]*)/m)?.[1]?.trim();
    const start = parseIcsDate(event.match(/^DTSTART(?:;[^:]+)?:([^\r\n]*)/m)?.[0]);
    const end = parseIcsDate(event.match(/^DTEND(?:;[^:]+)?:([^\r\n]*)/m)?.[0]) || start;
    if (!title || !start) return;
    state.tasks.push({ id: `calendar-${Date.now()}-${imported}`, jobId: job.id, title: `تقويم: ${title}`, duration: Math.max(15, Math.round(((end - start) / 60000) || 30)), due: start.toISOString(), importance: 1, status: 'pending', startedAt: null, completedAt: null });
    imported += 1;
  });
  save(); render();
  $('#calendarMessage').textContent = `تم استيراد ${imported} حدث من الملف.`;
}

$('#authForm').onsubmit = (event) => { event.preventDefault(); void startAuth(); };
$('#signupButton').onclick = () => { void signUp(); };
$('#gateLogin').onclick = () => openModal('authModal');
$('#loginTop').onclick = async () => { if (currentSession) { await supabase.auth.signOut(); currentSession = null; updateAccountButton(); return; } openModal('authModal'); };
$('#calendarTop').onclick = () => openModal('calendarModal');
$('#breakTop').onclick = () => openModal('breakModal');
$('#googleConnect').onclick = () => { void connectGoogleCalendar(); };
$('#googleSync').onclick = () => { void syncGoogleCalendar(); };
$('#analyticsPeriod').onchange = () => renderAnalytics();
$('#icsInput').onchange = (event) => { if (event.target.files[0]) void importIcs(event.target.files[0]); };
supabase.auth.onAuthStateChange((_event, session) => {
  if (session || authReady) {
    currentSession = session;
    updateAccountButton();
    if (session) void syncRemote();
  }
});
void refreshSession();
