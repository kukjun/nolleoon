import { backupDatabase, restoreDatabase } from '../../apps/api/dist/infrastructure/sqlite/backup.js';
const [command, source, destination, ...extra] = process.argv.slice(2);
if (!['backup', 'restore'].includes(command) || !source || !destination || extra.length) {
  console.error('사용법: node tools/storage/backup.mjs backup|restore <원본 절대경로> <존재하지 않는 대상 절대경로>');
  process.exitCode = 1;
} else {
  try {
    await (command === 'backup' ? backupDatabase : restoreDatabase)(source, destination);
    console.log('검증된 새 DB 파일을 생성했습니다. 실행 중인 서버의 DB 경로는 변경하지 않았습니다.');
  } catch (error) {
    const cleanupMessage = 'BACKUP_CLEANUP_FAILED: 새 대상은 게시됐으나 임시 파일 정리에 실패했습니다. 대상을 검증하고 임시 파일을 점검하세요.';
    if (error instanceof Error && error.message === cleanupMessage) console.error(cleanupMessage);
    else console.error('BACKUP_FAILED: 경로·여유 공간·DB 무결성·현재 스키마 호환성을 확인하세요. 원본과 기존 대상은 덮어쓰지 않습니다.');
    process.exitCode = 1;
  }
}
