import 'package:material_ui/material_ui.dart';

import '../../../data/api_client.dart';
import '../../../data/wire_models.dart';
import '../game_controller.dart';

class TrialSetupForm extends StatefulWidget {
  const TrialSetupForm({
    super.key,
    required this.selected,
    required this.onComplete,
    this.names = const {},
    this.initialSettings,
  });
  final List<String> selected;
  final JsonMap? initialSettings;
  final Map<String, String> names;
  final ValueChanged<JsonMap?> onComplete;
  @override
  State<TrialSetupForm> createState() => _TrialSetupFormState();
}

class _TrialSetupFormState extends State<TrialSetupForm> {
  final caseText = TextEditingController(), penalty = TextEditingController();
  String? defendant;
  int minutes = 3;
  bool submitted = false;
  @override
  void initState() {
    super.initState();
    final initial = widget.initialSettings;
    defendant =
        initial?['defendantMembershipId'] as String? ??
        widget.selected.firstOrNull;
    caseText.text = initial?['caseText'] as String? ?? '';
    penalty.text = initial?['penaltyText'] as String? ?? '';
    minutes = initial?['durationMinutes'] as int? ?? 3;
  }

  @override
  void dispose() {
    caseText.clear();
    penalty.clear();
    caseText.dispose();
    penalty.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ids = widget.selected.toSet().toList();
    final valid =
        ids.length >= 3 &&
        ids.length == widget.selected.length &&
        ids.contains(defendant) &&
        caseText.text.trim().isNotEmpty &&
        caseText.text.runes.length <= 2000 &&
        penalty.text.trim().isNotEmpty &&
        penalty.text.runes.length <= 500;
    return AlertDialog(
      title: const Text('재판 설정'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('선택한 참가자 ${ids.length}명'),
            if (ids.length < 3) const Text('참가자를 3명 이상 선택해 주세요.'),
            TextField(
              key: const Key('trial-case'),
              controller: caseText,
              enabled: !submitted,
              maxLines: 3,
              maxLength: 2000,
              decoration: const InputDecoration(labelText: '사건'),
              onChanged: (_) => setState(() {}),
            ),
            TextField(
              key: const Key('trial-penalty'),
              controller: penalty,
              enabled: !submitted,
              maxLength: 500,
              decoration: const InputDecoration(labelText: '벌칙'),
              onChanged: (_) => setState(() {}),
            ),
            if (ids.isNotEmpty)
              DropdownButton<String>(
                key: const Key('trial-defendant'),
                isExpanded: true,
                value: defendant,
                items: [
                  for (var i = 0; i < ids.length; i++)
                    DropdownMenuItem(
                      value: ids[i],
                      child: Text(widget.names[ids[i]] ?? '참가자 ${i + 1}'),
                    ),
                ],
                onChanged: submitted
                    ? null
                    : (id) => setState(() => defendant = id),
              ),
            DropdownButton<int>(
              key: const Key('trial-minutes'),
              isExpanded: true,
              value: minutes,
              items: [
                for (var n = 1; n <= 10; n++)
                  DropdownMenuItem(value: n, child: Text('$n분')),
              ],
              onChanged: submitted
                  ? null
                  : (v) {
                      if (v != null) setState(() => minutes = v);
                    },
            ),
            const Text('피고의 벌칙 동의 후 진행자가 시작해요. 시작 시 참가자가 고정돼요.'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => widget.onComplete(null),
          child: const Text('취소'),
        ),
        FilledButton(
          onPressed: !valid || submitted
              ? null
              : () {
                  if (submitted) return;
                  setState(() => submitted = true);
                  widget.onComplete({
                    'caseText': caseText.text.trim(),
                    'penaltyText': penalty.text.trim(),
                    'durationMinutes': minutes,
                    'defendantMembershipId': defendant,
                  });
                },
          child: const Text('설정 적용'),
        ),
      ],
    );
  }
}

