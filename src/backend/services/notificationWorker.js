/**
 * Email Notification Worker
 * Polls every 60 s, processes pending jobs, builds official-format routine emails,
 * sends via SMTP, logs every delivery, retries failures up to 3 times.
 */

import nodemailer from 'nodemailer';
import { supabase } from '../config/supabaseClient.js';
import { notificationCoreService } from './notificationCoreService.js';

const ROUTINE_ROW_ID = '00000000-0000-0000-0000-000000000001';

const SEMESTER_MAP = {
  'Y1-S1': { year: '1st Year', semester: '1st Semester', academicYear: '1st' },
  'Y1-S2': { year: '1st Year', semester: '2nd Semester', academicYear: '1st' },
  'Y2-S1': { year: '2nd Year', semester: '1st Semester', academicYear: '2nd' },
  'Y2-S2': { year: '2nd Year', semester: '2nd Semester', academicYear: '2nd' },
  'Y3-S1': { year: '3rd Year', semester: '1st Semester', academicYear: '3rd' },
  'Y3-S2': { year: '3rd Year', semester: '2nd Semester', academicYear: '3rd' },
  'Y4-S1': { year: '4th Year', semester: '1st Semester', academicYear: '4th' },
  'Y4-S2': { year: '4th Year', semester: '2nd Semester', academicYear: '4th' },
  'MS-S1': { year: 'Master',   semester: '1st Semester', academicYear: 'ms'  },
  'MS-S2': { year: 'Master',   semester: '2nd Semester', academicYear: 'ms'  },
};

// ── SMTP ──────────────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
const canSend = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

