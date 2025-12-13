import { NextRequest, NextResponse } from 'next/server';
import { AccountService } from '@/lib/account-service';

export async function POST(request: NextRequest) {
    try {
        console.log('API - POST /api/accounts/validate - Validating account');

        const accountData = await request.json();
        console.log('API - Validation data:', accountData);

        const result = await AccountService.validateAccount(accountData);

        console.log('API - Account validation result:', result);
        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('API - Error validating account:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to validate account'
        }, { status: 500 });
    }
}
