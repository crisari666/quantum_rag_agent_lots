import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { TokenJwtMiddleware } from './core/middleware/token-jwt.middleware';
import { RagAgentModule } from './rag-agent/rag-agent.module';
import { AmenitiesModule } from './amenities/amenities.module';
import { ProjectsModule } from './projects/projects.module';
import { AgentChatModule } from './agent-chat/agent-chat.module';
import { ProjectReleaseModule } from './project-release/project-release.module';

@Module({
  imports: [
    CoreModule,
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
    RagAgentModule,
    AmenitiesModule,
    ProjectsModule,
    AgentChatModule,
    ProjectReleaseModule,
  ],
  controllers: [AppController],
  providers: [AppService, TokenJwtMiddleware],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TokenJwtMiddleware).forRoutes('*');
  }
}
