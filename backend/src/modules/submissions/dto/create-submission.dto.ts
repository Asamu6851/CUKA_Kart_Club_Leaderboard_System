import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class CreateSubmissionDto {
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
  finalRanking?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kartNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  weather?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
