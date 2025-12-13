'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { AuthGuard } from './auth-guard';

interface LayoutWrapperProps {
    children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
    const pathname = usePathname();

    // Hide sidebar on login page
    const hideSidebar = pathname === '/login';

    return (<AuthGuard>
        {hideSidebar ? (
            <main className="w-full min-h-screen">{children}</main>
        ) : (
            <div className="flex min-h-screen bg-background h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                    <div className="p-2 min-w-0">
                        {children}
                    </div>
                </main>
            </div>
        )}
    </AuthGuard>
    );
}
