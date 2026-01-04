import { NextResponse } from 'next/server';
import { threadStore } from '@/lib/store/thread-store';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ threadId: string }> }
) {
    try {
        const { threadId } = await params;
        const success = await threadStore.deleteThread(threadId);

        if (!success) {
            return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ threadId: string }> }
) {
    try {
        const { threadId } = await params;
        const body = await req.json();
        const { title } = body;

        const updated = await threadStore.updateThread(threadId, { title });

        if (!updated) {
            return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 });
    }
}
