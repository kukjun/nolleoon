import 'package:material_ui/material_ui.dart';

import '../../design/app_components.dart';
import 'invites_controller.dart';

/// Caller owns controller lifetime and authentication. Login returning never joins.
class InvitationScreen extends StatelessWidget {
  const InvitationScreen({
    super.key,
    required this.controller,
    required this.onLoginRequested,
    required this.onCancel,
  });
  final InvitesController controller;
  final Future<void> Function() onLoginRequested;
  final VoidCallback onCancel;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        title: const Text('여행방 초대'),
        leading: IconButton(
          tooltip: '초대 닫기',
          icon: const Icon(Icons.close),
          onPressed: () {
            controller.cancel();
            onCancel();
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('함께할 여행방에 초대받았어요.'),
              const Text(
                '로그인 후 참가 버튼을 눌러야 여행방에 들어가요. 참가 전에는 방의 개인정보를 표시하지 않아요.',
              ),
              if (controller.busy) const AppStatus(message: '초대를 확인하고 있어요'),
              if (controller.error != null)
                AppStatus(message: controller.error!, isError: true),
              if (controller.joined != null)
                const AppStatus(message: '참가했어요. 여행방으로 이동해 주세요.'),
              if (controller.joined == null &&
                  controller.available &&
                  controller.accountId == null)
                AppAction(
                  label: '로그인하고 초대 확인',
                  enabled: !controller.busy,
                  onPressed: onLoginRequested,
                ),
              if (controller.joined == null &&
                  controller.available &&
                  controller.accountId != null)
                AppAction(
                  label: controller.error == null ? '여행방 참가' : '같은 참가 요청 다시 확인',
                  enabled: !controller.busy,
                  onPressed: controller.join,
                ),
              if (!controller.available &&
                  !controller.busy &&
                  controller.link != null)
                AppAction(label: '초대 다시 확인', onPressed: controller.preview),
            ],
          ),
        ),
      ),
    ),
  );
}
