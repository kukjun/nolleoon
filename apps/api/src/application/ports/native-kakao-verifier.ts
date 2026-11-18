/** The token is inspected with Kakao, never trusted as client-supplied identity or stored. */
export interface NativeKakaoTokenVerifier {
 verify(accessToken:string):Promise<{subject:string;expiresInSeconds:number}>;
}
