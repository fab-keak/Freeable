export const domainTarget =
  process.env.NEXT_PUBLIC_DOMAIN_TARGET || 'cname.vercel-dns.com';

export async function addProjectDomain(domain: string) {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    throw new Error(
      'Custom domains need VERCEL_API_TOKEN and VERCEL_PROJECT_ID configured.',
    );
  }

  const search = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const domainUrl =
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}` +
    `/domains/${encodeURIComponent(domain)}${search}`;
  const existing = await fetch(domainUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error('Vercel could not check this custom domain.');
  }

  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${search}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (response.ok) return;

  const result = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (
    result?.error?.code === 'domain_already_in_use' ||
    result?.error?.code === 'forbidden'
  ) {
    throw new Error(
      'This domain is already connected to another Vercel project.',
    );
  }

  throw new Error(
    result?.error?.message || 'The custom domain could not be added to Vercel.',
  );
}
