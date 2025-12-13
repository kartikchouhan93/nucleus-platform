import { NextRequest, NextResponse } from 'next/server';
import { ScheduleService } from '@/lib/schedule-service';

// POST /api/schedules/[name]/toggle - Toggle schedule active status
export async function POST(
    request: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        const scheduleName = decodeURIComponent(params.name);
        console.log('API Route - Toggling schedule status:', scheduleName);

        const updatedSchedule = await ScheduleService.toggleScheduleStatus(scheduleName);

        return NextResponse.json({
            success: true,
            data: updatedSchedule,
            message: `Schedule "${scheduleName}" status toggled to ${updatedSchedule.active ? 'active' : 'inactive'}`
        });
    } catch (error) {
        console.error('API Route - Error toggling schedule status:', error);

        if (error instanceof Error && error.message === 'Schedule not found') {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to toggle schedule status'
        }, { status: 500 });
    }
}
