import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./common/config/env";
import { AuthModule } from "./modules/auth/auth.module";
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { HealthModule } from "./modules/health/health.module";
import { MembersModule } from "./modules/members/members.module";
import { RecordsModule } from "./modules/records/records.module";
import { SubmissionsModule } from "./modules/submissions/submissions.module";
import { TracksModule } from "./modules/tracks/tracks.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    PrismaModule,
    BootstrapModule,
    HealthModule,
    AuthModule,
    MembersModule,
    TracksModule,
    SubmissionsModule,
    RecordsModule
  ]
})
export class AppModule {}
