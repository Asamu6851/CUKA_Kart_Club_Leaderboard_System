import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
  const port = Number(process.env.PORT || 3000);

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: corsOrigin.split(",").map((item) => item.trim()),
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );

  await app.listen(port, "0.0.0.0");
}

bootstrap();
