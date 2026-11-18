import type {Migration} from './migrations.js';
export const accountAvatarMigration:Migration={version:14,name:'separate-account-avatars',sql:`
CREATE TABLE account_avatars(account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),preset_id TEXT CHECK(preset_id IN ('preset-01','preset-02','preset-03','preset-04','preset-05','preset-06','preset-07','preset-08','preset-09','preset-10')),revision INTEGER NOT NULL CHECK(revision>=1),image_bytes BLOB,CHECK((preset_id IS NOT NULL AND image_bytes IS NULL) OR (preset_id IS NULL AND length(image_bytes) BETWEEN 1 AND 65536 AND image_bytes IS NOT NULL))) STRICT;
`};
