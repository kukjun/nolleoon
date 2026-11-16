import assert from 'node:assert/strict';
import {resolve,dirname,basename} from 'node:path';
import {realpathSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';

// 이 프로그램은 mutation-check의 임시 복사본과 임시 DB 안에서만 실행된다.
const [copy,scenario]=process.argv.slice(2);
if(!copy||!scenario)throw new Error('격리 복사본과 시나리오가 필요합니다.');
const ownedRoot=dirname(realpathSync(copy));
if(dirname(ownedRoot)!==realpathSync(tmpdir())||!basename(ownedRoot).startsWith('trip-security-mutations-')||existsSync(resolve(copy,'fixture.sqlite')))throw new Error('새로 만든 소유 임시 폴더에서만 실행할 수 있습니다.');
const moduleAt=relative=>import(pathToFileURL(resolve(copy,'dist',relative)).href);
const {openSqlite,migrate,SqliteUnitOfWork}=await moduleAt('infrastructure/sqlite/index.js');
const {SubmitVote}=await moduleAt('application/submit-vote.js');
const {Rooms}=await moduleAt('application/rooms.js');
const {PersonalHistory}=await moduleAt('application/personal-history.js');
const db=openSqlite(resolve(copy,'fixture.sqlite'));
try {
 migrate(db);
 db.exec(`
  INSERT INTO sessions(id,token_hash,created_at,expires_at) VALUES
   ('s0','synthetic-hash-0',1000,999999),('s1','synthetic-hash-1',1000,999999),
   ('s2','synthetic-hash-2',1000,999999),('s3','synthetic-hash-3',1000,999999);
  INSERT INTO rooms(id,invite_code,status,version,created_at) VALUES ('room','${'a'.repeat(43)}','open',0,1000);
  INSERT INTO room_members(id,room_id,session_id,nickname,nickname_key,joined_at,last_seen_at,role) VALUES
   ('m0','room','s0','피고','피고',1000,1000,'defendant'),
   ('m1','room','s1','참가자1','참가자1',1000,1000,'participant'),
   ('m2','room','s2','참가자2','참가자2',1000,1000,'participant');
  UPDATE rooms SET host_member_id='m0' WHERE id='room';
  INSERT INTO games(id,room_id,status,case_text,penalty_text,duration_seconds,version,created_at)
   VALUES ('game','room','voting','합성 비공개 사건','합성 벌칙',180,0,1000);
  INSERT INTO game_participants(game_id,room_id,member_id,role,eligible) VALUES
   ('game','room','m0','defendant',0),('game','room','m1','participant',1),('game','room','m2','participant',1);
  INSERT INTO rounds(game_id,number,started_at,deadline) VALUES ('game',1,1000,181000);
 `);
 const uow=new SqliteUnitOfWork(db),clock={now:()=>2000},random={nextInt:()=>0};
 const rooms=new Rooms(uow,clock,{},random);
 const vote={gameId:'game',roundNumber:1,memberId:'m1',choice:'guilty',reason:'SYNTHETIC_PRIVATE_REASON',requestId:'synthetic-request-0001',submittedAt:2000};
 const marker=`MUTATION_INVARIANT:${scenario}`;
 if(scenario==='defendant-allowed'){
  let rejected=false;
  try {new SubmitVote(uow,clock,random).execute({id:'s0'},'a'.repeat(43),'game',{roundNumber:1,requestId:'defendant-mutation-001',choice:'abstain',reason:''});}
  catch(error){if(error.code!=='FORBIDDEN')throw error;rejected=true;}
  assert.ok(rejected,marker);
 }else if(scenario==='vote-unique-removed'){
  uow.run(r=>r.votes.insert(vote));let rejected=false;
  try{uow.run(r=>r.votes.insert({...vote,requestId:'synthetic-request-0002'}));}
  catch(error){if(error.code!=='constraint')throw error;rejected=true;}
  assert.ok(rejected,marker);
 }else if(scenario==='private-reason-serialized'){
  uow.run(r=>r.votes.insert(vote));
  const snapshot=rooms.read({id:'s2'},'a'.repeat(43));
  assert.ok(snapshot.game.ownVote===null&&!JSON.stringify(snapshot).includes(vote.reason),marker);
 }else if(scenario==='history-auth-omitted'){
  let rejected=false;
  try{new PersonalHistory(uow,rooms,clock,random).detail({id:'s3'},'game');}
  catch(error){if(error.code!=='FORBIDDEN')throw error;rejected=true;}
  assert.ok(rejected,marker);
 }else throw new Error('알 수 없는 결함 주입 시나리오입니다.');
 console.log(JSON.stringify({scenario,invariant:'passed'}));
}finally{db.close();}
