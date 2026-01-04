"use client";

// Utility for consistent date formatting across server and client
// Prevents hydration mismatches caused by locale differences

export function formatDate(dateString: string | Date, options?: {
    includeTime?: boolean;
    format?: 'short' | 'long' | 'medium';
}): string {
    if (!dateString) return 'N/A';

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) return 'Invalid Date';

    const { includeTime = false, format = 'medium' } = options || {};

    // Use consistent formatting to avoid server/client hydration mismatches
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    let formattedDate = '';

    switch (format) {
        case 'long':
            formattedDate = `${day}/${month}/${year}`;
            break;
        case 'medium':
        default:
            formattedDate = `${month}/${day}/${year}`;
            break;
    }

    if (includeTime) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${formattedDate} ${hours}:${minutes}:${seconds}`;
    }

    return formattedDate;
}

export function formatTime(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

export function formatDateTime(dateString: string | Date): string {
    return formatDate(dateString, { includeTime: true });
}

export function getRelativeTime(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();

    const minutes = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return formatDate(date);
}
