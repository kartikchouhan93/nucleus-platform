'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/agent/chat-interface';
import { ThreadSidebar } from '@/components/agent/thread-sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function AgentPage() {
    const [threadId, setThreadId] = useState(() => Date.now().toString());
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleThreadSelect = (id: string) => {
        setThreadId(id);
        setIsMobileOpen(false);
    };

    const handleNewChat = () => {
        setThreadId(Date.now().toString());
        setIsMobileOpen(false);
    };

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <ThreadSidebar 
                className="w-64 hidden md:flex shrink-0" 
                currentThreadId={threadId}
                onThreadSelect={handleThreadSelect}
                onNewChat={handleNewChat}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center p-4 border-b">
                    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-72">
                            <ThreadSidebar 
                                currentThreadId={threadId}
                                onThreadSelect={handleThreadSelect}
                                onNewChat={handleNewChat}
                                className="border-r-0"
                            />
                        </SheetContent>
                    </Sheet>
                    <span className="font-semibold">Conversations</span>
                </div>
                
                <main className="flex-1 overflow-hidden relative">
                    <ChatInterface key={threadId} threadId={threadId} />
                </main>
            </div>
        </div>
    );
}
