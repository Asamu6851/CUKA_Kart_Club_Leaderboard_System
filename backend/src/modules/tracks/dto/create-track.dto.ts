import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class CreateTrackDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  lengthMeters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  layout?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
