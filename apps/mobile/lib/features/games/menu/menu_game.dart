import 'package:material_ui/material_ui.dart';

import '../../../data/api_client.dart';
import '../../../data/wire_models.dart';
import '../game_controller.dart';

class MenuSetupForm extends StatefulWidget {
  const MenuSetupForm({
    super.key,
    required this.selected,
    required this.onComplete,
    this.names = const {},
  });
  final List<String> selected;
  final Map<String, String> names;
  final ValueChanged<JsonMap?> onComplete;
  @override
  State<MenuSetupForm> createState() => _MenuSetupFormState();
}

class _MenuSetupFormState extends State<MenuSetupForm> {
  bool submitted = false;
  @override
  Widget build(BuildContext context) {
    final valid =
        widget.selected.length >= 2 &&
        widget.selected.toSet().length == widget.selected.length;
    return AlertDialog(
      title: const Text('메뉴 선택 설정'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('참가자 ${widget.selected.length}명'),
            for (var i = 0; i < widget.selected.length; i++)
              Text(widget.names[widget.selected[i]] ?? '참가자 ${i + 1}'),
            if (!valid) const Text('참가자를 2명 이상 선택해 주세요.'),
            const Text('한 사람당 메뉴 하나를 제안하거나 패스해요. 모든 응답이 모이면 서버가 메뉴를 정해요.'),
            const Text(
              '가장 많이 제안된 메뉴를 고르고, 동률이면 서버가 추첨해요. 다른 사람의 후보와 득표수는 공개하지 않아요.',
            ),
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
                  widget.onComplete(<String, Object?>{});
                },
          child: const Text('설정 적용'),
        ),
      ],
    );
  }
}

/// No client tally, normalization or random choice: only own submission/final DTO.
class MenuGameView extends StatefulWidget {
  const MenuGameView({
    super.key,
    required this.run,
    required this.controller,
    this.viewerMembershipId,
  });
  final RunDto run;
  final GameController controller;
  final String? viewerMembershipId;
  @override
  State<MenuGameView> createState() => _MenuGameViewState();
}

class _MenuGameViewState extends State<MenuGameView> {
  final input = TextEditingController();
  @override
  void didUpdateWidget(covariant MenuGameView oldWidget) {
    super.didUpdateWidget(oldWidget);
    final game = widget.run.game;
    if (oldWidget.run.runId != widget.run.runId ||
        !identical(oldWidget.controller, widget.controller) ||
        game == null ||
        game.redacted ||
        game.restricted ||
        game.data['phase'] != 'collecting' ||
        ((game.data['self'] as Map?)?['eligible'] != true ||
            (game.data['self'] as Map?)?['submission'] != null)) {
      input.clear();
    }
  }

  @override
  void dispose() {
    input.clear();
    input.dispose();
    super.dispose();
  }

  Future<void> _send(JsonMap command) async {
    final c = widget.controller, current = c.run, game = c.run?.game;
    if (current == null ||
        current.runId != widget.run.runId ||
        current.data['type'] != 'menu' ||
        current.data['status'] != 'active' ||
        game == null ||
        game.redacted ||
        game.restricted ||
        game.data['phase'] != 'collecting' ||
        c.busy ||
        c.hasPendingIntent ||
        !c.foreground) {
      return;
    }
    final self = game.data['self'] as Map;
    if (command['type'] == 'cancel') {
      if (widget.viewerMembershipId == null ||
          widget.viewerMembershipId !=
              current.data['facilitatorMembershipId']) {
        return;
      }
    } else if (self['eligible'] != true || self['submission'] != null) {
      return;
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

  @override
  Widget build(BuildContext context) {
    final run = widget.run, game = run.game, c = widget.controller;
    if (run.data['type'] != 'menu' || game == null) {
      return const Text('메뉴 상태를 확인할 수 없어요.');
    }
    if (game.redacted) return const Text('탈퇴로 개인 내용이 삭제된 메뉴 선택이에요.');
    if (game.restricted) return const Text('이 메뉴 선택을 볼 수 없어요.');
    final phase = game.data['phase'], self = game.data['self'] as Map;
    if (phase == 'incomplete') return const Text('메뉴 선택이 중단됐어요.');
    if (phase == 'completed') {
      final result = game.data['result'] as Map?;
      if (result == null) return const Text('확정된 메뉴를 확인할 수 없어요.');
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('메뉴 선택 결과'),
          if (result['outcome'] == 'selected')
            Text(
              result['menu'] as String,
              style: Theme.of(context).textTheme.headlineSmall,
            )
          else
            const Text('선택된 메뉴가 없어요.'),
          const Text('서버에 저장된 최종 결과예요.'),
        ],
      );
    }
    if (phase == 'draft') return const Text('진행자가 시작하면 메뉴를 제안할 수 있어요.');
    final disabled = c.busy || c.hasPendingIntent || !c.foreground;
    final submission = self['submission'] as Map?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('메뉴를 함께 골라요'),
        const Text('다른 사람의 후보는 공개하지 않아요.'),
        if (self['eligible'] != true)
          const Text('이번 판에는 응답할 수 없어요. 결과를 기다려 주세요.')
        else if (submission != null) ...[
          const Text('내 응답을 보냈어요.'),
          Text(
            submission['kind'] == 'pass'
                ? '이번에는 패스했어요.'
                : submission['menu'] as String,
          ),
          const Text('나머지 응답이 모이면 결과가 나와요.'),
        ] else ...[
          TextField(
            key: const Key('menu-candidate'),
            controller: input,
            enabled: !disabled,
            decoration: const InputDecoration(
              labelText: '제안할 메뉴',
              helperText: '서버에서 공백 등을 정리한 뒤 80자 이내인지 확인해요.',
            ),
            onChanged: (_) => setState(() {}),
          ),
          FilledButton(
            onPressed: disabled || input.text.trim().isEmpty
                ? null
                : () => _send({'type': 'submit', 'menu': input.text}),
            child: const Text('후보 보내기'),
          ),
          TextButton(
            onPressed: disabled ? null : () => _send({'type': 'pass'}),
            child: const Text('이번에는 패스'),
          ),
        ],
        if (widget.viewerMembershipId != null &&
            widget.viewerMembershipId == run.data['facilitatorMembershipId'])
          OutlinedButton(
            onPressed: disabled ? null : () => _send({'type': 'cancel'}),
            child: const Text('수집 중단'),
          ),
      ],
    );
  }
}
