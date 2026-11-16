import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const kinds = ['tls','health','static','cookie','invite','five-player-vote','sync','reconnect','history','existing-service'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function publicOrigin(value) {
 if (!text(value)) return false;
 try {
  const url = new URL(value);
  const host = url.hostname;
  if (value !== url.origin) return false;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return false;
  if (host.endsWith('.') || !host.includes('.') || /^[0-9.]+$/.test(host) || host.includes(':')) return false;
  if (!host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return false;
  if (/(^|\.)(localhost|local|test|invalid|internal|home|lan)$/.test(host)) return false;
  if (/(^|\.)example\.(com|org|net)$/.test(host) || /(^|\.)example$/.test(host)) return false;
  return true;
 } catch { return false; }
}
/** Offline shape audit only. No DNS, TLS, content, provenance, or deployed-HEAD verification. */
export function auditExternalEvidence(input) {
 const issues = [];
 const summary = (status, acceptedCount, missing) => ({status,verified:false,acceptedCount,missing,issues,limitations:'오프라인 형식 검사만 수행했습니다. DNS·외부 접속·증거 진위·배포 commit은 검증하지 않았습니다.'});
 if (!object(input) || input.schemaVersion !== 1 || !object(input.release) || !Array.isArray(input.observations) || !Array.isArray(input.operatorClaims)) {
  issues.push('invalid-or-missing-evidence-document');
  return summary('blocked',0,[...kinds]);
 }
 if (!publicOrigin(input.targetOrigin)) {
  issues.push('invalid-public-https-origin');
  return summary('blocked',0,[...kinds]);
 }
 const { expectedCommit, observedCommit, sourceEvidence } = input.release;
 if (typeof expectedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(expectedCommit) || expectedCommit !== observedCommit || !text(sourceEvidence)) issues.push('missing-or-mismatched-release-evidence');
 const accepted = new Set();
 for (const observation of input.observations) {
  if (!object(observation) || !kinds.includes(observation.kind)) { issues.push('unknown-observation'); continue; }
  const validTime = typeof observation.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(observation.observedAt) && Number.isFinite(Date.parse(observation.observedAt));
  if (!validTime || !object(observation.network) || observation.network.kind !== 'external' || !text(observation.network.source) || !text(observation.evidence) || observation.result !== 'passed') {
   issues.push('invalid-or-failed-observation'); continue;
  }
  accepted.add(observation.kind);
 }
 const missing = kinds.filter(kind=>!accepted.has(kind));
 return summary(issues.length || missing.length ? 'incomplete' : 'ready-for-independent-review', accepted.size, missing);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 let input = null;
 try { if (process.argv.length === 3) input = JSON.parse(readFileSync(process.argv[2], 'utf8')); } catch { /* Only sanitized audit output, never raw paths or evidence. */ }
 const report = auditExternalEvidence(input);
 console.log(JSON.stringify(report,null,2));
 process.exitCode = report.status === 'ready-for-independent-review' ? 0 : 1;
}
