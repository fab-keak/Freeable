# Deploying Freeable on Vercel

Freeable runs as a standard Next.js application and uses Supabase Postgres for
published websites and Vercel Blob for prompt images.

## 1. Create the Vercel project

Import this repository into Vercel. The framework preset should be detected as
Next.js. No custom build or output directory is required.

## 2. Connect storage

In the Vercel project dashboard:

1. Add a Neon Postgres integration from **Storage**. Confirm that it creates a
   `DATABASE_URL` environment variable.
2. Create a public Vercel Blob store. Confirm that it creates a
   `BLOB_READ_WRITE_TOKEN` environment variable.

The `published_sites` table is created automatically the first time Freeable
publishes or loads a website.

## 3. Add environment variables

Copy the remaining names from `.env.example` into Vercel:

- `CHEAPER_INFERENCE_API_KEY`: the server-only Cheaper Inference key.
- `SITE_URL`: the production URL of the builder.
- `BUILDER_HOSTS`: comma-separated builder hostnames, without protocols.
- `ADMIN_EMAILS`: comma-separated account emails allowed to view all users and
  published websites in the admin dashboard.
- `NEXT_PUBLIC_DOMAIN_TARGET`: the CNAME target shown by Vercel when a custom
  domain is added.
- `NEXT_PUBLIC_FREE_SITE_DOMAIN`: the base hostname used for free customer
  subdomains, such as `sites.example.com`.

To let customers connect domains from inside Freeable, also add:

- `VERCEL_API_TOKEN`: a Vercel access token allowed to manage the project.
- `VERCEL_PROJECT_ID`: the project ID from Vercel project settings.
- `VERCEL_TEAM_ID`: the team ID when the project belongs to a team; omit it for
  a personal project.

Keep all API and storage credentials server-only. Only
`NEXT_PUBLIC_DOMAIN_TARGET` is intentionally exposed to the browser.

## 4. Deploy

Deploy from the Vercel dashboard or run `vercel` from the project root. Vercel
will provide a `*.vercel.app` address immediately.

## Custom domains

When someone publishes with a custom domain, Freeable adds that hostname to the
Vercel project using the Vercel API. The customer then creates the CNAME shown
in Freeable. Requests on that hostname are routed to the matching published
site.

For production, set `BUILDER_HOSTS` to every hostname that should continue to
show the Freeable builder. All other connected custom hostnames are treated as
customer websites.

## Free customer subdomains

Add a wildcard domain such as `*.sites.example.com` to the Vercel project and
set `NEXT_PUBLIC_FREE_SITE_DOMAIN=sites.example.com`. Vercel requires its
nameservers for wildcard domains. Freeable will then publish free addresses such
as `my-coffee-shop.sites.example.com` and route each hostname to its saved site.

Without this variable, Freeable safely falls back to path-based addresses such as
`your-builder.vercel.app/s/my-coffee-shop`.
