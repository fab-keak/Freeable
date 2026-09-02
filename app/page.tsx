'use client';

/* oxlint-disable next/no-img-element -- User-uploaded thumbnails use dynamic Blob URLs. */

import { upload } from '@vercel/blob/client';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Circle,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Files,
  Globe2,
  ImagePlus,
  Link2,
  LockKeyhole,
  Monitor,
  Palette,
  Rocket,
  Smartphone,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FreeableLogo } from '@/components/sleeksite-logo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getDesignTemplate } from '@/lib/design-templates';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

type BuildStatus = 'idle' | 'building' | 'ready' | 'error';
type PublishStatus = 'idle' | 'publishing' | 'published' | 'error';
type Viewport = 'desktop' | 'mobile';
type PublishMode = 'free' | 'custom';
type DomainStatus =
  | 'idle'
  | 'pending_dns'
  | 'checking'
  | 'dns_verified'
  | 'error';
type UploadTarget = 'prompt' | 'refinement';
type PromptImage = { id: string; name: string; path: string };
type AuthMode = 'signup' | 'signin';
type AuthStatus = 'idle' | 'submitting';
type AccountUser = { name: string; email: string };
type PageStatus = 'suggested' | 'building' | 'ready' | 'error';
type SitePage = {
  id: string;
  title: string;
  slug: string;
  html: string;
  status: PageStatus;
  error?: string;
};

const stages = [
  'Reading your brief',
  'Matching a design system',
  'Designing the interface',
  'Writing the final code',
];
const streamErrorPrefix = '__CANVAS_STREAM_ERROR__:';
const maxAttachedImages = 4;
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const domainTarget =
  process.env.NEXT_PUBLIC_DOMAIN_TARGET || 'cname.vercel-dns.com';
const freeSiteDomain = process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN || '';

function createAddressSuggestion(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36) || 'my-website'
  );
}

function cleanGeneratedHtml(value: string) {
  const withoutFences = value
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = withoutFences.search(/<!doctype html>|<html/i);
  return start >= 0 ? withoutFences.slice(start) : withoutFences;
}

function normalizeInternalPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  const path = value.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  if (!path || /^(api|_next|s)(\/|$)/.test(path)) return '';
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return '';
  return path
    .split('/')
    .map((part) =>
      part
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('/');
}

