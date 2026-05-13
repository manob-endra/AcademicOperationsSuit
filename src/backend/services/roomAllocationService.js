import { supabase } from '../config/supabaseClient.js';

const ROW_ID = 1;

export const roomAllocationService = {

  async getAllocation() {
    try {
      const { data, error } = await supabase
        .from('room_allocation')
        .select('theory_rooms, lab_rooms, semester_theory_rooms')
        .eq('id', ROW_ID)
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

  async saveAllocation(theoryRooms, labRooms, semesterTheoryRooms) {
    try {
      const { error } = await supabase
        .from('room_allocation')
        .upsert(
          {
            id: ROW_ID,
            theory_rooms: theoryRooms,
            lab_rooms: labRooms,
            semester_theory_rooms: semesterTheoryRooms,
          },
          { onConflict: 'id' }
        );

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('roomAllocationService.saveAllocation:', err);
      return { success: false, error: err.message };
    }
  },
};
