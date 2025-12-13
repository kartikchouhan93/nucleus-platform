// DynamoDB service for audit log operations
import { ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBDocumentClient, DYNAMODB_TABLE_NAME, handleDynamoDBError } from './aws-config';
import { AuditLog } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogFilters {
    startDate?: string;
    endDate?: string;
    eventType?: string;
    status?: string;
    severity?: string;
    userType?: string;
    resourceType?: string;
    user?: string;
    correlationId?: string;
    limit?: number;
}

export interface AuditLogStats {
    totalLogs: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    systemEvents: number;
    userEvents: number;
    criticalEvents: number;
    byEventType: Record<string, number>;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byResourceType: Record<string, number>;
}

// Define handleDynamoDBError if it's not properly imported
const handleError = (error: any, operation: string) => {
    console.error(`AuditService - Error during ${operation}:`, error);
    console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode
    });

    // Re-throw with a more user-friendly message
    if (error.name === 'ValidationException') {
        throw new Error(`Validation error: ${error.message}`);
    } else {
        throw new Error(`Failed to ${operation}`);
    }
};

export class AuditService {
    /**
     * Fetch audit logs from DynamoDB
     */
    static async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
        try {
            console.log('AuditService - Attempting to fetch audit logs from DynamoDB');
            
            let filterExpressions: string[] = ['#type = :typeVal'];
            const expressionAttributeNames: Record<string, string> = {
                '#type': 'type'
            };
            
            const expressionAttributeValues: Record<string, any> = {
                ':typeVal': 'audit_log'
            };
            
            // Add date range filters if provided
            if (filters.startDate) {
                filterExpressions.push('timestamp >= :startDate');
                expressionAttributeValues[':startDate'] = filters.startDate;
            }
            
            if (filters.endDate) {
                filterExpressions.push('timestamp <= :endDate');
                expressionAttributeValues[':endDate'] = filters.endDate;
            }
            
            // Add other filters
            if (filters.eventType) {
                filterExpressions.push('#eventType = :eventType');
                expressionAttributeNames['#eventType'] = 'action';
                expressionAttributeValues[':eventType'] = filters.eventType;
            }
            
            if (filters.status) {
                filterExpressions.push('#status = :status');
                expressionAttributeNames['#status'] = 'status';
                expressionAttributeValues[':status'] = filters.status;
            }
            
            if (filters.severity) {
                filterExpressions.push('#severity = :severity');
                expressionAttributeNames['#severity'] = 'severity';
                expressionAttributeValues[':severity'] = filters.severity;
            }
            
            if (filters.userType) {
                filterExpressions.push('#userType = :userType');
                expressionAttributeNames['#userType'] = 'userType';
                expressionAttributeValues[':userType'] = filters.userType;
            }
            
            if (filters.resourceType) {
                filterExpressions.push('#resourceType = :resourceType');
                expressionAttributeNames['#resourceType'] = 'resourceType';
                expressionAttributeValues[':resourceType'] = filters.resourceType;
            }
            
            if (filters.user) {
                filterExpressions.push('#user = :user');
                expressionAttributeNames['#user'] = 'user';
                expressionAttributeValues[':user'] = filters.user;
            }
            
            if (filters.correlationId) {
                filterExpressions.push('#correlationId = :correlationId');
                expressionAttributeNames['#correlationId'] = 'correlationId';
                expressionAttributeValues[':correlationId'] = filters.correlationId;
            }
            
            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: filterExpressions.join(' AND '),
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                Limit: filters.limit || 100
            });
            
            const response = await getDynamoDBDocumentClient().send(command);
            console.log('AuditService - Successfully fetched audit logs:', response.Items?.length || 0);
            
            return response.Items as AuditLog[] || [];
        } catch (error: any) {
            console.error('AuditService - Error fetching audit logs:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.$metadata?.httpStatusCode
            });
            throw new Error('Failed to fetch audit logs from database');
        }
    }

    /**
     * Get audit log statistics
     */
    static async getAuditLogStats(filters: AuditLogFilters = {}): Promise<AuditLogStats> {
        try {
            console.log('AuditService - Calculating audit log statistics');
            
            // Fetch logs with the given filters
            const logs = await this.getAuditLogs(filters);
            
            // Initialize stats object
            const stats: AuditLogStats = {
                totalLogs: logs.length,
                successCount: 0,
                errorCount: 0,
                warningCount: 0,
                systemEvents: 0,
                userEvents: 0,
                criticalEvents: 0,
                byEventType: {},
                byStatus: {},
                bySeverity: {},
                byResourceType: {}
            };
            
            // Populate stats by iterating through logs
            logs.forEach(log => {
                // Count by status
                if (log.status === 'success') stats.successCount++;
                else if (log.status === 'error') stats.errorCount++;
                else if (log.status === 'warning') stats.warningCount++;
                
                // Count by user type
                if (log.userType === 'system') stats.systemEvents++;
                else if (log.userType === 'user') stats.userEvents++;
                
                // Count by severity
                if (log.severity === 'critical') stats.criticalEvents++;
                
                // Count by event type
                if (!stats.byEventType[log.action]) stats.byEventType[log.action] = 0;
                stats.byEventType[log.action]++;
                
                // Count by status
                if (!stats.byStatus[log.status]) stats.byStatus[log.status] = 0;
                stats.byStatus[log.status]++;
                
                // Count by severity
                const severity = log.severity || 'medium';
                if (!stats.bySeverity[severity]) stats.bySeverity[severity] = 0;
                stats.bySeverity[severity]++;
                
                // Count by resource type
                if (!stats.byResourceType[log.resourceType]) stats.byResourceType[log.resourceType] = 0;
                stats.byResourceType[log.resourceType]++;
            });
            
            return stats;
        } catch (error) {
            console.error('AuditService - Error calculating audit log statistics:', error);
            throw new Error('Failed to calculate audit log statistics');
        }
    }

    /**
     * Get audit logs by correlation ID
     */
    static async getAuditLogsByCorrelationId(correlationId: string): Promise<AuditLog[]> {
        try {
            console.log('AuditService - Fetching audit logs by correlation ID');
            
            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: '#type = :typeVal AND correlationId = :correlationId',
                ExpressionAttributeNames: {
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':typeVal': 'audit_log',
                    ':correlationId': correlationId
                }
            });
            
            const response = await getDynamoDBDocumentClient().send(command);
            console.log('AuditService - Successfully fetched audit logs by correlation ID:', response.Items?.length || 0);
            
            return response.Items as AuditLog[] || [];
        } catch (error) {
            console.error('AuditService - Error fetching audit logs by correlation ID:', error);
            throw new Error('Failed to fetch audit logs by correlation ID');
        }
    }

    /**
     * Create a new audit log entry
     */
    static async logUserAction(auditData: {
        action: string;
        resourceType: string;
        resourceId: string;
        resourceName?: string;
        user: string;
        userType: string;
        status: 'success' | 'error' | 'warning';
        details?: string;
        metadata?: Record<string, any>;
        correlationId?: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
    }): Promise<void> {
        try {
            console.log('AuditService - Creating new audit log');
            
            const now = new Date().toISOString();
            const logId = uuidv4();
            
            const auditLog = {
                id: logId,
                type: 'audit_log',
                timestamp: now,
                action: auditData.action,
                resourceType: auditData.resourceType,
                resourceId: auditData.resourceId,
                resourceName: auditData.resourceName || auditData.resourceId,
                user: auditData.user,
                userType: auditData.userType,
                status: auditData.status,
                details: auditData.details || '',
                metadata: auditData.metadata || {},
                correlationId: auditData.correlationId || logId,
                severity: auditData.severity || 'medium'
            };
            
            const command = new PutCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Item: auditLog
            });
            
            await getDynamoDBDocumentClient().send(command);
            console.log('AuditService - Successfully created audit log');
        } catch (error) {
            console.error('AuditService - Error creating audit log:', error);
            handleError(error, 'create audit log');
        }
    }
}
