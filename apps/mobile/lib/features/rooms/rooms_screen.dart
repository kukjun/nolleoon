import '../room_avatars/room_avatar_widgets.dart';

import 'package:material_ui/material_ui.dart';

import '../../design/app_tokens.dart';

import '../../design/app_components.dart';
import 'rooms_controller.dart';
import '../../data/wire_models.dart';
import 'rooms_repository.dart';

/// Mount only for a verified signed-in account; key by account ID.
/// Dispose this subtree on logout/account switch. No auth simulation here.
class RoomsScreen extends StatefulWidget {
  const RoomsScreen({
    super.key,
    required this.repository,
    required this.onSessionLost,
    this.onOpenRun,
    this.roomActionsBuilder,
    this.roomScopeBuilder,
    this.accountId,
    this.initialRoomId,
    this.createRecovery,
  });
  final RoomsRepository repository;
  final Widget Function(RoomDto)? roomActionsBuilder;
  final Widget Function(RoomDto, Widget)? roomScopeBuilder;
  final String? accountId;
  final String? initialRoomId;
  final RoomsCreateRecovery? createRecovery;
  final VoidCallback onSessionLost;
  final Future<void> Function(String roomId, String runId)? onOpenRun;
  @override
  State<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends State<RoomsScreen> with WidgetsBindingObserver {
  late RoomsController controller;
  bool creating = false;
  int _draftGeneration = 0;
  int _screenEpoch = 0;
  bool _childRoute = false;
  bool _backPending = false;
  DialogRoute<bool>? _discardRoute;
  final title = TextEditingController();
  DateTime? start, end;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bindController();
  }

  void _bindController() {
    _screenEpoch++;
    _draftGeneration = widget.createRecovery?.generation ?? 0;
    creating = false;
    title.clear();
    start = null;
    end = null;
    controller = RoomsController(
      widget.repository,
      onSessionLost: widget.onSessionLost,
      accountId: widget.accountId,
      createRecovery: widget.createRecovery,
    );
    final draft = controller.pendingDraft ?? widget.createRecovery?.unsentDraft;
    if (draft != null) {
      creating = true;
      title.text = draft['title'] as String;
      start = DateTime.tryParse(draft['startDate'] as String? ?? '');
      end = DateTime.tryParse(draft['endDate'] as String? ?? '');
    }
    controller.addListener(_changed);
    if (widget.initialRoomId != null) {
      controller.open(widget.initialRoomId!);
    } else {
      controller.refresh();
    }
  }

