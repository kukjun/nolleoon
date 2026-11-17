export const avatarMigration={version:11,name:'private-avatar-profiles',sql:`
CREATE TABLE avatar_profiles (
 session_id TEXT PRIMARY KEY NOT NULL REFERENCES sessions(id),
 preset_id TEXT CHECK(preset_id IN ('preset-01','preset-02','preset-03','preset-04','preset-05','preset-06','preset-07','preset-08','preset-09','preset-10')),
 revision INTEGER NOT NULL CHECK(revision>0), image_bytes BLOB,
 CHECK ((preset_id IS NOT NULL AND image_bytes IS NULL) OR (preset_id IS NULL AND image_bytes IS NOT NULL AND length(image_bytes) BETWEEN 1 AND 65536))
) STRICT;
`};
