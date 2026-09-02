import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import {
  maxImageBytes,
  supportedImageTypes,
} from '@/lib/uploads';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: 'The upload request was not valid.' },
      { status: 400 },
    );
  }

  try {
    const response = await handleUpload({
      request,
      body,
      async onBeforeGenerateToken(pathname, clientPayload) {
        let metadata: { contentType?: unknown; originalName?: unknown } = {};
        try {
          metadata = JSON.parse(clientPayload || '{}') as typeof metadata;
        } catch {
          throw new Error('The upload details were not valid.');
        }

        const contentType =
          typeof metadata.contentType === 'string'
            ? metadata.contentType
            : '';
        const extension = supportedImageTypes.get(contentType);
        if (
          !extension ||
          !new RegExp(
            `^prompt-images/[0-9a-f-]{36}\\.${extension}$`,
          ).test(pathname)
        ) {
          throw new Error('Use a JPEG, PNG, WebP, GIF, or AVIF image.');
        }

        return {
          allowedContentTypes: [contentType],
          maximumSizeInBytes: maxImageBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 31_536_000,
          tokenPayload: JSON.stringify({
            originalName:
              typeof metadata.originalName === 'string'
                ? metadata.originalName.slice(0, 180)
                : 'Uploaded image',
          }),
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Image storage is temporarily unavailable. Please try again.',
      },
      { status: 400 },
    );
  }
}
