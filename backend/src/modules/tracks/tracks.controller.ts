import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";

import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { CreateTrackDto } from "./dto/create-track.dto";
import { TracksService } from "./tracks.service";

@Controller("tracks")
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  async listTracks() {
    return {
      items: await this.tracksService.findAll()
    };
  }

  @Get("kart-types")
  async listKartTypes() {
    return {
      items: await this.tracksService.findKartTypes()
    };
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  createTrack(
    @Body() payload: CreateTrackDto,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.tracksService.create(payload, currentUser);
  }

  @Delete(":trackId")
  @UseGuards(AccessTokenGuard)
  deleteTrack(
    @Param("trackId") trackId: string,
    @CurrentUser() currentUser: AuthenticatedRequestUser
  ) {
    return this.tracksService.remove(trackId, currentUser);
  }
}
