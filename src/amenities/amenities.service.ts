import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Amenity, AmenityDocument } from './schemas/amenity.schema';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';

/**
 * Service responsible for amenity persistence and business logic.
 */
@Injectable()
export class AmenitiesService {
  public constructor(
    @InjectModel(Amenity.name) private readonly amenityModel: Model<AmenityDocument>,
  ) {}

  public async create(createAmenityDto: CreateAmenityDto): Promise<AmenityDocument> {
    const amenity = new this.amenityModel(createAmenityDto);
    return amenity.save();
  }

  public async update(
    id: string,
    updateAmenityDto: UpdateAmenityDto,
  ): Promise<AmenityDocument> {
    const amenity = await this.amenityModel
      .findByIdAndUpdate(id, updateAmenityDto, { new: true })
      .exec();
    if (!amenity) {
      throw new NotFoundException(`Amenity with id ${id} not found`);
    }
    return amenity;
  }

  public async list(): Promise<AmenityDocument[]> {
    return this.amenityModel.find().sort({ title: 1 }).exec();
  }

  public async getById(id: string): Promise<AmenityDocument> {
    const amenity = await this.amenityModel.findById(id).exec();
    if (!amenity) {
      throw new NotFoundException(`Amenity with id ${id} not found`);
    }
    return amenity;
  }
}
