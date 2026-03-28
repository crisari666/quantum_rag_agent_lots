import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectLotOption } from '../types/project-lot-option.type';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, trim: true })
  location: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ trim: true, default: '' })
  city: string;

  @Prop({ trim: true, default: '' })
  state: string;

  @Prop({ trim: true, default: '' })
  country: string;

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  @Prop({ required: true })
  priceSell: number;

  /**
   * Separation measure for the development (e.g. meters between lots); product-defined unit.
   */
  @Prop({ default: 0 })
  separation: number;

  /**
   * Available lot variants: area and price per option.
   */
  @Prop({
    type: [
      {
        _id: false,
        area: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    default: [],
  })
  lotOptions: ProjectLotOption[];

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ required: true })
  commissionPercentage: number;

  @Prop({ required: true })
  commissionValue: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Amenity' }], default: [] })
  amenities: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  images: string[];

  /** Single image filename for project card display in listings. */
  @Prop({ trim: true, default: '' })
  cardProject: string;

  /** Landscape-oriented image filenames for gallery or banners. */
  @Prop({ type: [String], default: [] })
  horizontalImages: string[];

  /** Portrait-oriented video filenames. */
  @Prop({ type: [String], default: [] })
  verticalVideos: string[];

  @Prop({ trim: true, default: '' })
  reelVideo: string;

  @Prop({ trim: true, default: '' })
  plane: string;

  @Prop({ trim: true, default: '' })
  brochure: string;

}

export const ProjectSchema = SchemaFactory.createForClass(Project);
