import assert from 'node:assert/strict';
import {migrate,migrations} from '../../apps/api/dist/infrastructure/sqlite/index.js';
export const legacyCompleteTables=['schema_migrations','sessions','rooms','room_members','drafts','penalty_consents','games','game_participants','rounds','votes','start_receipts','defenses','vote_open_receipts','round_settlements','game_interruptions','room_closures','next_preparation_receipts'];
export function seedLegacyComplete(db){
 migrate(db,migrations.slice(0,9));
 for(let i=1;i<=3;i++)db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(`s${i}`,`synthetic-hash-${i}`,0,99999999);
 for(const [id,status] of [['r-open','open'],['r-closed','closed']]){
  db.prepare('INSERT INTO rooms(id,invite_code,status,version,created_at,role_revision,penalty_revision) VALUES (?,?,?,?,?,?,?)').run(id,`synthetic-${id}`,status,8,100,0,2);
  for(let i=1;i<=3;i++)db.prepare('INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at,last_seen_at,role) VALUES (?,?,?,?,?,?,?,?)').run(`${id}-m${i}`,id,`s${i}`,`합성 친구 ${i}`,`합성 친구 ${i}`,100,5000,i===1?'defendant':'participant');
  if(status==='open')db.prepare('UPDATE rooms SET host_member_id=? WHERE id=?').run(`${id}-m1`,id);
  db.prepare('INSERT INTO drafts VALUES (?,?,?,?,?)').run(id,'합성 사건 🎲\n둘째 줄',"커피 '한 잔'",180,2);
  db.prepare('INSERT INTO penalty_consents VALUES (?,?,?,?,?,?)').run(id,`${id}-m1`,0,2,'accepted',1);
 }
 for(const [id,room,status,at] of [['g-result','r-open','result',200],['g-active','r-open','voting',2000],['g-interrupted','r-closed','interrupted',3000]]){
  db.prepare('INSERT INTO games VALUES (?,?,?,?,?,?,?,?)').run(id,room,status,`합성 ${id} 사건`,"벌칙: 커피 ☕",180,4,at);
  for(let i=1;i<=3;i++)db.prepare('INSERT INTO game_participants VALUES (?,?,?,?,?)').run(id,room,`${room}-m${i}`,i===1?'defendant':'participant',i===1?0:1);
  db.prepare('INSERT INTO start_receipts VALUES (?,?,?,?,?)').run(room,`${id}-start`,'s1',`synthetic-intent-${id}`,id);
  const count=id==='g-result'?2:1;
  for(let round=1;round<=count;round++){
   const start=at+round*100,closed=id==='g-active'?null:start+90;
   db.prepare('INSERT INTO rounds VALUES (?,?,?,?,?)').run(id,round,start,start+180000,closed);
   db.prepare('INSERT INTO defenses VALUES (?,?,?,?,?)').run(id,round,`${room}-m1`,'submitted',`합성 변론 ${round} 🦊\n줄바꿈`);
   db.prepare('INSERT INTO vote_open_receipts VALUES (?,?,?,?,?)').run(id,`${id}-open-${round}`,'s1',round,round);
   if(id!=='g-interrupted'){
    const voters=id==='g-active'?[2]:[2,3];
    for(const n of voters)db.prepare('INSERT INTO votes VALUES (?,?,?,?,?,?,?)').run(id,round,`${room}-m${n}`,id==='g-active'?'abstain':round===1&&n===3?'not-guilty':'guilty',`합성 이유 ${n}: "증거" 🎲`,`${id}-vote-${round}-${n}`,start+10);
    if(id==='g-result')db.prepare('INSERT INTO round_settlements VALUES (?,?,?,?,?,?,?,?,?)').run(id,round,round===1?'tie':'guilty',round===1?1:2,round===1?1:0,0,2,closed,'all-submitted');
   }
  }
 }
 db.prepare('UPDATE room_members SET disconnected_at=3200,left_at=3290 WHERE id=?').run('r-closed-m3');
 db.prepare('INSERT INTO game_interruptions VALUES (?,?,?)').run('g-interrupted','room-closed',3290);
 db.prepare('INSERT INTO room_closures VALUES (?,?,?)').run('r-closed',3290,'r-closed-m1');
 db.prepare('INSERT INTO next_preparation_receipts VALUES (?,?,?,?,?,?)').run('r-open','synthetic-next','s1','g-result',0,1);
 db.prepare('UPDATE rooms SET preparation_version=1,prepared_after_game_id=? WHERE id=?').run('g-result','r-open');
}
export function snapshotLegacyComplete(db){return Object.fromEntries(legacyCompleteTables.map(table=>[table,db.prepare(`SELECT * FROM ${table}${table==='schema_migrations'?' WHERE version<=9':''} ORDER BY rowid`).all()]));}
export function assertLegacyComplete(snapshot){assert.deepEqual(Object.keys(snapshot).sort(),[...legacyCompleteTables].sort());for(const table of legacyCompleteTables)assert.ok(snapshot[table].length>0,`${table} must contain representative rows`);}
export function canonicalLegacyBytes(snapshot){return Buffer.from(JSON.stringify(snapshot),'utf8');}
