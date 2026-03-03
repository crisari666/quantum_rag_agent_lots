import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseName = configService.get<string>('DB_NAME');
        const databaseUser = configService.get<string>('DB_USER');
        const databasePass = configService.get<string>('DB_PASS');
        const host = configService.get<string>('HOST');
        const databasePort = configService.get<string>('PORT_DB');
        const uri = `mongodb://${databaseUser}:${databasePass}@${host}:${databasePort}/${databaseName}`;
        return { uri };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
