import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class UpdateRecordDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  kartTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lapTimeText?: string;

  @IsOptional()
  @IsDateString()
  raceDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  finalRanking?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kartNo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  weather?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
