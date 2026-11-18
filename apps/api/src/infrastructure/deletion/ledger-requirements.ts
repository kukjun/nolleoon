import {createHash} from 'node:crypto';
import type Database from 'better-sqlite3';
export interface RuntimeLedger {entries():readonly unknown[];bindingIdentity?():string}
type Witness={namespace:'account'|'room';bindingHash:string;knownSequence:number;knownDigest:string};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
/** The latch is independent of deletion transactions and can never be silently disabled. */
export class LedgerRequirements {
 constructor(private readonly db:Database.Database){}
 check(account?:RuntimeLedger,room?:RuntimeLedger):void {
  if(this.db.inTransaction)throw Error('LEDGER_REQUIREMENTS_NESTED');
  const prepared:Witness[]=[];
  for(const [namespace,ledger]of [['account',account],['room',room]] as const){
   const old=this.db.prepare('SELECT namespace,binding_hash bindingHash,known_sequence knownSequence,known_digest knownDigest FROM privacy_ledger_requirements WHERE namespace=?').get(namespace) as Witness|undefined;
   if(!ledger){if(old)throw Error('LEDGER_REQUIRED');continue;}
   const entries=ledger.entries();const bindingHash=hash(ledger.bindingIdentity?.()??'explicit-application-injected-ledger');
   if(old&&(old.bindingHash!==bindingHash||entries.length<old.knownSequence||hash(JSON.stringify(entries.slice(0,old.knownSequence)))!==old.knownDigest))throw Error('LEDGER_REQUIREMENTS_MISMATCH');
   prepared.push({namespace,bindingHash,knownSequence:entries.length,knownDigest:hash(JSON.stringify(entries))});
  }
  this.db.transaction(()=>{for(const p of prepared)this.db.prepare('INSERT INTO privacy_ledger_requirements VALUES (@namespace,@bindingHash,@knownSequence,@knownDigest) ON CONFLICT(namespace) DO UPDATE SET known_sequence=excluded.known_sequence,known_digest=excluded.known_digest').run(p);}).immediate();
 }
}
