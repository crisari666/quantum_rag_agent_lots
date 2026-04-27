import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectAmenityGroup } from '../types/project-amenity-group.type';
import { ProjectLotOption } from '../types/project-lot-option.type';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, trim: true })
  title: string;

  /** URL-friendly unique identifier among non-deleted projects (optional). */
  @Prop({ trim: true, lowercase: true, unique: true, sparse: true })
  slug?: string;

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

  /** Primary list / contract sale amount in Colombian pesos (COP). */
  @Prop({ required: true })
  priceSell: number;

  /**
   * Optional parallel list price in US dollars for marketing or export buyers.
   * Independent of `priceSell` (COP); commission stays COP-based unless product changes.
   */
  @Prop({ default: 0 })
  priceSellUsd: number;

  /**
   * Separation measure for the development (e.g. meters between lots); product-defined unit.
   */
  @Prop({ default: 0 })
  separation: number;

  /**
   * Available lot variants: area, COP sale `price`, optional `priceUsd` reference.
   */
  @Prop({
    type: [
      {
        _id: false,
        area: {
          type: Number,
          required: true,
          comment: 'Lot size (e.g. m²); unit is product-defined.',
        },
        price: {
          type: Number,
          required: true,
          comment: 'Sale amount in COP (same basis as project priceSell).',
        },
        priceUsd: {
          type: Number,
          default: 0,
          comment: 'Optional reference amount in USD for this lot option.',
        },
      },
    ],
    default: [],
  })
  lotOptions: ProjectLotOption[];

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ required: true })
  commissionPercentage: number;

  /** Commission amount in COP (derived from `priceSell` and `commissionPercentage`). */
  @Prop({ required: true })
  commissionValue: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Amenity' }], default: [] })
  amenities: Types.ObjectId[];

  /**
   * Grouped amenity labels for marketing UI (independent of `amenities` ObjectId refs).
   */
  @Prop({
    type: [
      {
        _id: false,
        icon: { type: String, required: true },
        title: { type: String, required: true },
        amenities: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  amenitiesGroups: ProjectAmenityGroup[];

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
