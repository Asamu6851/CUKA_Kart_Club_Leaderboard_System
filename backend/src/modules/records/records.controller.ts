import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { CreateRecordDto } from "./dto/create-record.dto";
import { UpdateRecordDto } from "./dto/update-record.dto";
import { RecordsService } from "./records.service";

@Controller("records")
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async listRecords(
    @Query("trackId") trackId?: string,
    @Query("kartTypeId") kartTypeId?: string
  ) {
    return {
      items: await this.recordsService.findAll({
        trackId,
        kartTypeId
      })
    };
  }

  @Get("leaderboard")
  async leaderboard(
    @Query("trackId") trackId?: string,
    @Query("kartTypeId") kartTypeId?: string
  ) {
    const groups = await this.recordsService.leaderboard({
      trackId,
      kartTypeId
    });

    return {
      items: groups,
      groups
    };
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  createRecord(
    @Body() payload: CreateRecordDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.recordsService.create(payload, currentUser);
  }

  @Patch(":recordId")
  @UseGuards(AccessTokenGuard)
  updateRecord(
    @Param("recordId") recordId: string,
    @Body() payload: UpdateRecordDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.recordsService.update(recordId, payload, currentUser);
  }

  @Delete(":recordId")
  @UseGuards(AccessTokenGuard)
  deleteRecord(
    @Param("recordId") recordId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.recordsService.remove(recordId, currentUser);
  }
}
