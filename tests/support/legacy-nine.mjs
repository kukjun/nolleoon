import {migrate} from '../../apps/api/dist/infrastructure/sqlite/index.js';
import {migrations} from '../../apps/api/dist/infrastructure/sqlite/migrations.js';
export function seedLegacyNine(db){
 migrate(db,migrations.slice(0,9));
 db.exec(`INSERT INTO sessions VALUES ('legacy-session','synthetic-token-hash',0,9999999);
 INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES ('legacy-room','synthetic-invite','open',1,0);
 INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at,last_seen_at,role) VALUES ('legacy-member','legacy-room','legacy-session','합성 방장','합성 방장',0,1000,'defendant');
 UPDATE rooms SET host_member_id='legacy-member' WHERE id='legacy-room';
 INSERT INTO drafts VALUES ('legacy-room','합성 진행 사건','합성 벌칙',180,3);
 INSERT INTO penalty_consents VALUES ('legacy-room','legacy-member',0,0,'accepted',1);
 INSERT INTO games VALUES ('legacy-complete','legacy-room','result','합성 완료 사건','합성 이전 벌칙',180,2,100);
 INSERT INTO game_participants VALUES ('legacy-complete','legacy-room','legacy-member','defendant',0);
 INSERT INTO rounds VALUES ('legacy-complete',1,100,180100,180100);
 INSERT INTO round_settlements VALUES ('legacy-complete',1,'no-verdict',0,0,0,0,180100,'deadline');
 INSERT INTO games VALUES ('legacy-active','legacy-room','voting','합성 진행 사건','합성 벌칙',180,2,1000);
 INSERT INTO game_participants VALUES ('legacy-active','legacy-room','legacy-member','defendant',0);
 INSERT INTO rounds VALUES ('legacy-active',1,1000,181000,NULL);
 `);
}
export function legacyRows(db){return Object.fromEntries(['sessions','rooms','room_members','drafts','penalty_consents','games','game_participants','rounds','round_settlements'].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));}
