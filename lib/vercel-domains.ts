export type DomainDnsRecord = {
  type: 'A' | 'CNAME';
  name: string;
  value: string;
  ttl: 'Auto';
};

export type ProjectDomainConfiguration = {
  connected: boolean;
  record: DomainDnsRecord;
};

type ProjectDomain = {
  apexName?: string;
  name?: string;
  verified?: boolean;
};

type DomainConfiguration = {
  misconfigured?: boolean;
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  recommendedIPv4?: Array<{ rank?: number; value?: string[] }>;
};

function getVercelConfiguration() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    throw new Error(
      'Custom domains need VERCEL_API_TOKEN and VERCEL_PROJECT_ID configured.',
    );
  }

  return {
    token,
    projectId,
    search: teamId ? `?teamId=${encodeURIComponent(teamId)}` : '',
  };
}

function firstRecommendation<T extends { rank?: number }>(values?: T[]) {
  return [...(values || [])].sort(
    (left, right) => (left.rank ?? 99) - (right.rank ?? 99),
  )[0];
}

function dnsRecordForDomain(
  domain: string,
  projectDomain: ProjectDomain,
  configuration: DomainConfiguration,
): DomainDnsRecord {
  const apexName = projectDomain.apexName?.toLowerCase() || domain;
  const isApex = domain === apexName;

  if (isApex) {
    const recommendation = firstRecommendation(configuration.recommendedIPv4);
    return {
      type: 'A',
      name: '@',
      value: recommendation?.value?.[0] || '76.76.21.21',
      ttl: 'Auto',
    };
  }

  const recommendation = firstRecommendation(configuration.recommendedCNAME);
  const suffix = `.${apexName}`;
  return {
    type: 'CNAME',
    name: domain.endsWith(suffix) ? domain.slice(0, -suffix.length) : domain,
    value: (recommendation?.value || 'cname.vercel-dns.com').replace(/\.$/, ''),
    ttl: 'Auto',
  };
}

async function readDomainConfiguration(
  domain: string,
  projectDomain: ProjectDomain,
) {
  const { token, search } = getVercelConfiguration();
  const response = await fetch(
    `https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config${search}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    return {
      connected: false,
      record: dnsRecordForDomain(domain, projectDomain, {}),
    };
  }

  const configuration = (await response.json()) as DomainConfiguration;
  return {
    connected:
      projectDomain.verified === true && configuration.misconfigured === false,
    record: dnsRecordForDomain(domain, projectDomain, configuration),
  };
}

async function getProjectDomain(domain: string) {
  const { token, projectId, search } = getVercelConfiguration();
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}` +
      `/domains/${encodeURIComponent(domain)}${search}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  return { response, token, projectId, search };
}

export async function getProjectDomainConfiguration(
  domain: string,
): Promise<ProjectDomainConfiguration> {
  const { response } = await getProjectDomain(domain);
  if (!response.ok) {
    throw new Error('Vercel could not check this custom domain.');
  }

  const projectDomain = (await response.json()) as ProjectDomain;
  return readDomainConfiguration(domain, projectDomain);
}

export async function addProjectDomain(domain: string) {
  const {
    response: existing,
    token,
    projectId,
    search,
  } = await getProjectDomain(domain);
  if (existing.ok) {
    const projectDomain = (await existing.json()) as ProjectDomain;
    return readDomainConfiguration(domain, projectDomain);
  }
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

  if (response.ok) {
    return getProjectDomainConfiguration(domain);
  }

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
