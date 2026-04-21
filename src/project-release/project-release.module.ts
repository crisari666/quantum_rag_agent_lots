import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from '../projects/projects.module';
import {
  ProjectRelease,
  ProjectReleaseSchema,
} from './schemas/project-release.schema';
import { ProjectReleaseController } from './project-release.controller';
import { ProjectReleaseService } from './project-release.service';
import { ProjectReleaseImageStorageService } from './services/project-release-image-storage.service';
import { ProjectReleaseImageUploadService } from './services/project-release-image-upload.service';
import { ProjectReleaseImageRemoveService } from './services/project-release-image-remove.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectRelease.name, schema: ProjectReleaseSchema },
    ]),
    ProjectsModule,
  ],
  controllers: [ProjectReleaseController],
  providers: [
    ProjectReleaseService,
    ProjectReleaseImageStorageService,
    ProjectReleaseImageUploadService,
    ProjectReleaseImageRemoveService,
  ],
  exports: [ProjectReleaseService],
})
export class ProjectReleaseModule {}
