import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "cuka-backend",
      time: new Date().toISOString()
    };
  }
}
