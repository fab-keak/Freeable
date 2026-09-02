import { NextResponse } from 'next/server';

import {
  getUploadUrl,
  imageResponseToDataUrl,
  maxPromptImageBytes,
  maxPromptImages,
} from '@/lib/uploads';
import {
  formatTemplatePrompt,
  selectDesignTemplate,
} from '@/lib/design-templates';

const endpoint = 'https://api.cheaperinference.com/v1/chat/completions';
const model = 'gpt-5.6-sol';
const streamErrorPrefix = '__CANVAS_STREAM_ERROR__:';

export const runtime = 'nodejs';
export const maxDuration = 300;

const systemPrompt = `You are an expert product designer and front-end engineer inside an AI website builder.
Create a complete, polished, production-quality single-page website from the user's brief.

Return only one self-contained HTML document beginning with <!doctype html>. Never use markdown fences or add commentary.

Requirements:
- Put all CSS in a <style> tag and all JavaScript in a <script> tag.
- Make the layout responsive across desktop and mobile.
- Use semantic HTML, visible focus states, accessible labels, and sufficient contrast.
- Follow the selected design system closely while adapting its composition to the user's specific brief.
- Write specific, convincing content instead of lorem ipsum or vague placeholders.
- Make interactive elements work with small, dependency-free JavaScript when useful.
- When uploaded images are supplied, understand them visually and use the provided Vercel Blob URLs in the HTML when the brief calls for those images.
- For any other imagery, use only public HTTPS image URLs. The page must still look good if images fail.
- Do not load JavaScript frameworks or require a build step.
- Keep the document focused and complete within 5,000 output tokens. Prefer a finished page over excessive sections.
- Do not explain the result.`;

