// API route for fetching audit logs
import { NextRequest, NextResponse } from 'next/server';
import { AuditService, AuditLogFilters } from '@/lib/audit-service';
import { getDynamoDBDocumentClient, DYNAMODB_TABLE_NAME } from '@/lib/aws-config';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Build filters from query parameters
        const filters: AuditLogFilters = {};

        if (searchParams.get('startDate')) filters.startDate = searchParams.get('startDate')!;
        if (searchParams.get('endDate')) filters.endDate = searchParams.get('endDate')!;
        if (searchParams.get('eventType')) filters.eventType = searchParams.get('eventType')!;
        if (searchParams.get('status')) filters.status = searchParams.get('status')!;
        if (searchParams.get('severity')) filters.severity = searchParams.get('severity')!;
        if (searchParams.get('userType')) filters.userType = searchParams.get('userType')!;
        if (searchParams.get('resourceType')) filters.resourceType = searchParams.get('resourceType')!;
        if (searchParams.get('user')) filters.user = searchParams.get('user')!;
        if (searchParams.get('correlationId')) filters.correlationId = searchParams.get('correlationId')!;
        if (searchParams.get('limit')) filters.limit = parseInt(searchParams.get('limit')!);

        console.log('API - Fetching audit logs with filters:', filters);

        const auditLogs = await AuditService.getAuditLogs(filters);

        return NextResponse.json({
            success: true,
            data: auditLogs,
            count: auditLogs.length,
        });
    } catch (error: unknown) {
        console.error('API - Error fetching audit logs:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auditData = await request.json();

        // Extract user info from headers (if available)
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        // Add audit log
        await AuditService.createAuditLog({
            ...auditData,
            userAgent,
            ipAddress,
            source: 'web-ui',
        });

        return NextResponse.json({
            success: true,
            message: 'Audit log created successfully',
        });
    } catch (error: unknown) {
        console.error('API - Error creating audit log:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create audit log',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const name = searchParams.get('name');

        if (!id || !name) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required parameters: id and name',
                },
                { status: 400 }
            );
        }

        console.log('API - Deleting audit log:', { id, name });

        // Delete the audit log from DynamoDB
        const command = new DeleteCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Key: {
                name: name,
                type: 'audit_log'
            }
        });

        await getDynamoDBDocumentClient().send(command);

        // Log the deletion as an audit event
        await AuditService.logUserAction({
            action: 'delete',
            resourceType: 'audit_log',
            resourceId: id,
            resourceName: `Audit Log ${id}`,
            user: 'system', // This should ideally be the actual user
            userType: 'admin',
            status: 'success',
            details: `Audit log ${id} was deleted`,
        });

        return NextResponse.json({
            success: true,
            message: 'Audit log deleted successfully',
        });
    } catch (error: unknown) {
        console.error('API - Error deleting audit log:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete audit log',
            },
            { status: 500 }
        );
    }
}
