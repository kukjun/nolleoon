import preset01 from './assets/avatars/preset-01.webp';
import preset02 from './assets/avatars/preset-02.webp';
import preset03 from './assets/avatars/preset-03.webp';
import preset04 from './assets/avatars/preset-04.webp';
import preset05 from './assets/avatars/preset-05.webp';
import preset06 from './assets/avatars/preset-06.webp';
import preset07 from './assets/avatars/preset-07.webp';
import preset08 from './assets/avatars/preset-08.webp';
import preset09 from './assets/avatars/preset-09.webp';
import preset10 from './assets/avatars/preset-10.webp';
export const avatarPresets = [
 ['preset-01','판사'],['preset-02','검사'],['preset-03','변호사'],['preset-04','피고'],
 ['preset-05','여우'],['preset-06','고양이'],['preset-07','강아지'],['preset-08','토끼'],['preset-09','곰'],['preset-10','펭귄'],
] as const;
export const avatarArtwork:Readonly<Record<string,string>>={'preset-01':preset01,'preset-02':preset02,'preset-03':preset03,'preset-04':preset04,'preset-05':preset05,'preset-06':preset06,'preset-07':preset07,'preset-08':preset08,'preset-09':preset09,'preset-10':preset10};
export function presetLabel(id:string|null){return avatarPresets.find(([key])=>key===id)?.[1]??'기본 캐릭터';}
