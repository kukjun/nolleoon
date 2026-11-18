import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../data/api_client.dart';
import '../../design/app_components.dart';
import 'management_controller.dart';
import 'management_repository.dart';

class ManagementScreen extends StatefulWidget {
  const ManagementScreen({
    super.key,
    required this.repository,
    required this.roomId,
    required this.accountId,
    required this.recovery,
    required this.onSessionLost,
  });
  final ManagementRepository repository;
  final String roomId, accountId;
  final ManagementRecovery recovery;
  final VoidCallback onSessionLost;
  @override
  State<ManagementScreen> createState() => _ManagementScreenState();
}

class _ManagementScreenState extends State<ManagementScreen> {
  late ManagementController controller;
  int _generation = 0;
  (String, String, Completer<bool>)? _dialog;
  final title = TextEditingController(),
      start = TextEditingController(),
      end = TextEditingController();
  bool dirty = false,
      confirming = false,
      _allowPop = false,
      _backPending = false;
  int? _formVersion;
  @override
  void initState() {
    super.initState();
    _bind();
  }

  void _bind() {
    controller = ManagementController(
      widget.repository,
      widget.roomId,
      accountId: widget.accountId,
      recovery: widget.recovery,
      onSessionLost: () => widget.onSessionLost(),
    )..addListener(_changed);
    controller.refresh();
  }

