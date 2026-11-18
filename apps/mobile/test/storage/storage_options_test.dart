import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/secure_session_store.dart';
import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'default stores pass resetOnError false and only acknowledge after barrier',
    () async {
      final values = <String, String>{};
      final events = <String>[];
      const channel = MethodChannel(
        'plugins.it_nomads.com/flutter_secure_storage',
      );
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        final args = call.arguments as Map;
        expect((args['options'] as Map)['resetOnError'], 'false');
        final key = args['key'] as String;
        events.add(call.method);
        if (call.method == 'write') {
          values[key] = args['value'] as String;
          return null;
        }
        if (call.method == 'delete') {
          values.remove(key);
          return null;
        }
        if (call.method == 'read') return values[key];
        throw StateError('Unexpected method');
      });
      Future<void> barrier() async {
        events.add('barrier');
      }

      final session = SecureSessionStore(commitBarrier: barrier);
      await session.write('a' * 43);
      expect(events, ['write', 'barrier', 'read']);
      events.clear();
      await session.clear();
      expect(events, ['delete', 'barrier', 'read']);
      final receipt = SecureDeletionReceiptStore(commitBarrier: barrier);
      events.clear();
      await receipt.write(
        DeletionReceipt.pending(
          accountScope: 'A',
          requestId: 'fixed',
          token: 'a' * 43,
          expiresAt: DateTime.now()
              .add(const Duration(days: 1))
              .millisecondsSinceEpoch,
        ),
      );
      expect(events, ['read', 'write', 'barrier', 'read']);
      events.clear();
      await receipt.clear();
      expect(events, ['delete', 'barrier', 'read']);
      messenger.setMockMethodCallHandler(channel, null);
    },
  );
}
