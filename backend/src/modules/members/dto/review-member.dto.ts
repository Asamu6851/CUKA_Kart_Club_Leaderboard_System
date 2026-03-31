import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reviewNote?: string;
}
