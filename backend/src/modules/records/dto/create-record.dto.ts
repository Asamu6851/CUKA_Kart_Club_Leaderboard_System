import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class CreateRecordDto {
  @IsString()
  memberId!: string;

  @IsString()
  trackId!: string;

  @IsString()
  kartTypeId!: string;

  @IsString()
  @MaxLength(20)
  lapTimeText!: string;

  @IsDateString()
  raceDate!: string;

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
