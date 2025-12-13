// DynamoDB service for schedule operations
import { ScanCommand, PutCommand, DeleteCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBDocumentClient, DYNAMODB_TABLE_NAME, handleDynamoDBError } from './aws-config';
import { Schedule, UISchedule } from './types';
import { AuditService } from './audit-service';

export class ScheduleService {
    /**
     * Fetch all schedules from DynamoDB with optional filters
     */
    static async getSchedules(filters?: {
        statusFilter?: string;
        resourceFilter?: string;
        searchTerm?: string;
    }): Promise<UISchedule[]> {
        try {
            console.log('ScheduleService - Attempting to fetch schedules from DynamoDB with filters:', filters);
            console.log('Using table:', DYNAMODB_TABLE_NAME);
            console.log('AWS Region:', process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1');

            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();

            // Base filter for schedules
            let filterExpression = '#type = :typeVal';
            const expressionAttributeNames: Record<string, string> = {
                '#type': 'type',
            };
            let expressionAttributeValues: Record<string, any> = {
                ':typeVal': 'schedule',
            };

            // Add status filter if provided
            if (filters?.statusFilter) {
                if (filters.statusFilter === 'active') {
                    filterExpression += ' AND #active = :activeVal';
                    expressionAttributeNames['#active'] = 'active';
                    expressionAttributeValues[':activeVal'] = true;
                } else if (filters.statusFilter === 'inactive') {
                    filterExpression += ' AND #active = :activeVal';
                    expressionAttributeNames['#active'] = 'active';
                    expressionAttributeValues[':activeVal'] = false;
                }
            }

            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            });

            console.log('ScheduleService - Sending DynamoDB command...');
            const response = await dynamoDBDocumentClient.send(command);
            console.log('ScheduleService - Successfully fetched schedules:', response.Items?.length || 0);
            
            let schedules = (response.Items || []).map(item => this.transformToUISchedule(item as Schedule));
            
            // Apply client-side filters for search term and resource type
            if (filters?.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                schedules = schedules.filter(schedule => 
                    schedule.name.toLowerCase().includes(searchLower) ||
                    (schedule.description && schedule.description.toLowerCase().includes(searchLower)) ||
                    (schedule.createdBy && schedule.createdBy.toLowerCase().includes(searchLower))
                );
            }
            
            if (filters?.resourceFilter && filters.resourceFilter !== 'all') {
                schedules = schedules.filter(schedule => 
                    schedule.resourceTypes && schedule.resourceTypes.includes(filters.resourceFilter!)
                );
            }
            
            return schedules;
        } catch (error: any) {
            console.error('ScheduleService - Error fetching schedules:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.$metadata?.httpStatusCode,
                requestId: error.$metadata?.requestId,
                region: error.region || 'undefined'
            });

            // For debugging credentials issues
            if (error.name === 'CredentialsProviderError' || error.message?.includes('Credential')) {
                console.error('Credentials debugging info:', {
                    AWS_REGION: process.env.AWS_REGION,
                    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
                    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
                    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
                    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV,
                    LAMBDA_RUNTIME_DIR: process.env.LAMBDA_RUNTIME_DIR,
                    AWS_USE_STS: process.env.AWS_USE_STS
                });
            }

