import { NextRequest, NextResponse } from 'next/server';
import { backupDirtyRooms } from '@/lib/server/cloud-backup';
import { jsonError, noStore } from '@/lib/server/room-security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret || secret.length < 24) return jsonError('Backup job is disabled', 503);
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError('Unauthorized', 401);
  }
  try {
    const results = await backupDirtyRooms();
    const pending = results.filter((item) => !item.saved).length;
    return noStore(NextResponse.json({
      processed: results.length,
      backedUp: results.length - pending,
      pending,
      results,
    }));
  } catch (error) {
    console.error('Durable backup failed', error);
    return jsonError('Durable backup failed; Redis remains authoritative', 503);
  }
}
