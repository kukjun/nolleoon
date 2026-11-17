import type {Migration} from './migrations.js';
export const partyMigration: Migration = {version:10,name:'party-game-runs',sql:`
CREATE TABLE party_selections (
 room_id TEXT PRIMARY KEY NOT NULL REFERENCES rooms(id), type TEXT NOT NULL CHECK(type IN ('trial','team','draw')),
 version INTEGER NOT NULL CHECK(version>=0), team_count INTEGER NOT NULL CHECK(team_count>=2),
 winner_count INTEGER NOT NULL CHECK(winner_count>=1), penalty_text TEXT NOT NULL, prepared_after_run_id TEXT
) STRICT;
INSERT INTO party_selections SELECT id,'trial',0,2,1,'',prepared_after_game_id FROM rooms;
CREATE TRIGGER party_room_selection AFTER INSERT ON rooms BEGIN
 INSERT INTO party_selections VALUES (NEW.id,'trial',0,2,1,'',NULL);
END;
CREATE TABLE game_runs (
 id TEXT PRIMARY KEY NOT NULL,room_id TEXT NOT NULL REFERENCES rooms(id),
 type TEXT NOT NULL CHECK(type IN ('trial','team','draw')),
 status TEXT NOT NULL CHECK(status IN ('active','completed','interrupted')),
 version INTEGER NOT NULL CHECK(version>=0),settings_json TEXT NOT NULL CHECK(json_valid(settings_json)),
 created_at INTEGER NOT NULL CHECK(created_at>=0),UNIQUE(id,room_id)
) STRICT;
CREATE UNIQUE INDEX one_active_party_run ON game_runs(room_id) WHERE status='active';
CREATE TABLE run_participants (
 run_id TEXT NOT NULL,room_id TEXT NOT NULL,member_id TEXT NOT NULL,nickname TEXT NOT NULL,
 eligible INTEGER NOT NULL CHECK(eligible IN (0,1)),PRIMARY KEY(run_id,member_id),
 FOREIGN KEY(run_id,room_id) REFERENCES game_runs(id,room_id),FOREIGN KEY(room_id,member_id) REFERENCES room_members(room_id,id)
) STRICT;
CREATE TABLE run_allocations (
 run_id TEXT NOT NULL,member_id TEXT NOT NULL,team INTEGER,winning INTEGER,
 CHECK((team IS NOT NULL AND team>=1 AND winning IS NULL) OR (team IS NULL AND winning IN (0,1))),
 PRIMARY KEY(run_id,member_id),FOREIGN KEY(run_id,member_id) REFERENCES run_participants(run_id,member_id)
) STRICT;
CREATE TABLE run_reveals (
 run_id TEXT NOT NULL,member_id TEXT NOT NULL,revealed_at INTEGER NOT NULL CHECK(revealed_at>=0),
 PRIMARY KEY(run_id,member_id),FOREIGN KEY(run_id,member_id) REFERENCES run_allocations(run_id,member_id)
) STRICT;
CREATE TABLE party_receipts (
 room_id TEXT NOT NULL REFERENCES rooms(id),request_id TEXT NOT NULL,actor_session_id TEXT NOT NULL REFERENCES sessions(id),
 action TEXT NOT NULL CHECK(action IN ('start','next','reveal')),intent TEXT NOT NULL,run_id TEXT NOT NULL REFERENCES game_runs(id),
 PRIMARY KEY(room_id,request_id)
) STRICT;
INSERT INTO game_runs SELECT id,room_id,'trial',CASE WHEN status='result' THEN 'completed' WHEN status='interrupted' THEN 'interrupted' ELSE 'active' END,version,'{}',created_at FROM games;
INSERT INTO run_participants SELECT p.game_id,p.room_id,p.member_id,m.nickname,p.eligible FROM game_participants p JOIN room_members m ON m.id=p.member_id;
CREATE TRIGGER trial_party_selection_guard BEFORE INSERT ON games WHEN (SELECT type FROM party_selections WHERE room_id=NEW.room_id)!='trial' BEGIN SELECT RAISE(ABORT,'party selection conflict'); END;
CREATE TRIGGER trial_run_insert AFTER INSERT ON games BEGIN
 INSERT INTO game_runs VALUES (NEW.id,NEW.room_id,'trial',CASE WHEN NEW.status='result' THEN 'completed' WHEN NEW.status='interrupted' THEN 'interrupted' ELSE 'active' END,NEW.version,'{}',NEW.created_at);
END;
CREATE TRIGGER trial_run_update AFTER UPDATE ON games BEGIN
 UPDATE game_runs SET status=CASE WHEN NEW.status='result' THEN 'completed' WHEN NEW.status='interrupted' THEN 'interrupted' ELSE 'active' END,version=NEW.version WHERE id=NEW.id;
END;
CREATE TRIGGER trial_run_participant AFTER INSERT ON game_participants BEGIN
 INSERT INTO run_participants SELECT NEW.game_id,NEW.room_id,NEW.member_id,nickname,NEW.eligible FROM room_members WHERE id=NEW.member_id;
END;
CREATE TRIGGER trial_next_preparation AFTER UPDATE OF preparation_version ON rooms WHEN NEW.prepared_after_game_id IS NOT OLD.prepared_after_game_id BEGIN
 UPDATE party_selections SET version=version+1,prepared_after_run_id=NEW.prepared_after_game_id WHERE room_id=NEW.id;
END;
CREATE TRIGGER party_close_pending AFTER UPDATE OF status ON rooms WHEN NEW.status='closed' BEGIN
 UPDATE game_runs SET status='interrupted',version=version+1 WHERE room_id=NEW.id AND type='draw' AND status='active';
END;
CREATE TRIGGER run_settings_immutable BEFORE UPDATE OF id,room_id,type,settings_json,created_at ON game_runs BEGIN SELECT RAISE(ABORT,'immutable run'); END;
CREATE TRIGGER run_participants_immutable BEFORE UPDATE ON run_participants BEGIN SELECT RAISE(ABORT,'immutable participant'); END;
CREATE TRIGGER run_allocations_immutable BEFORE UPDATE ON run_allocations BEGIN SELECT RAISE(ABORT,'immutable allocation'); END;
CREATE TRIGGER run_allocations_no_delete BEFORE DELETE ON run_allocations BEGIN SELECT RAISE(ABORT,'immutable allocation'); END;
CREATE TRIGGER run_reveals_immutable BEFORE UPDATE ON run_reveals BEGIN SELECT RAISE(ABORT,'immutable reveal'); END;
CREATE TRIGGER run_reveals_no_delete BEFORE DELETE ON run_reveals BEGIN SELECT RAISE(ABORT,'immutable reveal'); END;
CREATE TRIGGER party_receipts_immutable BEFORE UPDATE ON party_receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
CREATE TRIGGER party_receipts_no_delete BEFORE DELETE ON party_receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
`};
