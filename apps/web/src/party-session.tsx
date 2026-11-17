import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {PartyGameType,RoomSnapshot} from '@trip-court/contracts';
import {Button,Status} from './design/components';
import {useParty} from './api/use-party';
import {PartyLobby} from './party-lobby';
import {PartySelection} from './party-selection';
import {PartyGameSetup} from './party-game-setup';
import {PartyRunView} from './party-run-view';
import {MemberAvatar} from './avatar';
export function PartySession({room,reconnecting,renderCourt,refreshRoom}:{room:RoomSnapshot;reconnecting:boolean;renderCourt:(preparing:boolean,onDirty?:(dirty:boolean)=>void)=>ReactNode;refreshRoom:()=>Promise<void>}){
 const party=useParty(room.inviteCode,!room.closed);const [view,setView]=useState<'lobby'|'selection'|'setup'>('lobby');const [courtDirty,setCourtDirty]=useState(false);const lastRun=useRef<string|null>(null);const switching=useRef(false);
 useEffect(()=>{const run=party.snapshot?.run?.runId??null;if(lastRun.current&&run===null){setView('lobby');void refreshRoom();}lastRun.current=run;},[party.snapshot?.run?.runId,refreshRoom]);
 async function select(type:PartyGameType){const current=party.snapshot;if(!current||switching.current)return;switching.current=true;try{const result=await party.send({kind:'selection',expectedVersion:current.selection.version,type,teamCount:current.selection.teamCount,winnerCount:current.selection.winnerCount,penaltyText:current.selection.penaltyText});if(result?.ok){await refreshRoom();setView('setup');}}finally{switching.current=false;}}
 const snapshot=party.snapshot;
 if(!snapshot)return <section className="party-loading"><h2>우리 방을 확인하고 있어요</h2>{party.loading?<Status live>게임 상태를 불러오고 있어요.</Status>:<><p role="alert" className="field-error">{party.error||'게임 상태를 확인하지 못했어요.'}</p><Button onPress={party.refresh}>게임 상태 다시 확인</Button></>}</section>;
 if(snapshot.roomId!==room.roomId||snapshot.self.memberId!==room.self.memberId)return <p role="alert">참가 신원이 바뀌었어요. 방 상태를 다시 확인해 주세요.</p>;
 const run=snapshot.run;
 const newGameRunning=run&&run.type!=='trial';
 const courtActive=(room.game!==null||room.interrupted)&&!newGameRunning;
 return <>
  {party.error&&<p role="alert" className="field-error">{party.error} 마지막 확인 상태를 보여드려요.</p>}
  {newGameRunning?<PartyRunView key={run.runId} party={snapshot} busy={party.busy} send={party.send}/>:courtActive?renderCourt(true):<>
   {view==='lobby'&&<PartyLobby room={room} reconnecting={reconnecting} onPrepare={()=>setView(courtDirty?'setup':room.self.isHost?'selection':'setup')} actionLabel={courtDirty?'작성 중인 재판 이어서 준비':room.self.isHost?'같이 할 게임 고르기':'선택된 게임 준비 보기'} renderAvatar={member=><MemberAvatar memberId={member.memberId} nickname={member.nickname} size="large"/>}/>}
   {view==='selection'&&<PartySelection party={snapshot} busy={party.busy} onSelect={select} onBack={()=>setView('lobby')}/>}
   {snapshot.selection.type==='trial'?<div hidden={view!=='setup'}><Button variant="quiet" onPress={()=>setView('lobby')}>대기실로 돌아가기</Button>{renderCourt(view==='setup',setCourtDirty)}</div>:view==='setup'&&<PartyGameSetup key={`${snapshot.selection.type}:${room.preparationVersion}`} party={snapshot} room={room} busy={party.busy} send={party.send} onBack={()=>setView('lobby')}/>}
  </>}
 </>;
}
