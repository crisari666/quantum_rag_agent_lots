import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsResourceDownloadController } from './projects-resource-download.controller';
import { ProjectsService } from './projects.service';
import { ImageCompressionService } from './services/image-compression.service';
import { ProjectImageStorageService } from './services/project-image-storage.service';
import { ProjectDocumentUploadService } from './services/project-document-upload.service';
import { ProjectLotsModule } from '../project-lots/project-lots.module';
import { OfficeLevelGuard } from '../core/guards/office-level.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    forwardRef(() => ProjectLotsModule),
  ],
  controllers: [ProjectsController, ProjectsResourceDownloadController],
  providers: [
    ProjectsService,
    ImageCompressionService,
    ProjectImageStorageService,
    ProjectDocumentUploadService,
    OfficeLevelGuard,
  ],
  exports: [ProjectsService, ImageCompressionService],
})
export class ProjectsModule {}
