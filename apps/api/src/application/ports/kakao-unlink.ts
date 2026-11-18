/** Transport only. Caller must own a durable deletion workflow and rejoin exclusion. */
export interface KakaoUnlink {unlink(subject:string):Promise<{status:'unlinked'|'already-unlinked'}>}
