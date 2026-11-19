import '../../data/api_origin.dart';

import 'dart:math';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../data/api_client.dart';
import 'deletion_receipt_store.dart';
export 'deletion_receipt_store.dart';

/// Fixed credential snapshot: a deleted session's receipt must NOT be retried
/// with a newly signed-in account's token. Production injects a secure receipt store.
class AccountDeletionRepository {
  AccountDeletionRepository({
    required this.accountScope,
    required String token,
    required this.transport,
    String Function()? requestId,
    this.receiptStore,
    this.expiresAt,
  }) : _token = token,
       requestId = requestId ?? _id {
    if ((receiptStore == null) != (expiresAt == null)) {
      throw ArgumentError('Receipt store requires original session expiry');
    }
    if (accountScope.isEmpty ||
        !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      throw ArgumentError('Verified native account required');
    }
  }
  AccountDeletionRepository._restored(
    DeletionReceipt receipt,
    this.transport,
    this.receiptStore,
  ) : accountScope = receipt.accountScope,
      expiresAt = receipt.expiresAt,
      requestId = (() => receipt.requestId),
      _token = receipt.token,
      _receipt = receipt,
      _serverConfirmed = receipt.serverConfirmed;
  final DeletionReceiptStore? receiptStore;
  final int? expiresAt;
  DeletionReceipt? _receipt;
  bool _serverConfirmed = false;
  bool get serverConfirmed => _serverConfirmed;
  final String accountScope;
  final ApiTransport transport;
  final String Function() requestId;
  String? _token;
  static String _id() {
    final random = Random.secure();
    return List.generate(
      24,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
  }

  MutationIntent prepare() => MutationIntent(
    operation: ApiOperation.deleteAccount,
    body: {'requestId': requestId(), 'confirmation': '계정 탈퇴'},
  );
  Future<void> execute(MutationIntent intent, CancellationToken cancel) async {
    if (ApiOrigin.configured.isVerification) {
      throw StateError('Account deletion is outside verification scope');
    }
    if (_serverConfirmed) {
      await persistConfirmation();
      return;
    }
    final body = jsonDecode(intent.serializedBody);
    if (intent.operation != ApiOperation.deleteAccount ||
        body is! Map ||
        body.length != 2 ||
        body['confirmation'] != '계정 탈퇴' ||
        body['requestId'] is! String) {
      throw ArgumentError('Fixed deletion request required');
    }
    if (receiptStore != null) {
      _receipt ??= DeletionReceipt.pending(
        accountScope: accountScope,
        requestId: body['requestId'] as String,
        token: _token!,
        expiresAt: expiresAt!,
      );
      if (_receipt!.requestId != body['requestId']) {
        throw StateError('Deletion request changed');
      }
      await receiptStore!.write(_receipt!);
      if (cancel.isCancelled) throw const ApiFailure(FailureKind.cancelled);
    }
    final token = _token;
    if (token == null) throw const ApiFailure(FailureKind.unauthenticated);
    final client = ApiClient(
      transport: transport,
      resolver: const NativeRoutes(),
      accessToken: () async => token,
    );
    await client.mutate(intent, (value) {
      if (value is! Map || value.length != 1 || value['deleted'] != true) {
        throw const ApiFailure(FailureKind.invalidResponse);
      }
      return true;
    }, cancel: cancel);
    _serverConfirmed = true;
    forgetCredential();
    _receipt = _receipt?.confirmed();
    await persistConfirmation();
  }

  Future<void> persistConfirmation() async {
    if (_serverConfirmed && receiptStore != null) {
      await receiptStore!.write(_receipt!.confirmed());
    }
  }

  Future<void> clearReceipt() async {
    await receiptStore?.clear();
  }

  void forgetCredential() {
    _token = null;
    _receipt = _serverConfirmed ? _receipt?.confirmed() : null;
  }

  @override
  String toString() => 'AccountDeletionRepository(redacted)';
}

/// Caller retains this in account-scoped memory across background/remount.
/// Clear on explicit logout/account change. Only the bounded receipt store may persist intent.
class DeletionRecovery {
  DeletionRecovery(this._account);
  factory DeletionRecovery.restore(
    DeletionReceipt receipt, {
    required ApiTransport transport,
    required DeletionReceiptStore store,
  }) {
    receipt = DeletionReceipt.decode(receipt.encode(), now: DateTime.now());
    final recovery = DeletionRecovery(receipt.accountScope);
    final repo = AccountDeletionRepository._restored(receipt, transport, store);
    recovery._repository = repo;
    recovery._intent = repo.prepare();
    recovery._deleted = receipt.serverConfirmed;
    return recovery;
  }
  AccountDeletionRepository? get pendingRepository => _repository;
  bool get hasPending => _intent != null;
  bool get serverDeleted => _deleted;
  bool get completed => _complete;
  String _account;
  int _epoch = 0;
  MutationIntent? _intent;
  AccountDeletionRepository? _repository;
  bool _deleted = false, _complete = false;
  bool owns(String account) => _account == account;
  void bind(String account) {
    if (_account != account) {
      clear();
      _account = account;
    }
  }

