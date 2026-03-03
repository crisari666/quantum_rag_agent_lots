import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const defaultPort = 3000;
  const environmentPort = process.env.PORT_APP;
  const port = environmentPort ? parseInt(environmentPort, 10) : defaultPort;
  await app.listen(port);
}
bootstrap();
