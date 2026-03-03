import {
  Body,
  Controller,
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
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';

@ApiTags('Amenities')
@Controller('amenities')
export class AmenitiesController {
  public constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Create an amenity' })
  @ApiBody({ type: CreateAmenityDto })
  @ApiResponse({ status: 201, description: 'Amenity created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public create(@Body() createAmenityDto: CreateAmenityDto) {
    return this.amenitiesService.create(createAmenityDto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Update an amenity by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the amenity' })
  @ApiBody({ type: UpdateAmenityDto })
  @ApiResponse({ status: 200, description: 'Amenity updated.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public update(
    @Param('id') id: string,
    @Body() updateAmenityDto: UpdateAmenityDto,
  ) {
    return this.amenitiesService.update(id, updateAmenityDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all amenities' })
  @ApiResponse({ status: 200, description: 'List of amenities.' })
  public list() {
    return this.amenitiesService.list();
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get amenity by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the amenity' })
  @ApiResponse({ status: 200, description: 'Amenity found.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  public getById(@Param('id') id: string) {
    return this.amenitiesService.getById(id);
  }
}
