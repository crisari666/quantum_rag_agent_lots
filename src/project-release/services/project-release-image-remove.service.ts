import { Injectable } from '@nestjs/common';
import {
  ProjectReleaseResponse,
  ProjectReleaseService,
} from '../project-release.service';

@Injectable()
export class ProjectReleaseImageRemoveService {
  public constructor(
    private readonly projectReleaseService: ProjectReleaseService,
  ) {}

  public async removeImage(
    releaseId: string,
    imageName: string,
  ): Promise<{
    message: string;
    imageName: string;
    release: ProjectReleaseResponse;
  }> {
    const release = await this.projectReleaseService.removeImage(
      releaseId,
      imageName,
    );
    return {
      message: 'Image removed successfully',
      imageName,
      release,
    };
  }
}
