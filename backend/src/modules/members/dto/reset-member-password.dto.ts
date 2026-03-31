import { IsString, Length } from "class-validator";

export class ResetMemberPasswordDto {
  @IsString()
  @Length(6, 64, {
    message: "密码长度需要在 6 到 64 个字符之间。"
  })
  password!: string;
}
