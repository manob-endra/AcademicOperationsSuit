import { supabase } from '../config/supabaseClient.js';

export const classroomClustersService = {

  async getClusters() {
    try {
      const { data, error } = await supabase
        .from('classroom_clusters')
        .select('*')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, clusters: data || [] };
    } catch (error) {
      console.error('Get clusters error:', error);
      return { success: false, error: error.message };
    }
  },

  async createCluster({ name, rooms }) {
    try {
      const { data, error } = await supabase
        .from('classroom_clusters')
        .insert([{ name, rooms: rooms || [], is_active: true, is_deleted: false }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, cluster: data };
    } catch (error) {
      console.error('Create cluster error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateCluster(clusterId, updates) {
    try {
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.rooms !== undefined) dbUpdates.rooms = updates.rooms;

      const { data, error } = await supabase
        .from('classroom_clusters')
        .update(dbUpdates)
        .eq('id', clusterId)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) throw error;
      return { success: true, cluster: data };
    } catch (error) {
      console.error('Update cluster error:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteCluster(clusterId) {
    try {
      const { data, error } = await supabase
        .from('classroom_clusters')
        .update({ is_active: false, is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', clusterId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, cluster: data };
    } catch (error) {
      console.error('Delete cluster error:', error);
      return { success: false, error: error.message };
    }
  },

  async getRemovedClusters() {
    try {
      const { data, error } = await supabase
        .from('classroom_clusters')
        .select('*')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return { success: true, clusters: data || [] };
    } catch (error) {
      console.error('Get removed clusters error:', error);
      return { success: false, error: error.message };
    }
  },

  async restoreCluster(clusterId) {
    try {
      const { data, error } = await supabase
        .from('classroom_clusters')
        .update({ is_active: true, is_deleted: false, deleted_at: null })
        .eq('id', clusterId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, cluster: data };
    } catch (error) {
      console.error('Restore cluster error:', error);
      return { success: false, error: error.message };
    }
  },

  async getDistances() {
    try {
      const { data, error } = await supabase
        .from('cluster_distances')
        .select('*');

      if (error) throw error;
      return { success: true, distances: data || [] };
    } catch (error) {
      console.error('Get distances error:', error);
      return { success: false, error: error.message };
    }
  },

  async upsertDistance(cluster1Id, cluster2Id, distanceMinutes) {
    try {
      const [id1, id2] = [cluster1Id, cluster2Id].sort();

      const { data, error } = await supabase
        .from('cluster_distances')
        .upsert(
          { cluster1_id: id1, cluster2_id: id2, distance_minutes: Number(distanceMinutes) || 0 },
          { onConflict: 'cluster1_id,cluster2_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, distance: data };
    } catch (error) {
      console.error('Upsert distance error:', error);
      return { success: false, error: error.message };
    }
  },
};
