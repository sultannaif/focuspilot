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
}
function taskCard(task) {
  const job = jobById(task.jobId) || { name: 'غير مصنف', color: '#94a3b8' };
  return `<article class="task-card ${task.status === 'done' ? 'done' : ''} ${orderedTasks()[0]?.id === task.id ? 'is-focus' : ''}"><div class="task-rank" style="color:${job.color}">${task.status === 'done' ? '✓' : priorityScore(task)}</div><div><div class="task-name">${task.title}</div><div class="task-meta"><span style="color:${job.color}">${job.name}</span> · ${minutes(task.duration)} · التسليم ${new Date(task.due).toLocaleString('ar-SA', { hour: 'numeric', minute: '2-digit' })}</div></div><div class="task-buttons">${task.status === 'done' ? '<span class="task-score">مكتملة</span>' : `<button class="small-button" data-action="done" data-id="${task.id}">أنجزتها</button><button class="small-button secondary" data-action="start" data-id="${task.id}">ابدأ</button>`}</div></article>`;
}
function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }
document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) { document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === nav)); document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden')); $(`#${nav.dataset.view}View`).classList.remove('hidden'); }
  const action = event.target.closest('[data-action]');
  if (action) { const task = state.tasks.find((item) => item.id === action.dataset.id); if (action.dataset.action === 'done' && task) task.status = 'done'; if (action.dataset.action === 'start' && task) task.startedAt = task.startedAt || new Date().toISOString(); if (action.dataset.action === 'skip' && task) task.due = new Date(Date.now() + 864e5).toISOString(); if (action.dataset.action === 'delete-job') state.jobs = state.jobs.filter((job) => job.id !== action.dataset.id); save(); render(); }
  const closer = event.target.closest('[data-close]'); if (closer) closeModal(closer.dataset.close);
});
$('#addTaskTop').onclick = $('#addTaskList').onclick = () => openModal('taskModal');
$('#addJob').onclick = () => openModal('jobModal');
const resetDemo = $('#resetDemo');
if (resetDemo) resetDemo.onclick = () => { state = JSON.parse(JSON.stringify(demo)); save(); render(); };
$('#taskForm').onsubmit = (event) => { event.preventDefault(); const form = new FormData(event.target); state.tasks.push({ id: `task-${Date.now()}`, title: form.get('title'), jobId: form.get('jobId'), duration: Number(form.get('duration')), due: form.get('due'), importance: Number(form.get('importance')), status: 'pending', startedAt: null, completedAt: null }); save(); event.target.reset(); closeModal('taskModal'); render(); };
$('#jobForm').onsubmit = (event) => { event.preventDefault(); const form = new FormData(event.target); state.jobs.push({ id: `job-${Date.now()}`, name: form.get('name'), salary: Number(form.get('salary')), color: form.get('color') }); save(); event.target.reset(); closeModal('jobModal'); render(); };
render();

let currentSession = null;

function updateAccountButton() {
  $('#loginTop').textContent = currentSession ? 'تسجيل الخروج' : 'تسجيل الدخول';
  document.body.classList.toggle('authenticated', Boolean(currentSession));
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
  const [{ data: remoteJobs, error: jobsError }, { data: remoteTasks, error: tasksError }] = await Promise.all([
    supabase.from('focus_jobs').select('*').order('created_at'),
    supabase.from('focus_tasks').select('*').order('due_at')
  ]);
  if (jobsError || tasksError) throw jobsError || tasksError;
  if (!remoteJobs?.length) {
    await seedRemoteData();
    return syncRemote();
  }
  const remoteJobsById = new Map(remoteJobs.map((job) => [job.id, job]));
  state.jobs = remoteJobs.map((job) => ({ id: job.id, name: job.name, salary: Number(job.monthly_salary), color: job.color }));
  state.tasks = (remoteTasks || []).map((task) => ({ id: task.id, jobId: task.job_id, title: task.title, duration: task.duration_minutes, due: task.due_at, importance: Number(task.importance), status: task.status, startedAt: task.started_at, completedAt: task.completed_at })).filter((task) => remoteJobsById.has(task.jobId));
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

async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  updateAccountButton();
  if (currentSession) {
    try { await syncRemote(); } catch (error) { console.error(error); }
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
$('#icsInput').onchange = (event) => { if (event.target.files[0]) void importIcs(event.target.files[0]); };
supabase.auth.onAuthStateChange((_event, session) => { currentSession = session; updateAccountButton(); if (session) void syncRemote(); });
void refreshSession();
