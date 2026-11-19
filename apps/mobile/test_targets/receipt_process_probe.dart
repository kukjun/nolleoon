// Dedicated debug-only OS storage probe. Never production app main.

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

const probeAccount = 'synthetic-receipt-probe-account';
const probeRequest = 'synthetic-receipt-probe-request';
final probeToken = List.filled(43, 'S').join();
bool matchesProbeReceipt(
  DeletionReceipt? receipt,
  int expiry, {
  required bool confirmed,
}) {
  final expected = DeletionReceipt.pending(
    accountScope: probeAccount,
    requestId: probeRequest,
    token: probeToken,
    expiresAt: expiry,
  );
  return receipt != null &&
      receipt.accountScope == probeAccount &&
      receipt.requestId == probeRequest &&
      receipt.expiresAt == expiry &&
      receipt.serverConfirmed == confirmed &&
      receipt.tokenDigest == expected.tokenDigest &&
      (confirmed ? receipt.token == null : receipt.token == probeToken);
}

void require(bool value) {
  if (!value) throw StateError('Probe check failed');
}

Future<void> probe(String route) async {
  require(
    kDebugMode && !kIsWeb && defaultTargetPlatform == TargetPlatform.android,
  );
  final parts = route.split('/');
  require(parts.length == 4 && parts[1] == 'receipt-probe');
  final step = parts[2], expiry = int.tryParse(parts[3]);
  require(
    expiry != null &&
        expiry > DateTime.now().millisecondsSinceEpoch &&
        expiry <=
            DateTime.now().add(const Duration(days: 30)).millisecondsSinceEpoch,
  );
  final receiptStore = SecureDeletionReceiptStore(),
      sessionStore = SecureSessionStore();
  final receipt = await receiptStore.read();
  final session = await sessionStore.read();
  void matches({required bool confirmed}) {
    require(matchesProbeReceipt(receipt, expiry!, confirmed: confirmed));
  }

  switch (step) {
    case 'seed':
      require(receipt == null && session == null);
      await sessionStore.write(probeToken);
      await receiptStore.write(
        DeletionReceipt.pending(
          accountScope: probeAccount,
          requestId: probeRequest,
          token: probeToken,
          expiresAt: expiry!,
        ),
      );
    case 'check-pending':
      matches(confirmed: false);
      require(session == probeToken);
    case 'confirm':
      matches(confirmed: false);
      require(session == probeToken);
      await receiptStore.write(receipt!.confirmed());
      await sessionStore.clear();
    case 'check-confirmed':
      matches(confirmed: true);
      require(session == null);
    case 'clear':
      matches(confirmed: true);
      require(session == null);
      await receiptStore.clear();
    case 'check-clear':
      require(receipt == null && session == null);
    default:
      throw StateError('Unknown probe step');
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final route = PlatformDispatcher.instance.defaultRouteName;
  var result = 'FAIL';
  try {
    await probe(route);
    result = 'PASS';
  } catch (_) {
    /* Never log plugin errors or storage data. */
  }
  final step =
      RegExp(r'^/receipt-probe/([a-z-]+)/[0-9]+$')
          .firstMatch(route)
          ?.group(1) ??
      'invalid';
  final status = 'RECEIPT_PROBE $step $result';
  // Only a stage verdict. No token, digest, storage payload, or account data.
  debugPrint(status);
  runApp(
    MaterialApp(
      initialRoute: '/',
      home: Scaffold(body: Center(child: Text(status))),
    ),
  );
}
