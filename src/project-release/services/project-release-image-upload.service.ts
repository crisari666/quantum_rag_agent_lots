import { BadRequestException, Injectable } from '@nestjs/common';
import { ImageCompressionService } from '../../projects/services/image-compression.service';
import {
  ProjectReleaseResponse,
  ProjectReleaseService,
} from '../project-release.service';
import { ProjectReleaseImageStorageService } from './project-release-image-storage.service';

@Injectable()
export class ProjectReleaseImageUploadService {
  public constructor(
    private readonly imageCompressionService: ImageCompressionService,
    private readonly projectReleaseImageStorageService: ProjectReleaseImageStorageService,
    private readonly projectReleaseService: ProjectReleaseService,
  ) {}

  public async uploadImage(
    releaseId: string,
    file: Express.Multer.File,
  ): Promise<{
    message: string;
    imageName: string;
    release: ProjectReleaseResponse;
  }> {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const release = await this.projectReleaseService.getDocumentById(releaseId);
    const { buffer, format } = await this.imageCompressionService.compress(
      file.buffer,
    );
    const fileName = this.projectReleaseImageStorageService.buildImageFileName(
      release.title,
      format,
    );
    await this.projectReleaseImageStorageService.saveFile(buffer, fileName);
    const updated = await this.projectReleaseService.addImage(releaseId, fileName);
    return {
      message: 'Image uploaded successfully',
      imageName: fileName,
      release: updated,
    };
  }
}
