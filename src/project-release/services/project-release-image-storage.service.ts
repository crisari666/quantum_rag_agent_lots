import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { resolveProjectReleaseImagesUploadDir } from '../../config/upload-bucket.resolver';

@Injectable()
export class ProjectReleaseImageStorageService {
  public constructor(private readonly configService: ConfigService) {}

  public buildImageFileName(
    releaseTitle: string,
    format: string,
    index = 0,
  ): string {
    const normalized = this.normalizeTitle(releaseTitle);
    const timestamp = Date.now();
    const suffix = index > 0 ? `_${index}` : '';
    return `project_release_image_${normalized}_${timestamp}${suffix}.${format}`;
  }

  public async saveFile(buffer: Buffer, fileName: string): Promise<string> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    return fileName;
  }

  public async deleteFile(fileName: string): Promise<void> {
    const filePath = this.resolveFilePath(fileName);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public resolveFilePath(fileName: string): string {
    const uploadDir = this.getUploadDir();
    const safeFileName = basename(fileName);
    return join(uploadDir, safeFileName);
  }

  private getUploadDir(): string {
    return resolveProjectReleaseImagesUploadDir(this.configService);
  }

  private normalizeTitle(title: string): string {
    const normalized = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || 'release';
  }
}
