import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readBriefing } from '@/lib/services/briefing-store';
import BriefingView from './BriefingView';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Drudge 财经简报',
  robots: { index: false, follow: false },
};

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const briefing = await readBriefing(id);
  if (!briefing) notFound();

  return <BriefingView briefing={briefing} />;
}
