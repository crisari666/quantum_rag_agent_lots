import * as sharpNamespace from 'sharp';

/** sharp's CJS export is the function; a default import compiles to `.default` and is undefined. */
const sharp =
  (sharpNamespace as unknown as { default?: typeof sharpNamespace }).default ??
  sharpNamespace;

const PANORAMA_MAX_WIDTH = 4096;
const PANORAMA_MAX_HEIGHT = 2048;
const PANORAMA_START_QUALITY = 82;
const PANORAMA_MIN_QUALITY = 58;
const PANORAMA_QUALITY_STEP = 8;
const PANORAMA_TARGET_BYTES = 4 * 1024 * 1024;

/**
 * Resize an equirectangular panorama to a JPEG the viewer can load quickly.
 */
export async function compressPanoramaUpload(
  file: Express.Multer.File,
): Promise<Express.Multer.File> {
  const baseName = (file.originalname ?? 'panorama').replace(/\.[^.]+$/, '');
  let quality = PANORAMA_START_QUALITY;
  let buffer = await encodePanorama(file.buffer, quality);
  while (buffer.length > PANORAMA_TARGET_BYTES && quality > PANORAMA_MIN_QUALITY) {
    quality -= PANORAMA_QUALITY_STEP;
    buffer = await encodePanorama(file.buffer, quality);
  }
  return {
    ...file,
    buffer,
    size: buffer.length,
    mimetype: 'image/jpeg',
    originalname: `${baseName || 'panorama'}.jpg`,
  };
}

async function encodePanorama(buffer: Buffer, quality: number): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: false, failOn: 'none' })
    .rotate()
    .resize({
      width: PANORAMA_MAX_WIDTH,
      height: PANORAMA_MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}
