import { api } from './api';
import {
  getTasks,
  saveTasks,
  getMessages,
  saveMessages,
  getStudyPlans,
  saveStudyPlans,
  getTests,
  saveTests,
  addToOfflineQueue,
  getOfflineQueue,
  removeFromOfflineQueue,
  saveLastSyncTime,
  isDataStale,
} from './offline-storage';
import NetInfo from '@react-native-community/netinfo';

// Check if device is online
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Fetch tasks with offline support
export async function fetchTasksOffline() {
  const online = await isOnline();
  
  if (online) {
    try {
      const response = await api.get('/api/tasks');
      const tasks = response.data;
      await saveTasks(tasks);
      await saveLastSyncTime(Date.now());
      return { data: tasks, fromCache: false };
    } catch (error) {
      console.error('Error fetching tasks online:', error);
      // Fall back to cached data
      const cachedTasks = await getTasks();
      return { data: cachedTasks || [], fromCache: true };
    }
  } else {
    // Offline: return cached data
    const cachedTasks = await getTasks();
    return { data: cachedTasks || [], fromCache: true };
  }
}

// Create task with offline support
export async function createTaskOffline(taskData: any) {
  const online = await isOnline();
  
  if (online) {
    try {
      const response = await api.post('/api/tasks', taskData);
      // Update cache
      const tasks = await getTasks() || [];
      tasks.push(response.data);
      await saveTasks(tasks);
      return { data: response.data, queued: false };
    } catch (error) {
      console.error('Error creating task online:', error);
      // Queue for later
      await addToOfflineQueue({
        type: 'CREATE',
        endpoint: '/api/tasks',
        data: taskData,
      });
      
      // Add to local cache with temporary ID
      const tempTask = { ...taskData, id: `temp_${Date.now()}`, _offline: true };
      const tasks = await getTasks() || [];
      tasks.push(tempTask);
      await saveTasks(tasks);
      
      return { data: tempTask, queued: true };
    }
  } else {
    // Offline: queue and add to cache
    await addToOfflineQueue({
      type: 'CREATE',
      endpoint: '/api/tasks',
      data: taskData,
    });
    
    const tempTask = { ...taskData, id: `temp_${Date.now()}`, _offline: true };
    const tasks = await getTasks() || [];
    tasks.push(tempTask);
    await saveTasks(tasks);
    
    return { data: tempTask, queued: true };
  }
}

// Update task with offline support
export async function updateTaskOffline(taskId: number | string, updates: any) {
  const online = await isOnline();
  
  if (online && !String(taskId).startsWith('temp_')) {
    try {
      const response = await api.patch(`/api/tasks/${taskId}`, updates);
      // Update cache
      const tasks = await getTasks() || [];
      const index = tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks[index] = response.data;
        await saveTasks(tasks);
      }
      return { data: response.data, queued: false };
    } catch (error) {
      console.error('Error updating task online:', error);
      // Queue for later
      await addToOfflineQueue({
        type: 'UPDATE',
        endpoint: `/api/tasks/${taskId}`,
        data: updates,
      });
      
      // Update local cache
      const tasks = await getTasks() || [];
      const index = tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates, _offline: true };
        await saveTasks(tasks);
      }
      
      return { data: tasks[index], queued: true };
    }
  } else {
    // Offline or temp task: queue and update cache
    if (!String(taskId).startsWith('temp_')) {
      await addToOfflineQueue({
        type: 'UPDATE',
        endpoint: `/api/tasks/${taskId}`,
        data: updates,
      });
    }
    
    const tasks = await getTasks() || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates, _offline: true };
      await saveTasks(tasks);
      return { data: tasks[index], queued: true };
    }
    
    return { data: null, queued: true };
  }
}

// Delete task with offline support
export async function deleteTaskOffline(taskId: number | string) {
  const online = await isOnline();
  
  if (online && !String(taskId).startsWith('temp_')) {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      // Remove from cache
      const tasks = await getTasks() || [];
      const filtered = tasks.filter(t => t.id !== taskId);
      await saveTasks(filtered);
      return { success: true, queued: false };
    } catch (error) {
      console.error('Error deleting task online:', error);
      // Queue for later
      await addToOfflineQueue({
        type: 'DELETE',
        endpoint: `/api/tasks/${taskId}`,
        data: {},
      });
      
      // Remove from local cache
      const tasks = await getTasks() || [];
      const filtered = tasks.filter(t => t.id !== taskId);
      await saveTasks(filtered);
      
      return { success: true, queued: true };
    }
  } else {
    // Offline or temp task: just remove from cache
    if (!String(taskId).startsWith('temp_')) {
      await addToOfflineQueue({
        type: 'DELETE',
        endpoint: `/api/tasks/${taskId}`,
        data: {},
      });
    }
    
    const tasks = await getTasks() || [];
    const filtered = tasks.filter(t => t.id !== taskId);
    await saveTasks(filtered);
    
    return { success: true, queued: true };
  }
}

// Sync offline queue when back online
export async function syncOfflineQueue() {
  const online = await isOnline();
  if (!online) {
    console.log('Cannot sync: device is offline');
    return { synced: 0, failed: 0 };
  }
  
  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    console.log('No items in offline queue');
    return { synced: 0, failed: 0 };
  }
  
  console.log(`Syncing ${queue.length} items from offline queue...`);
  
  let synced = 0;
  let failed = 0;
  
  for (const item of queue) {
    try {
      switch (item.type) {
        case 'CREATE':
          await api.post(item.endpoint, item.data);
          break;
        case 'UPDATE':
          await api.patch(item.endpoint, item.data);
          break;
        case 'DELETE':
          await api.delete(item.endpoint);
          break;
      }
      
      await removeFromOfflineQueue(item.id);
      synced++;
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      failed++;
    }
  }
  
  console.log(`Sync complete: ${synced} synced, ${failed} failed`);
  
  // Refresh data after sync
  if (synced > 0) {
    await fetchTasksOffline();
  }
  
  return { synced, failed };
}

// Auto-sync when coming back online
export function setupAutoSync() {
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('Device is online, syncing...');
      syncOfflineQueue().catch(console.error);
    }
  });
}