  void clear() {
    _epoch++;
    _repository?.forgetCredential();
    _repository = null;
    _intent = null;
    _deleted = false;
    _complete = false;
  }

  @override
  String toString() => 'DeletionRecovery(redacted)';
}

class AccountDeletionController extends ChangeNotifier {
  AccountDeletionController(
    this.repository,
    this.recovery, {
    required this.onDeleted,
  }) : _ownerEpoch = recovery._epoch {
    if (!recovery.owns(repository.accountScope)) {
      throw ArgumentError('Account scope mismatch');
    }
  }
  final AccountDeletionRepository repository;
  final DeletionRecovery recovery;
  final int _ownerEpoch;

  /// Must clear secure native storage, auth identity, and ALL private caches for
  /// this account. Must not log out a different current account. Failure must
  /// throw so the UI can offer local cleanup retry without repeating deletion.
  final Future<void> Function(String accountScope) onDeleted;
  bool busy = false, _disposed = false, _foreground = true;
  int _generation = 0;
  CancellationToken? _cancel;
  String? error;
  bool get _owned =>
      recovery.owns(repository.accountScope) && recovery._epoch == _ownerEpoch;
  bool get pending => _owned && recovery._intent != null;
  bool get deleted => _owned && recovery._deleted;
  bool get complete => _owned && recovery._complete;
  bool get foreground => _foreground;
  bool _current(int g) =>
      !_disposed && _foreground && _owned && g == _generation;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void setForeground(bool value) {
    _foreground = value;
    if (!value) {
      _generation++;
      _cancel?.cancel();
      _cancel = null;
      busy = false;
      error = null;
    }
    _notify();
  }

  Future<void> confirm(String phrase) async {
    if (phrase != '계정 탈퇴' ||
        busy ||
        _disposed ||
        !_foreground ||
        !_owned ||
        complete) {
      return;
    }
    recovery._intent ??= repository.prepare();
    recovery._repository ??= repository;
    await retry();
  }

  Future<void> retry() async {
    if (busy || _disposed || !_foreground || !_owned || complete || !pending) {
      return;
    }
    final generation = ++_generation, cancel = CancellationToken();
    _cancel = cancel;
    busy = true;
    error = null;
    _notify();
    try {
      if (!deleted) {
        try {
          await recovery._repository!.execute(recovery._intent!, cancel);
        } finally {
          if (_owned && recovery._repository?.serverConfirmed == true) {
            recovery._deleted = true;
            repository.forgetCredential();
          }
        }
        if (!_current(generation)) return;
        recovery._deleted = true;
        recovery._repository?.forgetCredential();
        repository.forgetCredential();
      }
      if (!_current(generation)) return;
      await recovery._repository!.persistConfirmation();
      if (!_current(generation)) return;
      await onDeleted(repository.accountScope);
      if (!_current(generation)) return;
      await recovery._repository!.clearReceipt();
      if (!_current(generation)) return;
      recovery._complete = true;
    } catch (e) {
      if (!_current(generation)) return;
      if (deleted) {
        error = '서버 탈퇴는 확인됐지만 기기 로그인 정보 정리를 끝내지 못했어요. 정리만 다시 시도해 주세요.';
      } else if (e is ApiFailure && e.status == 409) {
        error =
            '다른 멤버가 있는 방의 관리자라면 먼저 관리자를 넘겨 주세요. 상태 확인 뒤 같은 요청으로 다시 시도할 수 있어요.';
      } else if (e is ApiFailure &&
          (e.status == 401 || e.kind == FailureKind.unauthenticated)) {
        error = '이 인증으로 탈퇴 영수증을 확인할 수 없어요. 완료 여부를 단정할 수 없으니 새 계정으로 이 요청을 재전송하지 마세요.';
      } else {
        error = '탈퇴 완료 여부를 확인하지 못했어요. 자동 재시도하지 않으며 같은 요청으로만 다시 확인해요.';
      }
    } finally {
      if (_current(generation)) {
        busy = false;
        _cancel = null;
        _notify();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _cancel?.cancel();
    super.dispose();
  }
}
