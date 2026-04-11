import { NextRequest, NextResponse } from 'next/server';
import { lantuClient } from '@/lib/lantu-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const resourceType = searchParams.get('resourceType') || undefined;
  const status = searchParams.get('status') || undefined;
  const keyword = searchParams.get('keyword') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined;

  const result = await lantuClient.fetchResources({
    resourceType,
    status,
    keyword,
    page,
    pageSize,
  });
  
  return NextResponse.json({ data: result });
}
