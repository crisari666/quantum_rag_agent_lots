import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AmenityDocument = Amenity & Document;

@Schema({ timestamps: true, collection: 'amenities' })
export class Amenity {
  @Prop({ required: true, trim: true })
  title: string;
}

export const AmenitySchema = SchemaFactory.createForClass(Amenity);
