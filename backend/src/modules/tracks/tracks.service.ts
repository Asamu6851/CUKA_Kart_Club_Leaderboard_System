import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { PrismaService } from "src/prisma/prisma.service";

import type { AuthenticatedRequestUser } from "../auth/auth.types";
import { assertAdminUser } from "../auth/auth.utils";
import { CreateTrackDto } from "./dto/create-track.dto";

@Injectable()
export class TracksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const tracks = await this.prisma.track.findMany({
      where: {
        isEnabled: true
      },
      orderBy: {
        name: "asc"
      }
    });

    return tracks.map((track) => ({
      id: track.id,
      name: track.name,
      location: track.location,
      lengthMeters: track.lengthMeters,
      layout: track.layout,
      note: track.note,
      isEnabled: track.isEnabled,
      createdAt: track.createdAt,
      updatedAt: track.updatedAt
    }));
  }

  async findKartTypes() {
    const kartTypes = await this.prisma.kartType.findMany({
      where: {
        isEnabled: true
      },
      orderBy: {
        sortOrder: "asc"
      }
    });

    return kartTypes.map((kartType) => ({
      id: kartType.id,
      code: kartType.code,
      name: kartType.name,
      sortOrder: kartType.sortOrder,
      isEnabled: kartType.isEnabled
    }));
  }

  async create(payload: CreateTrackDto, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);

    const name = payload.name.trim();
    const location = payload.location?.trim() || null;
    const layout = payload.layout?.trim() || null;
    const note = payload.note?.trim() || null;

    const existingTrack = await this.prisma.track.findFirst({
      where: {
        name,
        isEnabled: true
      }
    });

    if (existingTrack) {
      throw new ConflictException("Track name already exists.");
    }

    const track = await this.prisma.track.create({
      data: {
        name,
        location,
        lengthMeters: payload.lengthMeters ?? null,
        layout,
        note,
        isEnabled: true
      }
    });

    return {
      success: true,
      item: {
        id: track.id,
        name: track.name,
        location: track.location,
        lengthMeters: track.lengthMeters,
        layout: track.layout,
        note: track.note,
        isEnabled: track.isEnabled,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt
      }
    };
  }

  async remove(trackId: string, currentUser: AuthenticatedRequestUser) {
    assertAdminUser(currentUser);

    const track = await this.prisma.track.findUnique({
      where: {
        id: trackId
      }
    });

    if (!track || !track.isEnabled) {
      throw new NotFoundException("Track not found.");
    }

    const updatedTrack = await this.prisma.track.update({
      where: {
        id: track.id
      },
      data: {
        isEnabled: false
      }
    });

    return {
      success: true,
      item: {
        id: updatedTrack.id,
        name: updatedTrack.name,
        isEnabled: updatedTrack.isEnabled
      }
    };
  }
}
