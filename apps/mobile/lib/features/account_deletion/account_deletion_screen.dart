import 'package:material_ui/material_ui.dart';

import 'account_deletion.dart';

/// Host must retain recovery per verified account, hide private routes during
/// auth checks, and supply account-scoped secure-store/auth/cache cleanup.
class AccountDeletionScreen extends StatefulWidget {
  const AccountDeletionScreen({
    super.key,
    required this.repository,
    required this.recovery,
    required this.onDeleted,
  });
  final AccountDeletionRepository repository;
  final DeletionRecovery recovery;
  final Future<void> Function(String accountScope) onDeleted;
  @override
  State<AccountDeletionScreen> createState() => _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends State<AccountDeletionScreen>
    with WidgetsBindingObserver {
  late AccountDeletionController controller;
  final phrase = TextEditingController();
  bool confirming = false, foreground = true;
  void _bind() {
    controller = AccountDeletionController(
      widget.repository,
      widget.recovery,
      onDeleted: (account) => widget.onDeleted(account),
    );
    controller.addListener(_changed);
    controller.setForeground(foreground);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bind();
  }

  @override
  void didUpdateWidget(covariant AccountDeletionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.repository, widget.repository) ||
        !identical(oldWidget.recovery, widget.recovery)) {
      controller.removeListener(_changed);
      controller.dispose();
      phrase.clear();
      confirming = false;
      _bind();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (!foreground) {
      phrase.clear();
      confirming = false;
    }
    controller.setForeground(foreground);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    phrase.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('계정 탈퇴')),
    body: SafeArea(
      child: !foreground
          ? const Center(child: Text('앱으로 돌아오면 상태를 확인해 주세요.'))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (controller.complete)
                  const Text('계정 탈퇴와 기기 정보 정리를 완료했어요.')
                else if (controller.deleted)
                  const Text('앱 계정 탈퇴가 확인됐어요. 기기의 로그인 정보와 개인 화면을 정리해요.')
                else ...[
                  const Text(
                    '탈퇴하면 되돌릴 수 없어요',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const Text(
                    '본인이 참여한 판에서 모든 작성자의 사건·벌칙·변론·투표 이유 등 자유글이 삭제돼요. 본인이 만든 시작 전 취소 판의 자유글도 삭제돼요. 숫자 집계와 완료·미완료 상태만 남아요.',
                  ),
                  const Text(
                    '진행 중인 판은 미완료로 중단돼요. 공개하지 않은 제비는 새로 공개하지 않아요. 신원·사진·로그인 인증을 정리하며 다른 참가자의 글에도 영향을 줘요.',
                  ),
                  const Text(
                    '다른 멤버가 있는 방의 관리자라면 먼저 관리자를 넘겨야 해요. 혼자 남은 관리자인 방은 삭제 대기로 전환되어 즉시 접근이 차단되고 7일 뒤에는 복구할 수 없어요. 탈퇴한 계정의 복구 권한은 되살릴 수 없어요.',
                  ),
                  const Text(
                    '앱 탈퇴는 즉시 처리돼요. 카카오 연결 해제 실패 시 재시도를 위해 카카오 회원 ID만 최대 7일 보관하며 그동안 같은 계정의 재가입이 차단돼요. 성공하면 즉시 삭제하고, 7일 후에도 실패하면 ID를 삭제하고 자동 재시도를 멈춰요. 이는 연결 해제 성공을 뜻하지 않아요.',
                  ),
                ],
                if (controller.error != null)
                  Semantics(liveRegion: true, child: Text(controller.error!)),
                if (controller.busy) const LinearProgressIndicator(),
                if (!controller.complete && controller.pending) ...[
                  if (!controller.deleted)
                    const Text(
                      '같은 인증과 요청 번호로 탈퇴 영수증을 확인해요. 새 요청을 만들거나 자동 재전송하지 않아요.',
                    ),
                  FilledButton(
                    onPressed: controller.busy ? null : controller.retry,
                    child: Text(
                      controller.deleted ? '기기 정보 정리 다시 시도' : '같은 탈퇴 요청 다시 확인',
                    ),
                  ),
                ] else if (!controller.complete) ...[
                  if (!confirming)
                    OutlinedButton(
                      onPressed: () => setState(() => confirming = true),
                      child: const Text('탈퇴 최종 확인으로'),
                    ),
                  if (confirming) ...[
                    TextField(
                      controller: phrase,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: '확인 문구',
                        hintText: '계정 탈퇴',
                      ),
                    ),
                    const Text('위 영향을 확인했다면 ‘계정 탈퇴’를 정확히 입력한 뒤 아래 버튼을 눌러 주세요.'),
                    TextButton(
                      onPressed: () {
                        phrase.clear();
                        setState(() => confirming = false);
                      },
                      child: const Text('취소'),
                    ),
                    FilledButton(
                      onPressed: phrase.text == '계정 탈퇴' && !controller.busy
                          ? () => controller.confirm(phrase.text)
                          : null,
                      child: const Text('계정 영구 탈퇴'),
                    ),
                  ],
                ],
              ],
            ),
    ),
  );
}
