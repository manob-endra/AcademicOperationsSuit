import { supabase } from '../config/supabaseClient.js';

export const notificationService = {
  async createSignupNotification({ userId, email, fullName, role }) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          type: 'signup',
          user_id: userId,
          user_email: email,
          user_name: fullName || null,
          user_role: role,
          is_read: false,
          is_handled: false,
        }])
        .select()
        .single();
      if (error) throw error;
      return { success: true, notification: data };
    } catch (error) {
      console.error('notificationService.createSignupNotification:', error);
      return { success: false, error: error.message };
    }
  },

  async getAllNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error('notificationService.getAllNotifications:', error);
      return { success: false, error: error.message };
    }
  },

  async getUnreadCount() {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('is_handled', false);
      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      return { success: false, count: 0, error: error.message };
    }
  },

  async markAsRead(id) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async markAsHandled(id) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, is_handled: true })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
