import { supabase } from '../config/supabaseClient.js';

const FIELDS = 'id, registration_no, name, hall, date_of_birth, roll, email, mobile, institutional_email, session, academic_year, parents_contact, is_active, created_at';

export const studentService = {

  async getActiveStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(FIELDS)
        .eq('is_active', true)
        .order('academic_year')
        .order('name');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('studentService.getActiveStudents:', err);
      return { success: false, error: err.message };
    }
  },

  async getInactiveStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(FIELDS)
        .eq('is_active', false)
        .order('name');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('studentService.getInactiveStudents:', err);
      return { success: false, error: err.message };
    }
  },

  async getStudentByEmail(email) {
    try {
      const lc = email.toLowerCase().trim();

      // Prioritise institutional_email (primary login identifier)
      const { data: byInst, error: e1 } = await supabase
        .from('students')
        .select(FIELDS)
        .ilike('institutional_email', lc)
        .eq('is_active', true)
        .maybeSingle();
      if (e1) throw e1;
      if (byInst) return { success: true, data: byInst };

      // Fallback: personal/general email field
      const { data: byEmail, error: e2 } = await supabase
        .from('students')
        .select(FIELDS)
        .ilike('email', lc)
        .eq('is_active', true)
        .maybeSingle();
      if (e2) throw e2;
      return { success: true, data: byEmail || null };
    } catch (err) {
      console.error('studentService.getStudentByEmail:', err);
      return { success: false, error: err.message };
    }
  },

  async createStudent(fields) {
    try {
      const { data, error } = await supabase
        .from('students')
        .insert([sanitize(fields)])
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('studentService.createStudent:', err);
      return { success: false, error: err.message };
    }
  },

  async updateStudent(id, fields) {
    try {
      const payload = { ...sanitize(fields), updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('studentService.updateStudent:', err);
      return { success: false, error: err.message };
    }
  },

  async softDelete(id) {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('studentService.softDelete:', err);
      return { success: false, error: err.message };
    }
  },

  async restore(id) {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('studentService.restore:', err);
      return { success: false, error: err.message };
    }
  },

  async importStudents(rows) {
    try {
      const records = rows.map(sanitize).filter(r => r.name);
      if (!records.length) return { success: false, error: 'No valid student records found.' };
      const { data, error } = await supabase
        .from('students')
        .insert(records)
        .select();
      if (error) throw error;
      return { success: true, data, count: data.length };
    } catch (err) {
      console.error('studentService.importStudents:', err);
      return { success: false, error: err.message };
    }
  },

  // Move all students in `fromYear` to `toYear`
  async promoteBatch(fromYear, toYear) {
    try {
      const { data, error } = await supabase
        .from('students')
        .update({ academic_year: toYear, updated_at: new Date().toISOString() })
        .eq('academic_year', fromYear)
        .eq('is_active', true)
        .select('id');
      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } catch (err) {
      console.error('studentService.promoteBatch:', err);
      return { success: false, error: err.message };
    }
  },
};

// Whitelist + coerce fields coming from client
function sanitize(t) {
  return {
    registration_no:     str(t.registration_no) || null,
    name:                str(t.name),
    hall:                str(t.hall) || null,
    date_of_birth:       t.date_of_birth || null,
    roll:                str(t.roll) || null,
    email:               str(t.email) || null,
    mobile:              str(t.mobile) || null,
    institutional_email: str(t.institutional_email) || null,
    session:             str(t.session) || null,
    academic_year:       str(t.academic_year) || '1st',
    parents_contact:     str(t.parents_contact) || null,
    is_active:           true,
  };
}

const str = (v) => (v !== undefined && v !== null ? String(v).trim() : '');
