import { Module } from "@nestjs/common";

import { AppModule } from "./app.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";

@Module({
  imports: [AppModule, DatabaseModule, AuthModule],
})
export class RuntimeModule {}
