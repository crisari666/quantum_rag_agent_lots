import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const MAX_RAW_TEXT_LENGTH = 1_000_000;
const MAX_PROJECT_ID_LENGTH = 100;
const MAX_DOC_TYPE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 2048;

/**
 * DTO for document ingestion into the RAG vector store.
 */
export class IngestDocumentDto {
  @ApiProperty({
    description:
      'Plain text used only for chunking and embeddings. The assistant cites vendors using `source`, not this field.',
    example: 'This is the document content about the project...',
    maxLength: MAX_RAW_TEXT_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_RAW_TEXT_LENGTH)
  rawText?: string;

  @ApiProperty({
    description: 'Project identifier the document belongs to',
    example: '507f1f77bcf86cd799439011',
    maxLength: MAX_PROJECT_ID_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PROJECT_ID_LENGTH)
  projectId: string;

  @ApiProperty({
    description: 'Type of document (e.g. manual, regulation, spec)',
    example: 'manual',
    maxLength: MAX_DOC_TYPE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DOC_TYPE_LENGTH)
  docType: string;

  @ApiProperty({
    description:
      'Vendor-facing citation: filename, title, or public URL the assistant returns (not the document body). With file upload, omit to use the uploaded filename; set explicitly when the canonical link differs (e.g. CDN URL).',
    example: 'https://cdn.example.com/docs/project-manual.pdf',
    maxLength: MAX_SOURCE_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  source?: string;

  @ApiProperty({
    description:
      'URL to fetch text/plain (or text/*) body for embeddings. Use `source` for the link you want vendors to see when it differs from this URL.',
    example: 'https://cdn.example.com/docs/project-manual.txt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  externalUrl?: string;
}
