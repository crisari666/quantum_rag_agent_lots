import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectDocument } from '../schemas/project.schema';
import { ProjectsService } from '../projects.service';
import { ProjectImageStorageService } from './project-image-storage.service';
import { ImageCompressionService } from './image-compression.service';
import { UploadProjectDocumentParams } from '../types/upload-project-document-params.type';

type UploadProjectDocumentResult = {
  message: string;
  fileName: string;
  project: ProjectDocument;
};

/**
 * Handles project document uploads and optional compression.
 */
@Injectable()
export class ProjectDocumentUploadService {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectImageStorageService: ProjectImageStorageService,
    private readonly imageCompressionService: ImageCompressionService,
  ) {}

  /**
   * Uploads a project document and updates the corresponding project field.
   * Image-based documents are compressed to reduce file size.
   */
  public async uploadDocument(
    params: UploadProjectDocumentParams,
  ): Promise<UploadProjectDocumentResult> {
    const { projectId, file, field, fileType } = params;
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const project = await this.projectsService.getById(projectId);
    const compressedPayload = await this.compressDocumentIfSupported(file);
    const fileName = this.projectImageStorageService.buildDocumentFileName(
      fileType,
      project.title,
      compressedPayload.extension,
    );
    await this.projectImageStorageService.saveFile(compressedPayload.buffer, fileName);
    const { project: updatedProject, previousFileName } =
      await this.projectsService.setDocumentFile(projectId, field, fileName);
    if (previousFileName && previousFileName !== fileName) {
      await this.projectImageStorageService.deleteFile(previousFileName);
    }
    return {
      message: 'Document uploaded successfully',
      fileName,
      project: updatedProject,
    };
  }

  private async compressDocumentIfSupported(file: Express.Multer.File): Promise<{
    buffer: Buffer;
    extension: string;
  }> {
    const isImageFile = file.mimetype.startsWith('image/');
    if (isImageFile) {
      const compressedImage = await this.imageCompressionService.compress(file.buffer);
      return {
        buffer: compressedImage.buffer,
        extension: compressedImage.format,
      };
    }
    const extension = this.resolveFileExtension(file.originalname);
    return { buffer: file.buffer, extension };
  }

  private resolveFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts[parts.length - 1].trim().toLowerCase() : '';
    if (!extension) {
      throw new BadRequestException('Uploaded file must include an extension');
    }
    return extension;
  }
}