  @override
  void didUpdateWidget(covariant RoomsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.initialRoomId != widget.initialRoomId ||
        !identical(oldWidget.createRecovery, widget.createRecovery)) {
      if (oldWidget.accountId != widget.accountId) {
        oldWidget.createRecovery?.clear();
      }
      _cancelDiscard();
      controller.removeListener(_changed);
      controller.dispose();
      _childRoute = false;
      _backPending = false;
      _bindController();
    }
  }

  void _changed() {
    if (mounted) {
      setState(() {
        if (controller.room != null) creating = false;
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _screenEpoch++;
      _cancelDiscard();
    }
    controller.setForeground(
      state == AppLifecycleState.resumed && !_childRoute,
    );
  }

  @override
  void dispose() {
    _screenEpoch++;
    _cancelDiscard();
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    title.dispose();
    super.dispose();
  }

  void _rememberDraft() {
    if (creating && !controller.pendingCreate) {
      widget.createRecovery?.rememberDraft(
        _draftGeneration,
        title.text,
        _dateText(start),
        _dateText(end),
      );
    }
  }

  Future<void> _date(bool first) async {
    final epoch = _screenEpoch;
    final selected = await showDatePicker(
      context: context,
      initialDate: (first ? start : end) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (mounted &&
        selected != null &&
        epoch == _screenEpoch &&
        controller.foreground) {
      setState(() {
        if (first) {
          start = selected;
        } else {
          end = selected;
        }
        _rememberDraft();
      });
    }
  }

  String? _dateText(DateTime? d) => d == null
      ? null
      : '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  void _cancelDiscard() {
    final route = _discardRoute;
    _discardRoute = null;
    _backPending = false;
    if (route?.isActive ?? false) route!.navigator?.removeRoute(route);
  }

  Future<void> _back() async {
    if (_backPending) return;
    final epoch = _screenEpoch, captured = controller;
    bool current() =>
        mounted &&
        epoch == _screenEpoch &&
        identical(captured, controller) &&
        controller.foreground;
    _backPending = true;
    try {
      if (creating &&
          (title.text.isNotEmpty ||
              start != null ||
              end != null ||
              controller.pendingCreate)) {
        late final DialogRoute<bool> route;
        void complete(bool value) {
          if (current() && identical(route, _discardRoute) && route.isActive) {
            route.navigator?.removeRoute(route, value);
          }
        }

        route = DialogRoute<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('목록으로 돌아갈까요?'),
            content: Text(
              controller.pendingCreate
                  ? '요청이 서버에 도착했을 수 있어요. 목록에서 만들어진 방을 확인한 뒤 새 방을 만들어 주세요.'
                  : '입력한 내용은 저장되지 않아요.',
            ),
            actions: [
              TextButton(
                onPressed: () => complete(false),
                child: const Text('계속 작성'),
              ),
              TextButton(
                onPressed: () => complete(true),
                child: const Text('목록으로'),
              ),
            ],
          ),
        );
        _discardRoute = route;
        final leave = await Navigator.of(
          context,
          rootNavigator: true,
        ).push(route);
        if (identical(_discardRoute, route)) _discardRoute = null;
        if (!current() || leave != true) return;
      }
      if (!current()) return;
      setState(() {
        creating = false;
        title.clear();
        start = null;
        end = null;
      });
      await captured.backToList();
    } finally {
      if (current()) _backPending = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final room = controller.room;
    final inDetail = controller.roomId != null;
    return PopScope(
      canPop: !creating && !inDetail,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            creating
                ? '여행방 만들기'
                : inDetail
                ? '여행방 로비'
                : '내 여행방',
          ),
          leading: creating || inDetail
              ? IconButton(
                  tooltip: '목록으로',
                  onPressed: controller.busy ? null : _back,
                  icon: const Icon(Icons.arrow_back),
                )
              : null,
        ),
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppTokens.pageWidth),
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (!controller.foreground)
                    const AppStatus(message: '앱으로 돌아오면 여행방을 다시 확인해요')
                  else ...[
                    if (controller.busy)
                      const AppStatus(message: '여행방을 확인하고 있어요'),
                    if (controller.error != null) ...[
                      AppStatus(message: controller.error!, isError: true),
                      if (!creating)
                        TextButton(
                          onPressed: controller.busy
                              ? null
                              : controller.refresh,
                          child: const Text('다시 시도'),
                        ),
                    ],
                    if (creating) ...[
                      Text(
                        '새 여행의 시작',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      const Text('친구들과 함께할 여행방을 만들어요.'),
                      const SizedBox(height: 20),
                      TextField(
                        controller: title,
                        enabled: !controller.busy && !controller.pendingCreate,
                        maxLength: 80,
                        decoration: const InputDecoration(labelText: '여행방 이름'),
                        onChanged: (_) => setState(_rememberDraft),
                      ),
                      const Text('여행 날짜는 나중에 정해도 괜찮아요.'),
                      OutlinedButton(
                        onPressed: controller.busy || controller.pendingCreate
                            ? null
                            : () => _date(true),
                        child: Text('시작일: ${_dateText(start) ?? '선택 안 함'}'),
                      ),
                      OutlinedButton(
                        onPressed: controller.busy || controller.pendingCreate
                            ? null
                            : () => _date(false),
                        child: Text('종료일: ${_dateText(end) ?? '선택 안 함'}'),
                      ),
                      if (start != null || end != null)
                        TextButton(
                          onPressed: controller.busy || controller.pendingCreate
                              ? null
                              : () => setState(() {
                                  start = null;
                                  end = null;
                                  _rememberDraft();
                                }),
                          child: const Text('날짜 선택 지우기'),
                        ),
                      if (start != null && end != null && end!.isBefore(start!))
                        const AppStatus(
                          message: '종료일은 시작일 이후로 선택해 주세요.',
                          isError: true,
                        ),
                      if (controller.pendingCreate)
                        const AppStatus(
                          message:
                              '완료 여부를 확인하지 못했어요. 입력을 바꾸지 않고 같은 요청을 다시 확인해요.',
                        ),
                      AppAction(
                        label: controller.pendingCreate
                            ? '같은 요청 다시 확인'
                            : '여행방 만들기',
                        enabled:
                            !controller.busy &&
                            title.text.trim().isNotEmpty &&
                            !(start != null &&
                                end != null &&
                                end!.isBefore(start!)),
                        onPressed: () => controller.create(
                          title.text,
                          _dateText(start),
                          _dateText(end),
                        ),
                      ),
                    ] else if (room != null)
                      if (widget.roomScopeBuilder != null)
                        widget.roomScopeBuilder!(
                          room,
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: _lobby(room.data),
                          ),
                        )
                      else
                        ..._lobby(room.data)
                    else if (!inDetail) ...[
                      Semantics(
                        header: true,
                        child: Text(
                          '우리의 다음 여행',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text('함께 떠날 친구들, 함께 즐길 한 판.'),
                      const SizedBox(height: 20),
                      AppAction(
                        label: '새 여행방 만들기',
                        enabled: !controller.busy,
                        onPressed: () async {
                          setState(() {
                            creating = true;
                            _draftGeneration =
                                widget.createRecovery?.generation ?? 0;
                            _rememberDraft();
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      if (controller.items.isEmpty &&
                          !controller.busy &&
                          controller.error == null)
                        const AppStatus(
                          message:
                              '아직 참여한 여행방이 없어요. 새 방을 만들거나 친구의 초대 링크로 참여해 보세요.',
                        ),
                      for (final item in controller.items)
                        Card(
                          child: ListTile(
                            title: Text(item['title'] as String),
                            subtitle: Text(
                              '${item['status'] == 'closed' ? '여행 종료 · 읽기 전용' : '여행 중'} · ${item['memberCount']}명${item['isAdmin'] == true ? ' · 관리자' : ''}',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: controller.busy
                                ? null
                                : () =>
                                      controller.open(item['roomId'] as String),
                          ),
                        ),
                      if (controller.nextCursor != null)
                        OutlinedButton(
                          onPressed: controller.busy
                              ? null
                              : controller.loadMore,
                          child: const Text('여행방 더 보기'),
                        ),
                      TextButton(
                        onPressed: controller.busy ? null : controller.refresh,
                        child: const Text('목록 새로고침'),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openRun(String runId) async {
    if (_childRoute) return;
    final id = controller.roomId!;
    _childRoute = true;
    controller.setForeground(false);
    try {
      await widget.onOpenRun!(id, runId);
    } finally {
      _childRoute = false;
      if (mounted &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        controller.setForeground(true);
      }
    }
  }

  List<Widget> _lobby(Map<String, Object?> room) {
    final run = room['activeRun'] as Map<String, Object?>?;
    final members = room['members'] as List;
    final self = room['self'] as Map<String, Object?>;
    return [
      Text('OUR TRAVEL ROOM', style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 8),
      Semantics(
        header: true,
        child: Text(
          room['title'] as String,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
      ),
      const SizedBox(height: 8),
      Text(room['status'] == 'closed' ? '여행 종료 · 읽기 전용' : '여행 중'),
      if (room['startDate'] != null || room['endDate'] != null)
        Text('${room['startDate'] ?? '미정'} ~ ${room['endDate'] ?? '미정'}'),
      const SizedBox(height: 16),
      if (run != null)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${const {'team': '팀 나누기', 'draw': '제비뽑기', 'trial': '재판', 'menu': '메뉴 정하기'}[run['type']]} · ${run['status'] == 'draft' ? '준비 중' : '진행 중'}',
                ),
                Text(
                  run['facilitatorMembershipId'] == self['membershipId']
                      ? '이번 판의 진행자예요'
                      : '진행자는 방 관리자와 다를 수 있어요',
                ),
                if (widget.onOpenRun != null)
                  FilledButton(
                    onPressed: () => _openRun(run['runId'] as String),
                    child: const Text('현재 판 보기'),
                  )
                else
                  const Text('게임 화면 연결은 다음 단계에서 제공돼요.'),
              ],
            ),
          ),
        )
      else
        const AppStatus(message: '진행 중인 판이 없어요.'),
      if (widget.roomActionsBuilder != null)
        widget.roomActionsBuilder!(controller.room!),
      Semantics(
        header: true,
        child: Text(
          '함께하는 사람 ${members.length}명',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
      const Text('오프라인이어도 여행방 멤버로 남아요.'),
      for (final raw in members)
        Builder(
          builder: (context) {
            final member = raw as Map<String, Object?>;
            return Padding(
              padding: const EdgeInsets.only(top: 10),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppTokens.memberSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  leading: RoomMemberAvatar(
                    membershipId: member['membershipId'] as String,
                    presetId: member['presetId'] as String? ?? 'preset-01',
                    size: 44,
                    label: '참가자 아바타',
                  ),
                  title: Text(
                    '${member['nickname']}${member['membershipId'] == self['membershipId'] ? ' (나)' : ''}',
                  ),
                  subtitle: Text(
                    '${member['isAdmin'] == true ? '방 관리자 · ' : ''}${run?['facilitatorMembershipId'] == member['membershipId'] ? '게임 진행자 · ' : ''}${member['connected'] == true ? '연결됨' : '오프라인'}',
                  ),
                ),
              ),
            );
          },
        ),
      const SizedBox(height: 16),
      TextButton(
        onPressed: controller.busy ? null : controller.refresh,
        child: const Text('로비 새로고침'),
      ),
    ];
  }
}
