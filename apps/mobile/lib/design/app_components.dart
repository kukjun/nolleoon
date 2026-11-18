import 'package:material_ui/material_ui.dart';

/// Shared request button. Does not assume a server connection or retry itself.
class AppAction extends StatefulWidget {
  const AppAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
  });
  final String label;
  final Future<void> Function() onPressed;
  final bool enabled;
  @override
  State<AppAction> createState() => _AppActionState();
}

class _AppActionState extends State<AppAction> {
  bool _busy = false;
  bool _failed = false;
  Future<void> _press() async {
    if (_busy || !widget.enabled) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await widget.onPressed();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FilledButton(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
        onPressed: _busy || !widget.enabled ? null : _press,
        child: Text(
          _busy ? '처리 중이에요' : widget.label,
          textAlign: TextAlign.center,
        ),
      ),
      if (_busy) const AppStatus(message: '요청을 처리하고 있어요'),
      if (_failed)
        const AppStatus(message: '완료하지 못했어요. 다시 시도해 주세요.', isError: true),
    ],
  );
}

class AppStatus extends StatelessWidget {
  const AppStatus({super.key, required this.message, this.isError = false});
  final String message;
  final bool isError;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        message,
        style: TextStyle(
          color: isError
              ? Theme.of(context).colorScheme.error
              : Theme.of(context).colorScheme.onSurface,
          height: 1.6,
        ),
      ),
    ),
  );
}

/// Presentation-only step shell: caller owns draft data and step transitions.
class StepPage extends StatefulWidget {
  const StepPage({
    super.key,
    required this.title,
    required this.currentStep,
    required this.totalSteps,
    required this.hasUnsavedChanges,
    required this.onBack,
    required this.child,
  }) : assert(currentStep >= 1 && currentStep <= totalSteps);
  final String title;
  final int currentStep;
  final int totalSteps;
  final bool hasUnsavedChanges;
  final VoidCallback onBack;
  final Widget child;
  @override
  State<StepPage> createState() => _StepPageState();
}

class _StepPageState extends State<StepPage> {
  bool _confirming = false;
  bool _allowPop = false;
  Future<void> _back() async {
    if (_confirming) return;
    _confirming = true;
    try {
      final leave =
          !widget.hasUnsavedChanges ||
          await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('작성을 그만둘까요?'),
                  content: const Text('저장하지 않은 내용은 사라질 수 있어요.'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('계속 작성'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('나가기'),
                    ),
                  ],
                ),
              ) ==
              true;
      if (leave && mounted) {
        setState(() => _allowPop = true);
        await WidgetsBinding.instance.endOfFrame;
        if (mounted) widget.onBack();
      }
    } finally {
      _confirming = false;
      if (mounted && _allowPop) setState(() => _allowPop = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: _allowPop,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) _back();
    },
    child: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                tooltip: '이전 단계',
                onPressed: _back,
                icon: const Icon(Icons.arrow_back),
              ),
            ),
            Semantics(
              label: '${widget.totalSteps}단계 중 ${widget.currentStep}단계',
              excludeSemantics: true,
              child: Text('${widget.currentStep} / ${widget.totalSteps}'),
            ),
            const SizedBox(height: 12),
            Semantics(
              header: true,
              child: Text(
                widget.title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            const SizedBox(height: 24),
            widget.child,
          ],
        ),
      ),
    ),
  );
}
