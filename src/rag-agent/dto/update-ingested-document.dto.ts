import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const MAX_RAW_TEXT_LENGTH = 1_000_000;
const MAX_PROJECT_ID_LENGTH = 100;
const MAX_DOC_TYPE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 2048;

/**
 * DTO for updating an existing ingested document in the RAG vector store.
 */
export class UpdateIngestedDocumentDto {
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
    description: 'Current document type used to identify existing chunks',
    example: 'brochure',
    maxLength: MAX_DOC_TYPE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DOC_TYPE_LENGTH)
  currentDocType: string;
  @ApiProperty({
    description: 'Current source used to identify existing chunks',
    example: 'https://cdn.example.com/public/brochure.pdf',
    maxLength: MAX_SOURCE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_LENGTH)
  currentSource: string;
  @ApiProperty({
    description: 'New document type after update. Falls back to currentDocType.',
    example: 'legal-doc',
    maxLength: MAX_DOC_TYPE_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DOC_TYPE_LENGTH)
  newDocType?: string;
  @ApiProperty({
    description:
      'New vendor-facing source after update. Falls back to currentSource unless a file is uploaded and no source is provided.',
    example: 'https://cdn.example.com/public/new-brochure.pdf',
    maxLength: MAX_SOURCE_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  newSource?: string;
  @ApiProperty({
    description: 'New plain text used for re-vectorization',
    example: 'Updated brochure content...',
    maxLength: MAX_RAW_TEXT_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_RAW_TEXT_LENGTH)
  rawText?: string;
  @ApiProperty({
    description:
      'URL to fetch updated text content for re-vectorization. Use newSource if vendor-facing citation should differ.',
    example: 'https://cdn.example.com/docs/brochure-v2.txt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  externalUrl?: string;
}
