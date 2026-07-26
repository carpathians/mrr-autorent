import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    const client = getMrrClient();
    const [account, balances, whoami] = await Promise.all([
      client.getAccount(),
      client.getAccountBalances().catch(() => null),
      client.whoami().catch(() => null),
    ]);

    const data = account?.data || {};
    const bal = balances?.data?.BTC || {};
    const perms = whoami?.data?.permissions || {};
    const rentPerm = String(perms.rent || '').toLowerCase();
    const canRent =
      rentPerm === 'write' ||
      rentPerm === 'yes' ||
      rentPerm === 'true' ||
      rentPerm === '1';

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        balance_btc: bal.confirmed ?? null,
        balance_btc_unconfirmed: bal.unconfirmed ?? null,
        balances: balances?.data || null,
        permissions: perms,
        can_rent: canRent,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
