import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { IngestGlobalDocumentDto } from './dto/ingest-global-document.dto';
import { GLOBAL_PROJECT_ID } from './constants/ingestion.constants';

@ApiTags('RAG Ingestion')
@Controller('rag')
export class IngestionController {
  public constructor(private readonly ingestionService: IngestionService) {}

  @Get('ingestion/documents')
  @ApiOperation({ summary: 'Get vectorized documents from the RAG store' })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter documents by project ID (MongoDB ObjectId)',
  })
  @ApiResponse({ status: 200, description: 'List of vectorized documents.' })
  @ApiResponse({ status: 500, description: 'Weaviate or query error.' })
  public async getVectorizedDocuments(
    @Query('projectId') projectId?: string,
  ) {
    return this.ingestionService.getVectorizedDocuments(projectId);
  }

  @Post('ingestion')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Ingest a document into the RAG vector store' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        docType: { type: 'string', description: 'Document type' },
        source: {
          type: 'string',
          description:
            'Vendor-facing citation (filename or public URL). Not the document body. With file upload, optional; defaults to uploaded filename.',
        },
        rawText: {
          type: 'string',
          description: 'Plain text for embeddings only; assistant cites `source` to vendors',
        },
        externalUrl: {
          type: 'string',
          description: 'URL to fetch text for embeddings; use `source` for vendor-visible link if different',
        },
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Text-based file: bytes are parsed for search; citation is `source` or original filename',
        },
      },
      required: ['projectId', 'docType'],
    },
  })
  @ApiResponse({ status: 201, description: 'Document vectorized successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'Ingestion or embedding error.' })
  public async ingestDocument(
    @Body() dto: IngestDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateAtLeastOneInputSource(dto.rawText, dto.externalUrl, file);
    return this.ingestionService.ingestDocumentFromSource({
      projectId: dto.projectId,
      docType: dto.docType,
      rawText: dto.rawText,
      source: dto.source,
      externalUrl: dto.externalUrl,
      file,
    });
  }

  @Post('ingestion/global')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Ingest a global knowledge document into the RAG vector store (projectId = GLOBAL)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        docType: { type: 'string', description: 'Document type' },
        source: {
          type: 'string',
          description:
            'Vendor-facing citation. With file upload, optional; defaults to uploaded filename.',
        },
        rawText: {
          type: 'string',
          description: 'Plain text for embeddings only; assistant cites `source` to vendors',
        },
        externalUrl: {
          type: 'string',
          description: 'URL to fetch text; use `source` for vendor-visible link if different',
        },
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Text-based file for embedding extraction; citation is `source` or original filename',
        },
      },
      required: ['docType'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Global document vectorized successfully.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'Ingestion or embedding error.' })
  public async ingestGlobalDocument(
    @Body() dto: IngestGlobalDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateAtLeastOneInputSource(dto.rawText, dto.externalUrl, file);
    const result = await this.ingestionService.ingestGlobalDocumentFromSource({
      docType: dto.docType,
      rawText: dto.rawText,
      source: dto.source,
      externalUrl: dto.externalUrl,
      file,
    });
    return {
      ...result,
      projectId: GLOBAL_PROJECT_ID,
    };
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }

  private validateAtLeastOneInputSource(
    rawText?: string,
    externalUrl?: string,
    file?: Express.Multer.File,
  ): void {
    const hasRawText = Boolean(rawText?.trim());
    const hasExternalUrl = Boolean(externalUrl?.trim());
    const hasFile = Boolean(file?.buffer);
    if (hasRawText || hasExternalUrl || hasFile) {
      return;
    }
    throw new BadRequestException(
      'Provide one input source: rawText, file, or externalUrl.',
    );
  }
}
