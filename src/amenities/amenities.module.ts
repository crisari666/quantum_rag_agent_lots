import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Amenity, AmenitySchema } from './schemas/amenity.schema';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Amenity.name, schema: AmenitySchema }]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
