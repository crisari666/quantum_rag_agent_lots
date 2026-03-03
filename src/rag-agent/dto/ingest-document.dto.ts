import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_RAW_TEXT_LENGTH = 1_000_000;
const MAX_PROJECT_ID_LENGTH = 100;
const MAX_DOC_TYPE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 500;

/**
 * DTO for document ingestion into the RAG vector store.
 */
export class IngestDocumentDto {
  @ApiProperty({
    description: 'Raw text content of the document to vectorize',
    example: 'This is the document content about the project...',
    maxLength: MAX_RAW_TEXT_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_RAW_TEXT_LENGTH)
  rawText: string;

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
    description: 'Source reference (e.g. filename or URL)',
    example: 'project-manual.pdf',
    maxLength: MAX_SOURCE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_LENGTH)
  source: string;
}
