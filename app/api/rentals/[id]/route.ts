import { NextResponse } from 'next/server';
import { ensureDb, getMrrClient } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    ensureDb();
    const { id } = await params;
    const data = await getMrrClient().getRental(id);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
