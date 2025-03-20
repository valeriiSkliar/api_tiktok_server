/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaClient } from '@prisma/client';

// Define the configuration options separately to avoid type issues
const configModuleOptions = {
  isGlobal: true,
  cache: true,
  envFilePath: ['.env'],
  expandVariables: true,
};

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ConfigModule.forRoot(configModuleOptions),
  ],
  providers: [
    {
      provide: AuthService,
      useFactory: (configService: ConfigService, prisma: PrismaClient) => {
        return new AuthService(configService, prisma);
      },
      inject: [ConfigService, PrismaClient],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
