// DynamoDB service for account metadata operations
import { ScanCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBDocumentClient, DYNAMODB_TABLE_NAME, handleDynamoDBError } from './aws-config';
import { AccountMetadata, UIAccount } from './types';
import { AuditService } from './audit-service';

// Define handleDynamoDBError if it's not properly imported
const handleError = (error: any, operation: string) => {
    console.error(`AccountService - Error during ${operation}:`, error);
    console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode
    });

    // Re-throw with a more user-friendly message
    if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Account with this name already exists');
    } else if (error.name === 'ValidationException') {
        throw new Error(`Validation error: ${error.message}`);
    } else {
        throw new Error(`Failed to ${operation}`);
    }
};

export class AccountService {
    /**
     * Fetch all accounts from DynamoDB with optional filtering
     */
    static async getAccounts(filters?: {
        statusFilter?: string;
        connectionFilter?: string;
        searchTerm?: string;
    }): Promise<UIAccount[]> {
        try {
            console.log('AccountService - Attempting to fetch accounts from DynamoDB', filters ? `with filters: ${JSON.stringify(filters)}` : '');
            // Build filter expression based on provided filters
            let filterExpression = '#type = :typeVal';
            const expressionAttributeNames = { '#type': 'type' };
            const expressionAttributeValues: Record<string, any> = { ':typeVal': 'account_metadata' };
            
            // Add status filter if provided and not 'all'
            if (filters?.statusFilter && filters.statusFilter !== 'all') {
                const isActive = filters.statusFilter === 'active';
                filterExpression += ' AND active = :activeVal';
                expressionAttributeValues[':activeVal'] = isActive;
            }
            
            // Add connection filter if provided and not 'all'
            if (filters?.connectionFilter && filters.connectionFilter !== 'all' && 
                filters.connectionFilter !== 'connected' && filters.connectionFilter !== 'inactive') {
                filterExpression += ' AND connectionStatus = :connVal';
                expressionAttributeValues[':connVal'] = filters.connectionFilter;
            }
            
            // Note: Text search is more complex in DynamoDB, we'll do that post-query
            
            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            });

            const response = await getDynamoDBDocumentClient().send(command);
            console.log('AccountService - Successfully fetched accounts:', response.Items?.length || 0);

            let accounts = (response.Items || []).map(item => this.transformToUIAccount(item as AccountMetadata));
            
            // Apply text search filter in memory if provided
            if (filters?.searchTerm && filters.searchTerm.trim() !== '') {
                const searchTerm = filters.searchTerm.toLowerCase();
                accounts = accounts.filter(account => 
                    account.name.toLowerCase().includes(searchTerm) ||
                    account.accountId.toLowerCase().includes(searchTerm) ||
                    (account.description && account.description.toLowerCase().includes(searchTerm)) ||
                    (account.createdBy && account.createdBy.toLowerCase().includes(searchTerm))
                );
                console.log(`AccountService - Applied text search filter, found ${accounts.length} matching accounts`);
            }
            
            // Apply connection filter for connected/inactive which is derived from active status
            if (filters?.connectionFilter && 
                (filters.connectionFilter === 'connected' || filters.connectionFilter === 'inactive')) {
                const shouldBeActive = filters.connectionFilter === 'connected';
                accounts = accounts.filter(account => account.active === shouldBeActive);
                console.log(`AccountService - Applied connection filter (${filters.connectionFilter}), found ${accounts.length} matching accounts`);
            }

            // Remove duplicates based on accountId (keep the most recently updated one)
            const uniqueAccounts = accounts.reduce((acc, current) => {
                const existing = acc.find(item => item.accountId === current.accountId);
                if (!existing) {
                    acc.push(current);
                } else {
                    // Keep the one with the more recent updatedAt timestamp
                    if (current.updatedAt && existing.updatedAt && new Date(current.updatedAt) > new Date(existing.updatedAt)) {
                        const index = acc.indexOf(existing);
                        acc[index] = current;
                    }
                }
                return acc;
            }, [] as UIAccount[]);

