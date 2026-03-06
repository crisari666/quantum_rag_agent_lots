import {
  Body,
  Controller,
  Get,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';

@ApiTags('RAG Ingestion')
@Controller('rag')
export class IngestionController {
  public constructor(private readonly ingestionService: IngestionService) {}

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
