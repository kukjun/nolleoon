import 'package:material_ui/material_ui.dart';

import 'history_controller.dart';
import 'history_repository.dart';
import 'history_summary.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({
    super.key,
    required this.repository,
    required this.roomId,
    required this.accountScope,
    required this.onSessionLost,
  });
  final HistoryRepository repository;
  final String roomId, accountScope;
  final VoidCallback onSessionLost;
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with WidgetsBindingObserver {
  late HistoryController controller;
  bool _foreground = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    _foreground = lifecycle == null || lifecycle == AppLifecycleState.resumed;
    _bind();
  }

  void _bind() {
    if (widget.accountScope.isEmpty) {
      throw ArgumentError('Verified account scope required');
    }
    controller = HistoryController(
      widget.repository,
      widget.roomId,
      onSessionLost: () => widget.onSessionLost(),
    )..addListener(_changed);
    if (_foreground) {
      controller.refresh();
    } else {
      controller.setForeground(false);
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(covariant HistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountScope != widget.accountScope ||
        oldWidget.roomId != widget.roomId ||
        oldWidget.repository != widget.repository) {
      controller.removeListener(_changed);
      controller.dispose();
      _bind();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    controller.setForeground(_foreground);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    super.dispose();
  }

  String _date(int milliseconds) {
    if (milliseconds > 8640000000000000) return '시간 정보 확인 불가';
    final date = DateTime.fromMillisecondsSinceEpoch(milliseconds).toLocal();
    return '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final c = controller, detail = c.detail;
    return PopScope<void>(
      canPop: detail == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) c.closeDetail();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('이 방의 게임 기록'),
          leading: detail == null
              ? null
              : IconButton(
                  tooltip: '기록 목록',
                  onPressed: c.closeDetail,
                  icon: const Icon(Icons.arrow_back),
                ),
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                '현재 계정에 서버가 공개한 기록만 표시해요. 삭제·접근 제한 상태는 복원하거나 추정하지 않아요.',
              ),
              if (c.busy) const LinearProgressIndicator(),
              if (c.error != null)
                Semantics(liveRegion: true, child: Text(c.error!)),
              if (!c.foreground)
                const Text('화면을 비웠어요. 다시 돌아오면 서버 상태를 확인해요.')
              else if (detail != null) ...[
                Text(
                  '${historyKind(detail)} · ${historyStatus(detail)}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(_date(detail.data['createdAt'] as int)),
                for (final line in historyLines(detail))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(line),
                  ),
                if (detail.game?.kind == 'trial' &&
                    !(detail.game?.restricted ?? true) &&
                    !(detail.game?.redacted ?? true))
                  const Text('익명 이유도 내용으로 작성자를 짐작할 수 있어요.'),
                OutlinedButton(
                  onPressed: c.busy ? null : () => c.select(detail.runId),
                  child: const Text('상세 다시 확인'),
                ),
              ] else ...[
                if (!c.busy && c.items.isEmpty && c.error == null)
                  const Text('표시할 기록이 없어요.'),
                for (final run in c.items)
                  Card(
                    key: ValueKey(run.runId),
                    child: ListTile(
                      title: Text(
                        '${historyKind(run)} · ${historyStatus(run)}',
                      ),
                      subtitle: Text(
                        '${_date(run.data['createdAt'] as int)}${run.game?.redacted == true ? ' · 개인 내용 삭제됨' : ''}',
                      ),
                      onTap: c.busy ? null : () => c.select(run.runId),
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  ),
                if (c.nextCursor != null)
                  OutlinedButton(
                    onPressed: c.busy ? null : c.more,
                    child: const Text('이전 기록 더 보기'),
                  ),
                OutlinedButton(
                  onPressed: c.busy ? null : c.refresh,
                  child: const Text('목록 다시 확인'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
