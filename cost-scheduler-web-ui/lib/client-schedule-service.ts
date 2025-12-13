// Client-safe schedule service that uses API routes instead of direct AWS SDK calls
import { UISchedule, Schedule } from './types';

export class ClientScheduleService {
    private static baseUrl = '/api/schedules';

    /**
     * Fetch all schedules via API route
     */
    static async getSchedules(filters?: {
        statusFilter?: string;
        resourceFilter?: string;
        searchTerm?: string;
    }): Promise<UISchedule[]> {
        try {
            console.log('ClientScheduleService - Fetching schedules via API route', filters);
            
            // Build query parameters
            const params = new URLSearchParams();
            if (filters?.statusFilter) {
                params.append('status', filters.statusFilter);
            }
            if (filters?.resourceFilter) {
                params.append('resource', filters.resourceFilter);
            }
            if (filters?.searchTerm) {
                params.append('search', filters.searchTerm);
            }

            const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch schedules');
            }

            console.log('ClientScheduleService - Successfully fetched schedules:', result.data.length);
            return result.data;
        } catch (error) {
            console.error('ClientScheduleService - Error fetching schedules:', error);
            throw error;
        }
    }

    /**
     * Get a specific schedule by name via API route
     */
    static async getSchedule(name: string): Promise<UISchedule | null> {
        try {
            console.log('ClientScheduleService - Fetching schedule:', name);
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(name)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch schedule');
            }

            return result.data;
        } catch (error) {
            console.error('ClientScheduleService - Error fetching schedule:', error);
            throw error;
        }
    }

    /**
     * Create a new schedule via API route
     */
    static async createSchedule(schedule: Omit<Schedule, 'id' | 'type'>): Promise<Schedule> {
        try {
            console.log('ClientScheduleService - Creating schedule:', schedule.name);
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(schedule),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to create schedule');
            }

            console.log('ClientScheduleService - Successfully created schedule:', result.data.name);
            return result.data;
        } catch (error) {
            console.error('ClientScheduleService - Error creating schedule:', error);
            throw error;
        }
    }

    /**
     * Update an existing schedule via API route
     */
    static async updateSchedule(
        scheduleName: string,
        updates: Partial<Omit<Schedule, 'name' | 'type'>>
    ): Promise<UISchedule> {
        try {
            console.log('ClientScheduleService - Updating schedule:', scheduleName);
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(scheduleName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to update schedule');
            }

            console.log('ClientScheduleService - Successfully updated schedule:', scheduleName);
            return result.data;
        } catch (error) {
            console.error('ClientScheduleService - Error updating schedule:', error);
            throw error;
        }
    }

    /**
     * Delete a schedule via API route
     */
    static async deleteSchedule(name: string): Promise<void> {
        try {
            console.log('ClientScheduleService - Deleting schedule:', name);
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to delete schedule');
            }

            console.log('ClientScheduleService - Successfully deleted schedule:', name);
        } catch (error) {
            console.error('ClientScheduleService - Error deleting schedule:', error);
            throw error;
        }
    }

    /**
     * Toggle schedule active status via API route
     */
    static async toggleScheduleStatus(name: string): Promise<UISchedule> {
        try {
            console.log('ClientScheduleService - Toggling schedule status:', name);
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(name)}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to toggle schedule status');
            }

            console.log('ClientScheduleService - Successfully toggled schedule status:', name);
            return result.data;
        } catch (error) {
            console.error('ClientScheduleService - Error toggling schedule status:', error);
            throw error;
        }
    }
}
