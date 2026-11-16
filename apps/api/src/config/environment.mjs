export function parseEnvironment(env) {
  if (!/^[1-9]\d{0,4}$/.test(env.API_PORT ?? '') || Number(env.API_PORT) > 65535) {
    throw new Error('API_PORT는 1~65535 사이 정수로 지정해야 합니다.');
  }
  if (env.API_HOST !== undefined && env.API_HOST !== '127.0.0.1') {
    throw new Error('MVP 로컬 실행은 API_HOST=127.0.0.1만 허용합니다.');
  }
  return { port: Number(env.API_PORT), host: '127.0.0.1' };
}
