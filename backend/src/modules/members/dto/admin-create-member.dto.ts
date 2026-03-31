import { IsString, Length, Matches } from "class-validator";

export class AdminCreateMemberDto {
  @IsString()
  @Length(3, 32, {
    message: "用户名长度需要在 3 到 32 个字符之间。"
  })
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: "用户名只允许使用字母、数字、下划线、点号和短横线。"
  })
  username!: string;

  @IsString()
  @Length(2, 32, {
    message: "群昵称长度需要在 2 到 32 个字符之间。"
  })
  nickname!: string;

  @IsString()
  @Length(6, 64, {
    message: "密码长度需要在 6 到 64 个字符之间。"
  })
  password!: string;
}