String _choiceLabel(Object? choice) => switch (choice) {
  'guilty' => '유죄',
  'not-guilty' => '무죄',
  'abstain' => '기권',
  _ => '알 수 없음',
};
String _outcomeLabel(Object? outcome) => switch (outcome) {
  'guilty' => '최종 판결 · 유죄',
  'not-guilty' => '최종 판결 · 무죄',
  'no-verdict' => '판결 없음 · 모두 기권',
  'tie' => '동률',
  _ => '판결 확인 중',
};
Future<void> _trialCommand(
  GameController c,
  String runId,
  String? viewer,
  JsonMap command, {
  bool restricted = false,
}) async {
  final current = c.run, game = c.run?.game;
  if (current == null ||
      current.runId != runId ||
      current.data['type'] != 'trial' ||
      game == null ||
      game.redacted ||
      game.restricted != restricted ||
      c.busy ||
      c.hasPendingIntent ||
      !c.foreground) {
    return;
  }
  final phase = game.data['phase'], action = command['action'];
  final facilitator =
      viewer != null && viewer == current.data['facilitatorMembershipId'];
  if (restricted) {
    if (!facilitator ||
        !((action == 'begin-vote' &&
                ['defense', 'final-defense'].contains(phase)) ||
            (action == 'final-defense' && phase == 'first-result'))) {
      return;
    }
  } else {
    final self = game.data['self'] as Map?;
    if (self == null) return;
    if (['consent', 'defense', 'vote'].contains(action) &&
        current.data['isParticipant'] != true) {
      return;
    }
    if (action == 'consent' &&
        (phase != 'preparing' || self['isDefendant'] != true)) {
      return;
    }
    if (action == 'defense' &&
        (!['defense', 'final-defense'].contains(phase) ||
            self['isDefendant'] != true)) {
      return;
    }
    if (action == 'vote' &&
        (phase != 'voting' ||
            self['isDefendant'] == true ||
            self['voted'] == true ||
            current.data['isParticipant'] != true)) {
      return;
    }
    if (action == 'duration' && (!facilitator || phase != 'defense')) return;
    if (action == 'begin-vote' &&
        (!facilitator || !['defense', 'final-defense'].contains(phase))) {
      return;
    }
    if (action == 'final-defense' &&
        (!facilitator || phase != 'first-result')) {
      return;
    }
  }
  await c.submit(
    c.repository.command(
      ApiOperation.runAction,
      current.data['roomId'] as String,
      current.runId,
      current.version,
      command: command,
    ),
  );
}

/// Only minimal server phase and facilitator identity; no private renderer.
class TrialRestrictedControls extends StatelessWidget {
  const TrialRestrictedControls({
    super.key,
    required this.run,
    required this.controller,
    required this.viewerMembershipId,
  });
  final RunDto run;
  final GameController controller;
  final String? viewerMembershipId;
  @override
  Widget build(BuildContext context) {
    final game = run.game;
    if (run.data['type'] != 'trial' ||
        game == null ||
        !game.restricted ||
        game.redacted ||
        viewerMembershipId == null ||
        viewerMembershipId != run.data['facilitatorMembershipId']) {
      return const SizedBox.shrink();
    }
    final phase = game.data['phase'],
        disabled =
            controller.busy ||
            controller.hasPendingIntent ||
            !controller.foreground;
    if (['defense', 'final-defense'].contains(phase)) {
      return FilledButton(
        onPressed: disabled
            ? null
            : () => _trialCommand(controller, run.runId, viewerMembershipId, {
                'action': 'begin-vote',
              }, restricted: true),
        child: const Text('모두 함께 투표 시작'),
      );
    }
    if (phase == 'first-result') {
      return FilledButton(
        onPressed: disabled
            ? null
            : () => _trialCommand(controller, run.runId, viewerMembershipId, {
                'action': 'final-defense',
              }, restricted: true),
        child: const Text('최후 변론으로'),
      );
    }
    return const Text('재판 내용은 볼 수 없고 허용된 단계만 진행할 수 있어요.');
  }
}

class TrialGameView extends StatefulWidget {
  const TrialGameView({
    super.key,
    required this.run,
    required this.controller,
    this.viewerMembershipId,
  });
  final RunDto run;
  final GameController controller;
  final String? viewerMembershipId;
  @override
  State<TrialGameView> createState() => _TrialGameViewState();
}

class _TrialGameViewState extends State<TrialGameView> {
  final defense = TextEditingController(), reason = TextEditingController();
  String? choice;
  int minutes = 3;
  bool durationDirty = false;
  void _reset() {
    defense.clear();
    reason.clear();
    choice = null;
    durationDirty = false;
    final seconds = widget.run.game?.data['durationSeconds'];
    minutes = seconds is int && seconds >= 60 && seconds <= 600
        ? seconds ~/ 60
        : 3;
  }

  @override
  void initState() {
    super.initState();
    _reset();
  }