            handleDynamoDBError(error, 'getSchedules');
            return [];
        }
    }

    /**
     * Fetch schedules with filtering support
     */
    static async getSchedulesWithFilters(active?: boolean, searchTerm?: string): Promise<UISchedule[]> {
        try {
            console.log('ScheduleService - Attempting to fetch schedules with filters from DynamoDB', { active, searchTerm });
            
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();

            // Base filter for schedules
            let filterExpression = '#type = :typeVal';
            const expressionAttributeNames: Record<string, string> = {
                '#type': 'type',
            };
            let expressionAttributeValues: Record<string, any> = {
                ':typeVal': 'schedule',
            };

            // Add active filter if provided
            if (active !== undefined) {
                filterExpression += ' AND #active = :activeVal';
                expressionAttributeNames['#active'] = 'active';
                expressionAttributeValues[':activeVal'] = active;
            }

            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            });

            const response = await dynamoDBDocumentClient.send(command);
            
            let schedules = (response.Items || []).map(item => this.transformToUISchedule(item as Schedule));
            
            // Apply search term filter if provided
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                schedules = schedules.filter(schedule => 
                    schedule.name.toLowerCase().includes(term) || 
                    (schedule.description && schedule.description.toLowerCase().includes(term))
                );
            }
            
            return schedules;
        } catch (error: any) {
            console.error('ScheduleService - Error fetching schedules with filters:', error);
            handleDynamoDBError(error, 'getSchedulesWithFilters');
            return [];
        }
    }

    /**
     * Get a specific schedule by name
     */
    static async getSchedule(name: string): Promise<UISchedule | null> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();
            const command = new GetCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Key: {
                    name: name,
                    type: 'schedule',
                },
            });

            const response = await dynamoDBDocumentClient.send(command);
            return response.Item ? this.transformToUISchedule(response.Item as Schedule) : null;
        } catch (error: any) {
            handleDynamoDBError(error, 'getSchedule');
            return null;
        }
    }

    /**
     * Create a new schedule
     */
    static async createSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();
            const now = new Date().toISOString();
            const dbSchedule = {
                ...schedule,
                createdAt: now,
                updatedAt: now,
            };

            const command = new PutCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Item: dbSchedule,
                ConditionExpression: 'attribute_not_exists(#name) AND attribute_not_exists(#type)',
                ExpressionAttributeNames: {
                    '#name': 'name',
                    '#type': 'type'
                }
            });

            await dynamoDBDocumentClient.send(command);

            // Log audit event
            await AuditService.logUserAction({
                action: 'Create Schedule',
                resourceType: 'schedule',
                resourceId: schedule.name,
                resourceName: schedule.name,
                user: 'system',
                userType: 'user',
                status: 'success',
                details: `Created schedule "${schedule.name}" with ${schedule.days.join(', ')} from ${schedule.starttime} to ${schedule.endtime}`,
                metadata: {
                    scheduleName: schedule.name,
                    starttime: schedule.starttime,
                    endtime: schedule.endtime,
                    timezone: schedule.timezone,
                    days: schedule.days,
                    active: schedule.active,
                },
            });

            return dbSchedule as Schedule;
        } catch (error) {
            console.error('Error creating schedule:', error);

            // Log failed audit event
            await AuditService.logUserAction({
                action: 'Create Schedule',
                resourceType: 'schedule',
                resourceId: schedule.name,
                resourceName: schedule.name,
                user: 'system',
                userType: 'user',
                status: 'error',
                details: `Failed to create schedule "${schedule.name}": ${(error as any).message}`,
                metadata: { error: (error as any).message },
            });

            handleDynamoDBError(error, 'create schedule');
            throw error;
        }
    }

    /**
     * Update an existing schedule
     */
    static async updateSchedule(scheduleName: string, updates: Partial<Omit<Schedule, 'name'>>): Promise<UISchedule> {
        try {
            // First, get the current schedule
            const currentSchedule = await this.getSchedule(scheduleName);
            if (!currentSchedule) {
                throw new Error('Schedule not found');
            }

            // Build update expression dynamically, excluding key attributes
            const updateExpressions: string[] = [];
            const expressionAttributeNames: Record<string, string> = {};
            const expressionAttributeValues: Record<string, any> = {};

            // List of fields that should NOT be updated (key attributes and computed fields)
            const excludedFields = ['name', 'type'];

            Object.entries(updates).forEach(([key, value]) => {
                // Skip key attributes and undefined values
                if (value !== undefined && !excludedFields.includes(key)) {
                    updateExpressions.push(`#${key} = :${key}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[`:${key}`] = value;
                }
            });

            // If no fields to update, return current schedule as UISchedule
            if (updateExpressions.length === 0) {
                return currentSchedule as UISchedule;
            }

            const command = new UpdateCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Key: {
                    name: scheduleName, // Partition key
                    type: 'schedule',   // Sort key - must match exactly
                },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            });

            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();
            const response = await dynamoDBDocumentClient.send(command);
            const updatedSchedule = this.transformToUISchedule(response.Attributes as Schedule);

            // Audit the change
            const changedFields = Object.keys(updates).filter(key => !excludedFields.includes(key));
            await AuditService.logUserAction({
                action: 'Update Schedule',
                resourceType: 'schedule',
                resourceId: scheduleName,
                resourceName: scheduleName,
                user: 'system',
                userType: 'user',
                status: 'success',
                details: `Updated schedule "${scheduleName}" with changes: ${changedFields.join(', ')}`,
                metadata: {
                    scheduleName,
                    updatedFields: changedFields,
                    previousValues: changedFields.reduce((acc, field) => {
                        acc[field] = (currentSchedule as any)[field];
                        return acc;
                    }, {} as any),
                    newValues: updates,
                },
            });

            return updatedSchedule;
        } catch (error) {
            console.error('Error updating schedule:', error);

            // Audit the failed update
            await AuditService.logUserAction({
                action: 'Update Schedule',
                resourceType: 'schedule',
                resourceId: scheduleName,
                resourceName: scheduleName,
                user: 'system',
                userType: 'user',
                status: 'error',
                details: `Failed to update schedule "${scheduleName}": ${(error as any).message}`,
                metadata: { error: (error as any).message, attemptedUpdates: updates },
            });

            handleDynamoDBError(error, 'update schedule');
            throw error;
        }
    }

    /**
     * Delete a schedule
     */
    static async deleteSchedule(name: string): Promise<void> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();
            const command = new DeleteCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Key: {
                    name: name,
                    type: 'schedule',
                },
            });

            await dynamoDBDocumentClient.send(command);

            // Log audit event
            await AuditService.logUserAction({
                action: 'Delete Schedule',
                resourceType: 'schedule',
                resourceId: name,
                resourceName: name,
                user: 'system', // This would be passed from the caller in a real implementation
                userType: 'user',
                status: 'success',
                details: `Deleted schedule "${name}"`,
            });
        } catch (error: any) {
            handleDynamoDBError(error, 'deleteSchedule');
        }
    }

    /**
     * Toggle schedule active status
     */
    static async toggleScheduleStatus(name: string): Promise<UISchedule> {
        try {
            // First get the current schedule
            const currentSchedule = await this.getSchedule(name);
            if (!currentSchedule) {
                throw new Error('Schedule not found');
            }

            // Toggle the active status
            const updatedSchedule = await this.updateSchedule(name, { active: !currentSchedule.active });

            // Log audit event
            await AuditService.logUserAction({
                action: 'Toggle Schedule Status',
                resourceType: 'schedule',
                resourceId: name,
                resourceName: name,
                user: 'system', // This would be passed from the caller in a real implementation
                userType: 'user',
                status: 'success',
                details: `Toggled schedule "${name}" status to ${!currentSchedule.active ? 'active' : 'inactive'}`,
                metadata: {
                    previousStatus: currentSchedule.active,
                    newStatus: !currentSchedule.active,
                },
            });

            return updatedSchedule;
        } catch (error: any) {
            if (error.message === 'Schedule not found') {
                throw error;
            }
            handleDynamoDBError(error, 'toggleScheduleStatus');
            throw error; // Re-throw after handling
        }
    }

    /**
     * Transform DynamoDB item to UI schedule format
     */
    private static transformToUISchedule(item: Schedule): UISchedule {
        return {
            id: item.name, // Use name as ID for UI
            name: item.name,
            starttime: item.starttime,
            endtime: item.endtime,
            timezone: item.timezone,
            active: item.active,
            days: item.days,
            description: item.description || '',
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
            updatedBy: item.updatedBy,
            // Default values for UI-specific fields that aren't in DynamoDB
            accounts: [],
            resourceTypes: ['EC2', 'RDS', 'ECS'], // Default supported types
            lastExecution: undefined,
            nextExecution: undefined,
            executionCount: 0,
            successRate: 100,
            estimatedSavings: 0,
        };
    }
}