function titleFromSlug(slug: string) {
  const segment = slug.split('/').at(-1) || 'Page';
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function discoverSuggestedPages(html: string): SitePage[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set<string>();
  const pages: SitePage[] = [];

  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    const slug = normalizeInternalPath(anchor.getAttribute('href') || '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    const title =
      label &&
      !/^(learn|read|view|see|explore|discover|get started|start now)(\s+more)?$/i.test(
        label,
      )
        ? label
        : titleFromSlug(slug);
    pages.push({
      id: crypto.randomUUID(),
      title: title.slice(0, 60),
      slug,
      html: '',
      status: 'suggested',
    });
    if (pages.length === 6) break;
  }

  return pages;
}

function createPreviewHtml(html: string) {
  const bridge = `<script>document.addEventListener('click',function(event){var anchor=event.target.closest&&event.target.closest('a[href]');if(!anchor)return;var href=anchor.getAttribute('href')||'';if(href.charAt(0)==='/'&&href.slice(0,2)!=='//'){event.preventDefault();parent.postMessage({type:'sleeksite:navigate',href:href},'*')}});</script>`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${bridge}</body>`)
    : `${html}${bridge}`;
}

function removeLinksToPages(html: string, slugs: Set<string>) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    const slug = normalizeInternalPath(anchor.getAttribute('href') || '');
    if (!slugs.has(slug)) continue;
    anchor.removeAttribute('href');
    anchor.setAttribute('aria-disabled', 'true');
    anchor.setAttribute('data-sleeksite-removed-link', slug);
  }
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [refinement, setRefinement] = useState('');
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [stage, setStage] = useState(0);
  const [sitePages, setSitePages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [error, setError] = useState('');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [copied, setCopied] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishError, setPublishError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [promptImages, setPromptImages] = useState<PromptImage[]>([]);
  const [refinementImages, setRefinementImages] = useState<PromptImage[]>([]);
  const [activeImages, setActiveImages] = useState<PromptImage[]>([]);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(
    null,
  );
  const [uploadError, setUploadError] = useState('');
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>('free');
  const [siteSlug, setSiteSlug] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<DomainStatus>('idle');
  const [domainError, setDomainError] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [siteCompletionDialogOpen, setSiteCompletionDialogOpen] =
    useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const pageRequestsRef = useRef(new Map<string, AbortController>());
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeTemplate = getDesignTemplate(templateId);
  const selectedPage =
    sitePages.find((page) => page.id === selectedPageId) ?? sitePages[0];
  const html = selectedPage?.html ?? '';
  const unfinishedPages = sitePages.filter((page) => page.status !== 'ready');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { user?: AccountUser | null };
        setAccount(data.user ?? null);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status !== 'building') return;
    const timer = window.setInterval(
      () => setStage((current) => Math.min(current + 1, stages.length - 1)),
      2400,
    );
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    function handlePreviewNavigation(event: MessageEvent) {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        event.data.type !== 'sleeksite:navigate' ||
        typeof event.data.href !== 'string'
      )
        return;
      const requestedPath = event.data.href
        .split(/[?#]/)[0]
        .replace(/^\/+|\/+$/g, '');
      const slug = requestedPath ? normalizeInternalPath(event.data.href) : '';
      if (requestedPath && !slug) return;
      const nextPage = sitePages.find((page) => page.slug === slug);
      if (nextPage) setSelectedPageId(nextPage.id);
    }
    window.addEventListener('message', handlePreviewNavigation);
    return () => window.removeEventListener('message', handlePreviewNavigation);
  }, [sitePages]);

  async function requestGeneratedHtml({
    instruction,
    previousHtml,
    images = [],
    controller,
    pageContext,
    trackHomepageProgress = false,
  }: {
    instruction: string;
    previousHtml?: string;
    images?: PromptImage[];
    controller: AbortController;
    pageContext?: {
      title: string;
      slug: string;
      sitePages: Array<{ title: string; slug: string }>;
      referenceHtml: string;
    };
    trackHomepageProgress?: boolean;
  }) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: instruction,
        previousHtml,
        images,
        templateId: previousHtml || pageContext ? templateId : undefined,
        pageContext,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'The site could not be generated.');
    }

    if (!response.body) throw new Error('The model returned an empty site.');

    const selectedTemplate = response.headers.get('X-SleekSite-Template');
    if (selectedTemplate) setTemplateId(selectedTemplate);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let generated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      generated += decoder.decode(value, { stream: true });

      const markerIndex = generated.indexOf(streamErrorPrefix);
      if (markerIndex >= 0) {
        throw new Error(
          generated.slice(markerIndex + streamErrorPrefix.length).trim() ||
            'The site could not be generated.',
        );
      }

      if (trackHomepageProgress && generated.length > 1_000) setStage(2);
      if (trackHomepageProgress && generated.length > 6_000) setStage(3);
    }

    generated += decoder.decode();
    const siteHtml = cleanGeneratedHtml(generated);
    if (!/<html|<!doctype/i.test(siteHtml) || !/<\/html>\s*$/i.test(siteHtml)) {
      throw new Error('The generated site was incomplete. Please try again.');
    }
    return siteHtml;
  }

  function mergeDiscoveredPages(current: SitePage[], pageHtml: string) {
    const existingSlugs = new Set(current.map((page) => page.slug));
    return [
      ...current,
      ...discoverSuggestedPages(pageHtml).filter(
        (page) => !existingSlugs.has(page.slug),
      ),
    ].slice(0, 8);
  }

  async function buildHome(instruction: string, images: PromptImage[] = []) {
    requestRef.current?.abort();
    for (const controller of pageRequestsRef.current.values())
      controller.abort();
    pageRequestsRef.current.clear();
    const controller = new AbortController();
    requestRef.current = controller;

    setActivePrompt(instruction);
    setActiveImages(images);
    setSitePages([]);
    setSelectedPageId('');
    setStatus('building');
    setStage(0);
    setError('');
    setUploadError('');
    setCopied(false);
    setPublishError('');

    try {
      const siteHtml = await requestGeneratedHtml({
        instruction,
        images,
        controller,
        trackHomepageProgress: true,
      });

      const homePage: SitePage = {
        id: 'home',
        title: 'Home',
        slug: '',
        html: siteHtml,
        status: 'ready',
      };
      setSitePages(mergeDiscoveredPages([homePage], siteHtml));
      setSelectedPageId('home');
      setStage(stages.length);
      setStatus('ready');
    } catch (buildError) {
      if (
        buildError instanceof DOMException &&
        buildError.name === 'AbortError'
      )
        return;
      setError(
        buildError instanceof Error
          ? buildError.message
          : 'Something interrupted the build. Please try again.',
      );
      setStatus('error');
    }
  }

  async function generatePage(
    pageId: string,
    pagesSnapshot: SitePage[] = sitePages,
  ) {
    const page = pagesSnapshot.find((candidate) => candidate.id === pageId);
    const homePage = pagesSnapshot.find((candidate) => candidate.slug === '');
    if (!page || !page.slug || !homePage?.html) return;

    pageRequestsRef.current.get(pageId)?.abort();
    const controller = new AbortController();
    pageRequestsRef.current.set(pageId, controller);
    setSitePages((current) =>
      current.map((candidate) =>
        candidate.id === pageId
          ? { ...candidate, status: 'building', error: undefined }
          : candidate,
      ),
    );
    setPublishError('');

    try {
      const pageHtml = await requestGeneratedHtml({
        instruction: activePrompt,
        controller,
        pageContext: {
          title: page.title,
          slug: page.slug,
          sitePages: pagesSnapshot.map(({ title, slug }) => ({ title, slug })),
          referenceHtml: homePage.html,
        },
      });
      setSitePages((current) => {
        const updated = current.map((candidate) =>
          candidate.id === pageId
            ? { ...candidate, html: pageHtml, status: 'ready' as const }
            : candidate,
        );
        return mergeDiscoveredPages(updated, pageHtml);
      });
      if (publishedUrl) setPublishStatus('idle');
    } catch (pageError) {
      if (pageError instanceof DOMException && pageError.name === 'AbortError')
        return;
      setSitePages((current) =>
        current.map((candidate) =>
          candidate.id === pageId
            ? {
                ...candidate,
                status: 'error',
                error:
                  pageError instanceof Error
                    ? pageError.message
                    : 'This page could not be generated.',
              }
            : candidate,
        ),
      );
    } finally {
      if (pageRequestsRef.current.get(pageId) === controller)
        pageRequestsRef.current.delete(pageId);
    }
  }

  async function generateAllSuggested() {
    const snapshot = sitePages;
    const queue = snapshot
      .filter((page) => page.status === 'suggested' || page.status === 'error')
      .map((page) => page.id);
    if (!queue.length) return;
    setSiteCompletionDialogOpen(false);
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < queue.length) {
        const pageId = queue[nextIndex++];
        await generatePage(pageId, snapshot);
      }
    }
    await Promise.all([worker(), worker()]);
  }

  async function reviseSelectedPage(
    instruction: string,
    images: PromptImage[],
  ) {
    if (!selectedPage?.html) return;
    const pageId = selectedPage.id;
    pageRequestsRef.current.get(pageId)?.abort();
    const controller = new AbortController();
    pageRequestsRef.current.set(pageId, controller);
    setSitePages((current) =>
      current.map((page) =>
        page.id === pageId
          ? { ...page, status: 'building', error: undefined }
          : page,
      ),
    );
    try {
      const pageHtml = await requestGeneratedHtml({
        instruction,
        previousHtml: selectedPage.html,
        images,
        controller,
      });
      setSitePages((current) =>
        mergeDiscoveredPages(
          current.map((page) =>
            page.id === pageId
              ? { ...page, html: pageHtml, status: 'ready' as const }
              : page,
          ),
          pageHtml,
        ),
      );
      if (publishedUrl) setPublishStatus('idle');
    } catch (pageError) {
      if (pageError instanceof DOMException && pageError.name === 'AbortError')
        return;
      setSitePages((current) =>
        current.map((page) =>
          page.id === pageId
            ? {
                ...page,
                status: 'ready',
                error: undefined,
              }
            : page,
        ),
      );
      setPublishError(
        `Your previous version is safe. ${
          pageError instanceof Error
            ? pageError.message
            : 'The changes could not be applied.'
        }`,
      );
    } finally {
      if (pageRequestsRef.current.get(pageId) === controller)
        pageRequestsRef.current.delete(pageId);
    }
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const instruction = prompt.trim();
    if (instruction.length < 12) {
      setError(
        'Add a little more detail so the builder has something to work with.',
      );
      return;
    }
    void buildHome(instruction, promptImages);
  }

  function handleRefine(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextInstruction = refinement.trim();
    if (!nextInstruction || !html) return;
    const nextImages = refinementImages;
    setRefinement('');
    setRefinementImages([]);
    void reviseSelectedPage(nextInstruction, nextImages);
  }

  async function uploadImages(fileList: FileList | null, target: UploadTarget) {
    const existing = target === 'prompt' ? promptImages : refinementImages;
    const remainingSlots = maxAttachedImages - existing.length;
    const selected = Array.from(fileList || []).slice(
      0,
      Math.max(remainingSlots, 0),
    );

    if (remainingSlots < 1) {
      setUploadError(`You can attach up to ${maxAttachedImages} images.`);
      return;
    }
    if (!selected.length) return;

    setUploadingTarget(target);
    setUploadError('');
    const uploaded: PromptImage[] = [];

    try {
      for (const file of selected) {
        if (file.size > 6 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 6 MB.`);
        }

        const extension = imageExtensions[file.type];
        if (!extension) {
          throw new Error(`${file.name} is not a supported image.`);
        }
        const pathname = `prompt-images/${crypto.randomUUID()}.${extension}`;
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/uploads',
          contentType: file.type,
          clientPayload: JSON.stringify({
            contentType: file.type,
            originalName: file.name,
          }),
        });
        uploaded.push({
          id: blob.pathname,
          name: file.name.slice(0, 180) || 'Uploaded image',
          path: blob.url,
        });
      }

      const update = (current: PromptImage[]) =>
        [...current, ...uploaded].slice(0, maxAttachedImages);
      if (target === 'prompt') setPromptImages(update);
      else setRefinementImages(update);

      if (fileList && fileList.length > selected.length) {
        setUploadError(
          `Only the first ${maxAttachedImages} images were attached.`,
        );
      }
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : 'The image could not be uploaded.',
      );
    } finally {
      setUploadingTarget(null);
    }
  }

  function removeImage(target: UploadTarget, id: string) {
    if (target === 'prompt') {
      setPromptImages((current) => current.filter((image) => image.id !== id));
    } else {
      setRefinementImages((current) =>
        current.filter((image) => image.id !== id),
      );
    }
    setUploadError('');
  }

  function startOver() {
    requestRef.current?.abort();
    for (const controller of pageRequestsRef.current.values())
      controller.abort();
    pageRequestsRef.current.clear();
    setStatus('idle');
    setStage(0);
    setSitePages([]);
    setSelectedPageId('');
    setError('');
    setActivePrompt('');
    setRefinement('');
    setPublishStatus('idle');
    setPublishedUrl('');
    setPublishError('');
    setLinkCopied(false);
    setPromptImages([]);
    setRefinementImages([]);
    setActiveImages([]);
    setUploadingTarget(null);
    setUploadError('');
    setPublishDialogOpen(false);
    setPublishMode('free');
    setSiteSlug('');
    setCustomDomain('');
    setDomainStatus('idle');
    setDomainError('');
    setTemplateId('');
    setSiteCompletionDialogOpen(false);
  }

  function downloadSite() {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = selectedPage?.slug
      ? `${selectedPage.slug.replaceAll('/', '-')}.html`
      : 'index.html';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyCode() {
    if (!html) return;
    await navigator.clipboard.writeText(html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function continueToPublish() {
    if (!siteSlug) setSiteSlug(createAddressSuggestion(activePrompt));
    setDomainError('');
    if (!account) {
      setAuthError('');
      setAuthMode('signup');
      setAuthDialogOpen(true);
      return;
    }
    setPublishDialogOpen(true);
  }

  function openPublishOptions() {
    if (unfinishedPages.length) {
      setSiteCompletionDialogOpen(true);
      return;
    }
    continueToPublish();
  }

  function removeUnfinishedLinks() {
    const unfinishedSlugs = new Set(
      unfinishedPages.map((page) => page.slug).filter(Boolean),
    );
    setSitePages((current) =>
      current
        .filter((page) => page.status === 'ready')
        .map((page) => ({
          ...page,
          html: removeLinksToPages(page.html, unfinishedSlugs),
        })),
    );
    setSiteCompletionDialogOpen(false);
    continueToPublish();
  }

  async function handleAccountSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authStatus === 'submitting') return;

    setAuthStatus('submitting');
    setAuthError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: authMode,
          name: authMode === 'signup' ? authName : undefined,
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        user?: AccountUser;
      };
      if (!response.ok || !data.user) {
        throw new Error(data.error || 'Your account could not be created.');
      }

      setAccount(data.user);
      setAuthPassword('');
      setAuthDialogOpen(false);
      if (!siteSlug) setSiteSlug(createAddressSuggestion(activePrompt));
      setPublishDialogOpen(true);
    } catch (accountError) {
      setAuthError(
        accountError instanceof Error
          ? accountError.message
          : 'Accounts are temporarily unavailable. Please try again.',
      );
    } finally {
      setAuthStatus('idle');
    }
  }

  async function publishSite() {
    const readyPages = sitePages.filter((page) => page.status === 'ready');
    const homePage = readyPages.find((page) => page.slug === '');
    if (!homePage || publishStatus === 'publishing') return;

    setPublishStatus('publishing');
    setPublishError('');
    setDomainError('');

    try {
      const slug = siteSlug || createAddressSuggestion(activePrompt);
      const domain = publishMode === 'custom' ? customDomain.trim() : '';

      if (publishMode === 'custom' && !domain) {
        throw new Error('Enter the domain you want to connect.');
      }

      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: homePage.html,
          pages: readyPages.map(({ title, slug, html: pageHtml }) => ({
            title,
            slug,
            html: pageHtml,
          })),
          prompt: activePrompt,
          slug,
          customDomain: domain,
        }),
      });
      const data = (await response.json()) as {
        customDomain?: string | null;
        domainStatus?: DomainStatus;
        error?: string;
        path?: string;
        url?: string;
      };

      if (response.status === 401) {
        setAccount(null);
        setPublishStatus('idle');
        setPublishDialogOpen(false);
        setAuthMode('signin');
        setAuthError(data.error || 'Sign in again to publish.');
        setAuthDialogOpen(true);
        return;
      }

      if (!response.ok || !data.path) {
        throw new Error(data.error || 'The site could not be published.');
      }

      setPublishedUrl(
        new URL(data.url || data.path, window.location.origin).toString(),
      );
      setSiteSlug(data.path.split('/').pop() || slug || 'my-website');
      setDomainStatus(data.customDomain ? 'pending_dns' : 'idle');
      setPublishStatus('published');
      setPublishDialogOpen(false);
    } catch (publishFailure) {
      setPublishError(
        publishFailure instanceof Error
          ? publishFailure.message
          : 'The site could not be published.',
      );
      setPublishStatus('error');
    }
  }

  async function checkDomain() {
    const slug = siteSlug;
    if (!slug || !customDomain.trim()) return;

    setDomainStatus('checking');
    setDomainError('');
    try {
      const response = await fetch('/api/domain/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: customDomain, slug }),
      });
      const data = (await response.json()) as {
        connected?: boolean;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || 'The DNS record could not be checked.');
      setDomainStatus(data.connected ? 'dns_verified' : 'pending_dns');
      if (!data.connected) {
        setDomainError(
          'The CNAME record is not visible yet. DNS changes can take a few minutes.',
        );
      }
    } catch (domainFailure) {
      setDomainStatus('error');
      setDomainError(
        domainFailure instanceof Error
          ? domainFailure.message
          : 'The domain could not be checked.',
      );
    }
  }

  async function copyPublishedLink() {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  }

  function renderAttachments(target: UploadTarget, images: PromptImage[]) {
    if (!images.length) return null;
    return (
      <div className="image-attachments" aria-label="Attached images">
        {images.map((image) => (
          <div className="image-attachment" key={image.id}>
            <img src={image.path} alt="" />
            <span title={image.name}>{image.name}</span>
            <button
              type="button"
              onClick={() => removeImage(target, image.id)}
              aria-label={`Remove ${image.name}`}
            >
              <X />
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <main className="landing-shell">
        <header className="landing-header">
          <div className="landing-brand">
            <span className="landing-brand-mark" aria-hidden="true">
              <FreeableLogo />
            </span>
            <strong>Freeable</strong>
          </div>
          <span className="landing-model">
            <i /> GPT-5.6 Sol
          </span>
        </header>

        <section className="prompt-card" aria-labelledby="builder-heading">
          <div className="landing-intro">
            <p className="eyebrow">From idea to live website</p>
            <h1 id="builder-heading">
              Build a beautiful
              <br />
              <span>website for free.</span>
            </h1>
            <p className="landing-copy">
              Tell Freeable what you want. Add visual references if you have
              them, then let AI design, code, and prepare the site for launch.
            </p>
          </div>

          <form className="prompt-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="site-prompt">
              Describe the website you want to build
            </label>
            <Textarea
              id="site-prompt"
              name="prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="prompt-input"
              placeholder="A serene portfolio for an architecture studio in Copenhagen..."
            />
            {renderAttachments('prompt', promptImages)}
            <div className="prompt-footer">
              <div className="prompt-tools">
                <label
                  className={`attach-control ${uploadingTarget === 'prompt' ? 'uploading' : ''}`}
                >
                  {uploadingTarget === 'prompt' ? <Spinner /> : <ImagePlus />}
                  <span>
                    {uploadingTarget === 'prompt' ? 'Uploading' : 'Add images'}
                  </span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    multiple
                    disabled={
                      uploadingTarget !== null ||
                      promptImages.length >= maxAttachedImages
                    }
                    onChange={(event) => {
                      void uploadImages(event.currentTarget.files, 'prompt');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <span
                  className={error || uploadError ? 'prompt-error' : ''}
                  aria-live="polite"
                >
                  {error || uploadError || `Up to ${maxAttachedImages} images`}
                </span>
              </div>
              <Button
                type="submit"
                size="icon-lg"
                aria-label="Build website"
                className="build-button"
                disabled={!prompt.trim() || uploadingTarget === 'prompt'}
              >
                <ArrowUp />
              </Button>
            </div>
          </form>

          <div className="landing-proof" aria-label="Builder features">
            <span>
              <Sparkles /> GPT-5.6 Sol
            </span>
            <span>
              <Palette /> 8 curated directions
            </span>
            <span>
              <Rocket /> One-click publishing
            </span>
          </div>
        </section>

        <footer className="landing-attribution">
          <span>by</span>{' '}
          <a
            href="https://cheaperinference.com"
            target="_blank"
            rel="noreferrer"
          >
            Cheaper Inference
          </a>
        </footer>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand">
          <button
            className="studio-logo"
            onClick={startOver}
            aria-label="Start a new site"
          >
            <FreeableLogo />
          </button>
          <div>
            <strong>Freeable</strong>
            <span>AI site builder</span>
          </div>
        </div>

        <div className="model-chip">
          <span className="model-dot" />
          GPT-5.6 Sol
        </div>

        <div className="studio-actions">
          {account && (
            <div className="account-chip" title={account.email}>
              <UserRound />
              <span>{account.name}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={copyCode} disabled={!html}>
            {copied ? <Check /> : <Copy />}
            <span className="desktop-label">
              {copied ? 'Copied' : 'Copy code'}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSite}
            disabled={!html}
          >
            <Download />
            <span className="desktop-label">Download page</span>
          </Button>
          <Button
            size="sm"
            className="publish-button"
            onClick={openPublishOptions}
            disabled={
              status !== 'ready' || !html || publishStatus === 'publishing'
            }
          >
            {publishStatus === 'publishing' ? (
              <Spinner />
            ) : publishStatus === 'published' ? (
              <Globe2 />
            ) : (
              <Rocket />
            )}
            <span className="desktop-label">
              {publishStatus === 'publishing'
                ? 'Publishing'
                : publishStatus === 'published'
                  ? 'Domains'
                  : publishedUrl
                    ? 'Update site'
                    : 'Publish'}
            </span>
          </Button>
        </div>
      </header>

      <section className={`studio-body ${sitePages.length ? 'has-pages' : ''}`}>
        {sitePages.length > 0 && (
          <nav className="pages-rail" aria-label="Website pages">
            <div className="pages-rail-heading">
              <div>
                <p className="eyebrow">Site map</p>
                <strong>Pages</strong>
              </div>
              <span>{sitePages.length}</span>
            </div>
            <div className="pages-list">
              {sitePages.map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className={page.id === selectedPage?.id ? 'active' : ''}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <span className={`page-status ${page.status}`}>
                    {page.status === 'building' ? <Spinner /> : <FileText />}
                  </span>
                  <span>
                    <strong>{page.title}</strong>
                    <small>{page.slug ? `/${page.slug}` : '/'}</small>
                  </span>
                  {page.status === 'ready' && <Check className="page-check" />}
                </button>
              ))}
            </div>
            {unfinishedPages.length > 0 && status === 'ready' && (
              <button
                type="button"
                className="build-pages-button"
                onClick={() => void generateAllSuggested()}
              >
                <Files />
                <span>
                  <strong>Build all pages</strong>
                  <small>{unfinishedPages.length} remaining</small>
                </span>
              </button>
            )}
          </nav>
        )}

        <div className="preview-area">
          <div className="preview-toolbar">
            <Button variant="ghost" size="sm" onClick={startOver}>
              <ChevronLeft /> New site
            </Button>
            <p title={selectedPage?.title || activePrompt}>
              {selectedPage
                ? `${selectedPage.title} · ${selectedPage.slug ? `/${selectedPage.slug}` : '/'}`
                : activePrompt}
            </p>
            <div className="viewport-toggle" aria-label="Preview size">
              <button
                className={viewport === 'desktop' ? 'active' : ''}
                onClick={() => setViewport('desktop')}
                aria-label="Desktop preview"
                aria-pressed={viewport === 'desktop'}
              >
                <Monitor />
              </button>
              <button
                className={viewport === 'mobile' ? 'active' : ''}
                onClick={() => setViewport('mobile')}
                aria-label="Mobile preview"
                aria-pressed={viewport === 'mobile'}
              >
                <Smartphone />
              </button>
            </div>
          </div>

          <div className="preview-stage">
            <div className={`preview-frame ${viewport}`}>
              {status === 'ready' &&
              selectedPage?.status === 'ready' &&
              html ? (
                <iframe
                  ref={iframeRef}
                  title="Generated website preview"
                  srcDoc={createPreviewHtml(html)}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              ) : status === 'error' ? (
                <div className="build-error" role="alert">
                  <div className="error-icon">!</div>
                  <h2>The build paused</h2>
                  <p>{error}</p>
                  <Button
                    onClick={() => void buildHome(activePrompt, activeImages)}
                  >
                    Try again
                  </Button>
                </div>
              ) : status === 'ready' && selectedPage?.status === 'suggested' ? (
                <div className="page-placeholder">
                  <span>
                    <FileText />
                  </span>
                  <p className="eyebrow">Next page</p>
                  <h2>{selectedPage.title}</h2>
                  <p>
                    This page was found in your homepage navigation. Build it
                    now with the same visual direction and site-wide navigation.
                  </p>
                  <Button onClick={() => void generatePage(selectedPage.id)}>
                    <WandSparkles /> Generate this page
                  </Button>
                </div>
              ) : status === 'ready' && selectedPage?.status === 'error' ? (
                <div className="build-error" role="alert">
                  <div className="error-icon">!</div>
                  <h2>{selectedPage.title} paused</h2>
                  <p>{selectedPage.error}</p>
                  <Button onClick={() => void generatePage(selectedPage.id)}>
                    Try this page again
                  </Button>
                </div>
              ) : (
                <div className="building-view" aria-live="polite">
                  <div className="building-orbit">
                    <Spinner />
                  </div>
                  <p className="eyebrow">building with gpt-5.6 sol</p>
                  <h2>
                    {status === 'building'
                      ? 'Turning your idea into a website'
                      : `Building ${selectedPage?.title || 'your page'}`}
                  </h2>
                  <p>
                    {status === 'building'
                      ? 'Your homepage will appear first.'
                      : 'You can keep editing other finished pages while it works.'}
                  </p>
                  <div className="skeleton-site" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="build-panel">
          <div className="panel-heading">
            <span>
              <WandSparkles />
            </span>
            <div>
              <p className="eyebrow">build brief</p>
              <h2>
                {status === 'ready'
                  ? selectedPage?.status === 'ready'
                    ? `Editing ${selectedPage.title}`
                    : `Planning ${selectedPage?.title || 'your site'}`
                  : 'Making your first draft'}
              </h2>
            </div>
          </div>

          <blockquote>{activePrompt}</blockquote>

          {status === 'ready' && sitePages.length > 1 && (
            <section className="site-plan-card" aria-label="Website page plan">
              <div>
                <span>
                  <Files />
                </span>
                <div>
                  <strong>{sitePages.length}-page website</strong>
                  <p>
                    {unfinishedPages.length
                      ? `${unfinishedPages.length} suggested ${unfinishedPages.length === 1 ? 'page is' : 'pages are'} ready to build.`
                      : 'Every linked page is ready to edit and publish.'}
                  </p>
                </div>
              </div>
              {unfinishedPages.length > 0 && (
                <Button size="sm" onClick={() => void generateAllSuggested()}>
                  <WandSparkles /> Build remaining pages
                </Button>
              )}
            </section>
          )}

          {activeTemplate && (
            <section
              className="template-direction"
              aria-label="Selected design direction"
            >
              <div className="template-direction-heading">
                <span className="template-icon" aria-hidden="true">
                  <Palette />
                </span>
                <div>
                  <p>Creative direction</p>
                  <strong>{activeTemplate.name}</strong>
                </div>
              </div>
              <p className="template-summary">{activeTemplate.summary}</p>
              <div className="template-details">
                <span>
                  {activeTemplate.fonts.display} · {activeTemplate.fonts.body}
                </span>
                <div
                  className="template-swatches"
                  aria-label="Template color palette"
                >
                  {Object.entries(activeTemplate.colors).map(
                    ([role, color]) => (
                      <i
                        key={role}
                        title={`${role}: ${color}`}
                        style={{ backgroundColor: color }}
                      />
                    ),
                  )}
                </div>
              </div>
            </section>
          )}

          <ol className="build-steps">
            {stages.map((label, index) => {
              const isComplete = status === 'ready' || index < stage;
              const isCurrent = status === 'building' && index === stage;
              return (
                <li key={label} className={isCurrent ? 'current' : ''}>
                  {isComplete ? (
                    <span className="step-icon complete">
                      <Check />
                    </span>
                  ) : isCurrent ? (
                    <span className="step-icon current">
                      <Spinner />
                    </span>
                  ) : (
                    <span className="step-icon">
                      <Circle />
                    </span>
                  )}
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          {status === 'ready' && selectedPage?.status === 'ready' && (
            <>
              {publishedUrl && (
                <div className="publish-card" aria-live="polite">
                  <div className="publish-card-heading">
                    <span>
                      <Link2 />
                    </span>
                    <div>
                      <strong>Live on Freeable</strong>
                      <p>
                        {publishStatus === 'idle'
                          ? 'You have unpublished changes'
                          : 'Your website is live and ready to share'}
                      </p>
                    </div>
                  </div>
                  <a href={publishedUrl} target="_blank" rel="noreferrer">
                    {publishedUrl.replace(/^https?:\/\//, '')}
                    <ExternalLink />
                  </a>
                  {customDomain && domainStatus !== 'idle' && (
                    <div className="domain-connection">
                      <div className="domain-connection-heading">
                        <Globe2 />
                        <div>
                          <strong>{customDomain}</strong>
                          <span className={`domain-status ${domainStatus}`}>
                            {domainStatus === 'dns_verified'
                              ? 'DNS verified · SSL activation pending'
                              : domainStatus === 'checking'
                                ? 'Checking DNS…'
                                : 'Waiting for DNS'}
                          </span>
                        </div>
                      </div>
                      <div className="dns-record">
                        <span>CNAME</span>
                        <code>{customDomain}</code>
                        <span>points to</span>
                        <code>{domainTarget}</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void checkDomain()}
                        disabled={domainStatus === 'checking'}
                      >
                        {domainStatus === 'checking' ? <Spinner /> : <Globe2 />}
                        Check connection
                      </Button>
                      {domainError && (
                        <p className="domain-error">{domainError}</p>
                      )}
                    </div>
                  )}
                  <div className="publish-card-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyPublishedLink()}
                    >
                      {linkCopied ? <Check /> : <Copy />}
                      {linkCopied ? 'Copied' : 'Copy link'}
                    </Button>
                    {publishStatus === 'idle' && (
                      <Button size="sm" onClick={openPublishOptions}>
                        <Rocket /> Update site
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openPublishOptions}
                    >
                      <Globe2 /> Domains
                    </Button>
                  </div>
                </div>
              )}

              {publishError && (
                <p className="publish-error" role="alert">
                  {publishError}
                </p>
              )}

              <form className="refine-form" onSubmit={handleRefine}>
                <div className="refine-heading">
                  <label htmlFor="refinement">
                    Refine {selectedPage.title}
                  </label>
                  <label
                    className={`attach-control compact ${
                      uploadingTarget === 'refinement' ? 'uploading' : ''
                    }`}
                  >
                    {uploadingTarget === 'refinement' ? (
                      <Spinner />
                    ) : (
                      <ImagePlus />
                    )}
                    <span>
                      {uploadingTarget === 'refinement'
                        ? 'Uploading'
                        : 'Add images'}
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      multiple
                      disabled={
                        uploadingTarget !== null ||
                        refinementImages.length >= maxAttachedImages
                      }
                      onChange={(event) => {
                        void uploadImages(
                          event.currentTarget.files,
                          'refinement',
                        );
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                {renderAttachments('refinement', refinementImages)}
                {uploadError && (
                  <p className="upload-message" role="alert">
                    {uploadError}
                  </p>
                )}
                <Textarea
                  id="refinement"
                  value={refinement}
                  onChange={(event) => setRefinement(event.target.value)}
                  placeholder={`Describe changes for ${selectedPage.title} only...`}
                />
                <Button
                  type="submit"
                  disabled={
                    !refinement.trim() || uploadingTarget === 'refinement'
                  }
                >
                  <WandSparkles /> Apply changes
                </Button>
              </form>
            </>
          )}

          <div className="panel-note">
            <Code2 />
            <p>
              Select a page to edit, copy, or download its complete HTML file.
            </p>
          </div>
        </aside>
      </section>

      <Dialog
        open={siteCompletionDialogOpen}
        onOpenChange={setSiteCompletionDialogOpen}
      >
        <DialogContent className="completion-dialog">
          <div className="completion-dialog-icon" aria-hidden="true">
            <Files />
          </div>
          <DialogHeader>
            <p className="eyebrow">Complete your site</p>
            <DialogTitle>
              {unfinishedPages.length}{' '}
              {unfinishedPages.length === 1
                ? 'linked page is'
                : 'linked pages are'}{' '}
              still unfinished
            </DialogTitle>
            <DialogDescription>
              Build these pages with the same design system, or remove their
              links before you publish so visitors never hit a dead end.
            </DialogDescription>
          </DialogHeader>
          <div className="completion-page-list">
            {unfinishedPages.map((page) => (
              <span key={page.id}>
                <FileText /> {page.title}
              </span>
            ))}
          </div>
          <div className="completion-dialog-actions">
            <Button variant="outline" onClick={removeUnfinishedLinks}>
              Remove unfinished links
            </Button>
            <Button onClick={() => void generateAllSuggested()}>
              <WandSparkles /> Build {unfinishedPages.length}{' '}
              {unfinishedPages.length === 1 ? 'page' : 'pages'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={authDialogOpen}
        onOpenChange={(open) => {
          setAuthDialogOpen(open);
          if (!open) {
            setAuthError('');
            setAuthPassword('');
          }
        }}
      >
        <DialogContent className="auth-dialog">
          <div className="auth-dialog-brand" aria-hidden="true">
            <FreeableLogo />
          </div>
          <DialogHeader>
            <p className="eyebrow">Save & publish</p>
            <DialogTitle>
              {authMode === 'signup'
                ? 'Create your free account'
                : 'Welcome back'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'signup'
                ? 'Create an account to claim this website and continue publishing it.'
                : 'Sign in to continue publishing your website.'}
            </DialogDescription>
          </DialogHeader>

          <div className="auth-switcher" aria-label="Account action">
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup');
                setAuthError('');
                setAuthPassword('');
              }}
            >
              Create account
            </button>
            <button
              type="button"
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signin');
                setAuthError('');
                setAuthPassword('');
              }}
            >
              Sign in
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAccountSubmit}>
            {authMode === 'signup' && (
              <div className="auth-field">
                <label htmlFor="account-name">Your name</label>
                <Input
                  id="account-name"
                  name="name"
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  autoComplete="name"
                  minLength={2}
                  maxLength={60}
                  placeholder="Alex Morgan"
                  required
                />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="account-email">Email address</label>
              <Input
                id="account-email"
                name="email"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                placeholder="alex@example.com"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="account-password">Password</label>
              <Input
                id="account-password"
                name="password"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                autoComplete={
                  authMode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={10}
                maxLength={128}
                placeholder="10+ characters"
                required
              />
              {authMode === 'signup' && (
                <small>
                  Use at least 10 characters, including a letter and number.
                </small>
              )}
            </div>

            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}

            <Button
              type="submit"
              className="auth-submit"
              disabled={authStatus === 'submitting'}
            >
              {authStatus === 'submitting' ? <Spinner /> : <LockKeyhole />}
              {authStatus === 'submitting'
                ? authMode === 'signup'
                  ? 'Creating account…'
                  : 'Signing in…'
                : authMode === 'signup'
                  ? 'Create account & continue'
                  : 'Sign in & continue'}
            </Button>
          </form>

          <div className="auth-assurance">
            <LockKeyhole />
            <p>
              Your site stays in the builder while you sign up. You’ll continue
              directly to publishing when you’re done.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="domain-dialog">
          <DialogHeader>
            <p className="eyebrow">Publish your website</p>
            <DialogTitle>Choose your web address</DialogTitle>
            <DialogDescription>
              Go live instantly with a free Freeable address, or connect a
              domain you own.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="domain-options" aria-label="Publishing address">
            <button
              type="button"
              className={publishMode === 'free' ? 'selected' : ''}
              onClick={() => {
                setPublishMode('free');
                setDomainError('');
              }}
              aria-pressed={publishMode === 'free'}
            >
              <span>
                <Link2 />
              </span>
              <strong>Free Freeable address</strong>
              <small>Included · live immediately</small>
              {publishMode === 'free' && <Check />}
            </button>
            <button
              type="button"
              className={publishMode === 'custom' ? 'selected' : ''}
              onClick={() => {
                setPublishMode('custom');
                setDomainError('');
              }}
              aria-pressed={publishMode === 'custom'}
            >
              <span>
                <Globe2 />
              </span>
              <strong>Connect your domain</strong>
              <small>Use a domain you already own</small>
              {publishMode === 'custom' && <Check />}
            </button>
          </fieldset>

          {publishMode === 'free' ? (
            <div className="domain-field">
              <label htmlFor="site-address">Choose your free address</label>
              <div className="address-input">
                {!freeSiteDomain && <span>…/s/</span>}
                <Input
                  id="site-address"
                  value={siteSlug}
                  maxLength={36}
                  onChange={(event) =>
                    setSiteSlug(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '')
                        .replace(/-{2,}/g, '-'),
                    )
                  }
                  placeholder="my-beautiful-site"
                />
                {freeSiteDomain && <span>.{freeSiteDomain}</span>}
              </div>
              <p>Free hosting and HTTPS are included.</p>
            </div>
          ) : (
            <div className="domain-field">
              <label htmlFor="custom-domain">Your domain</label>
              <Input
                id="custom-domain"
                value={customDomain}
                onChange={(event) => {
                  setCustomDomain(event.target.value);
                  setDomainError('');
                }}
                placeholder="www.example.com"
                inputMode="url"
              />
              <div className="domain-setup-note">
                <Globe2 />
                <p>
                  After publishing, add one CNAME record pointing to{' '}
                  <code>{domainTarget}</code>.
                </p>
              </div>
            </div>
          )}

          {publishError && <p className="domain-error">{publishError}</p>}
          {domainError && <p className="domain-error">{domainError}</p>}

          <div className="domain-dialog-actions">
            <Button variant="ghost" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void publishSite()}
              disabled={
                publishStatus === 'publishing' ||
                !siteSlug ||
                (publishMode === 'custom' && !customDomain.trim())
              }
            >
              {publishStatus === 'publishing' ? <Spinner /> : <Rocket />}
              {publishStatus === 'publishing'
                ? 'Publishing…'
                : publishMode === 'custom'
                  ? 'Publish & set up domain'
                  : 'Publish with free address'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
