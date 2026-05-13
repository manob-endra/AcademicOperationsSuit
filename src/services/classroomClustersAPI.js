/**
 * Frontend API Service for Classroom Clusters
 * Handles all HTTP requests to the classroom clusters backend API
 */

const API_BASE_URL = 'http://localhost:3001/api/classroom-clusters';
const HEALTH_CHECK_URL = 'http://localhost:3001/health';

let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    console.warn('Backend server is not available');
    return false;
  }
};

const makeRequest = async (url, options = {}) => {
  if (!backendAvailable) {
    backendAvailable = await checkBackendConnection();
  }

  if (!backendAvailable) {
    return {
      success: false,
      error: 'Backend server is not running. Please start it with: npm run dev',
      offline: true,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status} ${response.statusText}`;
      try {
        const result = await response.json();
        errorMessage = result.error || errorMessage;
      } catch {
        // Response was HTML (e.g. 404 page) — use the status message above
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
      backendAvailable = false;
      return {
        success: false,
        error: 'Cannot connect to backend server. Make sure it is running on port 3001.',
        offline: true,
      };
    }
    return { success: false, error: error.message };
  }
};

export const classroomClustersAPI = {

  async getClusters() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async createCluster(clusterData) {
    const result = await makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clusterData),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async updateCluster(clusterId, updates) {
    const result = await makeRequest(`${API_BASE_URL}/${clusterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async deleteCluster(clusterId) {
    const result = await makeRequest(`${API_BASE_URL}/${clusterId}`, {
      method: 'DELETE',
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async getRemovedClusters() {
    const result = await makeRequest(`${API_BASE_URL}/removed`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async restoreCluster(clusterId) {
    const result = await makeRequest(`${API_BASE_URL}/${clusterId}/restore`, {
      method: 'POST',
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async getDistances() {
    const result = await makeRequest(`${API_BASE_URL}/distances`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async upsertDistance(cluster1Id, cluster2Id, distanceMinutes) {
    const result = await makeRequest(`${API_BASE_URL}/distances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cluster1Id, cluster2Id, distanceMinutes }),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },
};
