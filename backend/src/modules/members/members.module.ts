import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MembersController],
  providers: [MembersService]
})
export class MembersModule {}
