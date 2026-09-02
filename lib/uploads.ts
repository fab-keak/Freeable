export const supportedImageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
]);

export const maxImageBytes = 6 * 1024 * 1024;
export const maxPromptImageBytes = 16 * 1024 * 1024;
export const maxPromptImages = 4;

const uploadPathPattern = /^prompt-images\/[0-9a-f-]{36}\.(?:jpg|png|webp|gif|avif)$/;
const vercelBlobHostPattern = /\.public\.blob\.vercel-storage\.com$/;

export function getUploadUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !vercelBlobHostPattern.test(url.hostname) ||
      !uploadPathPattern.test(url.pathname.slice(1))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function hasValidImageSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (contentType === 'image/gif') {
    const signature = new TextDecoder().decode(bytes.slice(0, 6));
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  if (contentType === 'image/webp') {
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    );
  }
  if (contentType === 'image/avif') {
    const brand = new TextDecoder().decode(bytes.slice(8, 12));
    return (
      new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp' &&
      ['avif', 'avis', 'mif1'].includes(brand)
    );
  }
  return false;
}

export async function imageResponseToDataUrl(response: Response) {
  const contentType = response.headers.get('content-type')?.split(';')[0] || '';
  if (!supportedImageTypes.has(contentType)) throw new Error('invalid');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!hasValidImageSignature(contentType, bytes)) throw new Error('invalid');
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}
