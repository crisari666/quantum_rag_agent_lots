import { UPLOADS_STATIC_URL_PREFIX } from '../../config/upload-bucket.constants';

const PUBLIC_BASE_ENV = 'EXPERIENCE_UPLOADS_PUBLIC_BASE';

/**
 * True when the stored address can be loaded by a browser.
 * A typo such as htts:// must fall through to the file name.
 */
export function isPublicHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function buildExperiencePublicFileUrl(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return '';
  if (isPublicHttpUrl(trimmed)) return trimmed;
  const bareName = trimmed.includes('://')
    ? trimmed.slice(trimmed.lastIndexOf('/') + 1)
    : trimmed.replace(/^\//, '');
  if (!bareName) return '';
  const relative = `${UPLOADS_STATIC_URL_PREFIX}projects/${bareName}`;
  const configured = (process.env[PUBLIC_BASE_ENV] ?? '')
    .trim()
    .replace(/\/$/, '');
  const port = (process.env.PORT_APP ?? '3003').trim();
  const origin = configured || `http://localhost:${port}`;
  return `${origin}${relative}`;
}
