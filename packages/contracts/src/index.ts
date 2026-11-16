export interface HealthResponse { status:'ok';service:'trip-court-api' }
export interface SessionSnapshot { authenticated:true }
export const errorCodes=['SESSION_REQUIRED','FORBIDDEN','INVALID_INPUT','NOT_FOUND','STATE_CONFLICT','DEADLINE_PASSED','TEMPORARILY_UNAVAILABLE','INTERNAL_ERROR'] as const;
export type ErrorCode=typeof errorCodes[number];
export const errorMessages:Record<ErrorCode,string>={SESSION_REQUIRED:'브라우저 신원을 확인할 수 없습니다.',FORBIDDEN:'이 요청을 수행할 권한이 없습니다.',INVALID_INPUT:'입력 내용을 확인해 주세요.',NOT_FOUND:'요청한 항목을 찾을 수 없습니다.',STATE_CONFLICT:'상태가 변경됐어요. 최신 내용을 확인해 주세요.',DEADLINE_PASSED:'제출 시간이 지났습니다.',TEMPORARILY_UNAVAILABLE:'잠시 후 상태를 확인하고 다시 시도해 주세요.',INTERNAL_ERROR:'요청을 처리하지 못했습니다.'};
export interface ErrorResponse { error:{code:ErrorCode;message:string} }
export type GameAction='configure-game'|'select-role'|'accept-penalty'|'start-trial'|'submit-defense'|'start-vote'|'submit-vote'|'close-room';
export interface PublishedRound {number:1|2;counts:{guilty:number;notGuilty:number;abstain:number};reasons:{choice:'guilty'|'not-guilty'|'abstain';reason:string}[]}
export type GameSnapshot = {phase:'interrupted';caseText?:string;actions:GameAction[]} | {
 gameId:string;version:number;phase:'draft'|'defense'|'voting-1'|'final-defense'|'voting-2'|'result';caseText:string;penaltyText:string;
 self:{role:'defendant'|'participant'|'observer';isHost:boolean};actions:GameAction[];publishedRounds:PublishedRound[];
 deadline?:number;verdict?:'guilty'|'not-guilty'|'no-verdict';
};

export interface GameDraftSnapshot {version:number;caseText:string;penaltyText:string;durationMinutes:number}
export interface RoomSnapshot {roomId:string;consent:{penaltyRevision:number;roleRevision:number;decisionVersion:number;status:'pending'|'accepted'|'rejected';defendantMemberId:string|null;canDecide:boolean};roleRevision:number;rosterEditable:boolean;draft:GameDraftSnapshot;version:number;inviteCode:string;self:{memberId:string;isHost:boolean};members:{memberId:string;nickname:string;role:'defendant'|'participant';isHost:boolean;connected:boolean}[]}
