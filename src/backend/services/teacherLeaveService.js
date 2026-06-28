import { supabase } from '../config/supabaseClient.js';

const TABLE = 'teacher_leaves';

function sanitize(f) {
  const allowed = ['teacher_id','leave_type','start_date','end_date','status','added_by','reason','admin_note'];
  const out = {};
  allowed.forEach(k => { if (f[k] !== undefined) out[k] = f[k]; });
  return out;
}

export const teacherLeaveService = {

  // All leaves (joined with teacher name/initials) — admin view
  async getAllLeaves() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, teachers(id,name,initials,email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Leaves for a single teacher
  async getLeavesForTeacher(teacherId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('teacher_id', teacherId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // All pending teacher-submitted requests
  async getPendingRequests() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, teachers(id,name,initials,email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Admin adds a leave (always approved)
  async addLeave(fields) {
    const row = {
      ...sanitize(fields),
      status:   'approved',
      added_by: 'admin',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from(TABLE).insert([row]).select().single();
    if (error) throw error;
    return { success: true, data };
  },

  // Teacher submits a request (pending)
  async submitRequest(fields) {
    const row = {
      ...sanitize(fields),
      status:   'pending',
      added_by: 'teacher',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from(TABLE).insert([row]).select().single();
    if (error) throw error;
    return { success: true, data };
  },

  // Approve a pending request
  async approveRequest(id, adminNote = '') {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'approved', admin_note: adminNote, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  },

  // Reject a pending request
  async rejectRequest(id, adminNote = '') {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'rejected', admin_note: adminNote, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  },

  // Delete a leave record
  async deleteLeave(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
};
