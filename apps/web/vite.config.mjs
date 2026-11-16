import { defineConfig } from 'vite';
const port=process.env.API_PORT??'3001';
if(!/^[1-9]\d{0,4}$/.test(port) || Number(port)>65535)throw new Error('개발 API_PORT는 1~65535 정수여야 합니다.');
export default defineConfig({server:{host:'127.0.0.1',strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${port}`,changeOrigin:false}}}});
