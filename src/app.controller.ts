import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health / welcome' })
  @ApiResponse({ status: 200, description: 'Returns a welcome message.' })
  public getHello(): string {
    return this.appService.getHello();
  }
}
