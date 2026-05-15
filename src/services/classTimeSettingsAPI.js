/**
 * Frontend API Service for Class Time Settings
 * Handles all HTTP requests to the class time settings backend API
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/class-time-settings`;
const HEALTH_CHECK_URL = `${import.meta.env.VITE_API_URL}/health`;

// Check if backend is available
let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Backend server is not available');
    return false;
  }
};

export const classTimeSettingsAPI = {
  /**
   * Get the current class time settings
   */
  async getSettings() {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running. Please start it with: npm run dev',
          offline: true
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to fetch class time settings');
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Get class time settings error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return {
          success: false,
          error: 'Cannot connect to backend server. Make sure it is running on port 3001.',
          offline: true
        };
      }
      
      return { success: false, error: error.message || 'Failed to fetch class time settings' };
    }
  },

  /**
   * Save or create class time settings
   */
  async saveSettings(settingsData) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running. Please start it with: npm run dev',
          offline: true 
        };
      }

      // Ensure skipTime is included and is a number
      const dataToSend = {
        ...settingsData,
        skipTime: typeof settingsData.skipTime === 'string' 
          ? parseInt(settingsData.skipTime) 
          : settingsData.skipTime
      };

      console.log('API: Sending save request with data:', dataToSend);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to save class time settings');
      }

      const result = await response.json();
      console.log('API: Save response:', result);
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Save class time settings error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { 
          success: false, 
          error: 'Cannot connect to backend server. Please start it with: npm run dev',
          offline: true 
        };
      }
      
      return { success: false, error: error.message || 'Failed to save class time settings' };
    }
  },

  /**
   * Update class time settings
   */
  async updateSettings(settingsId, updates) {
    try {
      if (!backendAvailable) {
        backendAvailable = await checkBackendConnection();
      }

      if (!backendAvailable) {
        return { 
          success: false, 
          error: 'Backend server is not running.',
          offline: true 
        };
      }

      // Ensure skipTime is included and is a number
      const dataToSend = {
        ...updates,
        skipTime: typeof updates.skipTime === 'string' 
          ? parseInt(updates.skipTime) 
          : updates.skipTime
      };

      console.log('API: Sending update request with data:', dataToSend);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/${settingsId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update class time settings');
      }

      const result = await response.json();
      console.log('API: Update response:', result);
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Update class time settings error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
        backendAvailable = false;
        return { success: false, error: 'Cannot connect to backend server.', offline: true };
      }
      
      return { success: false, error: error.message };
    }
  }
};
