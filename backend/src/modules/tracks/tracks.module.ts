import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TracksController } from "./tracks.controller";
import { TracksService } from "./tracks.service";

@Module({
  imports: [AuthModule],
  controllers: [TracksController],
  providers: [TracksService]
})
export class TracksModule {}