async function sendEmail({ to, subject, html }) {
  if (!canSend()) {
    console.log(`[DEV-MAIL] "${subject}" → ${to}`);
    return { success: true, dev: true };
  }
  try {
    await createTransporter().sendMail({
      from: `"${process.env.FROM_NAME || 'CSE, University of Dhaka'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to, subject, html,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Data Loader ───────────────────────────────────────────────────────────────
async function loadRoutineData() {
  const [routineRes, coursesRes, teachersRes, studentsRes, settingsRes] = await Promise.all([
    supabase.from('routine_storage').select('entries,published_label').eq('id', ROUTINE_ROW_ID).maybeSingle(),
    supabase.from('courses').select('id,code,title,course_type,year,semester').eq('is_active', true),
    supabase.from('teachers').select('id,name,initials,email').eq('is_active', true),
    supabase.from('students').select('id,name,email,institutional_email,academic_year').eq('is_active', true),
    supabase.from('class_time_settings').select('*').eq('is_active', true).maybeSingle(),
  ]);
  return {
    entries:        routineRes.data?.entries || [],
    publishedLabel: routineRes.data?.published_label || 'Class Routine',
    courses:        coursesRes.data  || [],
    teachers:       teachersRes.data || [],
    students:       studentsRes.data || [],
    settings:       settingsRes.data || null,
  };
}

// ── Time / Slot Helpers ───────────────────────────────────────────────────────
function parseMinutes(t) {
  if (!t) return 8 * 60 + 30;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}
function parseDurMins(v, fallback) {
  if (!v) return fallback;
  const s = String(v);
  if (s.includes(':')) { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); }
  return parseInt(s) || fallback;
}
function mins12(m) {
  const h = Math.floor(m / 60), min = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}

function buildSlots(settings) {
  if (!settings) return [];
  const before = parseInt(settings.classes_before_lunch) || parseInt(settings.classesBeforeLunch) || 3;
  const after  = parseInt(settings.classes_after_lunch)  || parseInt(settings.classesAfterLunch)  || 2;
  const dur    = parseDurMins(settings.duration, 75);
  const skip   = parseInt(settings.skipTime) || 0;
  const lunch  = parseDurMins(settings.lunchDuration || settings.lunch_duration, 45);
  let cur = parseMinutes(settings.startTime || settings.start_time);
  const slots = [];
  for (let i = 0; i < before; i++) {
    const end = cur + dur;
    slots.push({ id: `s${i+1}`, label: mins12(cur), labelEnd: mins12(end), type: 'class' });
    cur = i < before - 1 ? end + skip : end;
  }
  if (before > 0 && lunch > 0) {
    slots.push({ id: 'lunch', label: mins12(cur), labelEnd: mins12(cur + lunch), type: 'break' });
    cur += lunch;
  }
  for (let i = 0; i < after; i++) {
    const end = cur + dur;
    slots.push({ id: `s${before+1+i}`, label: mins12(cur), labelEnd: mins12(end), type: 'class' });
    cur = end + skip;
  }
  return slots;
}

const WEEK_ALL = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
function getDays(settings) {
  const cd = settings?.class_day || settings?.classDay;
  if (!cd) return WEEK_ALL.slice(0, 6);
  const [s, e] = cd.split('-').map(d => d.trim());
  const si = WEEK_ALL.indexOf(s), ei = WEEK_ALL.indexOf(e);
  if (si === -1 || ei === -1) return WEEK_ALL.slice(0, 6);
  const days = []; let i = si;
  while (true) { days.push(WEEK_ALL[i]); if (i === ei) break; i = (i + 1) % WEEK_ALL.length; }
  return days;
}

// ── Email HTML Builder (Official Routine Format) ───────────────────────────────
function buildUnsubLink(email) {
  const base = process.env.APP_URL || `http://localhost:${process.env.VITE_PORT || 5173}`;
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}`;
}

function buildRoutineEmail({
  semId, semInfo, semLabel, title,
  semEntries, allEntries,
  courses, teachers,
  slots, days,
  recipientEmail, recipientName,
  highlightTeacherId = null,
}) {
  const courseMap  = Object.fromEntries(courses.map(c => [c.id, c]));
  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

  // Build grid: day → slotId → entries[]
  const grid = {};
  days.forEach(d => {
    grid[d] = {};
    slots.filter(s => s.type === 'class').forEach(s => { grid[d][s.id] = []; });
  });
  semEntries.forEach(e => {
    if (grid[e.day_of_week]?.[e.slot_id] !== undefined) grid[e.day_of_week][e.slot_id].push(e);
  });

  // Separate theory vs lab
  const theoryCourseIds = [...new Set(semEntries.filter(e => courseMap[e.course_id]?.course_type !== 'lab').map(e => e.course_id))];
  const labCourseIds    = [...new Set(semEntries.filter(e => courseMap[e.course_id]?.course_type === 'lab').map(e => e.course_id))];

  // Collect teacher info per course
  const courseTeacherMap = {};
  semEntries.forEach(e => {
    const t = teacherMap[e.teacher_id];
    if (!t) return;
    if (!courseTeacherMap[e.course_id]) courseTeacherMap[e.course_id] = new Map();
    courseTeacherMap[e.course_id].set(t.id, t);
  });

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;

  const navy   = '#1a3a52';
  const border = '#c0c0c0';
  const hdrBg  = '#1a3a52';
  const breakBg = '#f0f4f8';
  const cp     = '5px 6px';
  const font   = "'Segoe UI',Arial,sans-serif";

  // Slot headers
  const slotHeaders = slots.map(s => {
    if (s.type === 'break') {
      return `<th style="background:${breakBg};color:#555;font-size:10px;padding:${cp};border:1px solid ${border};text-align:center;width:28px;">Break</th>`;
    }
    return `<th style="background:${hdrBg};color:white;font-size:10px;font-weight:700;padding:${cp};border:1px solid ${border};text-align:center;white-space:nowrap;">
      ${s.label}<br><span style="font-weight:400;font-size:9px;">– ${s.labelEnd}</span>
    </th>`;
  }).join('');

  // Routine rows
  const routineRows = days.map(day => {
    const cells = slots.map(s => {
      if (s.type === 'break') return `<td style="background:${breakBg};border:1px solid ${border};"></td>`;
      const entries = grid[day]?.[s.id] || [];
      if (!entries.length) return `<td style="border:1px solid ${border};text-align:center;color:#d1d5db;font-size:10px;padding:${cp};">—</td>`;
      const content = entries.map(e => {
        const c   = courseMap[e.course_id];
        const t   = teacherMap[e.teacher_id];
        const hl  = highlightTeacherId && e.teacher_id === highlightTeacherId;
        const isLab = c?.course_type === 'lab';
        const bg  = hl ? '#fff3cd' : isLab ? '#f0fff4' : 'transparent';
        const init = t ? t.initials || t.name?.split(' ').map(w=>w[0]).join('') : null;
        return `<div style="background:${bg};border-radius:3px;padding:2px 3px;margin:1px 0;font-size:10px;line-height:1.4;">
          <strong style="color:${navy};">${c?.code || '?'}</strong>
          ${init ? `<span style="color:#374151;"> [${init}]</span>` : ''}
          ${e.room ? `<span style="color:#6b7280;font-size:9px;"> [R# ${e.room}]</span>` : ''}
        </div>`;
      }).join('');
      return `<td style="border:1px solid ${border};padding:3px 4px;vertical-align:top;">${content}</td>`;
    }).join('');
    return `<tr>
      <td style="background:#f8fafc;border:1px solid ${border};padding:${cp};font-size:10px;font-weight:700;white-space:nowrap;color:${navy};">${day}</td>
      ${cells}
    </tr>`;
  }).join('');

  // Legend builder
  const legend = (ids) => ids.map(cid => {
    const c = courseMap[cid];
    if (!c) return '';
    const teachers = courseTeacherMap[cid]
      ? [...courseTeacherMap[cid].values()].map(t => `(${t.initials || t.name?.split(' ').map(w=>w[0]).join('')}): ${t.name}`).join('<br>')
      : '—';
    return `<tr>
      <td style="padding:4px 8px;border:1px solid ${border};font-size:11px;">${c.code}: ${c.title}</td>
      <td style="padding:4px 8px;border:1px solid ${border};font-size:11px;">${teachers}</td>
    </tr>`;
  }).join('');

  const theoryLegend = legend(theoryCourseIds);
  const labLegend    = legend(labCourseIds);
  const greeting     = highlightTeacherId ? `Dear ${recipientName || 'Teacher'},` : `Dear ${recipientName || 'Student'},`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#eef2f7;font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:20px 8px;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12);max-width:100%;">

  <!-- Header -->
  <tr><td style="background:${hdrBg};padding:16px 24px;">
    <table width="100%"><tr>
      <td>
        <div style="color:white;font-size:15px;font-weight:700;line-height:1.4;">Department of Computer Science &amp; Engineering</div>
        <div style="color:rgba(255,255,255,.75);font-size:11px;">University of Dhaka, Dhaka-1000, Bangladesh</div>
      </td>
      <td align="right" style="vertical-align:top;">
        <div style="color:rgba(255,255,255,.65);font-size:10px;text-align:right;line-height:1.7;">
          Web: www.du.ac.bd/body/CSE<br>
          Email: office@cse.du.ac.bd<br>
          PABX: +88 09666911463
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Date -->
  <tr><td style="padding:6px 24px 0;border-bottom:1px solid #e5e7eb;">
    <span style="font-size:11px;color:#6b7280;">Date: ${dateStr}</span>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:14px 24px 8px;text-align:center;">
    <div style="font-size:13px;font-weight:700;color:${navy};">Department of Computer Science and Engineering</div>
    <div style="font-size:12px;color:#374151;">University of Dhaka</div>
    <div style="font-size:14px;font-weight:700;color:${navy};margin-top:6px;">${title}</div>
    <div style="font-size:12px;font-weight:600;color:#374151;margin-top:2px;">Regular Class Routine (Published)</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:4px 24px 10px;">
    <p style="font-size:13px;color:#374151;margin:0;">
      ${greeting}<br>
      The class routine for <strong>${semLabel}</strong> has been published. Please find the schedule below.
    </p>
  </td></tr>

  <!-- Routine table -->
  <tr><td style="padding:0 14px 14px;">
    <div style="overflow-x:auto;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;min-width:480px;">
        <thead><tr>
          <th style="background:${hdrBg};color:white;font-size:10px;padding:${cp};border:1px solid ${border};text-align:left;min-width:68px;">Day</th>
          ${slotHeaders}
        </tr></thead>
        <tbody>${routineRows}</tbody>
      </table>
    </div>
  </td></tr>

  ${theoryLegend ? `
  <tr><td style="padding:0 14px 8px;">
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr><th colspan="2" style="background:#f1f5f9;padding:6px 8px;border:1px solid ${border};font-size:11px;text-align:left;color:${navy};">Course</th></tr>
        <tr>
          <th style="background:#f8fafc;padding:4px 8px;border:1px solid ${border};font-size:10px;font-weight:700;width:58%;">Course Name</th>
          <th style="background:#f8fafc;padding:4px 8px;border:1px solid ${border};font-size:10px;font-weight:700;width:42%;">Course Teacher</th>
        </tr>
      </thead>
      <tbody>${theoryLegend}</tbody>
    </table>
  </td></tr>` : ''}

  ${labLegend ? `
  <tr><td style="padding:4px 14px 8px;">
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr><th colspan="2" style="background:#f1f5f9;padding:6px 8px;border:1px solid ${border};font-size:11px;text-align:left;color:${navy};">Lab</th></tr>
        <tr>
          <th style="background:#f8fafc;padding:4px 8px;border:1px solid ${border};font-size:10px;font-weight:700;width:58%;">Lab Name</th>
          <th style="background:#f8fafc;padding:4px 8px;border:1px solid ${border};font-size:10px;font-weight:700;width:42%;">Lab Teacher</th>
        </tr>
      </thead>
      <tbody>${labLegend}</tbody>
    </table>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:16px 24px;border-top:1px solid #f1f5f9;text-align:center;">
    <div style="font-size:11px;color:#9ca3af;">
      This is an automated notification from the Academic Operation Suite.<br>
      Department of Computer Science &amp; Engineering, University of Dhaka<br>
      <a href="${buildUnsubLink(recipientEmail)}" style="color:#9ca3af;font-size:10px;margin-top:4px;display:inline-block;">Unsubscribe from routine notifications</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  return { subject: `[${semLabel}] Class Routine Published`, html };
}

// ── Job Processor ─────────────────────────────────────────────────────────────
async function processRoutinePublished(job) {
  const { entries, publishedLabel, courses, teachers, students, settings } = await loadRoutineData();

  const semId    = job.trigger_ref?.semesterId;
  const semInfo  = SEMESTER_MAP[semId] || {};
  const semLabel = job.trigger_ref?.label || publishedLabel;
  const title    = semInfo.year && semInfo.semester ? `${semInfo.year} ${semInfo.semester}` : semLabel;

  const semEntries = semId ? entries.filter(e => e.semester === semId) : entries;
  if (!semEntries.length) {
    await notificationCoreService.markJobCompleted(job.id, 0, 0);
    return;
  }

  const slots = buildSlots(settings);
  const days  = getDays(settings);
  const recipients = [];

  // Students matching this semester's academic year
  if (semInfo.academicYear) {
    for (const student of students) {
      if (student.academic_year !== semInfo.academicYear) continue;
      const email = student.institutional_email || student.email;
      if (!email) continue;
      if (await notificationCoreService.isOptedOut(email)) continue;
      const { subject } = buildRoutineEmail({ semId, semInfo, semLabel, title, semEntries, allEntries: entries, courses, teachers, slots, days, recipientEmail: email, recipientName: student.name });
      recipients.push({ type: 'student', id: student.id, email, name: student.name, subject });
    }
  }

  // Teachers assigned to courses in this semester
  const teacherIdsInSem = [...new Set(semEntries.map(e => e.teacher_id).filter(Boolean))];
  for (const teacher of teachers) {
    if (!teacherIdsInSem.includes(teacher.id)) continue;
    if (!teacher.email) continue;
    if (await notificationCoreService.isOptedOut(teacher.email)) continue;
    const { subject } = buildRoutineEmail({ semId, semInfo, semLabel, title, semEntries, allEntries: entries, courses, teachers, slots, days, recipientEmail: teacher.email, recipientName: teacher.name, highlightTeacherId: teacher.id });
    recipients.push({ type: 'teacher', id: teacher.id, email: teacher.email, name: teacher.name, subject });
  }

  await notificationCoreService.createDeliveries(job.id, recipients);
  await notificationCoreService.updateJobTotal(job.id, recipients.length);

  const deliveries = await notificationCoreService.getPendingDeliveries(job.id);
  let sent = 0, failed = 0;

  for (const delivery of deliveries) {
    const isTeacher = delivery.recipient_type === 'teacher';
    const teacher   = isTeacher ? teachers.find(t => t.id === delivery.recipient_id) : null;
    const emailContent = buildRoutineEmail({
      semId, semInfo, semLabel, title,
      semEntries, allEntries: entries,
      courses, teachers, slots, days,
      recipientEmail: delivery.recipient_email,
      recipientName:  delivery.recipient_name,
      highlightTeacherId: isTeacher && teacher ? teacher.id : null,
    });

    const result = await sendEmail({ to: delivery.recipient_email, ...emailContent });
    if (result.success) {
      await notificationCoreService.markDeliverySent(delivery.id);
      sent++;
    } else {
      await notificationCoreService.markDeliveryFailed(delivery.id, result.error, 1);
      failed++;
    }
    await delay(600);
  }

  await notificationCoreService.markJobCompleted(job.id, sent, failed);
  console.log(`[NotificationWorker] job ${job.id} (${semId}) done — sent:${sent} failed:${failed}`);
}

// ── Retry ─────────────────────────────────────────────────────────────────────
async function retryFailedDeliveries() {
  const retryable = await notificationCoreService.getRetryableDeliveries();
  if (!retryable.length) return;

  const { entries, courses, teachers, students, settings } = await loadRoutineData();
  const slots = buildSlots(settings);
  const days  = getDays(settings);

  for (const delivery of retryable) {
    const newAttempts = (delivery.attempts || 0) + 1;
    const { data: jobRow } = await supabase.from('email_notification_jobs').select('trigger_ref').eq('id', delivery.job_id).maybeSingle();
    const semId    = jobRow?.trigger_ref?.semesterId;
    const semInfo  = SEMESTER_MAP[semId] || {};
    const semLabel = jobRow?.trigger_ref?.label || semId || 'Class Routine';
    const title    = semInfo.year && semInfo.semester ? `${semInfo.year} ${semInfo.semester}` : semLabel;
    const semEntries = semId ? entries.filter(e => e.semester === semId) : entries;

    const isTeacher = delivery.recipient_type === 'teacher';
    const teacher   = isTeacher ? teachers.find(t => t.id === delivery.recipient_id) : null;
    const emailContent = buildRoutineEmail({
      semId, semInfo, semLabel, title, semEntries, allEntries: entries,
      courses, teachers, slots, days,
      recipientEmail: delivery.recipient_email,
      recipientName:  delivery.recipient_name,
      highlightTeacherId: isTeacher && teacher ? teacher.id : null,
    });

    const result = await sendEmail({ to: delivery.recipient_email, ...emailContent });
    if (result.success) {
      await notificationCoreService.markDeliverySent(delivery.id);
    } else {
      await notificationCoreService.markDeliveryFailed(delivery.id, result.error, newAttempts);
    }
    await delay(600);
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────
let workerRunning = false;

async function tick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const job = await notificationCoreService.getNextPendingJob();
    if (job) {
      console.log(`[NotificationWorker] processing job ${job.id} (${job.type})`);
      await notificationCoreService.markJobProcessing(job.id);
      if (job.type === 'routine_published') {
        await processRoutinePublished(job);
      } else {
        await notificationCoreService.markJobFailed(job.id, `Unknown type: ${job.type}`);
      }
    }
    await retryFailedDeliveries();
  } catch (err) {
    console.error('[NotificationWorker] tick error:', err.message);
  } finally {
    workerRunning = false;
  }
}

export function startNotificationWorker(intervalMs = 60_000) {
  console.log(`[NotificationWorker] started — poll every ${intervalMs / 1000}s`);
  tick();
  setInterval(tick, intervalMs);
}
