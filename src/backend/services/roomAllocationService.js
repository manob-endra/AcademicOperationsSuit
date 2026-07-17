import { supabase } from '../config/supabaseClient.js';

// One row per academic semester. Which rooms a semester uses is a
// scheduling decision, so it is scoped — unlike the classroom clusters
// themselves, which stay global (the campus map doesn't change per semester).
export const roomAllocationService = {

  async getAllocation(semesterId) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { data, error } = await supabase
        .from('room_allocation')
        .select('theory_rooms, lab_rooms, semester_theory_rooms')
        .eq('semester_id', semesterId)
        .maybeSingle();

      if (error) throw error;
      return {
        success: true,
        data: data || { theory_rooms: [], lab_rooms: [], semester_theory_rooms: {} },
      };
    } catch (err) {
      console.error('roomAllocationService.getAllocation:', err);
      return { success: false, error: err.message };
    }
  },

  async saveAllocation(semesterId, theoryRooms, labRooms, semesterTheoryRooms) {
    try {
      if (!semesterId) return { success: false, error: 'semesterId is required.' };

      const { error } = await supabase
        .from('room_allocation')
        .upsert(
          {
            semester_id: semesterId,
            theory_rooms: theoryRooms,
            lab_rooms: labRooms,
            semester_theory_rooms: semesterTheoryRooms,
          },
          { onConflict: 'semester_id' }
        );

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('roomAllocationService.saveAllocation:', err);
      return { success: false, error: err.message };
    }
  },
};
