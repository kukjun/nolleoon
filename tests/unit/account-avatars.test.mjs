import test from 'node:test';import assert from 'node:assert/strict';
import {ACCOUNT_AVATAR_QUOTA} from '../../apps/api/dist/application/account-avatars.js';
import {accountAvatar,accountAvatarView} from '../../apps/api/dist/application/account-avatar-view.js';
test('account avatar projection falls back to current preset and never serializes owner or image bytes',()=>{
 const defaultRecord=accountAvatar({findAvatar:()=>undefined},{id:'private-account',presetId:'preset-03'});assert.deepEqual(accountAvatarView(defaultRecord),{kind:'preset',presetId:'preset-03',revision:0,imageUrl:null});
 const image={accountId:'private-account',presetId:null,revision:4,imageBytes:Buffer.from('private bytes')};assert.deepEqual(accountAvatarView(image,'/api/travel-rooms/room/avatars/member/image'),{kind:'image',presetId:null,revision:4,imageUrl:'/api/travel-rooms/room/avatars/member/image?v=4'});assert.equal(ACCOUNT_AVATAR_QUOTA,16*1024*1024);
});
