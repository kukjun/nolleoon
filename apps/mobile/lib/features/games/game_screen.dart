import 'package:material_ui/material_ui.dart';

import '../../data/api_client.dart';
import '../../data/wire_models.dart';
import 'game_controller.dart';
import 'game_repository.dart';

/// Game-specific forms/results are injected, not simulated by this common shell.
class GameScreen extends StatefulWidget {
  GameScreen({
    super.key,
    required this.repository,
    required this.roomId,
    this.runId,
    this.viewerMembershipId,
    required this.accountScope,
    required this.pendingCommands,
    required this.onSessionLost,
    this.configure,
    this.play,
  }) {
    if (accountScope.trim().isEmpty) {
      throw ArgumentError('Account scope required');
    }
  }
  final GameRepository repository;
  final String roomId;
  final String? runId, viewerMembershipId;

  /// Change on account/session replacement even when reusing a repository.
  final String accountScope;
  final PendingGameCommands pendingCommands;
  final VoidCallback onSessionLost;
  final Future<JsonMap?> Function(BuildContext, String, List<String>)?
  configure;
  final Widget Function(BuildContext, RunDto, GameController)? play;
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  late GameController controller;
  String kind = 'team';
  final selected = <String>{};
  bool _configuring = false;
  int _configEpoch = 0;
  AppLifecycleState _lifecycle = AppLifecycleState.resumed;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _replaceController();
  }

  void _replaceController() {
    controller = GameController(
      widget.repository,
      pendingCommands: widget.pendingCommands,
      accountScope: widget.accountScope,
      onSessionLost: () => widget.onSessionLost(),
    )..addListener(_changed);
    if (_lifecycle != AppLifecycleState.resumed) {
      controller.setForeground(false);
    }
    controller.open(widget.roomId, widget.runId);
  }

  @override
  void didUpdateWidget(covariant GameScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.roomId != widget.roomId ||
        oldWidget.runId != widget.runId ||
        !identical(oldWidget.repository, widget.repository) ||
        oldWidget.viewerMembershipId != widget.viewerMembershipId ||
        oldWidget.accountScope != widget.accountScope ||
        !identical(oldWidget.pendingCommands, widget.pendingCommands)) {
      _configEpoch++;
      _configuring = false;
      selected.clear();
      kind = 'team';
      controller.removeListener(_changed);
      controller.dispose();
      _replaceController();
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycle = state;
    if (state != AppLifecycleState.resumed) {
      _configEpoch++;
      selected.clear();
      kind = 'team';
    }
    controller.setForeground(
      state == AppLifecycleState.resumed && !_configuring,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final room = controller.room;
    final configure = widget.configure;
    if (room == null || configure == null || controller.busy || _configuring) {
      return;
    }
    final ids = List<String>.unmodifiable(selected);
    final type = kind;
    final epoch = ++_configEpoch;
    _configuring = true;
    await controller.setForeground(false);
    JsonMap? settings;
    try {
      if (mounted) settings = await configure(context, type, ids);
    } catch (_) {
      settings = null;
    } finally {
      if (epoch == _configEpoch) _configuring = false;
    }
    if (!mounted ||
        epoch != _configEpoch ||
        _lifecycle != AppLifecycleState.resumed) {
      return;
    }
    await controller.setForeground(true);
    if (!mounted ||
        epoch != _configEpoch ||
        settings == null ||
        controller.run != null ||
        controller.room == null) {
      return;
    }
    await controller.submit(
      widget.repository.create(
        widget.roomId,
        controller.room!.data['version'] as int,
        type,
        ids,
        settings,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final run = controller.run;
    final room = controller.room;
    final canControl =
        run != null &&
        widget.viewerMembershipId != null &&
        run.data['facilitatorMembershipId'] == widget.viewerMembershipId;
    return Scaffold(
      appBar: AppBar(title: const Text('함께 하는 게임')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            if (controller.error != null)
              Text(controller.error!, key: const Key('game-error')),
            if (controller.hasPendingIntent) ...[
              const Text('처리 결과를 확인하지 못했어요. 같은 요청만 다시 보낼 수 있어요.'),
              OutlinedButton(
                onPressed: controller.busy ? null : controller.retry,
                child: const Text('같은 요청 다시 보내기'),
              ),
            ],
            if (!controller.foreground)
              const Text('다시 돌아오면 최신 상태를 확인해요.')
            else if (run != null) ...[
              Text(
                '${run.data['type']} · ${run.data['status']}',
                key: const Key('run-status'),
              ),
              if (run.game?.redacted ?? false)
                const Text('탈퇴로 삭제된 게임입니다. 개인 내용은 표시하지 않아요.')
              else if (run.game?.restricted ?? false)
                const Text('이 게임의 상세 내용은 볼 수 없어요.')
              else if (widget.play != null)
                widget.play!(context, run, controller)
              else
                const Text('게임 상태는 연결됐어요. 게임별 입력·결과 화면은 준비 중이에요.'),
              if (canControl && run.data['status'] == 'draft') ...[
                FilledButton(
                  onPressed: controller.busy || controller.hasPendingIntent
                      ? null
                      : () => controller.submit(
                          widget.repository.command(
                            ApiOperation.startRun,
                            widget.roomId,
                            run.runId,
                            run.version,
                          ),
                        ),
                  child: const Text('게임 시작'),
                ),
                OutlinedButton(
                  onPressed: controller.busy || controller.hasPendingIntent
                      ? null
                      : () => controller.submit(
                          widget.repository.command(
                            ApiOperation.cancelRun,
                            widget.roomId,
                            run.runId,
                            run.version,
                          ),
                        ),
                  child: const Text('준비 취소'),
                ),
              ],
            ] else if (room != null) ...[
              const Text('어떤 게임을 할까요?'),
              Wrap(
                spacing: 8,
                children: [
                  for (final entry in {
                    'team': '팀 나누기',
                    'draw': '제비뽑기',
                    'trial': '재판',
                    'menu': '메뉴 고르기',
                  }.entries)
                    ChoiceChip(
                      label: Text(entry.value),
                      selected: kind == entry.key,
                      onSelected: controller.busy
                          ? null
                          : (_) => setState(() => kind = entry.key),
                    ),
                ],
              ),
              const Text('참가할 친구'),
              for (final value in room.data['members'] as List)
                CheckboxListTile(
                  title: Text((value as Map)['nickname'] as String),
                  value: selected.contains(value['membershipId']),
                  onChanged: controller.busy
                      ? null
                      : (checked) => setState(() {
                          if (checked == true) {
                            selected.add(value['membershipId'] as String);
                          } else {
                            selected.remove(value['membershipId']);
                          }
                        }),
                ),
              FilledButton(
                onPressed:
                    widget.configure == null ||
                        controller.busy ||
                        selected.isEmpty
                    ? null
                    : _create,
                child: const Text('게임 설정'),
              ),
              if (widget.configure == null)
                const Text('게임별 설정 화면은 아직 연결되지 않았어요.'),
            ] else if (!controller.busy)
              const Text('게임을 불러오지 못했어요.'),
            OutlinedButton(
              onPressed: controller.busy || !controller.foreground
                  ? null
                  : controller.refresh,
              child: const Text('최신 상태 확인'),
            ),
          ],
        ),
      ),
    );
  }
}
