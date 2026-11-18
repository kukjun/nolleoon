import '../../data/wire_models.dart';

String historyKind(RunDto run) => const {
  'team': '팀 나누기',
  'draw': '제비뽑기',
  'trial': '재판',
  'menu': '메뉴 고르기',
}[run.data['type']]!;
String historyStatus(RunDto run) => const {
  'draft': '준비 중',
  'active': '진행 중',
  'completed': '완료',
  'incomplete': '미완료',
  'interrupted': '중단됨',
}[run.data['status']]!;

/// Explicit projection fields only. No generic JSON dump, private submissions,
/// missing-vote calculation, winner inference, or client-side outcome rules.
List<String> historyLines(RunDto run) {
  final game = run.game;
  if (game == null || game.restricted) return ['상세 내용은 공개되지 않아요.'];
  final data = game.data;
  if (game.redacted) {
    final summary = data['summary'] as Map;
    return [
      '탈퇴로 개인 내용이 삭제됐어요. 숫자 기록만 표시해요.',
      '참가 ${summary['participantCount']}명',
      if (summary['teams'] case final List teams)
        for (final team in teams) '${team['team']}팀 ${team['count']}명',
      if (summary['revealed'] case final Map revealed)
        '공개된 당첨 ${revealed['winnerCount']} · 비당첨 ${revealed['notWinnerCount']}',
      if (summary['responseCount'] case final int count) '응답 $count명',
      if (summary['rounds'] case final List rounds)
        for (final round in rounds)
          '${round['number']}차 · 유죄 ${round['guilty']} · 무죄 ${round['notGuilty']} · 기권 ${round['abstain']}',
    ];
  }
  switch (game.kind) {
    case 'team':
      final assignments = data['assignments'] as List;
      final counts = <int, int>{};
      for (final item in assignments) {
        final team = item['team'] as int;
        counts[team] = (counts[team] ?? 0) + 1;
      }
      return counts.isEmpty
          ? ['팀 배정 결과가 아직 없어요.']
          : [
              for (final team in counts.keys.toList()..sort())
                '$team팀 ${counts[team]}명',
            ];
    case 'draw':
      final revealed = data['revealed'] as List;
      final winners = revealed.where((item) => item['winner'] == true).length;
      return [
        '공개된 당첨 $winners · 비당첨 ${revealed.length - winners}',
        '미공개 제비 결과는 추정하지 않아요.',
      ];
    case 'menu':
      final result = data['result'];
      if (result == null) return ['최종 메뉴 결과가 없어요. 비공개 후보는 표시하지 않아요.'];
      return (result as Map)['outcome'] == 'selected'
          ? ['선택된 메뉴: ${result['menu']}']
          : ['선택된 메뉴가 없어요.'];
    case 'trial':
      if (data['phase'] == 'interrupted') return ['중단된 재판의 상세 내용은 공개되지 않아요.'];
      return [
        '사건: ${data['caseText']}',
        if (data['outcome'] != null)
          '판정: ${const {'guilty': '유죄', 'not-guilty': '무죄', 'no-verdict': '판결 없음', 'tie': '동률'}[data['outcome']]}',
        if (data['outcome'] == 'guilty') '합의한 벌칙: ${data['penaltyText']}',
        for (final round in data['rounds'] as List) ...[
          '${round['number']}차 · 유죄 ${round['counts']['guilty']} · 무죄 ${round['counts']['notGuilty']} · 기권 ${round['counts']['abstain']}',
          for (final reason in round['reasons'] as List)
            if ((reason['reason'] as String).isNotEmpty)
              '익명 이유: ${reason['reason']}',
        ],
      ];
    default:
      throw const FormatException('Unsupported game');
  }
}
