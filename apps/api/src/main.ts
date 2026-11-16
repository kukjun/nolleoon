import {bootstrap} from './production/bootstrap.js';
bootstrap(process.env).then(()=>{console.info('Trip Court ready (loopback).');}).catch(()=>{
 console.error('Trip Court startup failed. Check configuration, build, storage and port.');
 process.exitCode=1;
});
