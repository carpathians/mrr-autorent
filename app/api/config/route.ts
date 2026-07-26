import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, publicConfig, refreshMrrClient, setConfig } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    return NextResponse.json(publicConfig());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureDb();
    const updates = await req.json().catch(() => ({}));
    for (const [key, value] of Object.entries(updates || {})) {
      if (key.endsWith('_set')) continue;
      if (
        (key === 'api_key' || key === 'api_secret') &&
        (!value || String(value).includes('•'))
      ) {
        continue;
      }
      setConfig(key, String(value));
    }
    if ('api_key' in (updates || {}) || 'api_secret' in (updates || {})) {
      refreshMrrClient();
    }
    return NextResponse.json(publicConfig());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