  @override
  void didUpdateWidget(covariant TrialGameView oldWidget) {
    super.didUpdateWidget(oldWidget);
    final game = widget.run.game, old = oldWidget.run.game;
    if (oldWidget.run.runId != widget.run.runId ||
        oldWidget.viewerMembershipId != widget.viewerMembershipId ||
        !identical(oldWidget.controller, widget.controller) ||
        game == null ||
        game.redacted ||
        game.restricted ||
        old?.data['phase'] != game.data['phase'] ||
        old?.data['roundNumber'] != game.data['roundNumber']) {
      _reset();
    } else {
      final seconds = game.data['durationSeconds'];
      if (seconds is int && seconds >= 60 && seconds <= 600) {
        final saved = seconds ~/ 60;
        if (!durationDirty) minutes = saved;
        if (minutes == saved) durationDirty = false;
      }
      if ((game.data['self'] as Map?)?['voted'] == true) {
        reason.clear();
        choice = null;
      }
    }
  }

  @override
  void dispose() {
    defense.clear();
    reason.clear();
    defense.dispose();
    reason.dispose();
    super.dispose();
  }

  Future<void> _send(JsonMap command) => _trialCommand(
    widget.controller,
    widget.run.runId,
    widget.viewerMembershipId,
    command,
  );
  @override
  Widget build(BuildContext context) {
    final run = widget.run, game = run.game, c = widget.controller;
    if (run.data['type'] != 'trial' || game == null) {
      return const Text('재판 상태를 확인할 수 없어요.');
    }
    if (game.redacted) return const Text('탈퇴로 개인 내용이 삭제된 재판이에요.');
    if (game.restricted) return const Text('이 재판의 상세 내용은 볼 수 없어요.');
    final p = game.data, phase = p['phase'];
    if (phase == 'interrupted') return const Text('재판이 중단됐어요.');
    final self = p['self'] as Map, round = p['roundNumber'] as int;
    final disabled = c.busy || c.hasPendingIntent || !c.foreground;
    final facilitator =
        widget.viewerMembershipId != null &&
        widget.viewerMembershipId == run.data['facilitatorMembershipId'];
    final isDefense = phase == 'defense' || phase == 'final-defense';
    final title = switch (phase) {
      'preparing' => '벌칙 동의를 기다려요',
      'defense' => '피고의 변론',
      'voting' => '익명 투표 · $round차',
      'first-result' => '1차 결과 · 동률',
      'final-defense' => '최후 변론',
      'completed' => _outcomeLabel(p['outcome']),
      _ => '재판 상태 확인 중',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (phase == 'preparing') ...[
          Text(p['caseText'] as String),
          Text('벌칙: ${p['penaltyText']}'),
          Text(
            '동의 상태: ${p['consent'] == 'accepted'
                ? '동의'
                : p['consent'] == 'rejected'
                ? '거절'
                : '대기'}',
          ),
          if (self['isDefendant'] == true)
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: disabled
                      ? null
                      : () => _send({
                          'action': 'consent',
                          'decision': 'accepted',
                        }),
                  child: const Text('벌칙에 동의'),
                ),
                OutlinedButton(
                  onPressed: disabled
                      ? null
                      : () => _send({
                          'action': 'consent',
                          'decision': 'rejected',
                        }),
                  child: const Text('동의하지 않기'),
                ),
              ],
            ),
          const Text('피고의 동의와 접속 상태를 서버가 확인한 뒤에만 시작할 수 있어요.'),
        ] else
          ExpansionTile(
            title: const Text('사건과 합의한 벌칙'),
            children: [
              Text(p['caseText'] as String),
              Text(p['penaltyText'] as String),
            ],
          ),
        if (isDefense) ...[
          if (self['isDefendant'] == true) ...[
            TextField(
              key: const Key('trial-defense'),
              controller: defense,
              enabled: !disabled,
              maxLength: 5000,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: phase == 'final-defense' ? '최후 변론' : '변론',
              ),
              onChanged: (_) => setState(() {}),
            ),
            Wrap(
              children: [
                FilledButton(
                  onPressed:
                      disabled ||
                          defense.text.trim().isEmpty ||
                          defense.text.runes.length > 5000
                      ? null
                      : () => _send({
                          'action': 'defense',
                          'decision': 'submit',
                          'text': defense.text,
                        }),
                  child: const Text('변론 제출'),
                ),
                TextButton(
                  onPressed: disabled
                      ? null
                      : () => _send({
                          'action': 'defense',
                          'decision': 'skip',
                          'text': '',
                        }),
                  child: const Text('변론 생략'),
                ),
              ],
            ),
          ] else
            const Text('피고의 이야기를 듣고 있어요.'),
          for (final d in (p['defenses'] as List).cast<Map>().where(
            (d) => d['number'] == (phase == 'final-defense' ? 2 : 1),
          ))
            Text(d['status'] == 'skipped' ? '변론을 생략했어요.' : d['text'] as String),
          if (facilitator) ...[
            if (phase == 'defense')
              ExpansionTile(
                title: Text('투표 제한시간 ${p['durationSeconds']}초'),
                children: [
                  DropdownButton<int>(
                    key: const Key('trial-duration'),
                    value: minutes,
                    items: [
                      for (var n = 1; n <= 10; n++)
                        DropdownMenuItem(value: n, child: Text('$n분')),
                    ],
                    onChanged: disabled
                        ? null
                        : (v) {
                            if (v != null) {
                              setState(() {
                                minutes = v;
                                durationDirty =
                                    minutes * 60 != p['durationSeconds'];
                              });
                            }
                          },
                  ),
                  OutlinedButton(
                    onPressed: disabled
                        ? null
                        : () => _send({
                            'action': 'duration',
                            'durationMinutes': minutes,
                          }),
                    child: const Text('시간 적용'),
                  ),
                  if (durationDirty) ...[
                    Text(
                      '선택한 $minutes분은 아직 적용되지 않았어요. 서버 저장값은 ${p['durationSeconds']}초예요.',
                    ),
                    TextButton(
                      onPressed: disabled
                          ? null
                          : () => setState(() {
                              minutes = (p['durationSeconds'] as int) ~/ 60;
                              durationDirty = false;
                            }),
                      child: const Text('저장된 시간으로 되돌리기'),
                    ),
                  ],
                ],
              ),
            FilledButton(
              onPressed: disabled || durationDirty
                  ? null
                  : () => _send({'action': 'begin-vote'}),
              child: const Text('모두 함께 투표 시작'),
            ),
          ],
        ],
        if (phase == 'voting') ...[
          Text('접수 ${p['submittedCount']}표 · 제한 ${p['durationSeconds']}초'),
          const Text('마감과 결과는 서버가 결정해요. 화면 시간으로 투표를 끝내지 않아요.'),
          if (self['isDefendant'] == true)
            const Text('피고는 투표에 참여하지 않아요.')
          else if (self['voted'] == true) ...[
            const Text('내 투표가 접수됐어요.'),
            if (self['vote'] != null) ...[
              Text('내 투표: ${_choiceLabel((self['vote'] as Map)['choice'])}'),
              Text((self['vote'] as Map)['reason'] as String),
            ],
          ] else if (run.data['isParticipant'] == true) ...[
            Wrap(
              spacing: 8,
              children: [
                for (final entry in {
                  'guilty': '유죄',
                  'not-guilty': '무죄',
                  'abstain': '기권',
                }.entries)
                  ChoiceChip(
                    label: Text(entry.value),
                    selected: choice == entry.key,
                    onSelected: disabled
                        ? null
                        : (_) => setState(() => choice = entry.key),
                  ),
              ],
            ),
            TextField(
              key: const Key('trial-reason'),
              controller: reason,
              enabled: !disabled,
              maxLength: 2000,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: choice == 'abstain' ? '기권 이유 (선택)' : '투표 이유 (필수)',
              ),
              onChanged: (_) => setState(() {}),
            ),
            FilledButton(
              onPressed:
                  disabled ||
                      choice == null ||
                      (choice != 'abstain' && reason.text.trim().isEmpty) ||
                      reason.text.runes.length > 2000
                  ? null
                  : () => _send({
                      'action': 'vote',
                      'choice': choice,
                      'reason': reason.text,
                    }),
              child: const Text('투표 제출'),
            ),
          ],
        ],
        for (final r in (p['rounds'] as List).cast<Map>())
          ExpansionTile(
            title: Text('${r['number']}차 공개 결과'),
            children: [
              Text(
                '유죄 ${(r['counts'] as Map)['guilty']} · 무죄 ${(r['counts'] as Map)['notGuilty']} · 기권 ${(r['counts'] as Map)['abstain']}',
              ),
              const Text('익명 투표 이유'),
              for (final v in (r['reasons'] as List).cast<Map>())
                Text('${_choiceLabel(v['choice'])}: ${v['reason']}'),
            ],
          ),
        if (phase == 'first-result') ...[
          const Text('최후 변론을 듣고 한 번 더 투표해요. 2차에도 동률이면 서버가 무죄로 판결해요.'),
          if (facilitator)
            FilledButton(
              onPressed: disabled
                  ? null
                  : () => _send({'action': 'final-defense'}),
              child: const Text('최후 변론으로'),
            ),
        ],
        if (phase == 'completed' && p['outcome'] == 'guilty')
          Text('벌칙: ${p['penaltyText']}'),
      ],
    );
  }
}