            return uniqueAccounts;
        } catch (error: any) {
            console.error('AccountService - Error fetching accounts:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.$metadata?.httpStatusCode
            });
            throw new Error('Failed to fetch accounts from database');
        }
    }

    /**
     * Get a specific account by account ID
     */
    static async getAccount(accountId: string): Promise<UIAccount | null> {
        try {
            // Since DynamoDB uses name field as partition key, we need to scan to find accounts by accountId
            // This is not efficient for large datasets but works for our use case
            const command = new ScanCommand({
                TableName: DYNAMODB_TABLE_NAME,
                FilterExpression: '#type = :typeVal AND accountId = :accountIdVal',
                ExpressionAttributeNames: {
                    '#type': 'type',
                },
                ExpressionAttributeValues: {
                    ':typeVal': 'account_metadata',
                    ':accountIdVal': accountId,
                },
            });

            const response = await getDynamoDBDocumentClient().send(command);
            const items = response.Items || [];

            if (items.length === 0) {
                return null;
            }

            // Should only be one account with this accountId
            return this.transformToUIAccount(items[0] as AccountMetadata);
        } catch (error) {
            console.error('Error fetching account:', error);
            throw new Error('Failed to fetch account from database');
        }
    }

    /**
     * Create a new account
     */
    static async createAccount(account: Omit<UIAccount, 'id'>): Promise<UIAccount> {
        try {
            const now = new Date().toISOString();
            const dbAccount: AccountMetadata & { name: string } = {
                name: account.name, // Use account name as partition key
                type: 'account_metadata', // Sort key
                accountId: account.accountId,
                roleArn: account.roleArn,
                regions: account.regions,
                active: account.active,
                description: account.description,
                createdAt: now,
                updatedAt: now,
                createdBy: account.createdBy || 'system',
                updatedBy: account.updatedBy || 'system',
            };

            const command = new PutCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Item: dbAccount,
                ConditionExpression: 'attribute_not_exists(#name) AND attribute_not_exists(#type)',
                ExpressionAttributeNames: {
                    '#name': 'name',
                    '#type': 'type'
                }
            });

            await getDynamoDBDocumentClient().send(command);

            // Log audit event
            await AuditService.logUserAction({
                action: 'Create Account',
                resourceType: 'account',
                resourceId: account.accountId,
                resourceName: account.name,
                user: account.createdBy || 'system',
                userType: 'user',
                status: 'success',
                details: `Created AWS account "${account.name}" (${account.accountId}) with role ${account.roleArn}`,
                metadata: {
                    accountId: account.accountId,
                    roleArn: account.roleArn,
                    regions: account.regions,
                    active: account.active,
                },
            });

            return this.transformToUIAccount(dbAccount);
        } catch (error) {
            console.error('Error creating account:', error);

            // Log failed audit event
            await AuditService.logUserAction({
                action: 'Create Account',
                resourceType: 'account',
                resourceId: account.accountId,
                resourceName: account.name,
                user: account.createdBy || 'system',
                userType: 'user',
                status: 'error',
                details: `Failed to create AWS account "${account.name}" (${account.accountId}): ${(error as any).message}`,
                metadata: { error: (error as any).message },
            });

            // This throws an error so execution won't continue past this point
            throw handleError(error, 'create account');
        }
    }

    /**
     * Update an existing account
     */
    static async updateAccount(accountId: string, updates: Partial<Omit<UIAccount, 'id' | 'accountId'>>): Promise<UIAccount> {
        try {
            // First, get the current account to find the correct name (partition key)
            const currentAccount = await this.getAccount(accountId);
            if (!currentAccount) {
                throw new Error('Account not found');
            }

            const now = new Date().toISOString();

            // Build update expression dynamically
            const updateExpressions: string[] = [];
            const expressionAttributeNames: Record<string, string> = {};
            const expressionAttributeValues: Record<string, any> = {};

            Object.entries(updates).forEach(([key, value]) => {
                // Skip updating the name if it's the same as current name (since it's the partition key)
                // Also skip id and accountId as usual
                if (value !== undefined && key !== 'id' && key !== 'accountId') {
                    if (key === 'name' && value === currentAccount.name) {
                        // Skip if name hasn't changed
                        return;
                    }
                    if (key === 'name' && value !== currentAccount.name) {
                        // Cannot update partition key - throw error
                        throw new Error('Cannot change account name as it is used as the primary identifier');
                    }
                    updateExpressions.push(`#${key} = :${key}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[`:${key}`] = value;
                }
            });

            // If no fields to update, return current account
            if (updateExpressions.length === 0) {
                return currentAccount;
            }

            // Always update the updatedAt timestamp
            updateExpressions.push('#updatedAt = :updatedAt');
            expressionAttributeNames['#updatedAt'] = 'updatedAt';
            expressionAttributeValues[':updatedAt'] = now;

            const command = new UpdateCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Key: {
                    name: currentAccount.name, // Use the account name as partition key
                    type: 'account_metadata',
                },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            });

            const response = await getDynamoDBDocumentClient().send(command);
            const updatedAccount = this.transformToUIAccount(response.Attributes as AccountMetadata);

            // Log audit event
            await AuditService.logUserAction({
                action: 'Update Account',
                resourceType: 'account',
                resourceId: accountId,
                resourceName: currentAccount.name,
                user: updates.updatedBy || 'system',
                userType: 'user',
                status: 'success',
                details: `Updated AWS account "${currentAccount.name}" (${accountId})`,
                metadata: {
                    accountId,
                    updatedFields: Object.keys(updates).filter(key => key !== 'updatedBy'),
                    previousValues: Object.keys(updates).reduce((acc, key) => {
                        if (key !== 'updatedBy') {
                            acc[key] = (currentAccount as any)[key];
                        }
                        return acc;
                    }, {} as any),
                    newValues: updates,
                },
            });

            return updatedAccount;
        } catch (error) {
            console.error('Error updating account:', error);

            // Log failed audit event
            await AuditService.logUserAction({
                action: 'Update Account',
                resourceType: 'account',
                resourceId: accountId,
                resourceName: 'unknown',
                user: updates.updatedBy || 'system',
                userType: 'user',
                status: 'error',
                details: `Failed to update AWS account ${accountId}: ${(error as any).message}`,
                metadata: { error: (error as any).message, attemptedUpdates: updates },
            });

            // This throws an error so execution won't continue past this point
            throw handleError(error, 'update account');
        }
    }

    /**
     * Delete an account
     */
    static async deleteAccount(accountId: string, deletedBy: string = 'system'): Promise<void> {
        try {
            // First, get the current account to find the correct name (partition key)
            const currentAccount = await this.getAccount(accountId);
            if (!currentAccount) {
                throw new Error('Account not found');
            }

            const command = new DeleteCommand({
                TableName: DYNAMODB_TABLE_NAME,
                Key: {
                    name: currentAccount.name, // Use the account name as partition key
                    type: 'account_metadata',
                },
            });

            await getDynamoDBDocumentClient().send(command);

            // Log audit event
            await AuditService.logUserAction({
                action: 'Delete Account',
                resourceType: 'account',
                resourceId: accountId,
                resourceName: currentAccount.name,
                user: deletedBy,
                userType: 'user',
                status: 'success',
                details: `Deleted AWS account "${currentAccount.name}" (${accountId})`,
                metadata: {
                    accountId,
                    deletedAccount: {
                        name: currentAccount.name,
                        roleArn: currentAccount.roleArn,
                        regions: currentAccount.regions,
                        active: currentAccount.active,
                    },
                },
            });

        } catch (error) {
            console.error('Error deleting account:', error);

            // Log failed audit event
            await AuditService.logUserAction({
                action: 'Delete Account',
                resourceType: 'account',
                resourceId: accountId,
                resourceName: 'unknown',
                user: deletedBy,
                userType: 'user',
                status: 'error',
                details: `Failed to delete AWS account ${accountId}: ${(error as any).message}`,
                metadata: { error: (error as any).message },
            });

            handleError(error, 'delete account');
        }
    }

    /**
     * Toggle the active status of an AWS account
     */
    static async toggleAccountStatus(accountId: string): Promise<UIAccount> {
        try {
            // Get the current account
            const account = await this.getAccount(accountId);
            if (!account) {
                throw new Error(`Account ${accountId} not found`);
            }

            // Toggle active status using the updateAccount method
            const updatedAccount = await this.updateAccount(accountId, {
                active: !account.active,
                updatedBy: 'system' // Set to authenticated user in real app
            });

            // Create separate audit log specifically for status change
            try {
                const statusChangeAction = updatedAccount.active ? 'activated' : 'deactivated';
                await AuditService.logUserAction({
                    action: 'Toggle Account Status',
                    resourceType: 'account',
                    resourceId: accountId,
                    resourceName: account.name,
                    user: 'system',
                    userType: 'user',
                    status: 'success',
                    details: `${updatedAccount.active ? 'Activated' : 'Deactivated'} AWS account "${account.name}" (${accountId})`,
                    metadata: {
                        accountId,
                        previousStatus: account.active,
                        newStatus: updatedAccount.active,
                        statusChange: statusChangeAction
                    }
                });
            } catch (auditError) {
                console.error('Failed to create audit log for account status change:', auditError);
                // Continue even if audit fails
            }

            return updatedAccount;
        } catch (error) {
            handleError(error, 'toggle account status');
            throw error;
        }
    }

    /**
     * Validate account connection (placeholder for actual validation logic)
     */
    static async validateAccount(accountId: string): Promise<UIAccount> {
        try {
            // Update the account to set connection status to validating
            await this.updateAccount(accountId, {
                connectionStatus: 'validating',
                lastValidated: new Date().toISOString()
            });

            // TODO: Implement actual cross-account role validation logic here
            // For now, we'll simulate a successful validation after a delay
            setTimeout(async () => {
                try {
                    await this.updateAccount(accountId, {
                        connectionStatus: 'connected',
                        lastValidated: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error updating validation status:', error);
                }
            }, 2000);

            return await this.getAccount(accountId) as UIAccount;
        } catch (error) {
            console.error('Error validating account:', error);
            throw new Error('Failed to validate account');
        }
    }

    /**
     * Transform DynamoDB item to UI account format
     */
    private static transformToUIAccount(item: AccountMetadata): UIAccount {
        return {
            id: item.accountId, // Use accountId as ID for UI
            accountId: item.accountId,
            name: item.name,
            roleArn: item.roleArn,
            regions: item.regions,
            active: item.active,
            description: item.description || '',
            connectionStatus: item.connectionStatus || 'connected',
            lastValidated: item.lastValidated || new Date().toISOString(),
            resourceCount: item.resourceCount || 0,
            schedulesCount: item.schedulesCount || 0,
            monthlySavings: item.monthlySavings || 0,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
            updatedBy: item.updatedBy,
            tags: item.tags || [],
        };
    }
}
