import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PROJECT_DOCUMENT_TYPES } from '../constants/ingestion.constants';

const MAX_RAW_TEXT_LENGTH = 1_000_000;
const MAX_DOC_TYPE_LENGTH = 100;
const MAX_SOURCE_LENGTH = 2048;

/**
 * DTO for global document ingestion into the RAG vector store.
 */
export class IngestGlobalDocumentDto {
  @ApiProperty({
    description:
      'Plain text used only for chunking and embeddings. The assistant cites vendors using `source`, not this field.',
    example: 'Ley 388 regula la planificación y gestión del suelo...',
    maxLength: MAX_RAW_TEXT_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_RAW_TEXT_LENGTH)
  rawText?: string;

  @ApiProperty({
    description:
      'Type of document. Includes project document types and allows custom values using "other".',
    enum: [...PROJECT_DOCUMENT_TYPES, 'other'],
    example: 'other',
    maxLength: MAX_DOC_TYPE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DOC_TYPE_LENGTH)
  @IsIn([...PROJECT_DOCUMENT_TYPES, 'other'])
  docType: string;

  @ApiProperty({
    description:
      'Vendor-facing citation: law name, official URL, or filename the assistant returns. With file upload, omit to use the uploaded filename.',
    example: 'https://www.secretariasenado.gov.co/senado/basedoc/ley_0388_1997.html',
    maxLength: MAX_SOURCE_LENGTH,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  source?: string;

  @ApiProperty({
    description:
      'URL to fetch text body for embeddings. Use `source` for the official or public link vendors should see when it differs.',
    example: 'https://cdn.example.com/docs/ley-388-1997.txt',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  externalUrl?: string;
}
