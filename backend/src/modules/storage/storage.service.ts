import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";

interface UploadableFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class StorageService {
  private readonly client: Client;
  private readonly bucketName: string;
  private bucketReadyPromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>("MINIO_BUCKET") ?? "cuka-records";
    this.client = new Client({
      endPoint: this.configService.get<string>("MINIO_ENDPOINT") ?? "localhost",
      port: Number(this.configService.get<string>("MINIO_PORT") ?? 9000),
      useSSL:
        String(this.configService.get<string>("MINIO_USE_SSL") ?? "false").toLowerCase() ===
        "true",
      accessKey: this.configService.get<string>("MINIO_ACCESS_KEY") ?? "cukaadmin",
      secretKey: this.configService.get<string>("MINIO_SECRET_KEY") ?? "change_me"
    });
  }

  async uploadSubmissionAttachment(submissionId: string, file: UploadableFile) {
    await this.ensureBucketReady();

    const fileName = this.sanitizeFileName(file.originalname);
    const objectKey = [
      "submissions",
      submissionId,
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`
    ].join("/");

    await this.client.putObject(this.bucketName, objectKey, file.buffer, file.size, {
      "Content-Type": file.mimetype || "application/octet-stream"
    });

    return {
      bucket: this.bucketName,
      objectKey
    };
  }

  async uploadMemberProfilePhoto(memberId: string, file: UploadableFile) {
    await this.ensureBucketReady();

    const fileName = this.sanitizeFileName(file.originalname);
    const objectKey = [
      "members",
      memberId,
      "profile-photo",
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`
    ].join("/");

    await this.client.putObject(this.bucketName, objectKey, file.buffer, file.size, {
      "Content-Type": file.mimetype || "application/octet-stream"
    });

    return {
      bucket: this.bucketName,
      objectKey
    };
  }

  async getObjectStream(objectKey: string) {
    await this.ensureBucketReady();
    return this.client.getObject(this.bucketName, objectKey);
  }

  async removeObject(objectKey: string) {
    if (!objectKey) {
      return;
    }

    await this.ensureBucketReady();
    await this.client.removeObject(this.bucketName, objectKey).catch(() => undefined);
  }

  private async ensureBucketReady() {
    if (!this.bucketReadyPromise) {
      this.bucketReadyPromise = this.ensureBucketReadyInternal();
    }

    await this.bucketReadyPromise;
  }

  private async ensureBucketReadyInternal() {
    const exists = await this.client.bucketExists(this.bucketName).catch(() => false);

    if (!exists) {
      await this.client.makeBucket(this.bucketName, "us-east-1").catch(() => undefined);
    }
  }

  private sanitizeFileName(fileName: string) {
    const cleaned = fileName
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return cleaned || "attachment";
  }
}
