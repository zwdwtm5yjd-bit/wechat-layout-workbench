import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ACCOUNT_REPOSITORY } from "./account.constants.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";
import { PostgresAccountRepository } from "./postgres-account.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AccountController],
  providers: [
    AccountService,
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: PostgresAccountRepository,
    },
  ],
  exports: [AccountService],
})
export class AccountModule {}
