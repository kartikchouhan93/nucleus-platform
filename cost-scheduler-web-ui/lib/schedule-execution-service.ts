// DynamoDB service for schedule execution operations
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBDocumentClient, APP_TABLE_NAME, handleDynamoDBError, DEFAULT_TENANT_ID } from './aws-config';

// Helper to build PK/SK for executions
const buildExecutionPK = (tenantId: string, accountId: string) => `TENANT#${tenantId}#ACCOUNT#${accountId}`;
const buildExecutionSK = (scheduleId: string, timestamp: string) => `SCHEDULE#${scheduleId}#EXEC#${timestamp}`;

export interface ScheduleExecution {
    executionId: string;
    tenantId: string;
    accountId: string;
    scheduleId: string;
    executionTime: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
    resourcesStarted?: number;
    resourcesStopped?: number;
    resourcesFailed?: number;
    duration?: number; // in seconds
    errorMessage?: string;
    details?: Record<string, any>;
}

export interface UIScheduleExecution extends ScheduleExecution {
    id: string;
}

export class ScheduleExecutionService {
    /**
     * Log a schedule execution result
     * PK: TENANT#<tenantId>#ACCOUNT#<accountId>
     * SK: SCHEDULE#<scheduleId>#EXEC#<timestamp>
     */
    static async logExecution(execution: Omit<ScheduleExecution, 'executionId'>): Promise<ScheduleExecution> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();
            const now = execution.executionTime || new Date().toISOString();
            const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // TTL: 90 days from now (for automatic cleanup)
            const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

            const dbItem = {
                // Primary Keys (hierarchical design)
                pk: buildExecutionPK(execution.tenantId, execution.accountId),
                sk: buildExecutionSK(execution.scheduleId, now),

                // GSI1: TYPE#EXECUTION -> timestamp#executionId (list all executions)
                gsi1pk: 'TYPE#EXECUTION',
                gsi1sk: `${now}#${executionId}`,

                // GSI3: STATUS#<status> -> TENANT#...#EXEC#...
                gsi3pk: `STATUS#${execution.status}`,
                gsi3sk: `TENANT#${execution.tenantId}#EXEC#${executionId}`,

                // Entity type
                type: 'execution',

                // TTL for auto-cleanup
                ttl: ttl,

                // IDs
                executionId,
                tenantId: execution.tenantId,
                accountId: execution.accountId,
                scheduleId: execution.scheduleId,

                // Attributes
                executionTime: now,
                status: execution.status,
                resourcesStarted: execution.resourcesStarted || 0,
                resourcesStopped: execution.resourcesStopped || 0,
                resourcesFailed: execution.resourcesFailed || 0,
                duration: execution.duration,
                errorMessage: execution.errorMessage,
                details: execution.details,
            };

            const command = new PutCommand({
                TableName: APP_TABLE_NAME,
                Item: dbItem,
            });

            await dynamoDBDocumentClient.send(command);
            console.log(`ScheduleExecutionService - Logged execution ${executionId} for schedule ${execution.scheduleId}`);

            return {
                executionId,
                ...execution,
                executionTime: now,
            };
        } catch (error: any) {
            console.error('ScheduleExecutionService - Error logging execution:', error);
            handleDynamoDBError(error, 'log execution');
            throw error;
        }
    }

    /**
     * Get executions for a specific schedule
     * Uses PK + SK begins_with
     */
    static async getExecutionsForSchedule(
        scheduleId: string,
        accountId: string,
        tenantId: string = DEFAULT_TENANT_ID,
        options?: {
            limit?: number;
            startDate?: string;
            endDate?: string;
        }
    ): Promise<UIScheduleExecution[]> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();

            let keyConditionExpression = 'pk = :pk AND begins_with(sk, :skPrefix)';
            const expressionAttributeValues: Record<string, any> = {
                ':pk': buildExecutionPK(tenantId, accountId),
                ':skPrefix': `SCHEDULE#${scheduleId}#EXEC#`,
            };

            // Add date range if provided
            if (options?.startDate && options?.endDate) {
                keyConditionExpression = 'pk = :pk AND sk BETWEEN :skStart AND :skEnd';
                expressionAttributeValues[':skStart'] = `SCHEDULE#${scheduleId}#EXEC#${options.startDate}`;
                expressionAttributeValues[':skEnd'] = `SCHEDULE#${scheduleId}#EXEC#${options.endDate}`;
            }

            const command = new QueryCommand({
                TableName: APP_TABLE_NAME,
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ScanIndexForward: false, // newest first
                Limit: options?.limit || 50,
            });

            const response = await dynamoDBDocumentClient.send(command);

            return (response.Items || []).map(item => this.transformToUIExecution(item));
        } catch (error: any) {
            console.error('ScheduleExecutionService - Error fetching executions:', error);
            handleDynamoDBError(error, 'get executions');
            return [];
        }
    }

    /**
     * Get all recent executions (across all schedules)
     * Uses GSI1: TYPE#EXECUTION
     */
    static async getRecentExecutions(options?: {
        limit?: number;
        status?: string;
    }): Promise<UIScheduleExecution[]> {
        try {
            const dynamoDBDocumentClient = await getDynamoDBDocumentClient();

            const command = new QueryCommand({
                TableName: APP_TABLE_NAME,
                IndexName: 'GSI1',
                KeyConditionExpression: 'gsi1pk = :pkVal',
                ExpressionAttributeValues: {
                    ':pkVal': 'TYPE#EXECUTION',
                },
                ScanIndexForward: false, // newest first
                Limit: options?.limit || 100,
            });

            const response = await dynamoDBDocumentClient.send(command);
            let executions = (response.Items || []).map(item => this.transformToUIExecution(item));

            // In-memory filtering by status if provided
            if (options?.status) {
                executions = executions.filter(e => e.status === options.status);
            }

            return executions;
        } catch (error: any) {
            console.error('ScheduleExecutionService - Error fetching recent executions:', error);
            handleDynamoDBError(error, 'get recent executions');
            return [];
        }
    }

    /**
     * Transform DynamoDB item to UI execution format
     */
    private static transformToUIExecution(item: any): UIScheduleExecution {
        return {
            id: item.executionId,
            executionId: item.executionId,
            tenantId: item.tenantId,
            accountId: item.accountId,
            scheduleId: item.scheduleId,
            executionTime: item.executionTime,
            status: item.status,
            resourcesStarted: item.resourcesStarted,
            resourcesStopped: item.resourcesStopped,
            resourcesFailed: item.resourcesFailed,
            duration: item.duration,
            errorMessage: item.errorMessage,
            details: item.details,
        };
    }
}
