import { mkdirSync } from 'fs';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  MAX_UPLOAD_SIZE_BYTES,
  UPLOADS_STATIC_URL_PREFIX,
} from './config/upload-bucket.constants';
import { resolveUploadsBucketAbsolutePath } from './config/upload-bucket.resolver';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadsBucketAbsolutePath = resolveUploadsBucketAbsolutePath();
  mkdirSync(uploadsBucketAbsolutePath, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(json({ limit: MAX_UPLOAD_SIZE_BYTES }));
  app.use(urlencoded({ extended: true, limit: MAX_UPLOAD_SIZE_BYTES }));
  app.useStaticAssets(uploadsBucketAbsolutePath, {
    prefix: UPLOADS_STATIC_URL_PREFIX,
  });
  const config = new DocumentBuilder()
    .setTitle('Omega RAG API')
    .setDescription('API for the RAG Agent and parcelization projects')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.setGlobalPrefix('rag');
  
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    //mak allowedHeaders: ['Content-Type', 'Authorization'],
    //credentials: true,
  });
  const defaultPort = 3000;
  const environmentPort = process.env.PORT_APP;
  const port = environmentPort ? parseInt(environmentPort, 10) : defaultPort;
  await app.listen(port);
}
bootstrap();
