import { NextRequest, NextResponse } from 'next/server';
import { getLantuClient } from '@/lib/runtime/lazy-services';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const entryResourceType = searchParams.get('entryResourceType') || undefined;
  const entryResourceId = searchParams.get('entryResourceId') || undefined;

  const lantuClient = await getLantuClient();
  const result = await lantuClient.fetchAggregatedTools(entryResourceType, entryResourceId);
  
  return NextResponse.json({ data: result });
}
