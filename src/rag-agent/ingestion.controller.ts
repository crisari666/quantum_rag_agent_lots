import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';

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
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Ingest a document into the RAG vector store' })
  @ApiBody({ type: IngestDocumentDto })
  @ApiResponse({ status: 201, description: 'Document vectorized successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'Ingestion or embedding error.' })
  public async ingestDocument(@Body() dto: IngestDocumentDto) {
    return this.ingestionService.ingestDocument({
      rawText: dto.rawText,
      projectId: dto.projectId,
      docType: dto.docType,
      source: dto.source,
    });
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }
}
