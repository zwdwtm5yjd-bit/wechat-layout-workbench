import { Module } from "@nestjs/common";

import { AppModule } from "./app.module.js";
import { DatabaseModule } from "./database/database.module.js";

@Module({
  imports: [AppModule, DatabaseModule],
})
export class RuntimeModule {}
