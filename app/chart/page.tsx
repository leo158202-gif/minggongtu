import ChartWorkspace from '@/components/ChartWorkspace';

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ pan?: string }>;
}) {
  const params = await searchParams;
  return <ChartWorkspace initialSchool={params.pan === 'bazi' ? 'bazi' : 'ziwei'} />;
}
