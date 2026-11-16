import type {RoomSnapshot} from '@trip-court/contracts';
import {Status} from './design/components';
export function SettlementPanel({game}:{game:NonNullable<RoomSnapshot['game']>}){
 const settlement=game.settlement;
 if(!settlement)return <p role="status">서버의 집계 결과를 기다리고 있어요.</p>;
 const labels={guilty:'유죄','not-guilty':'무죄','no-verdict':'판결 없음',tie:'1차 투표 동률'};
 return <section className="settlement-panel" aria-label="집계 결과"><h3>{labels[settlement.outcome]}</h3><Status>{settlement.roundNumber}차 투표 집계 완료</Status><dl className="settlement-counts"><div><dt>유죄</dt><dd>{settlement.guilty}표</dd></div><div><dt>무죄</dt><dd>{settlement.notGuilty}표</dd></div><div><dt>기권</dt><dd>{settlement.abstain}표</dd></div></dl><p>투표 대상 총 {settlement.total}명</p><p className="field-hint">{settlement.closedBy==='all-submitted'?'모든 투표가 제출되어 집계했어요.':'제한 시간이 끝나 집계했어요. 제출하지 않은 표는 기권에 포함돼요.'}</p>{settlement.outcome==='no-verdict'&&<p>유죄·무죄 의견이 없어 판결하지 않아요.</p>}{game.status==='final-defense'?<p>첫 투표가 동률이에요. 최후 변론 후 다시 투표하는 단계는 다음 기능에서 추가됩니다.</p>:<p>이번 게임의 집계가 완료됐어요.</p>}<p className="field-hint">개별 투표 이유는 아직 이 화면에서 제공하지 않아요.</p></section>;
}
