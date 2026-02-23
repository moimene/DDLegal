import { NextResponse } from 'next/server';

/**
 * Deal Cockpit API has been removed.
 * Returns 410 Gone for backwards compatibility.
 */
export async function GET() {
    return NextResponse.json(
        { error: 'Deal Cockpit endpoint has been removed.' },
        { status: 410 }
    );
}
