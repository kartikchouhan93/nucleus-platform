// DynamoDB service for audit log operations
import { ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBDocumentClient, DYNAMODB_TABLE_NAME, handleDynamoDBError } from './aws-config';
import { AuditLog } from './types';

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
    searchTerm?: string;
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

export class AuditService {
    /**
     * Create a new audit log entry
     */
    static async createAuditLog(auditData: Omit<AuditLog, 'id' | 'type' | 'timestamp'>): Promise<void> {
        try {
            // Skip logging in development/local environment
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUDIT_LOGGING === 'true') {
                console.log('AuditService - Skipping audit log creation in development environment');
                return;
            }

            // Check if auditData is a string (serialized JSON)
            if (typeof auditData === 'string') {
                try {
                    auditData = JSON.parse(auditData);
                } catch (parseError) {
                    console.error('AuditService - Failed to parse audit data string:', parseError);
                    return;
                }
            }

            // Check if auditData is empty or invalid
            if (!auditData || typeof auditData !== 'object' || Object.keys(auditData).length === 0) {
                console.warn('AuditService - Received empty audit data, skipping log creation');
                return;
            }

            // Validate and clean the audit data
            const cleanedAuditData = this.validateAndCleanAuditData(auditData);

            // Generate a unique ID for this audit log
            const auditId = this.generateAuditId();

            // Use the audit log ID as the "name" field to satisfy the DynamoDB schema requirement
            // Construct the audit log with required DynamoDB keys
            const auditLog: AuditLog & { name: string } = {
                name: auditId, // IMPORTANT: This is the partition key required by DynamoDB
                type: 'audit_log', // This is the sort key
                id: auditId, // Keep the id for backward compatibility
                timestamp: new Date().toISOString(),
                ...cleanedAuditData
            };

            // Clean any potential invalid DynamoDB values
            const sanitizedLog = this.sanitizeForDynamoDB(auditLog);

            // Ensure required DynamoDB keys are present
            if (!sanitizedLog.name || !sanitizedLog.type) {
                console.error('AuditService - Missing required DynamoDB keys (name, type), skipping log creation');
                return;
            }

            // Create a fallback handler that won't throw
            try {
                const command = new PutCommand({
                    TableName: DYNAMODB_TABLE_NAME,
                    Item: sanitizedLog
                });

                await getDynamoDBDocumentClient().send(command);
                console.log('AuditService - Successfully created audit log:', auditLog.id);
            } catch (dynErr: unknown) {
                // More specific error logging for debugging the issue
                const errorName = dynErr instanceof Error ? dynErr.name : 'Unknown';
                const errorMessage = dynErr instanceof Error ? dynErr.message : 'Unknown error';
                console.error('AuditService - DynamoDB error:', errorName, errorMessage);
                console.error('AuditService - Failed payload:', JSON.stringify(sanitizedLog, null, 2));

                // Try again with minimal fields - ensuring required DynamoDB keys are included
                if (dynErr instanceof Error && dynErr.name === 'ValidationException') {
                    try {
                        const minimalLog = {
                            name: auditId, // Required partition key
                            type: 'audit_log', // Required sort key
                            id: auditId,
                            timestamp: auditLog.timestamp,
                            action: cleanedAuditData.action || 'Unknown Action',
                            eventType: cleanedAuditData.eventType || 'unknown.action',
                            user: cleanedAuditData.user || 'system',
                            resource: cleanedAuditData.resource || 'Unknown',
                            details: cleanedAuditData.details || 'No details'
                        };

                        const command = new PutCommand({
                            TableName: DYNAMODB_TABLE_NAME,
                            Item: minimalLog
                        });

                        await getDynamoDBDocumentClient().send(command);
                        console.log('AuditService - Successfully created minimal audit log after initial failure');
                    } catch (fallbackErr) {
                        console.error('AuditService - Failed to create even minimal audit log:', fallbackErr);
                    }
                }
            }
        } catch (error: unknown) {
            console.error('AuditService - Error creating audit log:', error);
            console.error('AuditService - Audit data that failed:', auditData);
            // Don't throw error to prevent audit logging from breaking main functionality
        }
    }

    /**
     * Fetch audit logs with optional filters
     */
    static async getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
        try {
            console.log('AuditService - Fetching audit logs with filters:', filters);

            let command;

            if (filters?.startDate || filters?.endDate) {
                // Use Query with GSI if we have time-based filters
                command = new ScanCommand({
                    TableName: DYNAMODB_TABLE_NAME,
                    FilterExpression: this.buildFilterExpression(filters),
                    ExpressionAttributeNames: this.buildAttributeNames(filters),
                    ExpressionAttributeValues: this.buildAttributeValues(filters),
                    Limit: filters?.limit || 1000,
                });
            } else {
                // Use Scan for general queries
                command = new ScanCommand({
                    TableName: DYNAMODB_TABLE_NAME,
                    FilterExpression: this.buildFilterExpression(filters),
                    ExpressionAttributeNames: this.buildAttributeNames(filters),
                    ExpressionAttributeValues: this.buildAttributeValues(filters),
                    Limit: filters?.limit || 1000,
                });
            }

            const response = await getDynamoDBDocumentClient().send(command);
            const auditLogs = (response.Items || []) as AuditLog[];

            // Sort by timestamp descending (newest first)
            auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            console.log('AuditService - Successfully fetched audit logs:', auditLogs.length);
            return auditLogs;
        } catch (error: unknown) {
            console.error('AuditService - Error fetching audit logs:', error);
            handleDynamoDBError(error, 'fetch audit logs');
            return [];
        }
    }

    /**
     * Get audit logs by correlation ID
     */
    static async getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]> {
        try {
            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: '#type = :typeVal AND correlationId = :correlationId',
                ExpressionAttributeNames: {
                    '#type': 'type',
                },
                ExpressionAttributeValues: {
                    ':typeVal': 'audit_log',
                    ':correlationId': correlationId,
                },
            });

            const response = await getDynamoDBDocumentClient().send(command);
            const auditLogs = (response.Items || []) as AuditLog[];

            // Sort by timestamp
            auditLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            return auditLogs;
        } catch (error: unknown) {
            console.error('AuditService - Error fetching correlated audit logs:', error);
            return [];
        }
    }

    /**
     * Get audit log statistics
     */
    static async getAuditLogStats(filters?: AuditLogFilters): Promise<AuditLogStats> {
        try {
            const now = new Date();
            let startDate: Date;
            let endDate: Date = now;

            // Handle filters parameter
            if (filters?.startDate) {
                startDate = new Date(filters.startDate);
            } else {
                startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Default to 1 day ago
            }

            if (filters?.endDate) {
                endDate = new Date(filters.endDate);
            }

            const logs = await this.getAuditLogs({
                ...filters,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const stats = {
                totalLogs: logs.length,
                successCount: logs.filter(log => log.status === 'success').length,
                errorCount: logs.filter(log => log.status === 'error').length,
                warningCount: logs.filter(log => log.status === 'warning').length,
                systemEvents: logs.filter(log => log.userType === 'system').length,
                userEvents: logs.filter(log => log.userType === 'user' || log.userType === 'admin').length,
                criticalEvents: logs.filter(log => log.severity === 'critical').length,
                byEventType: this.groupBy(logs, 'eventType'),
                byStatus: this.groupBy(logs, 'status'),
                bySeverity: this.groupBy(logs, 'severity'),
                byResourceType: this.groupBy(logs, 'resourceType'),
            };

            return stats;
        } catch (error: unknown) {
            console.error('AuditService - Error fetching audit log stats:', error);
            return {
                totalLogs: 0,
                successCount: 0,
                errorCount: 0,
                warningCount: 0,
                systemEvents: 0,
                userEvents: 0,
                criticalEvents: 0,
                byEventType: {},
                byStatus: {},
                bySeverity: {},
                byResourceType: {},
            };
        }
    }

    // Helper methods
    private static generateAuditId(): string {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate and clean audit data before saving to DynamoDB
     */
    /**
     * Validate and clean audit data before saving to DynamoDB
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static validateAndCleanAuditData(data: any): Record<string, any> {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid audit data: data must be a non-empty object');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleaned: Record<string, any> = {};

        // Required fields with defaults
        cleaned.eventType = data.eventType || 'unknown.action';
        cleaned.action = data.action || 'Unknown Action';
        cleaned.user = data.user || 'system';
        cleaned.userType = data.userType || 'system';
        cleaned.resource = data.resource || 'Unknown Resource';
        cleaned.resourceType = data.resourceType || 'unknown';
        cleaned.resourceId = data.resourceId || 'unknown';
        cleaned.status = data.status || 'info';
        cleaned.severity = data.severity || 'info';
        cleaned.details = data.details || 'No details provided';
        cleaned.source = data.source || 'system';

        // Validate enum values
        const validStatuses = ['success', 'error', 'warning', 'info', 'pending'];
        if (!validStatuses.includes(cleaned.status as string)) {
            cleaned.status = 'info';
        }

        const validSeverities = ['low', 'medium', 'high', 'critical', 'info'];
        if (!validSeverities.includes(cleaned.severity as string)) {
            cleaned.severity = 'info';
        }

        const validUserTypes = ['system', 'user', 'admin', 'external'];
        if (!validUserTypes.includes(cleaned.userType as string)) {
            cleaned.userType = 'system';
        }

        const validSources = ['web-ui', 'lambda', 'system', 'api'];
        if (!validSources.includes(cleaned.source as string)) {
            cleaned.source = 'system';
        }

        // Optional fields - only include if they have values
        if (data.metadata && typeof data.metadata === 'object') {
            cleaned.metadata = data.metadata;
        }
        if (data.ipAddress && typeof data.ipAddress === 'string') cleaned.ipAddress = data.ipAddress;
        if (data.userAgent && typeof data.userAgent === 'string') cleaned.userAgent = data.userAgent;
        if (data.sessionId && typeof data.sessionId === 'string') cleaned.sessionId = data.sessionId;
        if (data.correlationId && typeof data.correlationId === 'string') cleaned.correlationId = data.correlationId;
        if (data.executionId && typeof data.executionId === 'string') cleaned.executionId = data.executionId;
        if (data.region && typeof data.region === 'string') cleaned.region = data.region;
        if (data.accountId && typeof data.accountId === 'string') cleaned.accountId = data.accountId;
        if (data.duration !== undefined && data.duration !== null && !isNaN(Number(data.duration))) {
            cleaned.duration = Number(data.duration);
        }
        if (data.errorCode && typeof data.errorCode === 'string') cleaned.errorCode = data.errorCode;

        return cleaned;
    }

    private static buildFilterExpression(filters?: AuditLogFilters): string {
        const conditions = ['#type = :typeVal'];

        if (filters?.startDate) conditions.push('#timestamp >= :startDate');
        if (filters?.endDate) conditions.push('#timestamp <= :endDate');
        if (filters?.eventType) conditions.push('eventType = :eventType');
        if (filters?.status) conditions.push('#status = :status');
        if (filters?.severity) conditions.push('severity = :severity');
        if (filters?.userType) conditions.push('userType = :userType');
        if (filters?.resourceType) conditions.push('resourceType = :resourceType');
        if (filters?.user) conditions.push('#user = :user');
        if (filters?.correlationId) conditions.push('correlationId = :correlationId');
        
        // Handle search term across multiple fields
        if (filters?.searchTerm) {
            const searchTerm = filters.searchTerm.toLowerCase();
            conditions.push(
                '(contains(lower(action), :searchTerm) OR ' +
                'contains(lower(resourceType), :searchTerm) OR ' +
                'contains(lower(#user), :searchTerm) OR ' +
                'contains(lower(details), :searchTerm))'
            );
        }

        return conditions.join(' AND ');
    }

    private static buildAttributeNames(filters?: AuditLogFilters): Record<string, string> {
        const names: Record<string, string> = {
            '#type': 'type',
        };

        if (filters?.startDate || filters?.endDate) names['#timestamp'] = 'timestamp';
        if (filters?.status) names['#status'] = 'status';
        if (filters?.user) names['#user'] = 'user';

        return names;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static buildAttributeValues(filters?: AuditLogFilters): Record<string, any> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values: Record<string, any> = {
            ':typeVal': 'audit_log',
        };

        if (filters?.startDate) values[':startDate'] = filters.startDate;
        if (filters?.endDate) values[':endDate'] = filters.endDate;
        if (filters?.eventType) values[':eventType'] = filters.eventType;
        if (filters?.status) values[':status'] = filters.status;
        if (filters?.severity) values[':severity'] = filters.severity;
        if (filters?.userType) values[':userType'] = filters.userType;
        if (filters?.resourceType) values[':resourceType'] = filters.resourceType;
        if (filters?.user) values[':user'] = filters.user;
        if (filters?.correlationId) values[':correlationId'] = filters.correlationId;
        if (filters?.searchTerm) values[':searchTerm'] = filters.searchTerm.toLowerCase();

        return values;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static groupBy(array: any[], key: string): Record<string, number> {
        return array.reduce((result, item) => {
            const value = item[key] || 'unknown';
            result[value] = (result[value] || 0) + 1;
            return result;
        }, {});
    }

    /**
     * Sanitize the object for DynamoDB - remove empty attributes and sanitize metadata
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static sanitizeForDynamoDB(data: any): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitized: any = {};

        // CRITICAL: Always include required DynamoDB keys
        sanitized.name = data.name || data.id || this.generateAuditId(); // Partition key
        sanitized.type = data.type || 'audit_log'; // Sort key
        sanitized.id = data.id || sanitized.name;
        sanitized.timestamp = data.timestamp || new Date().toISOString();

        // Process each property
        Object.entries(data).forEach(([key, value]) => {
            // Skip already added required fields
            if (key === 'name' || key === 'type' || key === 'id' || key === 'timestamp') {
                return;
            }

            // Skip empty values
            if (value === undefined || value === null || value === '') {
                return;
            }

            // Fix for metadata - ensure it doesn't contain id, type or name that could conflict
            if (key === 'metadata' && typeof value === 'object' && value !== null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const safeMetadata = { ...value } as any;
                // Remove potential conflicting attributes from metadata
                delete safeMetadata.name;
                delete safeMetadata.type;

                // Skip if empty after cleaning
                if (Object.keys(safeMetadata).length === 0) {
                    return;
                }

                sanitized.metadata = this.sanitizeNestedObject(safeMetadata);
                return;
            }

            // Other property handling (unchanged)
            // ...existing code for other property types...

            // Handle objects (like metadata)
            if (typeof value === 'object' && !Array.isArray(value)) {
                // DynamoDB doesn't support empty objects
                if (value === null || Object.keys(value).length === 0) {
                    return;
                }

                try {
                    // Handle special cases that might cause problems in DynamoDB
                    const jsonString = JSON.stringify(value);
                    // If we can stringify and parse it back, it should be safe for DynamoDB
                    const safeObject = JSON.parse(jsonString);

                    // Recursively sanitize nested objects
                    const sanitizedObject = this.sanitizeNestedObject(safeObject);

                    // Only add if the sanitized object has properties
                    if (Object.keys(sanitizedObject).length > 0) {
                        sanitized[key] = sanitizedObject;
                    }
                } catch (e) {
                    console.warn(`AuditService - Could not sanitize object property ${key}:`, e);
                    // Skip this property if it can't be sanitized
                }
                return;
            }

            // Handle arrays
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return; // Skip empty arrays
                }

                try {
                    sanitized[key] = value.map(item =>
                        typeof item === 'object' && item !== null
                            ? this.sanitizeNestedObject(item)
                            : item
                    ).filter(Boolean); // Remove any null or undefined items

                    // If array became empty after sanitization, skip it
                    if (sanitized[key].length === 0) {
                        delete sanitized[key];
                    }
                } catch (e) {
                    console.warn(`AuditService - Could not sanitize array property ${key}:`, e);
                }
                return;
            }

            // Add other values directly
            if (typeof value === 'string') {
                // Ensure strings are not empty
                if (value.trim() !== '') {
                    sanitized[key] = value;
                }
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                // Numbers and booleans are safe
                sanitized[key] = value;
            } else {
                // For any other type, try to convert to string
                try {
                    const strValue = String(value);
                    if (strValue.trim() !== '') {
                        sanitized[key] = strValue;
                    }
                } catch (e) {
                    console.warn(`AuditService - Could not convert ${key} to string:`, e);
                }
            }
        });

        return sanitized;
    }

    /**
     * Helper method to sanitize nested objects without adding name/type conflicts
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static sanitizeNestedObject(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = {};

        Object.entries(obj).forEach(([key, value]) => {
            // Skip empty values
            if (value === undefined || value === null || value === '') {
                return;
            }

            // Handle nested objects
            if (typeof value === 'object' && !Array.isArray(value)) {
                if (value === null || Object.keys(value).length === 0) {
                    return;
                }
                const sanitized = this.sanitizeNestedObject(value);
                if (Object.keys(sanitized).length > 0) {
                    result[key] = sanitized;
                }
                return;
            }

            // Handle arrays
            if (Array.isArray(value)) {
                if (value.length === 0) return;
                result[key] = value.map(item =>
                    typeof item === 'object' && item !== null
                        ? this.sanitizeNestedObject(item)
                        : item
                ).filter(Boolean);
                return;
            }

            // Handle primitives
            result[key] = value;
        });

        return result;
    }

    /**
     * Make audit logging silently fail rather than disrupt the app
     */
    static async logUserAction(data: {
        action: string;
        resourceType: string;
        resourceId: string;
        resourceName: string;
        user: string;
        userType: 'user' | 'admin';
        status: 'success' | 'error' | 'warning';
        details: string;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
    }): Promise<void> {
        try {
            // Check for completely empty data
            if (!data) {
                console.warn('AuditService.logUserAction - No data provided');
                return;
            }

            // Create a default object with safe fallback values
            const safeData = {
                action: data?.action || 'Unknown Action',
                resourceType: data?.resourceType || 'unknown',
                resourceId: data?.resourceId || 'unknown',
                resourceName: data?.resourceName || 'Unknown Resource',
                user: data?.user || 'system',
                userType: (data?.userType as 'user' | 'admin') || 'user',
                status: (data?.status as 'success' | 'error' | 'warning') || 'info',
                details: data?.details || 'No details provided',
                metadata: data?.metadata ? JSON.parse(JSON.stringify(data?.metadata)) : undefined,
                ipAddress: data?.ipAddress,
                userAgent: data?.userAgent,
                sessionId: data?.sessionId
            };

            // Generate an event-specific name for the audit log entry to use as partition key
            let logName = `audit-${safeData.resourceType}-${safeData.resourceId.substring(0, 20)}-${Date.now()}`;
            // Ensure the name is valid for DynamoDB (no spaces or special chars)
            logName = logName.replace(/[^a-zA-Z0-9_-]/g, '-').substring(0, 100);

            // Create the audit log entry
            const auditEntry = {
                name: logName, // Use as partition key for DynamoDB
                eventType: `${safeData.resourceType}.${safeData.action.toLowerCase().replace(/\s+/g, '_')}`,
                action: safeData.action,
                user: safeData.user,
                userType: safeData.userType,
                resource: safeData.resourceName,
                resourceType: safeData.resourceType,
                resourceId: safeData.resourceId,
                status: safeData.status,
                severity: (safeData.status === 'error' ? 'medium' : 'info') as 'info' | 'low' | 'medium' | 'high' | 'critical',
                details: safeData.details,
                metadata: safeData.metadata,
                ipAddress: safeData.ipAddress,
                userAgent: safeData.userAgent,
                sessionId: safeData.sessionId,
                source: 'web-ui' as 'web-ui' | 'lambda' | 'system' | 'api',
            };

            await this.createAuditLog(auditEntry);
        } catch (error) {
            console.error('Failed to create user action audit log:', error);
            // Silently fail to avoid disrupting the app
        }
    }

    /**
     * Similar to logUserAction but with a silently-fail approach for system actions
     */
    static async logResourceAction(data: {
        action: string;
        resourceType: string;
        resourceId: string;
        resourceName: string;
        status: 'success' | 'error' | 'warning';
        details: string;
        user?: string;
        userType?: 'system' | 'user' | 'admin';
        metadata?: Record<string, any>;
        correlationId?: string;
        accountId?: string;
        region?: string;
        source?: 'web-ui' | 'lambda' | 'system' | 'api';
    }): Promise<void> {
        try {
            await this.createAuditLog({
                eventType: `${data.resourceType}.${data.action.toLowerCase().replace(/\s+/g, '_')}`,
                action: data.action,
                user: data.user || 'system',
                userType: data.userType || 'system',
                resource: data.resourceName,
                resourceType: data.resourceType,
                resourceId: data.resourceId,
                status: data.status,
                severity: data.status === 'error' ? 'high' : data.status === 'warning' ? 'medium' : 'info',
                details: data.details,
                metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
                correlationId: data.correlationId,
                accountId: data.accountId,
                region: data.region,
                source: data.source || 'system',
            });
        } catch (error) {
            console.error('Failed to create resource action audit log:', error);
            // Silently fail to avoid disrupting the app
        }
    }
}
