import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    const client = getMrrClient();
    if (!client?.apiKey || !client?.apiSecret) {
      return NextResponse.json(
        { error: 'API keys not configured. Add them in Settings.' },
        { status: 401 }
      );
    }

    const who = await client.whoami();
    if (!who?.data?.authed) {
      const msg = (who?.data?.auth_mesage || 'Not authenticated').replace(/\.$/, '');
      return NextResponse.json(
        {
          error: `MRR auth failed: ${msg}. Check API key/secret and that the key has "rigs" permission.`,
        },
        { status: 401 }
      );
    }

    const data = await client.listMyRigs({ hashrate: true });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
