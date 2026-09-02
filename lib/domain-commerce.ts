import 'server-only';

import { addProjectDomain } from '@/lib/vercel-domains';

const domainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

type RegistrarPrice = {
  years: number;
  purchasePrice: number | string;
  renewalPrice: number | string;
};

type RegistrarOrder = {
  orderId: string;
  status: 'draft' | 'purchasing' | 'completed' | 'failed';
  domains: Array<{
    domainName: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded' | 'refund-failed';
    error?: { code?: string } | null;
  }>;
  error?: { code?: string } | null;
};

export type RegistrantContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

export function isValidDomain(domain: string) {
  return domainPattern.test(domain);
}

function getRegistrarConfiguration() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) throw new Error('Domain purchasing is not configured yet.');
  return {
    token,
    search: teamId ? `?teamId=${encodeURIComponent(teamId)}` : '',
    appendSearch: (path: string, params?: URLSearchParams) => {
      const query = new URLSearchParams(params);
      if (teamId) query.set('teamId', teamId);
      const value = query.toString();
      return `${path}${value ? `?${value}` : ''}`;
    },
  };
}

async function readVercelError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return data?.error?.message || data?.message || fallback;
}

function parsePrice(value: number | string) {
  const price = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Vercel could not determine the price for this domain.');
  }
  return price;
}

export async function searchDomain(domainValue: string) {
  const domain = normalizeDomain(domainValue);
  if (!isValidDomain(domain)) {
    throw new Error('Enter a complete domain such as yourbrand.com.');
  }

  const { token, appendSearch } = getRegistrarConfiguration();
  const headers = { Authorization: `Bearer ${token}` };
  const encodedDomain = encodeURIComponent(domain);
  const [availabilityResponse, priceResponse, schemaResponse] =
    await Promise.all([
      fetch(
        appendSearch(
          `https://api.vercel.com/v1/registrar/domains/${encodedDomain}/availability`,
        ),
        { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) },
      ),
      fetch(
        appendSearch(
          `https://api.vercel.com/v1/registrar/domains/${encodedDomain}/price`,
        ),
        { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) },
      ),
      fetch(
        appendSearch(
          `https://api.vercel.com/v1/registrar/domains/${encodedDomain}/contact-info/schema`,
        ),
        { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) },
      ),
    ]);

  if (!availabilityResponse.ok) {
    throw new Error(
      await readVercelError(
        availabilityResponse,
        'This domain could not be checked.',
      ),
    );
  }
  const availability = (await availabilityResponse.json()) as {
    available: boolean;
  };
  if (!availability.available) {
    return { domain, available: false as const };
  }
  if (!priceResponse.ok) {
    throw new Error(
      await readVercelError(priceResponse, 'This domain could not be priced.'),
    );
  }

  const price = (await priceResponse.json()) as RegistrarPrice;
  const schema = schemaResponse.ok
    ? ((await schemaResponse.json()) as Record<string, unknown>)
    : null;
  const purchasePrice = parsePrice(price.purchasePrice);
  const renewalPrice = parsePrice(price.renewalPrice);
  return {
    domain,
    available: true as const,
    years: Math.max(1, Math.round(price.years || 1)),
    purchasePrice,
    renewalPrice,
    currency: 'usd' as const,
    purchaseSupported: schema !== null && Object.keys(schema).length === 0,
  };
}

export async function buyDomain(input: {
  domain: string;
  years: number;
  expectedPrice: number;
  contact: RegistrantContact;
}) {
  const { token, appendSearch } = getRegistrarConfiguration();
  const response = await fetch(
    appendSearch(
      `https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(input.domain)}/buy`,
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        autoRenew: true,
        years: input.years,
        expectedPrice: input.expectedPrice,
        contactInformation: input.contact,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      await readVercelError(response, 'The domain could not be purchased.'),
    );
  }
  return (await response.json()) as { orderId: string };
}

export async function getRegistrarOrder(orderId: string) {
  const { token, appendSearch } = getRegistrarConfiguration();
  const response = await fetch(
    appendSearch(
      `https://api.vercel.com/v1/registrar/orders/${encodeURIComponent(orderId)}`,
    ),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      await readVercelError(response, 'The domain order could not be checked.'),
    );
  }
  return (await response.json()) as RegistrarOrder;
}

export async function isDomainOwnedByFreeable(domain: string) {
  const { token, appendSearch } = getRegistrarConfiguration();
  const response = await fetch(
    appendSearch(
      `https://api.vercel.com/v5/domains/${encodeURIComponent(domain)}`,
    ),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  );
  return response.ok;
}

export async function connectPurchasedDomain(domain: string) {
  return addProjectDomain(domain);
}
