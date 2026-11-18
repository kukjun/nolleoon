import type {TravelRepository,TravelRoom,TravelMember,TravelPresence,TravelRun,RoomDeletion} from '../../application/ports/travel.js';
import type {SqlAccess} from './account-repository.js';
const roomCols='id,title,start_date startDate,end_date endDate,status,version,created_at createdAt,administrator_membership_id administratorMembershipId';
const memberCols='id,room_id roomId,account_id accountId,joined_at joinedAt,left_at leftAt,departure';
const runCols='id,room_id roomId,type,status,creator_membership_id creatorMembershipId,facilitator_membership_id facilitatorMembershipId,version,settings_json settingsJson,state_json stateJson,result_json resultJson,selected_membership_ids_json selectedMembershipIdsJson,created_at createdAt,started_at startedAt,ended_at endedAt,legacy_run_id legacyRunId';
export function travelRepository({execute,find,all}:SqlAccess):TravelRepository {return {
 deletionEventApplied:id=>!!find<{id:string}>('SELECT operation_id id FROM travel_room_deletion_events WHERE operation_id=?',id),
 recordDeletionEvent:id=>execute('INSERT INTO travel_room_deletion_events VALUES (@id)',{id}),
 dueDeletions:(now,limit)=>all<{id:string}>('SELECT room_id id FROM travel_room_deletions WHERE purge_after<=? ORDER BY purge_after,room_id LIMIT ?',now,limit).map(r=>r.id),
 rawRoom:id=>find<TravelRoom>(`SELECT ${roomCols} FROM travel_rooms WHERE id=?`,id),
 deletion:id=>find<RoomDeletion>('SELECT room_id roomId,deletion_version deletionVersion,deleted_at deletedAt,purge_after purgeAfter,previous_status previousStatus,administrator_account_id administratorAccountId FROM travel_room_deletions WHERE room_id=?',id),
 deletedRooms:accountId=>all<RoomDeletion & {title:string}>('SELECT d.room_id roomId,d.deletion_version deletionVersion,d.deleted_at deletedAt,d.purge_after purgeAfter,d.previous_status previousStatus,d.administrator_account_id administratorAccountId,r.title FROM travel_room_deletions d JOIN travel_rooms r ON r.id=d.room_id WHERE d.administrator_account_id=? ORDER BY d.deleted_at DESC,d.room_id',accountId),
 markDeleted:d=>execute('INSERT INTO travel_room_deletions VALUES (@roomId,@deletionVersion,@deletedAt,@purgeAfter,@previousStatus,@administratorAccountId)',d),
 restoreDeleted:id=>execute('DELETE FROM travel_room_deletions WHERE room_id=@id',{id}),
 purgeDeleted:id=>{
 execute(`DELETE FROM travel_requests WHERE EXISTS (SELECT 1 FROM json_tree(travel_requests.result_json) WHERE value=@id OR value IN (SELECT id FROM travel_runs WHERE room_id=@id)) OR (json_valid(intent) AND EXISTS (SELECT 1 FROM json_tree(travel_requests.intent) WHERE value=@id OR value IN (SELECT id FROM travel_runs WHERE room_id=@id)))`,{id});
 execute('DELETE FROM travel_run_redactions WHERE run_id IN (SELECT id FROM travel_runs WHERE room_id=@id)',{id});
 execute('DELETE FROM travel_run_participants WHERE room_id=@id',{id});
 execute('DELETE FROM travel_runs WHERE room_id=@id',{id});
 execute('DELETE FROM travel_invites WHERE room_id=@id',{id});
 execute('DELETE FROM travel_presence WHERE membership_id IN (SELECT id FROM travel_memberships WHERE room_id=@id)',{id});
 execute('UPDATE travel_rooms SET administrator_membership_id=NULL WHERE id=@id',{id});
 execute('DELETE FROM travel_memberships WHERE room_id=@id',{id});
 execute('DELETE FROM travel_room_deletions WHERE room_id=@id',{id});
 execute('DELETE FROM travel_rooms WHERE id=@id',{id});
 },
 room:id=>find<TravelRoom>(`SELECT ${roomCols} FROM travel_rooms WHERE id=? AND id NOT IN (SELECT room_id FROM travel_room_deletions)`,id),
 insertRoom:r=>execute('INSERT INTO travel_rooms VALUES (@id,@title,@startDate,@endDate,@status,@version,@createdAt,@administratorMembershipId)',r),
 saveRoom:r=>execute('UPDATE travel_rooms SET title=@title,start_date=@startDate,end_date=@endDate,status=@status,version=@version,administrator_membership_id=@administratorMembershipId WHERE id=@id',r),
 list:(accountId,before,limit)=>all<TravelRoom>(`SELECT ${roomCols} FROM travel_rooms WHERE id NOT IN (SELECT room_id FROM travel_room_deletions) AND id IN (SELECT room_id FROM travel_memberships WHERE account_id=? AND left_at IS NULL) ${before?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`,accountId,...(before?[before.createdAt,before.createdAt,before.id]:[]),limit),
 member:id=>find<TravelMember>(`SELECT ${memberCols} FROM travel_memberships WHERE id=?`,id),
 membership:(roomId,accountId)=>find<TravelMember>(`SELECT ${memberCols} FROM travel_memberships WHERE room_id=? AND account_id=? ORDER BY joined_at DESC,id DESC LIMIT 1`,roomId,accountId),
 members:roomId=>all<TravelMember>(`SELECT ${memberCols} FROM travel_memberships WHERE room_id=? AND left_at IS NULL ORDER BY joined_at,id`,roomId),
 insertMember:r=>execute('INSERT INTO travel_memberships VALUES (@id,@roomId,@accountId,@joinedAt,@leftAt,@departure)',r),
 depart:(id,now,departure)=>execute('UPDATE travel_memberships SET left_at=@now,departure=@departure WHERE id=@id AND left_at IS NULL',{id,now,departure}),
 presence:id=>find<TravelPresence>('SELECT membership_id membershipId,last_seen_at lastSeenAt,disconnected_at disconnectedAt FROM travel_presence WHERE membership_id=?',id),
 touch:(id,now)=>execute('INSERT INTO travel_presence VALUES (@id,@now,NULL) ON CONFLICT(membership_id) DO UPDATE SET last_seen_at=@now,disconnected_at=NULL',{id,now}),
 detectDisconnected:(roomId,now,silentMs)=>execute('UPDATE travel_presence SET disconnected_at=last_seen_at+@silentMs WHERE disconnected_at IS NULL AND last_seen_at+@silentMs<=@now AND membership_id IN (SELECT id FROM travel_memberships WHERE room_id=@roomId)',{roomId,now,silentMs}),
 invite:hash=>find<{roomId:string;revokedAt:number|null}>('SELECT room_id roomId,revoked_at revokedAt FROM travel_invites WHERE token_hash=?',hash),
 revokeInvites:(roomId,now)=>execute('UPDATE travel_invites SET revoked_at=@now WHERE room_id=@roomId AND revoked_at IS NULL',{roomId,now}),
 insertInvite:(hash,roomId,now)=>execute('INSERT INTO travel_invites VALUES (@hash,@roomId,@now,NULL)',{hash,roomId,now}),
 receipt:(accountId,requestId)=>find<{intent:string;resultJson:string}>('SELECT intent,result_json resultJson FROM travel_requests WHERE account_id=? AND request_id=?',accountId,requestId),
 insertReceipt:(accountId,requestId,intent,resultJson,now)=>execute('INSERT INTO travel_requests VALUES (@accountId,@requestId,@intent,@resultJson,@now)',{accountId,requestId,intent,resultJson,now}),
 run:id=>find<TravelRun>(`SELECT ${runCols} FROM travel_runs WHERE id=?`,id),currentRun:roomId=>find<TravelRun>(`SELECT ${runCols} FROM travel_runs WHERE room_id=? AND status IN ('draft','active')`,roomId),
 insertRun:r=>execute('INSERT INTO travel_runs VALUES (@id,@roomId,@type,@status,@creatorMembershipId,@facilitatorMembershipId,@version,@settingsJson,@stateJson,@resultJson,@selectedMembershipIdsJson,@createdAt,@startedAt,@endedAt,@legacyRunId)',r),
 saveRun:r=>execute('UPDATE travel_runs SET status=@status,facilitator_membership_id=@facilitatorMembershipId,version=@version,settings_json=@settingsJson,state_json=@stateJson,result_json=@resultJson,selected_membership_ids_json=@selectedMembershipIdsJson,started_at=@startedAt,ended_at=@endedAt WHERE id=@id',r),
 participants:id=>all<{id:string}>('SELECT membership_id id FROM travel_run_participants WHERE run_id=? ORDER BY membership_id',id).map(r=>r.id),
 addParticipant:(runId,roomId,membershipId,now)=>execute('INSERT INTO travel_run_participants VALUES (@runId,@roomId,@membershipId,@now)',{runId,roomId,membershipId,now}),
 history:(roomId,before,limit)=>all<TravelRun>(`SELECT ${runCols} FROM travel_runs WHERE room_id=? AND status NOT IN ('draft','active') ${before?'AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`,roomId,...(before?[before.createdAt,before.createdAt,before.id]:[]),limit)
};}
