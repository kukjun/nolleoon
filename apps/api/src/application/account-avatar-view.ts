import type {AccountAvatarRecord,AccountAuthRepository,AccountRecord} from './ports/account-auth.js';
export function accountAvatar(r:AccountAuthRepository,a:AccountRecord,includeImage=false):AccountAvatarRecord{return r.findAvatar(a.id,includeImage)??{accountId:a.id,presetId:a.presetId,revision:0,imageBytes:null};}
export function accountAvatarView(avatar:AccountAvatarRecord,path='/api/account/avatar/image'){return {kind:avatar.presetId?'preset' as const:'image' as const,presetId:avatar.presetId,revision:avatar.revision,imageUrl:avatar.presetId?null:`${path}?v=${avatar.revision}`};}
