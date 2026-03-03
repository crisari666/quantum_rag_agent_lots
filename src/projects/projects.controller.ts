import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  public constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create a project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update a project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all non-deleted projects' })
  @ApiResponse({ status: 200, description: 'List of projects.' })
  public list() {
    return this.projectsService.list();
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project found.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public getById(@Param('id') id: string) {
    return this.projectsService.getById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project soft-deleted.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
