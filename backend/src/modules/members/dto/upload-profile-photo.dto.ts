import { IsIn, IsString } from "class-validator";

export class UploadProfilePhotoDto {
  @IsString()
  @IsIn(["AVATAR", "PORTRAIT"])
  displayType!: "AVATAR" | "PORTRAIT";
}
