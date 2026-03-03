/**
 * Result of compressing an image buffer.
 */
export interface ImageCompressionResult {
  readonly buffer: Buffer;
  readonly format: string;
}
