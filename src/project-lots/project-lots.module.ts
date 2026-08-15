import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectLotsController } from './project-lots.controller';
import { ProjectLotsService } from './project-lots.service';
import {
  ProjectLot,
  ProjectLotSchema,
} from './schemas/project-lot.schema';
import { ProjectLotExcelParserService } from './services/project-lot-excel-parser.service';
import { ProjectLotKmlParserService } from './services/project-lot-kml-parser.service';
import { ProjectLotMapService } from './services/project-lot-map.service';
import { OfficeLevelGuard } from '../core/guards/office-level.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectLot.name, schema: ProjectLotSchema },
    ]),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [ProjectLotsController],
  providers: [
    ProjectLotsService,
    ProjectLotExcelParserService,
    ProjectLotKmlParserService,
    ProjectLotMapService,
    OfficeLevelGuard,
  ],
  exports: [ProjectLotsService, ProjectLotMapService],
})
export class ProjectLotsModule {}
