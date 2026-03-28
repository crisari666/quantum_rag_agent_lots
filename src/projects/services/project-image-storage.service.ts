import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { resolveProjectImagesUploadDir } from '../../config/upload-bucket.resolver';

/**
 * Service responsible for persisting project images to disk.
 */
@Injectable()
export class ProjectImageStorageService {
  public constructor(private readonly configService: ConfigService) {}

  public buildDocumentFileName(
    fileType: string,
    projectName: string,
    extension: string,
  ): string {
    const normalizedProjectName = this.normalizeProjectName(projectName);
    return `${fileType}_${normalizedProjectName}.${extension}`;
  }

  public buildImageFileName(
    projectName: string,
    format: string,
    index = 0,
  ): string {
    const normalizedProjectName = this.normalizeProjectName(projectName);
    const timestamp = Date.now();
    const suffix = index > 0 ? `_${index}` : '';
    return `image_${normalizedProjectName}_${timestamp}${suffix}.${format}`;
  }

  /**
   * Builds a unique filename for horizontal (landscape) image uploads.
   */
  public buildHorizontalImageFileName(
    projectName: string,
    format: string,
    index = 0,
  ): string {
    const normalizedProjectName = this.normalizeProjectName(projectName);
    const timestamp = Date.now();
    const suffix = index > 0 ? `_${index}` : '';
    return `horizontal_image_${normalizedProjectName}_${timestamp}${suffix}.${format}`;
  }

  /**
   * Builds a unique filename for vertical (portrait) video uploads.
   */
  public buildVerticalVideoFileName(
    projectName: string,
    extension: string,
    index = 0,
  ): string {
    const normalizedProjectName = this.normalizeProjectName(projectName);
    const timestamp = Date.now();
    const suffix = index > 0 ? `_${index}` : '';
    return `vertical_video_${normalizedProjectName}_${timestamp}${suffix}.${extension}`;
  }

  /**
   * Ensures the upload directory exists and writes the buffer to a file.
   * Returns the filename (not full path) for storing in the project.
   */
  public async saveFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    return fileName;
  }

  /**
   * Deletes an image file from disk by filename.
   * Ignores ENOENT (file already missing).
   */
  public async deleteFile(fileName: string): Promise<void> {
    const uploadDir = this.getUploadDir();
    const filePath = join(uploadDir, fileName);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private getUploadDir(): string {
    return resolveProjectImagesUploadDir(this.configService);
  }

  private normalizeProjectName(projectName: string): string {
    const normalized = projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || 'project';
  }
}
