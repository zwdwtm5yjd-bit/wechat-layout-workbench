import { SetMetadata } from "@nestjs/common";

export const rawResponseMetadataKey = "api:raw-response";

export const RawResponse = () => SetMetadata(rawResponseMetadataKey, true);
