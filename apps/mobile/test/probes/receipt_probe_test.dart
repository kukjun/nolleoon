import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

import '../../test_targets/receipt_process_probe.dart' as probe;

void main() {
  test(
    'OS probe checks original digest even on tokenless confirmed receipt',
    () {
      final now = DateTime.now();
      final expiry = now.add(const Duration(days: 1)).millisecondsSinceEpoch;
      final pending = DeletionReceipt.pending(
        accountScope: probe.probeAccount,
        requestId: probe.probeRequest,
        token: probe.probeToken,
        expiresAt: expiry,
      );
      expect(
        probe.matchesProbeReceipt(pending, expiry, confirmed: false),
        true,
      );
      expect(
        probe.matchesProbeReceipt(pending.confirmed(), expiry, confirmed: true),
        true,
      );
      final json =
          jsonDecode(pending.confirmed().encode()) as Map<String, dynamic>;
      json['tokenDigest'] = '0' * 64;
      final wrong = DeletionReceipt.decode(jsonEncode(json), now: now);
      expect(probe.matchesProbeReceipt(wrong, expiry, confirmed: true), false);
      expect(
        probe.matchesProbeReceipt(
          pending.confirmed(),
          expiry + 1,
          confirmed: true,
        ),
        false,
      );
    },
  );
}
