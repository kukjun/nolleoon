import 'package:material_ui/material_ui.dart';

import '../../design/app_tokens.dart';

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
    this.supportedKinds = const {'team', 'draw', 'menu', 'trial'},
    this.restrictedControls,
    this.editConfigure,
    this.onRunAvailable,
  }) {
    if (accountScope.trim().isEmpty) {
      throw ArgumentError('Account scope required');
    }
  }
  final GameRepository repository;
  final Set<String> supportedKinds;
  final String roomId;
  final String? runId, viewerMembershipId;

  /// Change on account/session replacement even when reusing a repository.
  final String accountScope;
  final PendingGameCommands pendingCommands;
  final VoidCallback onSessionLost;

  /// Build a form inside the shell-owned dialog; do not push another route.
  final Widget Function(
    BuildContext,
    String,
    List<String>,
    ValueChanged<JsonMap?>,
  )?
  configure;

  /// Receives only an authorized draft snapshot; must not guess hidden settings.
  final Widget Function(BuildContext, RunDto, ValueChanged<JsonMap?>)?
  editConfigure;
  final ValueChanged<String>? onRunAvailable;
  final Widget Function(BuildContext, RunDto, GameController)? play;

  /// Minimal server-authorized trial phase controls, never private content.
  final Widget Function(BuildContext, RunDto, GameController)?
  restrictedControls;
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  late GameController controller;
  String kind = 'team';
  bool choosingParticipants = false;
  String? _reportedRun;
  final selected = <String>{};
  Object? _configurationToken;
  DialogRoute<JsonMap>? _configurationRoute;
  bool get _configuring => _configurationToken != null;
  int _configEpoch = 0;
  AppLifecycleState _lifecycle = AppLifecycleState.resumed;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _replaceController();
  }

  void _replaceController() {
    _reportedRun = null;
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
      _cancelConfiguration();
      selected.clear();
      kind = 'team';
      choosingParticipants = false;
      controller.removeListener(_changed);
      controller.dispose();
      _replaceController();
    }
  }

  void _changed() {
    final id = controller.run?.runId;
    if (mounted && id != null && id != _reportedRun) {
      _reportedRun = id;
      widget.onRunAvailable?.call(id);
    }
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycle = state;
    if (state != AppLifecycleState.resumed) {
      _cancelConfiguration();
      selected.clear();
      kind = 'team';
      choosingParticipants = false;
    }
    controller.setForeground(
      state == AppLifecycleState.resumed && !_configuring,
    );
  }

  @override
  void dispose() {
    _cancelConfiguration();
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    super.dispose();
  }

  void _cancelConfiguration() {
    _configEpoch++;
    _configurationToken = null;
    final route = _configurationRoute;
    _configurationRoute = null;
    if (route?.isActive ?? false) route!.navigator?.removeRoute(route);
  }

  Future<void> _create() => _configure();

  Future<void> _configure({RunDto? editing}) async {
    final room = controller.room, configure = widget.configure;
    if (controller.busy ||
        controller.hasPendingIntent ||
        _configuring ||
        (editing == null && (room == null || configure == null)) ||
        (editing != null &&
            (widget.editConfigure == null ||
                editing.data['status'] != 'draft' ||
                editing.game == null ||
                editing.game!.restricted ||
                editing.game!.redacted ||
                editing.data['facilitatorMembershipId'] !=
                    widget.viewerMembershipId))) {
      return;
    }
    final ids = List<String>.unmodifiable(
          editing == null
              ? selected
              : (editing.data['selectedMembershipIds'] as List).cast<String>(),
        ),
        type = editing?.data['type'] as String? ?? kind;
    final epoch = ++_configEpoch, token = Object();
    _configurationToken = token;
    await controller.setForeground(false);
    if (!mounted ||
        !identical(token, _configurationToken) ||
        _lifecycle != AppLifecycleState.resumed) {
      return;
    }
    JsonMap? settings;
    late final DialogRoute<JsonMap> route;
    void complete(JsonMap? value) {
      if (!mounted ||
          !identical(token, _configurationToken) ||
          !identical(route, _configurationRoute) ||
          !route.isActive) {
        return;
      }
      route.navigator?.removeRoute(route, value);
    }

    route = DialogRoute<JsonMap>(
      context: context,
      builder: (context) => editing == null
          ? configure!(context, type, ids, complete)
          : widget.editConfigure!(context, editing, complete),
    );
    _configurationRoute = route;
    try {
      settings = await Navigator.of(context, rootNavigator: true).push(route);
    } finally {
      if (identical(token, _configurationToken)) {
        _configurationToken = null;
        _configurationRoute = null;
      }
    }
    if (!mounted ||
        epoch != _configEpoch ||
        _lifecycle != AppLifecycleState.resumed) {
      return;
    }
    await controller.setForeground(true);
    if (!mounted || epoch != _configEpoch || settings == null) {
      return;
    }
    if (editing != null) {
      final latest = controller.run;
      if (latest == null ||
          latest.runId != editing.runId ||
          latest.version != editing.version ||
          latest.data['status'] != 'draft' ||
          latest.game == null ||
          latest.game!.restricted ||
          latest.game!.redacted ||
          latest.data['facilitatorMembershipId'] != widget.viewerMembershipId) {
        setState(
          () => controller.error = '상태가 바뀌었어요. 최신 설정을 확인한 뒤 다시 수정해 주세요.',
        );
        return;
      }
      await controller.submit(
        widget.repository.command(
          ApiOperation.editRun,
          widget.roomId,
          editing.runId,
          editing.version,
          selected: ids,
          settings: settings,
        ),
      );
      return;
    }
    if (controller.run != null || controller.room == null) return;
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
        widget.supportedKinds.contains(run.data['type']) &&
        widget.viewerMembershipId != null &&
        run.data['facilitatorMembershipId'] == widget.viewerMembershipId;
    return Scaffold(
      appBar: AppBar(title: const Text('함께 하는 게임')),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppTokens.pageWidth),
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
                    '${const {'team': '팀 나누기', 'draw': '제비뽑기', 'trial': '재판', 'menu': '메뉴 고르기'}[run.data['type']]} · ${const {'draft': '준비 중', 'active': '진행 중', 'completed': '완료', 'incomplete': '미완료', 'interrupted': '중단'}[run.data['status']] ?? run.data['status']}',
                    key: const Key('run-status'),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  if (run.game?.redacted ?? false)
                    const Text('탈퇴로 삭제된 게임입니다. 개인 내용은 표시하지 않아요.')
                  else if (run.game?.restricted ?? false) ...[
                    const Text('이 게임의 상세 내용은 볼 수 없어요.'),
                    if (run.data['type'] == 'trial' &&
                        canControl &&
                        widget.restrictedControls != null)
                      widget.restrictedControls!(context, run, controller),
                  ] else if (widget.play != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: widget.play!(context, run, controller),
                      ),
                    )
                  else
                    const Text('게임 상태는 연결됐어요. 게임별 입력·결과 화면은 준비 중이에요.'),
                  if (canControl && run.data['status'] == 'draft') ...[
                    if (run.game?.restricted ?? true)
                      const Text('설정을 볼 수 없어 수정할 수 없어요. 준비 취소 후 새 게임을 만들어 주세요.')
                    else if (widget.editConfigure != null)
                      OutlinedButton(
                        onPressed:
                            controller.busy || controller.hasPendingIntent
                            ? null
                            : () => _configure(editing: run),
                        child: const Text('설정 수정'),
                      ),

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
                  Text(
                    choosingParticipants ? '새 판 준비 · 2/3' : '새 판 준비 · 1/3',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                  const SizedBox(height: 8),
                  Semantics(
                    header: true,
                    child: Text(
                      choosingParticipants ? '함께할 사람을 골라요' : '어떤 게임을 할까요?',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (!choosingParticipants)
                    for (final entry in const {
                      'team': (
                        '팀 나누기',
                        '여행 멤버를 팀으로 나눠요.',
                        Icons.groups_outlined,
                      ),
                      'draw': (
                        '제비뽑기',
                        '각자 자기 결과를 공개해요.',
                        Icons.confirmation_number_outlined,
                      ),
                      'trial': (
                        '재판',
                        '사건과 벌칙, 피고를 정해요.',
                        Icons.balance_outlined,
                      ),
                      'menu': (
                        '메뉴 고르기',
                        '먹고 싶은 메뉴를 하나씩 적어요.',
                        Icons.restaurant_outlined,
                      ),
                    }.entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.all(16),
                            backgroundColor: AppTokens.gameSurface,
                            side: const BorderSide(color: Color(0xffd5dfd4)),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed:
                              controller.busy ||
                                  !widget.supportedKinds.contains(entry.key)
                              ? null
                              : () => setState(() {
                                  kind = entry.key;
                                  choosingParticipants = true;
                                }),
                          child: Row(
                            children: [
                              Icon(entry.value.$3, size: 28),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      entry.value.$1,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      widget.supportedKinds.contains(entry.key)
                                          ? entry.value.$2
                                          : '연결 대기',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                        ),
                      ),
                  if (choosingParticipants) ...[
                    TextButton(
                      onPressed: controller.busy
                          ? null
                          : () => setState(() => choosingParticipants = false),
                      child: const Text('게임 다시 고르기'),
                    ),
                    const Text('시작할 때 선택한 멤버가 고정돼요. 오프라인이어도 여행방 멤버로 남아요.'),
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
                              !widget.supportedKinds.contains(kind) ||
                              controller.busy ||
                              selected.isEmpty
                          ? null
                          : _create,
                      child: const Text('게임 설정'),
                    ),
                    Text(
                      '${selected.length}명 선택',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    if (widget.configure == null)
                      const Text('게임별 설정 화면은 아직 연결되지 않았어요.'),
                  ],
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
        ),
      ),
    );
  }
}
