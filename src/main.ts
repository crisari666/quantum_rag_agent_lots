import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

const UPLOADS_STATIC_PATH = 'uploads';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), UPLOADS_STATIC_PATH), {
    prefix: `/${UPLOADS_STATIC_PATH}/`,
  });
  const config = new DocumentBuilder()
    .setTitle('Omega RAG API')
    .setDescription('API for the RAG Agent and parcelization projects')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.setGlobalPrefix('rest');

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
