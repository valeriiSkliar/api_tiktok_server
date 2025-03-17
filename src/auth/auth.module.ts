/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

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
      useFactory: (configService: ConfigService) => {
        return new AuthService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
