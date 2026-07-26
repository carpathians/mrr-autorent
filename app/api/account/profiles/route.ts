import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureDb();
    const data = await getMrrClient().listProfiles();
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.data?.profiles)
        ? data.data.profiles
        : [];
    return NextResponse.json({
      success: true,
      data: list.map((p: Record<string, unknown>) => ({
        id: String(p.id),
        name: (p.name as string) || `Profile ${p.id}`,
        algo: (p.algo as { name?: string })?.name || p.algo || null,
        algo_display: (p.algo as { display?: string })?.display || null,
        pool_count: Array.isArray(p.pools) ? p.pools.length : 0,
        pools: Array.isArray(p.pools)
          ? p.pools.map((pool: Record<string, unknown>) => ({
              id: pool.id,
              name: pool.name || `${pool.host}:${pool.port}`,
              host: pool.host,
              port: pool.port,
              user: pool.user,
              priority: pool.priority,
            }))
          : [],
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
