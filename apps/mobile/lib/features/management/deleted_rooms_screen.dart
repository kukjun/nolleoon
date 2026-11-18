import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../data/api_client.dart';
import '../../design/app_components.dart';
import 'management_controller.dart';
import 'management_repository.dart';

class DeletedRoomsScreen extends StatefulWidget {
  const DeletedRoomsScreen({
    super.key,
    required this.repository,
    required this.accountId,
    required this.recovery,
    required this.onSessionLost,
  });
  final ManagementRepository repository;
  final String accountId;
  final ManagementRecovery recovery;
  final VoidCallback onSessionLost;
  @override
  State<DeletedRoomsScreen> createState() => _DeletedRoomsScreenState();
}

class _DeletedRoomsScreenState extends State<DeletedRoomsScreen> {
  List<DeletedRoom> items = [];
  bool busy = false, confirming = false;
  String? message;
  CancellationToken cancel = CancellationToken();
  int _generation = 0;
  (DeletedRoom, Completer<bool>)? _dialog;
  @override
  void initState() {
    super.initState();
    if (widget.accountId.isEmpty ||
        widget.recovery.accountId != widget.accountId ||
        (widget.recovery.pending != null &&
            widget.recovery.pending!.operation != ApiOperation.restoreRoom)) {
      throw ArgumentError('Recovery owner mismatch');
    }
    _load();
  }

  @override
  void didUpdateWidget(covariant DeletedRoomsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.repository != widget.repository ||
        oldWidget.recovery != widget.recovery) {
      _generation++;
      cancel.cancel();
      cancel = CancellationToken();
      _cancelDialog();
      items = [];
      message = null;
      busy = false;
      if (widget.accountId.isEmpty ||
          widget.recovery.accountId != widget.accountId) {
        throw ArgumentError('Recovery owner mismatch');
      }
      _load();
    }
  }

  void _cancelDialog() {
    final d = _dialog;
    _dialog = null;
    if (d != null && !d.$2.isCompleted) d.$2.complete(false);
  }

  void _answer(bool value) {
    final d = _dialog;
    if (d == null) return;
    setState(() => _dialog = null);
    d.$2.complete(value);
  }

  @override
  void dispose() {
    _generation++;
    _cancelDialog();
    cancel.cancel();
    items = [];
    super.dispose();
  }

  Future<void> _load() async {
    if (busy) return;
    setState(() {
      busy = true;
      items = [];
    });
    final generation = _generation;
    try {
      final rows = await widget.repository.deleted(cancel: cancel);
      if (mounted && generation == _generation) setState(() => items = rows);
    } catch (e) {
      if (generation == _generation) _failure(e, false);
    } finally {
      if (mounted && generation == _generation) setState(() => busy = false);
    }
  }

  void _failure(Object e, bool mutation) {
    if (!mounted) return;
    if (e is ApiFailure &&
        (e.status == 401 || e.kind == FailureKind.unauthenticated)) {
      items = [];
      widget.recovery.clear();
      widget.onSessionLost();
      message = '다시 로그인해 주세요.';
    } else if (mutation &&
        (e is! ApiFailure || e.status == null || e.status! >= 500)) {
      message = '복원 처리 여부를 확인하지 못했어요. 같은 요청을 다시 확인해 주세요.';
    } else {
      if (mutation) widget.recovery.clear();
      message = '복원 기간·권한 또는 방 상태가 바뀌었을 수 있어요. 목록을 다시 확인해 주세요.';
    }
  }

  Future<void> _restore(DeletedRoom room) async {
    if (busy || confirming || widget.recovery.pending != null) return;
    confirming = true;
    final generation = _generation;
    final completion = Completer<bool>();
    setState(() => _dialog = (room, completion));
    final confirmed = await completion.future;
    confirming = false;
    if (!mounted || generation != _generation || confirmed != true) return;
    widget.recovery.pending = widget.repository.restoreIntent(room);
    await _send();
  }

  Future<void> _send() async {
    final intent = widget.recovery.pending;
    if (busy || intent == null) return;
    final generation = _generation;
    setState(() => busy = true);
    var success = false;
    try {
      await widget.repository.execute(intent, cancel: cancel);
      if (!mounted || generation != _generation) return;
      widget.recovery.clear();
      message = '방을 복원했어요.';
      success = true;
    } catch (e) {
      if (generation == _generation) _failure(e, true);
    } finally {
      if (mounted && generation == _generation) setState(() => busy = false);
    }
    if (success && mounted && generation == _generation) await _load();
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
                title: const Text('방을 복원할까요?'),
                content: Text('${dialog.$1.title}\n기존 참가자와 삭제 전 방 상태가 복원돼요.'),
                actions: [
                  TextButton(
                    onPressed: () => _answer(false),
                    child: const Text('취소'),
                  ),
                  FilledButton(
                    onPressed: () => _answer(true),
                    child: const Text('복원'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('삭제 대기 중인 방')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                '관리자로 삭제한 방을 7일 이내 복원할 수 있어요. 영구 삭제된 방은 여기에 표시되지 않아요.',
              ),
              if (message != null) AppStatus(message: message!),
              if (busy) const AppStatus(message: '상태를 확인하고 있어요.'),
              if (widget.recovery.pending != null)
                AppAction(
                  label: '같은 복원 요청 다시 확인',
                  enabled: !busy,
                  onPressed: _send,
                ),
              if (!busy && items.isEmpty) const Text('복원할 방이 없어요.'),
              for (final room in items)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(room.title),
                        Text(
                          '복원 기한: ${DateTime.fromMillisecondsSinceEpoch(room.purgeAfter).toLocal()}',
                        ),
                        AppAction(
                          label: '방 복원',
                          enabled: !busy && widget.recovery.pending == null,
                          onPressed: () => _restore(room),
                        ),
                      ],
                    ),
                  ),
                ),
              AppAction(label: '목록 다시 확인', enabled: !busy, onPressed: _load),
            ],
          ),
        ),
      ),
    );
  }
}
