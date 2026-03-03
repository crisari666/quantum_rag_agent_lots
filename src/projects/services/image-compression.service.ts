import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ImageCompressionResult } from '../types/image-compression.types';
import { COMPRESSED_IMAGE_FORMAT } from '../constants/image-upload.constants';

const COMPRESSION_QUALITY = 85;
const MAX_WIDTH_PX = 1920;
const MAX_HEIGHT_PX = 1920;

/**
 * Service responsible for compressing images to reduce size and memory usage.
 */
@Injectable()
export class ImageCompressionService {
  /**
   * Compresses an image buffer and returns it in WebP format.
   */
  public async compress(buffer: Buffer): Promise<ImageCompressionResult> {
    const compressed = await sharp(buffer)
      .resize(MAX_WIDTH_PX, MAX_HEIGHT_PX, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: COMPRESSION_QUALITY })
      .toBuffer();
    return {
      buffer: compressed,
      format: COMPRESSED_IMAGE_FORMAT,
    };
  }
}
