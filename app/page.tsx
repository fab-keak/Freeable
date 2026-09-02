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
import { SleekSiteLogo } from '@/components/sleeksite-logo';
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

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [activePrompt, setActivePrompt] = useState('');
  const [refinement, setRefinement] = useState('');
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [stage, setStage] = useState(0);
  const [html, setHtml] = useState('');
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
  const requestRef = useRef<AbortController | null>(null);
  const activeTemplate = getDesignTemplate(templateId);

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

  async function buildSite(
    instruction: string,
    previousHtml?: string,
    images: PromptImage[] = [],
  ) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setActivePrompt(instruction);
    setActiveImages(images);
    setStatus('building');
    setStage(0);
    setError('');
    setUploadError('');
    setCopied(false);
    if (previousHtml && publishedUrl) setPublishStatus('idle');
    setPublishError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: instruction,
          previousHtml,
          images,
          templateId: previousHtml ? templateId : undefined,
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

        if (generated.length > 1_000) setStage(2);
        if (generated.length > 6_000) setStage(3);
      }

      generated += decoder.decode();
      const siteHtml = cleanGeneratedHtml(generated);
      if (
        !/<html|<!doctype/i.test(siteHtml) ||
        !/<\/html>\s*$/i.test(siteHtml)
      ) {
        throw new Error('The generated site was incomplete. Please try again.');
      }

      setHtml(siteHtml);
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

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const instruction = prompt.trim();
    if (instruction.length < 12) {
      setError(
        'Add a little more detail so the builder has something to work with.',
      );
      return;
    }
    void buildSite(instruction, undefined, promptImages);
  }

  function handleRefine(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextInstruction = refinement.trim();
    if (!nextInstruction || !html) return;
    const nextImages = refinementImages;
    setRefinement('');
    setRefinementImages([]);
    void buildSite(nextInstruction, html, nextImages);
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
    setStatus('idle');
    setStage(0);
    setHtml('');
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
  }

  function downloadSite() {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sleeksite-website.html';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyCode() {
    if (!html) return;
    await navigator.clipboard.writeText(html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function openPublishOptions() {
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
    if (!html || publishStatus === 'publishing') return;

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
          html,
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
              <SleekSiteLogo />
            </span>
            <strong>SleekSite</strong>
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
              Tell SleekSite what you want. Add visual references if you have
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
            <SleekSiteLogo />
          </button>
          <div>
            <strong>SleekSite</strong>
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
            <span className="desktop-label">Download</span>
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

      <section className="studio-body">
        <div className="preview-area">
          <div className="preview-toolbar">
            <Button variant="ghost" size="sm" onClick={startOver}>
              <ChevronLeft /> New site
            </Button>
            <p title={activePrompt}>{activePrompt}</p>
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
              {status === 'ready' && html ? (
                <iframe
                  title="Generated website preview"
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
              ) : status === 'error' ? (
                <div className="build-error" role="alert">
                  <div className="error-icon">!</div>
                  <h2>The build paused</h2>
                  <p>{error}</p>
                  <Button
                    onClick={() =>
                      void buildSite(
                        activePrompt,
                        html || undefined,
                        activeImages,
                      )
                    }
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="building-view" aria-live="polite">
                  <div className="building-orbit">
                    <Spinner />
                  </div>
                  <p className="eyebrow">building with gpt-5.6 sol</p>
                  <h2>Turning your idea into a website</h2>
                  <p>The first complete version will appear here.</p>
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
                  ? 'Your site is ready'
                  : 'Making your first draft'}
              </h2>
            </div>
          </div>

          <blockquote>{activePrompt}</blockquote>

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

          {status === 'ready' && (
            <>
              {publishedUrl && (
                <div className="publish-card" aria-live="polite">
                  <div className="publish-card-heading">
                    <span>
                      <Link2 />
                    </span>
                    <div>
                      <strong>Live on SleekSite</strong>
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
                      <Button size="sm" onClick={() => void publishSite()}>
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
                  <label htmlFor="refinement">Refine this version</label>
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
                  placeholder="Make the type larger and add a testimonials section..."
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
              Publish here for a shareable link, or download the complete HTML
              file.
            </p>
          </div>
        </aside>
      </section>

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
            <SleekSiteLogo />
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
              Go live instantly with a free SleekSite address, or connect a
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
              <strong>Free SleekSite address</strong>
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
