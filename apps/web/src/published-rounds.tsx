import type {RoomSnapshot} from '@trip-court/contracts';
const labels={guilty:'유죄','not-guilty':'무죄',abstain:'기권'};
export function PublishedRounds({game}:{game:NonNullable<RoomSnapshot['game']>}){
 return <>{game.publishedRounds.map(round=><section key={round.number} className="published-round" aria-label={`${round.number}차 공개 투표 이유`}><h3>{round.number}차 공개 투표 이유</h3>{game.settlement?.roundNumber!==round.number&&<p>유죄 {round.counts.guilty}표 · 무죄 {round.counts.notGuilty}표 · 기권 {round.counts.abstain}표</p>}<p className="field-hint">완료된 투표의 이유예요. 작성자 정보나 제출 순서는 표시하지 않아요.</p>{round.reasons.length?<ul>{round.reasons.map((item,index)=><li key={index}><strong>{labels[item.choice]}</strong><p>{item.reason}</p></li>)}</ul>:<p>공개할 이유가 없어요.</p>}</section>)}</>;
}
