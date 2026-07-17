import { supabase } from '../config/supabaseClient.js';

export const noticeService = {
  async getAllNotices() {
    const { data, error } = await supabase
      .from('notices')
      .select('*, users(email)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createNotice({ title, content, priority = 'normal', created_by, document_url = null, document_name = null, document_size = null }) {
    const { data, error } = await supabase
      .from('notices')
      .insert([{
        title, content, priority, created_by, is_active: true,
        // Optional attachment — null when the notice has no document.
        document_url, document_name, document_size,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateNotice(id, updates) {
    const { data, error } = await supabase
      .from('notices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteNotice(id) {
    const { error } = await supabase
      .from('notices')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },
};