  @override
  void didUpdateWidget(covariant ManagementScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.roomId != widget.roomId ||
        oldWidget.repository != widget.repository ||
        oldWidget.recovery != widget.recovery) {
      _generation++;
      _cancelDialog();
      controller.removeListener(_changed);
      controller.dispose();
      title.clear();
      start.clear();
      end.clear();
      _formVersion = null;
      dirty = false;
      _bind();
    }
  }

  void _cancelDialog() {
    final dialog = _dialog;
    _dialog = null;
    if (dialog != null && !dialog.$3.isCompleted) dialog.$3.complete(false);
  }

  void _answer(bool value) {
    final dialog = _dialog;
    if (dialog == null) return;
    setState(() => _dialog = null);
    dialog.$3.complete(value);
  }

  void _changed() {
    final room = controller.room;
    if (room != null &&
        _formVersion != room.version &&
        controller.state == ManagementState.ready) {
      title.text = room.data['title'] as String;
      start.text = room.data['startDate'] as String? ?? '';
      end.text = room.data['endDate'] as String? ?? '';
      _formVersion = room.version;
      dirty = false;
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _generation++;
    _cancelDialog();
    controller.removeListener(_changed);
    controller.dispose();
    title.dispose();
    start.dispose();
    end.dispose();
    super.dispose();
  }

  Future<bool> _confirm(String heading, String detail) async {
    if (confirming) return false;
    confirming = true;
    final completion = Completer<bool>();
    setState(() => _dialog = (heading, detail, completion));
    try {
      return await completion.future;
    } finally {
      confirming = false;
    }
  }

  Future<void> _act(
    ApiOperation op,
    String heading,
    String detail, {
    Map<String, Object?> values = const {},
    String? target,
  }) async {
    final generation = _generation;
    if (!await _confirm(heading, detail) ||
        !mounted ||
        generation != _generation) {
      return;
    }
    await controller.submit(op, values: values, target: target);
  }

  Future<void> _back() async {
    if (_backPending) return;
    _backPending = true;
    try {
      if ((dirty || controller.pending != null) &&
          !await _confirm(
            '관리 화면을 나갈까요?',
            controller.pending != null
                ? '서버 처리 여부가 아직 불명확해요. 자동으로 요청을 다시 보내지 않아요.'
                : '저장하지 않은 수정 내용은 사라져요.',
          )) {
        return;
      }
      if (!mounted) return;
      setState(() => _allowPop = true);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) await Navigator.maybePop(context);
    } finally {
      _backPending = false;
      if (mounted) setState(() => _allowPop = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dialog = _dialog;
    if (dialog != null) {
      return PopScope<void>(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _answer(false);
        },
        child: Scaffold(
          body: SafeArea(
            child: Center(
              child: AlertDialog(
                scrollable: true,
                title: Text(dialog.$1),
                content: Text(dialog.$2),
                actions: [
                  TextButton(
                    onPressed: () => _answer(false),
                    child: const Text('취소'),
                  ),
                  FilledButton(
                    onPressed: () => _answer(true),
                    child: const Text('확인'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    final c = controller, r = c.room;
    return PopScope<void>(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          leading: IconButton(
            tooltip: '이전 화면',
            onPressed: _back,
            icon: const Icon(Icons.arrow_back),
          ),
          title: const Text('여행방 관리'),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (c.message != null)
                  AppStatus(
                    message: c.message!,
                    isError:
                        c.state != ManagementState.ready &&
                        c.state != ManagementState.finished,
                  ),
                if (c.state == ManagementState.loading ||
                    c.state == ManagementState.busy)
                  const AppStatus(message: '서버 상태를 확인하고 있어요.'),
                if (c.state == ManagementState.uncertain)
                  AppAction(label: '같은 요청 다시 확인', onPressed: c.retry),
                if (c.state == ManagementState.conflict ||
                    c.state == ManagementState.error)
                  AppAction(label: '방 상태 다시 불러오기', onPressed: c.refresh),
                if (r != null && c.state == ManagementState.ready) ...[
                  Text(
                    r.data['title'] as String,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  if (c.active)
                    const Text('진행 중인 게임이 있어 닫기·삭제·퇴장·추방은 지금 할 수 없어요.'),
                  if (c.admin) ...[
                    if (c.open) ...[
                      TextField(
                        controller: title,
                        maxLength: 80,
                        onChanged: (_) => setState(() => dirty = true),
                        decoration: const InputDecoration(labelText: '방 이름'),
                      ),
                      TextField(
                        controller: start,
                        onChanged: (_) => setState(() => dirty = true),
                        decoration: const InputDecoration(
                          labelText: '시작일 (YYYY-MM-DD, 선택)',
                        ),
                      ),
                      TextField(
                        controller: end,
                        onChanged: (_) => setState(() => dirty = true),
                        decoration: const InputDecoration(
                          labelText: '종료일 (YYYY-MM-DD, 선택)',
                        ),
                      ),
                      AppAction(
                        label: '방 정보 저장',
                        onPressed: () => _act(
                          ApiOperation.updateRoom,
                          '방 정보를 바꿀까요?',
                          title.text,
                          values: {
                            'title': title.text.trim(),
                            'startDate': start.text.trim().isEmpty
                                ? null
                                : start.text.trim(),
                            'endDate': end.text.trim().isEmpty
                                ? null
                                : end.text.trim(),
                          },
                        ),
                      ),
                    ],
                    if (c.permits(ApiOperation.roomStatus))
                      AppAction(
                        label: c.open ? '방 닫기' : '방 다시 열기',
                        onPressed: () => _act(
                          ApiOperation.roomStatus,
                          c.open ? '방을 닫을까요?' : '방을 다시 열까요?',
                          '방의 참여 가능 상태가 바뀌어요.',
                          values: {'status': c.open ? 'closed' : 'open'},
                        ),
                      ),
                    for (final m in r.data['members'] as List)
                      if ((m as Map)['membershipId'] !=
                          (r.data['self'] as Map)['membershipId']) ...[
                        Text(m['nickname'] as String),
                        if (c.permits(
                          ApiOperation.transferAdministrator,
                          target: m['membershipId'] as String,
                        ))
                          AppAction(
                            label: '${m['nickname']}에게 관리자 위임',
                            onPressed: () => _act(
                              ApiOperation.transferAdministrator,
                              '관리자를 위임할까요?',
                              '${m['nickname']}님이 관리자가 되고 내 관리 권한은 없어져요.',
                              target: m['membershipId'] as String,
                            ),
                          ),
                        if (c.permits(
                          ApiOperation.removeMember,
                          target: m['membershipId'] as String,
                        ))
                          AppAction(
                            label: '${m['nickname']} 내보내기',
                            onPressed: () => _act(
                              ApiOperation.removeMember,
                              '이 참가자를 내보낼까요?',
                              '${m['nickname']}님은 이 방에 다시 참여할 수 없어요.',
                              target: m['membershipId'] as String,
                            ),
                          ),
                      ],
                    const Text(
                      '관리자는 바로 퇴장할 수 없어요. 다른 참가자에게 위임하거나 방 삭제를 이용해 주세요.',
                    ),
                    if (c.permits(ApiOperation.deleteRoom))
                      AppAction(
                        label: '방 삭제',
                        onPressed: () => _act(
                          ApiOperation.deleteRoom,
                          '방을 삭제할까요?',
                          '모든 참가자의 방 접근이 중지돼요. 7일 이내 복원할 수 있고 이후에는 영구 삭제돼요.',
                          values: {'confirmation': 'DELETE_ROOM'},
                        ),
                      ),
                  ] else if (c.permits(ApiOperation.leaveRoom))
                    AppAction(
                      label: '방 나가기',
                      onPressed: () => _act(
                        ApiOperation.leaveRoom,
                        '이 방에서 나갈까요?',
                        '이 방에 다시 참여할 수 없어요.',
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
