import { NextResponse } from 'next/server';
import { threadStore } from '@/lib/store/thread-store';

export async function GET() {
    try {
        const threads = await threadStore.listThreads();
        return NextResponse.json(threads);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, title, model } = body;

        if (!id) {
            return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        const thread = await threadStore.createThread(id, title, model);
        return NextResponse.json(thread);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }
}
