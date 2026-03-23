import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_UPLOADS_BUCKET_RELATIVE_PATH,
  UPLOADS_BUCKET_PATH_ENV_KEY,
} from './upload-bucket.constants';

const UPLOAD_DIR_ENV_KEY = 'UPLOAD_DIR';

/**
 * Absolute path to the uploads bucket root (creates parent chain via caller).
 */
export function resolveUploadsBucketAbsolutePath(): string {
  const configuredPath =
    process.env[UPLOADS_BUCKET_PATH_ENV_KEY] ??
    DEFAULT_UPLOADS_BUCKET_RELATIVE_PATH;
  return resolve(process.cwd(), configuredPath);
}

/**
 * Absolute path for project image files; honors UPLOAD_DIR when set.
 */
export function resolveProjectImagesUploadDir(
  configService: ConfigService,
): string {
  const configuredOverride = configService.get<string>(UPLOAD_DIR_ENV_KEY);
  if (configuredOverride) {
    return resolve(process.cwd(), configuredOverride);
  }
  return resolve(resolveUploadsBucketAbsolutePath(), 'projects');
}
