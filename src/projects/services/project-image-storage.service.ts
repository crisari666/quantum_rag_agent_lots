import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DEFAULT_PROJECT_IMAGES_UPLOAD_DIR } from '../constants/image-upload.constants';

const UPLOAD_DIR_ENV_KEY = 'UPLOAD_DIR';

/**
 * Service responsible for persisting project images to disk.
 */
@Injectable()
export class ProjectImageStorageService {
  public constructor(private readonly configService: ConfigService) {}

  /**
   * Builds the stored image filename: projectId_timestamp.format
   */
  public buildImageFileName(projectId: string, format: string): string {
    const timestamp = Date.now();
    return `${projectId}_${timestamp}.${format}`;
  }

  /**
   * Ensures the upload directory exists and writes the buffer to a file.
   * Returns the filename (not full path) for storing in the project.
   */
  public async saveImage(
    buffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    return fileName;
  }

  private getUploadDir(): string {
    return (
      this.configService.get<string>(UPLOAD_DIR_ENV_KEY) ??
      DEFAULT_PROJECT_IMAGES_UPLOAD_DIR
    );
  }
}