export async function POST(request: Request) {
  let body: {
    prompt?: unknown;
    previousHtml?: unknown;
    images?: unknown;
    templateId?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'The build request was not valid.' },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const previousHtml =
    typeof body.previousHtml === 'string'
      ? body.previousHtml.slice(0, 450_000)
      : '';
  const preferredTemplateId =
    typeof body.templateId === 'string' ? body.templateId : '';

  if (prompt.length < 12 || prompt.length > 4_000) {
    return NextResponse.json(
      { error: 'Describe the site in 12 to 4,000 characters.' },
      { status: 400 },
    );
  }

  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length > maxPromptImages) {
    return NextResponse.json(
      { error: `Attach no more than ${maxPromptImages} images to a prompt.` },
      { status: 400 },
    );
  }

  const images: Array<{ url: string; name: string; path: string }> = [];
  for (const image of rawImages) {
    if (!image || typeof image !== 'object') {
      return NextResponse.json(
        { error: 'One of the image attachments was not valid.' },
        { status: 400 },
      );
    }

    const candidate = image as { path?: unknown; name?: unknown };
    const path = typeof candidate.path === 'string' ? candidate.path : '';
    const url = getUploadUrl(path);
    if (!url) {
      return NextResponse.json(
        { error: 'One of the image attachments was not valid.' },
        { status: 400 },
      );
    }

    images.push({
      url,
      path,
      name:
        typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim().slice(0, 180)
          : 'Uploaded image',
    });
  }

  const apiKey = process.env.CHEAPER_INFERENCE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'The builder needs a Cheaper Inference API key before it can generate sites.',
      },
      { status: 503 },
    );
  }

  let promptImages: Array<{ dataUrl: string; name: string; path: string }> = [];
  if (images.length) {
    try {
      let totalBytes = 0;

      promptImages = await Promise.all(
        images.map(async ({ url, name, path }) => {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) throw new Error('missing');

          const contentLength = Number(
            response.headers.get('content-length') || 0,
          );
          totalBytes += contentLength;
          if (totalBytes > maxPromptImageBytes) throw new Error('too-large');

          const dataUrl = await imageResponseToDataUrl(response);
          totalBytes += contentLength ? 0 : Math.ceil(dataUrl.length * 0.75);
          if (totalBytes > maxPromptImageBytes) throw new Error('too-large');

          return { dataUrl, name, path };
        }),
      );
    } catch (imageError) {
      const reason = imageError instanceof Error ? imageError.message : '';
      return NextResponse.json(
        {
          error:
            reason === 'too-large'
              ? 'The attached images are too large together. Keep the total under 16 MB.'
              : reason === 'missing' || reason === 'invalid'
                ? 'One of the attached images is no longer available. Remove it and upload it again.'
                : 'Image storage is temporarily unavailable. Please try again.',
        },
        {
          status:
            reason === 'too-large' ||
            reason === 'missing' ||
            reason === 'invalid'
              ? 400
              : 503,
        },
      );
    }
  }

  const attachmentGuide = promptImages.length
    ? `\n\nUploaded image references (attached in the same order):\n${promptImages
        .map(({ name, path }, index) => `${index + 1}. ${name}: ${path}`)
        .join(
          '\n',
        )}\nUnderstand the attached images visually. When the user wants one shown in the website, use its matching HTTPS URL exactly in the HTML. Never embed the data URL.`
    : '';

  const designTemplate = selectDesignTemplate(
    prompt,
    previousHtml,
    preferredTemplateId,
  );
  const templateGuide = formatTemplatePrompt(designTemplate);

  const task = previousHtml
    ? `Revise the existing website according to this instruction: ${prompt}${attachmentGuide}\n\nExisting website:\n${previousHtml}`
    : `${prompt}${attachmentGuide}`;

  const userContent = promptImages.length
    ? [
        { type: 'text', text: task },
        ...promptImages.map(({ dataUrl }) => ({
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'auto' },
        })),
      ]
    : task;

  const messages = [
    { role: 'system', content: `${systemPrompt}\n${templateGuide}` },
    { role: 'user', content: userContent },
  ];

  try {
    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-CI-Concise': '1',
      },
      body: JSON.stringify({
        model,
        messages,
        reasoning_effort: 'none',
        max_completion_tokens: 12_000,
        stream: true,
      }),
      signal: AbortSignal.timeout(240_000),
    });

    if (!providerResponse.ok) {
      if (providerResponse.status === 401 || providerResponse.status === 403) {
        return NextResponse.json(
          {
            error:
              'The Cheaper Inference API key was rejected. Check the key and try again.',
          },
          { status: 502 },
        );
      }
      if (providerResponse.status === 429) {
        return NextResponse.json(
          {
            error: 'The model is busy right now. Wait a moment and try again.',
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        {
          error:
            'Cheaper Inference could not complete this build. Please try again.',
        },
        { status: 502 },
      );
    }

    if (!providerResponse.body) {
      return NextResponse.json(
        {
          error:
            'The model returned an empty site. Please try a slightly different prompt.',
        },
        { status: 502 },
      );
    }

    const upstream = providerResponse.body;
    const output = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let buffer = '';
        let finishReason = '';
        let sawContent = false;

        const sendError = (message: string) => {
          controller.enqueue(
            encoder.encode(`\n${streamErrorPrefix}${message}`),
          );
          controller.close();
        };

        void (async () => {
          const reader = upstream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder
                .decode(value, { stream: true })
                .replace(/\r\n/g, '\n');
              const events = buffer.split('\n\n');
              buffer = events.pop() ?? '';

              for (const event of events) {
                for (const line of event.split('\n')) {
                  if (!line.startsWith('data:')) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === '[DONE]') continue;

                  try {
                    const chunk = JSON.parse(payload) as {
                      choices?: Array<{
                        delta?: { content?: string };
                        finish_reason?: string | null;
                      }>;
                    };
                    const choice = chunk.choices?.[0];
                    if (choice?.finish_reason)
                      finishReason = choice.finish_reason;
                    if (choice?.delta?.content) {
                      sawContent = true;
                      controller.enqueue(encoder.encode(choice.delta.content));
                    }
                  } catch {
                    // Ignore malformed provider heartbeats and continue the stream.
                  }
                }
              }
            }

            if (!sawContent) {
              sendError('The model returned an empty site. Please try again.');
            } else if (finishReason === 'length') {
              sendError(
                'The generated site was incomplete. Try a more focused description.',
              );
            } else {
              controller.close();
            }
          } catch {
            sendError(
              'The model connection was interrupted. Please try again.',
            );
          } finally {
            reader.releaseLock();
          }
        })();
      },
      cancel(reason) {
        return upstream.cancel(reason);
      },
    });

    return new Response(output, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-SleekSite-Template': designTemplate.id,
      },
    });
  } catch (providerError) {
    const timedOut =
      providerError instanceof DOMException &&
      providerError.name === 'TimeoutError';
    return NextResponse.json(
      {
        error: timedOut
          ? 'The model took too long to start. Please try again.'
          : 'The builder could not reach Cheaper Inference. Please try again.',
      },
      { status: 504 },
    );
  }
}
