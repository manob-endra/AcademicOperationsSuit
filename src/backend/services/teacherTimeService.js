import { supabase } from '../config/supabaseClient.js';
import { saveSemesterLoad } from './teacherLoadService.js';
import { defaultLoadLimit } from '../../utils/teacherRank.js';

export const teacherTimeService = {

  // Teacher records are global, but their weekly load is per-semester:
  // it is computed from the courses assigned within `semesterId` and
  // written to teacher_semester_load, never to the shared teachers row.
  // semesterId is optional — global teacher-management pages that have no
  // semester context get teacher records back with weekly_load_hours: 0.
  async getActiveTeachers(semesterId) {
    try {
      const { data: teacherRows, error: teacherError } = await supabase
        .from('teachers')
        .select('id, name, initials, department, email, load_limit, designation, joining_date, special_post, contact_number, availability_status')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (teacherError) throw teacherError;

      if (!teacherRows || teacherRows.length === 0) return { success: true, data: [] };

      if (!semesterId) {
        return { success: true, data: teacherRows.map(t => ({ ...t, weekly_load_hours: 0 })) };
      }

      // Fetch this semester's assigned_courses for every active teacher
      const { data: prefRows, error: prefError } = await supabase
        .from('teacher_course_preferences')
        .select('teacher_id, assigned_courses')
        .eq('semester_id', semesterId)
        .in('teacher_id', teacherRows.map(t => t.id));
      if (prefError) throw prefError;

      // Build prefMap and collect every referenced course ID
      const prefMap = {};
      const allCourseIds = new Set();
      (prefRows || []).forEach(p => {
        prefMap[p.teacher_id] = p.assigned_courses || [];
        (p.assigned_courses || []).forEach(id => allCourseIds.add(id));
      });

      // Fetch credit_hours + course_type for every assigned course
      const courseMap = {};
      if (allCourseIds.size > 0) {
        const { data: courseRows, error: courseError } = await supabase
          .from('courses')
          .select('id, credit_hours, course_type')
          .in('id', [...allCourseIds]);
        if (courseError) throw courseError;
        (courseRows || []).forEach(c => { courseMap[c.id] = c; });
      }

      // Compute weekly load: theory → credit hrs, lab → credit hrs × 4.
      // credit_hours is NUMERIC (may be fractional / string); round the
      // per-teacher total up to whole hours to match load limits.
      const teachersWithLoad = teacherRows.map(t => {
        const assignedIds = prefMap[t.id] || [];
        const weeklyLoad = assignedIds.reduce((sum, id) => {
          const c = courseMap[id];
          if (!c) return sum;
          const hrs = Number(c.credit_hours) || 0;
          return sum + (c.course_type === 'lab' ? hrs * 4 : hrs);
        }, 0);
        return { ...t, weekly_load_hours: Math.ceil(weeklyLoad) };
      });

      // Cache the computed loads for this semester
      await Promise.allSettled(
        teachersWithLoad.map(t => saveSemesterLoad(semesterId, t.id, t.weekly_load_hours))
      );

      return { success: true, data: teachersWithLoad };
    } catch (err) {
      console.error('teacherTimeService.getActiveTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async getInactiveTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, initials, department, email, load_limit, weekly_load_hours, designation, joining_date, special_post, contact_number, availability_status')
        .eq('is_active', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherTimeService.getInactiveTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async createTeacher({ name, initials, department, email, load_limit, weekly_load_hours, designation, joining_date, special_post, contact_number, availability_status }) {
    try {
      // When no explicit limit is given, default it from the teacher's rank
      // (Dean/Chairman 6, Professor 8, Assoc. 10, Asst. 12, Lecturer 16).
      const resolvedLoadLimit = (load_limit === undefined || load_limit === null || load_limit === '')
        ? defaultLoadLimit({ designation, special_post })
        : Number(load_limit);

      const { data, error } = await supabase
        .from('teachers')
        .insert([{
          name: name.trim(),
          initials: (initials || '').trim(),
          department: department?.trim() || null,
          email: email?.trim() || null,
          load_limit: resolvedLoadLimit || 20,
          weekly_load_hours: Number(weekly_load_hours) || 0,
          designation: designation?.trim() || null,
          joining_date: joining_date || null,
          special_post: special_post?.trim() || null,
          contact_number: contact_number?.trim() || null,
          availability_status: availability_status || 'available',
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('teacherTimeService.createTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async updateTeacher(id, fields) {
    try {
      const allowed = ['name', 'initials', 'department', 'email', 'load_limit', 'designation', 'joining_date', 'special_post', 'contact_number', 'availability_status'];
      const updateData = { updated_at: new Date().toISOString() };
      allowed.forEach(key => {
        if (fields[key] !== undefined) updateData[key] = fields[key];
      });
      const { data, error } = await supabase
        .from('teachers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('teacherTimeService.updateTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async softDeleteTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ is_active: false })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.softDeleteTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async updateLoadLimit(teacherId, loadLimit) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ load_limit: Number(loadLimit) })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.updateLoadLimit:', err);
      return { success: false, error: err.message };
    }
  },

  async restoreTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ is_active: true })
        .eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.restoreTeacher:', err);
      return { success: false, error: err.message };
    }
  },

  async importTeachers(teachersArray) {
    try {
      const rows = teachersArray
        .map(t => {
          const designation = String(t.designation || '').trim() || null;
          const special_post = String(t.special_post || '').trim() || null;
          // Explicit load_limit in the file wins; otherwise default from rank.
          const hasExplicit = t.load_limit !== undefined && t.load_limit !== null && t.load_limit !== '';
          return {
            name: String(t.name || '').trim(),
            initials: String(t.initials || '').trim(),
            department: String(t.department || '').trim() || null,
            email: String(t.email || '').trim() || null,
            load_limit: hasExplicit ? Number(t.load_limit) : defaultLoadLimit({ designation, special_post }),
            designation,
            joining_date: t.joining_date || null,
            special_post,
            contact_number: String(t.contact_number || '').trim() || null,
            availability_status: t.availability_status || 'available',
            is_active: true,
          };
        })
        .filter(t => t.name);

      if (rows.length === 0) {
        return { success: false, error: 'No valid teacher records found in the file.' };
      }

      const { data, error } = await supabase
        .from('teachers')
        .insert(rows)
        .select();
      if (error) throw error;
      return { success: true, data, count: data.length };
    } catch (err) {
      console.error('teacherTimeService.importTeachers:', err);
      return { success: false, error: err.message };
    }
  },

  async getAllAvailability(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('teacher_availability')
        .select('teacher_id, day_of_week, slot_id')
        .eq('semester_id', semesterId);
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('teacherTimeService.getAllAvailability:', err);
      return { success: false, error: err.message };
    }
  },

  async saveTeacherAvailability(semesterId, teacherId, selectedSlots) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      // Only this semester's rows are replaced — the same teacher's
      // availability in other semesters is left alone.
      const { error: delErr } = await supabase
        .from('teacher_availability')
        .delete()
        .eq('semester_id', semesterId)
        .eq('teacher_id', teacherId);
      if (delErr) throw delErr;

      if (selectedSlots.length === 0) return { success: true };

      const rows = selectedSlots.map(slotKey => {
        const dash = slotKey.indexOf('-');
        return {
          semester_id: semesterId,
          teacher_id: teacherId,
          day_of_week: slotKey.slice(0, dash),
          slot_id: slotKey.slice(dash + 1),
        };
      });

      const { error: insErr } = await supabase
        .from('teacher_availability')
        .insert(rows);
      if (insErr) throw insErr;
      return { success: true };
    } catch (err) {
      console.error('teacherTimeService.saveTeacherAvailability:', err);
      return { success: false, error: err.message };
    }
  },
};
