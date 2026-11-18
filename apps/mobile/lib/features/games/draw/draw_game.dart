import 'package:material_ui/material_ui.dart';

import '../../../data/api_client.dart';
import '../../../data/wire_models.dart';
import '../game_controller.dart';

/// Return as GameScreen.configure's form. The shell owns dismissal and lifecycle.
class DrawSetupForm extends StatefulWidget {
  const DrawSetupForm({
    super.key,
    required this.selected,
    required this.onComplete,
    this.names = const {},
  });
  final List<String> selected;
  final Map<String, String> names;
  final ValueChanged<JsonMap?> onComplete;
  @override
  State<DrawSetupForm> createState() => _DrawSetupFormState();
}

class _DrawSetupFormState extends State<DrawSetupForm> {
  final penalty = TextEditingController();
  int count = 1;
  bool submitted = false;
  @override
  void dispose() {
    penalty.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rosterValid =
        widget.selected.length >= 2 &&
        widget.selected.toSet().length == widget.selected.length;
    final valid =
        rosterValid &&
        penalty.text.trim().isNotEmpty &&
        penalty.text.runes.length <= 500;
    return AlertDialog(
      title: const Text('제비뽑기 설정'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('참가자 ${widget.selected.length}명'),
            for (var i = 0; i < widget.selected.length; i++)
              Text(widget.names[widget.selected[i]] ?? '참가자 ${i + 1}'),
            if (!rosterValid)
              const Text('참가자를 2명 이상 선택해 주세요.')
            else
              DropdownButton<int>(
                key: const Key('draw-count'),
                value: count,
                isExpanded: true,
                items: [
                  for (var n = 1; n <= widget.selected.length; n++)
                    DropdownMenuItem(value: n, child: Text('$n명')),
                ],
                onChanged: submitted
                    ? null
                    : (v) {
                        if (v != null) setState(() => count = v);
                      },
              ),
            TextField(
              key: const Key('draw-penalty'),
              controller: penalty,
              enabled: !submitted,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: '벌칙',
                hintText: '함께 정한 벌칙을 적어 주세요.',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const Text('서버가 시작할 때 제비를 미리 배정해요. 각자 자기 제비 한 장만 공개해요.'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => widget.onComplete(null),
          child: const Text('취소'),
        ),
        FilledButton(
          onPressed: valid && !submitted
              ? () {
                  setState(() => submitted = true);
                  widget.onComplete({
                    'winnerCount': count,
                    'penaltyText': penalty.text.trim(),
                  });
                }
              : null,
          child: const Text('설정 적용'),
        ),
      ],
    );
  }
}

class DrawGameView extends StatelessWidget {
  const DrawGameView({
    super.key,
    required this.run,
    required this.controller,
    this.viewerMembershipId,
    this.names = const {},
  });
  final RunDto run;
  final GameController controller;
  final String? viewerMembershipId;
  final Map<String, String> names;
  Future<void> _reveal() async {
    final current = controller.run, game = controller.run?.game;
    if (current == null ||
        current.runId != run.runId ||
        current.data['type'] != 'draw' ||
        current.data['status'] != 'active' ||
        game == null ||
        game.redacted ||
        game.restricted ||
        controller.busy ||
        controller.hasPendingIntent ||
        !controller.foreground) {
      return;
    }
    final self = game.data['self'] as Map;
    if (self['participating'] != true ||
        self['canReveal'] != true ||
        self['revealed'] == true ||
        game.data['blockedPolicy'] != null) {
      return;
    }
    await controller.submit(
      controller.repository.command(
        ApiOperation.runAction,
        current.data['roomId'] as String,
        current.runId,
        current.version,
        command: {'kind': 'reveal'},
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final game = run.game;
    if (run.data['type'] != 'draw' || game == null) {
      return const Text('제비 상태를 확인할 수 없어요.');
    }
    if (game.redacted) return const Text('탈퇴로 개인 내용이 삭제된 제비뽑기예요.');
    if (game.restricted) return const Text('이 제비뽑기를 볼 수 없어요.');
    final status = run.data['status'], self = game.data['self'] as Map;
    final selected = (run.data['selectedMembershipIds'] as List).cast<String>();
    final revealed = (game.data['revealed'] as List).cast<Map>();
    final stopped = status == 'incomplete' || status == 'interrupted';
    final mayReveal =
        status == 'active' &&
        self['participating'] == true &&
        self['canReveal'] == true &&
        self['revealed'] != true &&
        game.data['blockedPolicy'] == null;
    String name(String id) {
      final index = selected.indexOf(id);
      return names[id] ?? (index < 0 ? '참가자' : '참가자 ${index + 1}');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          stopped
              ? '제비뽑기가 중단됐어요.'
              : status == 'completed'
              ? '제비뽑기 결과'
              : status == 'draft'
              ? '제비뽑기 준비'
              : '내 제비',
        ),
        Text(game.data['penaltyText'] as String),
        if (status == 'draft') ...[
          Text('참가 ${selected.length}명 · 뽑을 인원 ${game.data['winnerCount']}명'),
          const Text('진행자가 시작하면 서버가 제비를 배정해요.'),
        ] else ...[
          Text('공개 ${revealed.length}명 / 참가 ${selected.length}명'),
          if (stopped)
            const Text('공개 전 제비는 표시하지 않아요. 새 게임은 별도로 시작해 주세요.')
          else if (game.data['blockedPolicy'] != null)
            const Text('참가자 상태를 확인할 때까지 공개할 수 없어요.')
          else if (self['participating'] != true)
            const Text('이번 판에는 내 제비가 없어요. 공개된 결과만 볼 수 있어요.')
          else if (self['revealed'] == true)
            const Text('내 제비 공개가 완료됐어요.')
          else if (status == 'active')
            const Text('아래 버튼은 내게 배정된 제비 한 장을 공개해요.'),
          if (mayReveal)
            FilledButton(
              onPressed:
                  controller.busy ||
                      controller.hasPendingIntent ||
                      !controller.foreground
                  ? null
                  : _reveal,
              child: Text(controller.busy ? '서버 확인 중' : '내 제비 공개'),
            ),
          for (final item in revealed)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(name(item['membershipId'] as String)),
              subtitle: Text(item['winner'] == true ? '당첨' : '통과'),
              trailing: item['membershipId'] == viewerMembershipId
                  ? const Text('나')
                  : null,
            ),
        ],
      ],
    );
  }
}
