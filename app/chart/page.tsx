import ChartWorkspace from '@/components/ChartWorkspace';

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ pan?: string }>;
}) {
  const params = await searchParams;
  const school = params.pan === 'bazi' ? 'bazi' : params.pan === 'astro' ? 'astro' : 'ziwei';
  return <ChartWorkspace initialSchool={school} />;
}
