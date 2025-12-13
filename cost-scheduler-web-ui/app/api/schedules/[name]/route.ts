import { NextRequest, NextResponse } from 'next/server';
import { ScheduleService } from '@/lib/schedule-service';

// GET /api/schedules/[name] - Get a specific schedule by name
export async function GET(
    request: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        const scheduleName = decodeURIComponent(params.name);
        console.log('API Route - Getting schedule:', scheduleName);

        const schedule = await ScheduleService.getSchedule(scheduleName);

        if (!schedule) {
            return NextResponse.json({
                success: false,
                error: 'Schedule not found'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('API Route - Error getting schedule:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get schedule'
        }, { status: 500 });
    }
}

// PUT /api/schedules/[name] - Update a specific schedule
export async function PUT(
    request: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        const scheduleName = decodeURIComponent(params.name);
        const body = await request.json();
        console.log('API Route - Updating schedule:', scheduleName);

        const updatedSchedule = await ScheduleService.updateSchedule(scheduleName, {
            ...body,
            updatedBy: body.updatedBy || 'api-user'
        });

        return NextResponse.json({
            success: true,
            data: updatedSchedule,
            message: `Schedule "${scheduleName}" updated successfully`
        });
    } catch (error) {
        console.error('API Route - Error updating schedule:', error);

        if (error instanceof Error && error.message === 'Schedule not found') {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update schedule'
        }, { status: 500 });
    }
}

// DELETE /api/schedules/[name] - Delete a specific schedule
export async function DELETE(
    request: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        const scheduleName = decodeURIComponent(params.name);
        console.log('API Route - Deleting schedule:', scheduleName);

        await ScheduleService.deleteSchedule(scheduleName);

        return NextResponse.json({
            success: true,
            message: `Schedule "${scheduleName}" deleted successfully`
        });
    } catch (error) {
        console.error('API Route - Error deleting schedule:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete schedule'
        }, { status: 500 });
    }
}
