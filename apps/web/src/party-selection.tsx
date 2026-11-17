import type {PartyGameType,PartySnapshot} from '@trip-court/contracts';
import {Button} from './design/components';
export const partyGameLabels:Record<PartyGameType,string>={trial:'우리끼리 재판',team:'팀 나누기',draw:'제비뽑기'};
export function PartySelection({party,busy,onSelect,onBack}:{party:PartySnapshot;busy:boolean;onSelect:(type:PartyGameType)=>void;onBack:()=>void}){
 return <section className="party-selection"><span className="eyebrow">CHOOSE OUR GAME</span><h2>오늘의 한 판</h2><p className="field-hint">같은 친구들, 다른 재미. 방장이 게임을 골라요.</p>{([{type:'team',icon:'🧩',copy:'인원 차이 없이, 공평하게 한 팀'},{type:'draw',icon:'🎟️',copy:'내게 배정된 제비를 직접 뒤집어요'},{type:'trial',icon:'⚖️',copy:'이야기를 듣고 익명으로 판단해요'}] as const).map(game=><button type="button" className="party-game-card" key={game.type} disabled={busy||!party.self.isHost} onClick={()=>onSelect(game.type)}><span className="party-game-icon" aria-hidden="true">{game.icon}</span><span><strong>{partyGameLabels[game.type]}</strong><small>{game.copy}</small></span><span aria-hidden="true">↗</span></button>)}<Button variant="quiet" onPress={onBack}>대기실로 돌아가기</Button></section>;
}
