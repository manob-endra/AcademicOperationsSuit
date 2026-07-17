import { supabase } from '../config/supabaseClient.js';

/**
 * Syllabus Catalog Service
 *
 * A syllabus is a versioned course catalog ("2023-24 and onward"). New
 * versions are new rows with their own course rows — an existing syllabus
 * is never edited into a new one, so older batches keep following theirs.
 *
 *   • option_groups          — "Option-A" etc. inside one syllabus semester
 *   • batches                — admitted batch → syllabus, set once
 *   • semester_batch_syllabus— which syllabus each running level (Y4-S1 …)
 *                              follows in one academic semester
 *   • course_offerings       — which optional courses actually run in one
 *                              academic semester (compulsory always run)
 *   • course_equivalences    — old↔new course mapping across versions
 */

const isMissingTable = (err) =>
  /does not exist|not find|schema cache/i.test(err?.message || '');

const MIGRATION_HINT =
  'Database migration required: run migrations/syllabus_catalog.sql in the Supabase SQL editor first.';

export const syllabusService = {

  // ── Syllabi ────────────────────────────────────────────────────────────

  async getAllSyllabi() {
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [], migrationNeeded: true };
        throw error;
      }
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('syllabusService.getAllSyllabi:', err);
      return { success: false, error: err.message };
    }
  },

  async createSyllabus({ title, effective_session, starting_year, notes }) {
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .insert({
          title: title.trim(),
          effective_session: effective_session.trim(),
          starting_year: starting_year?.trim() || null,
          notes: notes?.trim() || null,
        })
        .select()
        .single();
      if (error) {
        if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
        throw error;
      }
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.createSyllabus:', err);
      return { success: false, error: err.message };
    }
  },

  async updateSyllabus(id, fields) {
    try {
      const allowed = ['title', 'effective_session', 'starting_year', 'notes', 'is_active'];
      const updates = { updated_at: new Date().toISOString() };
      allowed.forEach(k => { if (fields[k] !== undefined) updates[k] = fields[k]; });

      const { data, error } = await supabase
        .from('syllabi')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.updateSyllabus:', err);
      return { success: false, error: err.message };
    }
  },

  // Deleting a syllabus cascades to its option groups; its courses keep
  // existing with syllabus_id = NULL (ON DELETE SET NULL) so history and
  // results referencing them never break. Blocked while a batch points at it.
  async deleteSyllabus(id) {
    try {
      const { data: batchRows } = await supabase
        .from('batches')
        .select('id')
        .eq('syllabus_id', id)
        .limit(1);
      if (batchRows && batchRows.length > 0) {
        return { success: false, error: 'A batch follows this syllabus — reassign the batch first.' };
      }

      const { error } = await supabase.from('syllabi').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('syllabusService.deleteSyllabus:', err);
      return { success: false, error: err.message };
    }
  },

  // ── Option groups ──────────────────────────────────────────────────────

  async getOptionGroups(syllabusId) {
    try {
      let query = supabase.from('option_groups').select('*').order('name');
      if (syllabusId) query = query.eq('syllabus_id', syllabusId);
      const { data, error } = await query;
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('syllabusService.getOptionGroups:', err);
      return { success: false, error: err.message };
    }
  },

  async createOptionGroup({ syllabus_id, name, year, semester, choose_count }) {
    try {
      const { data, error } = await supabase
        .from('option_groups')
        .insert({
          syllabus_id,
          name: name.trim(),
          year,
          semester,
          choose_count: Number(choose_count) || 1,
        })
        .select()
        .single();
      if (error) {
        if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
        throw error;
      }
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.createOptionGroup:', err);
      return { success: false, error: err.message };
    }
  },

  async updateOptionGroup(id, fields) {
    try {
      const allowed = ['name', 'year', 'semester', 'choose_count'];
      const updates = {};
      allowed.forEach(k => { if (fields[k] !== undefined) updates[k] = fields[k]; });

      const { data, error } = await supabase
        .from('option_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.updateOptionGroup:', err);
      return { success: false, error: err.message };
    }
  },

  // Courses in the group become compulsory-looking (option_group_id NULL via
  // ON DELETE SET NULL) — the route warns the caller to reassign them.
  async deleteOptionGroup(id) {
    try {
      const { error } = await supabase.from('option_groups').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('syllabusService.deleteOptionGroup:', err);
      return { success: false, error: err.message };
    }
  },

  // ── Batches ────────────────────────────────────────────────────────────

  async getAllBatches() {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*, syllabi(title, effective_session)')
        .order('admission_session', { ascending: false });
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('syllabusService.getAllBatches:', err);
      return { success: false, error: err.message };
    }
  },

  async createBatch({ name, admission_session, syllabus_id }) {
    try {
      const { data, error } = await supabase
        .from('batches')
        .insert({ name: name.trim(), admission_session: admission_session.trim(), syllabus_id })
        .select()
        .single();
      if (error) {
        if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
        throw error;
      }
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.createBatch:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteBatch(id) {
    try {
      const { error } = await supabase.from('batches').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('syllabusService.deleteBatch:', err);
      return { success: false, error: err.message };
    }
  },

  // ── Semester batch → syllabus assignment ───────────────────────────────

  async getSemesterAssignments(semesterId) {
    try {
      const { data, error } = await supabase
        .from('semester_batch_syllabus')
        .select('batch_code, syllabus_id')
        .eq('semester_id', semesterId);
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('syllabusService.getSemesterAssignments:', err);
      return { success: false, error: err.message };
    }
  },

  async assignSyllabus(semesterId, batchCode, syllabusId) {
    try {
      if (!syllabusId) {
        // Clearing an assignment
        const { error } = await supabase
          .from('semester_batch_syllabus')
          .delete()
          .eq('semester_id', semesterId)
          .eq('batch_code', batchCode);
        if (error) throw error;
        return { success: true };
      }

      const { error } = await supabase
        .from('semester_batch_syllabus')
        .upsert(
          {
            semester_id: semesterId,
            batch_code: batchCode,
            syllabus_id: syllabusId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'semester_id,batch_code' }
        );
      if (error) {
        if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
        throw error;
      }
      return { success: true };
    } catch (err) {
      console.error('syllabusService.assignSyllabus:', err);
      return { success: false, error: err.message };
    }
  },

  // ── Course offerings (optional courses that run this semester) ─────────

  async getOfferings(semesterId) {
    try {
      const { data, error } = await supabase
        .from('course_offerings')
        .select('course_id')
        .eq('semester_id', semesterId);
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: (data || []).map(r => r.course_id) };
    } catch (err) {
      console.error('syllabusService.getOfferings:', err);
      return { success: false, error: err.message };
    }
  },

  async setOffering(semesterId, courseId, offered) {
    try {
      if (offered) {
        const { error } = await supabase
          .from('course_offerings')
          .upsert(
            { semester_id: semesterId, course_id: courseId },
            { onConflict: 'semester_id,course_id' }
          );
        if (error) {
          if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('course_offerings')
          .delete()
          .eq('semester_id', semesterId)
          .eq('course_id', courseId);
        if (error) throw error;
      }
      return { success: true };
    } catch (err) {
      console.error('syllabusService.setOffering:', err);
      return { success: false, error: err.message };
    }
  },

  // ── Course equivalences ────────────────────────────────────────────────

  async getEquivalences() {
    try {
      const { data, error } = await supabase
        .from('course_equivalences')
        .select('*');
      if (error) {
        if (isMissingTable(error)) return { success: true, data: [] };
        throw error;
      }
      return { success: true, data: data || [] };
    } catch (err) {
      console.error('syllabusService.getEquivalences:', err);
      return { success: false, error: err.message };
    }
  },

  async addEquivalence(oldCourseId, newCourseId) {
    try {
      const { data, error } = await supabase
        .from('course_equivalences')
        .upsert(
          { old_course_id: oldCourseId, new_course_id: newCourseId },
          { onConflict: 'old_course_id,new_course_id' }
        )
        .select()
        .single();
      if (error) {
        if (isMissingTable(error)) return { success: false, error: MIGRATION_HINT };
        throw error;
      }
      return { success: true, data };
    } catch (err) {
      console.error('syllabusService.addEquivalence:', err);
      return { success: false, error: err.message };
    }
  },

  async removeEquivalence(id) {
    try {
      const { error } = await supabase.from('course_equivalences').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('syllabusService.removeEquivalence:', err);
      return { success: false, error: err.message };
    }
  },
};
