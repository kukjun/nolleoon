import { isAbsolute } from 'node:path';
export function parseEnvironment(env) {
  if (!/^[1-9]\d{0,4}$/.test(env.API_PORT ?? '') || Number(env.API_PORT) > 65535) {
    throw new Error('API_PORT는 1~65535 사이 정수로 지정해야 합니다.');
  }
  if (env.API_HOST !== undefined && env.API_HOST !== '127.0.0.1') {
    throw new Error('MVP 로컬 실행은 API_HOST=127.0.0.1만 허용합니다.');
  }
  if (!env.DB_PATH || !isAbsolute(env.DB_PATH)) throw new Error('DB_PATH 절대 경로가 필요합니다.');
  let origin;
  try { origin = new URL(env.PUBLIC_ORIGIN); } catch { throw new Error('PUBLIC_ORIGIN이 필요합니다.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (origin.origin !== env.PUBLIC_ORIGIN || origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local))) throw new Error('PUBLIC_ORIGIN은 HTTPS 또는 로컬 HTTP의 정확한 origin이어야 합니다.');
  return { port: Number(env.API_PORT), host: '127.0.0.1', dbPath: env.DB_PATH, publicOrigin: origin.origin };
}
