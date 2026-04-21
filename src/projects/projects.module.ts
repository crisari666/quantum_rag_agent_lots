import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsResourceDownloadController } from './projects-resource-download.controller';
import { ProjectsService } from './projects.service';
import { ImageCompressionService } from './services/image-compression.service';
import { ProjectImageStorageService } from './services/project-image-storage.service';
import { ProjectDocumentUploadService } from './services/project-document-upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
  ],
  controllers: [ProjectsController, ProjectsResourceDownloadController],
  providers: [
    ProjectsService,
    ImageCompressionService,
    ProjectImageStorageService,
    ProjectDocumentUploadService,
  ],
  exports: [ProjectsService, ImageCompressionService],
})
export class ProjectsModule {}
