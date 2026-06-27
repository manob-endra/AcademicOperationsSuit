import { supabase } from '../config/supabaseClient.js';
import crypto from 'crypto';

const JOBS_TABLE  = 'email_notification_jobs';
const DELIV_TABLE = 'email_notification_deliveries';
const PREFS_TABLE = 'email_notification_prefs';

export const notificationCoreService = {

  // ── Jobs ──────────────────────────────────────────────────────────────────

  /**
   * Create a job. Returns { success, job } or { success:false, duplicate:true }
   * if a job for (type, triggerId) already exists.
   */
  async createJob(type, triggerId, triggerRef = {}) {
    try {
      const { data, error } = await supabase
        .from(JOBS_TABLE)
        .insert([{ type, trigger_id: triggerId, trigger_ref: triggerRef, status: 'pending' }])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return { success: false, duplicate: true };
        throw error;
      }
      return { success: true, job: data };
    } catch (err) {
      console.error('notificationCoreService.createJob:', err);
      return { success: false, error: err.message };
    }
  },

  async getNextPendingJob() {
    const { data } = await supabase
      .from(JOBS_TABLE)
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    return data || null;
  },

  async markJobProcessing(id) {
    await supabase.from(JOBS_TABLE).update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', id);
  },

  async updateJobTotal(id, total) {
    await supabase.from(JOBS_TABLE).update({ total_recipients: total }).eq('id', id);
  },

  async markJobCompleted(id, sentCount, failedCount) {
    await supabase.from(JOBS_TABLE).update({
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    }).eq('id', id);
  },

  async markJobFailed(id, errorMsg) {
    await supabase.from(JOBS_TABLE).update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      trigger_ref: supabase.from(JOBS_TABLE).select('trigger_ref').eq('id', id),
    }).eq('id', id);
    console.error(`notificationWorker: job ${id} failed — ${errorMsg}`);
  },

  async cancelJob(id) {
    await supabase.from(JOBS_TABLE).update({ status: 'cancelled' }).eq('id', id);
  },

  async getJobs(limit = 50) {
    const { data, error } = await supabase
      .from(JOBS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ── Deliveries ────────────────────────────────────────────────────────────

  async createDeliveries(jobId, recipients) {
    if (!recipients.length) return;
    const rows = recipients.map(r => ({
      job_id:         jobId,
      recipient_type: r.type,       // 'student' | 'teacher'
      recipient_id:   r.id || null,
      recipient_email: r.email,
      recipient_name: r.name || null,
      subject:        r.subject || null,
      status:         'pending',
      attempts:       0,
    }));
    const { error } = await supabase.from(DELIV_TABLE).insert(rows);
    if (error) throw error;
  },

  async getPendingDeliveries(jobId) {
    const { data, error } = await supabase
      .from(DELIV_TABLE)
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  async markDeliverySent(id) {
    await supabase.from(DELIV_TABLE).update({
      status:     'sent',
      sent_at:    new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  },

  async markDeliveryFailed(id, errorMsg, attempts) {
    const newStatus = attempts >= 3 ? 'failed' : 'pending';
    await supabase.from(DELIV_TABLE).update({
      status:     newStatus,
      last_error: errorMsg,
      attempts,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  },

  async getJobDeliveryCounts(jobId) {
    const { data } = await supabase
      .from(DELIV_TABLE)
      .select('status')
      .eq('job_id', jobId);
    const counts = { sent: 0, failed: 0, pending: 0, skipped: 0 };
    (data || []).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  },

  async getDeliveries({ jobId, status, limit = 100, offset = 0 } = {}) {
    let q = supabase
      .from(DELIV_TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (jobId)  q = q.eq('job_id', jobId);
    if (status) q = q.eq('status', status);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data || [], total: count || 0 };
  },

  /** Deliveries eligible for retry: failed, attempts < 3 */
  async getRetryableDeliveries() {
    const { data } = await supabase
      .from(DELIV_TABLE)
      .select('*')
      .eq('status', 'failed')
      .lt('attempts', 3)
      .order('updated_at');
    return data || [];
  },

  async resetDeliveryForResend(id) {
    await supabase.from(DELIV_TABLE).update({
      status:     'pending',
      attempts:   0,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  },

  // ── Preferences / Unsubscribe ─────────────────────────────────────────────

  /** Return or create a preference row and its unsubscribe token */
  async getOrCreatePref(email, type = 'all') {
    const { data: existing } = await supabase
      .from(PREFS_TABLE)
      .select('*')
      .eq('email', email)
      .eq('notification_type', type)
      .maybeSingle();
    if (existing) return existing;

    const token = crypto.randomBytes(24).toString('hex');
    const { data } = await supabase
      .from(PREFS_TABLE)
      .insert([{ email, notification_type: type, opted_out: false, unsubscribe_token: token }])
      .select()
      .single();
    return data;
  },

  async isOptedOut(email) {
    const { data } = await supabase
      .from(PREFS_TABLE)
      .select('opted_out')
      .eq('email', email)
      .in('notification_type', ['all', 'routine_published']);
    return (data || []).some(r => r.opted_out);
  },

  async unsubscribeByToken(token) {
    const { data, error } = await supabase
      .from(PREFS_TABLE)
      .update({ opted_out: true, updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select()
      .single();
    if (error) return { success: false };
    return { success: true, email: data?.email };
  },

  async resubscribeByEmail(email) {
    await supabase
      .from(PREFS_TABLE)
      .update({ opted_out: false, updated_at: new Date().toISOString() })
      .eq('email', email);
    return { success: true };
  },

  async getOptedOutList() {
    const { data } = await supabase
      .from(PREFS_TABLE)
      .select('*')
      .eq('opted_out', true)
      .order('updated_at', { ascending: false });
    return data || [];
  },
};
