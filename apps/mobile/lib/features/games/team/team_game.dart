import 'package:material_ui/material_ui.dart';

import '../../../data/wire_models.dart';

/// Only collects server settings. No random assignment or local game outcome.
Future<JsonMap?> teamSetup(
  BuildContext context,
  List<String> selected, {
  Map<String, String> names = const {},
}) => showDialog<JsonMap>(
  context: context,
  builder: (dialogContext) => TeamSetupForm(
    selected: List.unmodifiable(selected),
    names: Map.unmodifiable(names),
    onComplete: (value) => Navigator.pop(dialogContext, value),
  ),
);

class TeamSetupForm extends StatefulWidget {
  const TeamSetupForm({
    super.key,
    required this.selected,
    this.names = const {},
    required this.onComplete,
  });
  final ValueChanged<JsonMap?> onComplete;
  final List<String> selected;
  final Map<String, String> names;
  @override
  State<TeamSetupForm> createState() => _TeamSetupState();
}

class _TeamSetupState extends State<TeamSetupForm> {
  int teams = 2;
  bool submitted = false;
  @override
  Widget build(BuildContext context) {
    final valid =
        widget.selected.length >= 2 &&
        widget.selected.toSet().length == widget.selected.length;
    return AlertDialog(
      title: const Text('팀 나누기 설정'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('선택한 참가자 ${widget.selected.length}명'),
            for (var i = 0; i < widget.selected.length; i++)
              Text(widget.names[widget.selected[i]] ?? '참가자 ${i + 1}'),
            if (!valid)
              const Text('참가자를 2명 이상 선택해 주세요.')
            else
              DropdownButton<int>(
                key: const Key('team-count'),
                value: teams,
                isExpanded: true,
                items: [
                  for (var n = 2; n <= widget.selected.length; n++)
                    DropdownMenuItem(value: n, child: Text('$n팀')),
                ],
                onChanged: submitted
                    ? null
                    : (v) {
                        if (v != null) setState(() => teams = v);
                      },
              ),
            const Text('시작 시 참가자가 고정되고 서버가 팀을 고르게 나눠요.'),
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
                  setState(() => submitted = true);
                  widget.onComplete(<String, Object?>{'teamCount': teams});
                },
          child: const Text('설정 적용'),
        ),
      ],
    );
  }
}

/// Displays only the server's already-authorized projection. Start/cancel and
/// immutable request retry remain in GameScreen/GameController.
class TeamGameView extends StatelessWidget {
  const TeamGameView({
    super.key,
    required this.run,
    this.names = const {},
    this.avatarBuilder,
  });
  final RunDto run;
  final Map<String, String> names;
  final Widget Function(String memberId)? avatarBuilder;
  @override
  Widget build(BuildContext context) {
    final game = run.game;
    if (run.data['type'] != 'team' || game == null) {
      return const Text('팀 상태를 확인할 수 없어요.');
    }
    if (game.redacted) return const Text('탈퇴로 개인 내용이 삭제된 팀 나누기예요.');
    if (game.restricted) return const Text('이 게임을 볼 수 없어요.');
    final status = run.data['status'];
    if (status == 'incomplete' || status == 'interrupted') {
      return const Text('팀 나누기가 중단됐어요.');
    }
    final selected = (run.data['selectedMembershipIds'] as List).cast<String>();
    String name(String id) {
      final index = selected.indexOf(id);
      return names[id] ?? (index < 0 ? '참가자' : '참가자 ${index + 1}');
    }

    if (status == 'draft') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${game.data['teamCount']}팀 · 참가자 ${selected.length}명'),
          const Text('진행자가 시작하면 팀이 정해져요.'),
          for (final id in selected)
            ListTile(
              leading:
                  avatarBuilder?.call(id) ??
                  const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(name(id)),
            ),
          const Text('시작 전까지 선택 명단을 확인해 주세요.'),
        ],
      );
    }
    if (status != 'completed') return const Text('서버에서 팀 결과를 확인하고 있어요.');
    final assignments = (game.data['assignments'] as List).cast<Map>();
    if (assignments.isEmpty) {
      return const Text('공개된 팀 결과가 없어요. 최신 상태를 확인해 주세요.');
    }
    final groups = <int, List<String>>{};
    for (final assignment in assignments) {
      groups
          .putIfAbsent(assignment['team'] as int, () => [])
          .add(assignment['membershipId'] as String);
    }
    final numbers = groups.keys.toList()..sort();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('팀 나누기 결과'),
        const Text('서버에 저장된 배정 결과예요.'),
        for (final team in numbers)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$team팀 · ${groups[team]!.length}명',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final id in groups[team]!)
                    ListTile(
                      leading:
                          avatarBuilder?.call(id) ??
                          const CircleAvatar(child: Icon(Icons.person_outline)),
                      title: Text(name(id)),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
