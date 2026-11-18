import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/auth/storage_commit_barrier.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.android);
  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    messenger.setMockMethodCallHandler(
      NativeStorageCommitBarrier.channel,
      null,
    );
  });
  test('fixed channel null args accepts only true, errors and missing bridge fail closed', () async {
    final results = <Object?>[false, null, 1, 'true', true];
    for (final value in results) {
      messenger.setMockMethodCallHandler(NativeStorageCommitBarrier.channel, (
        call,
      ) async {
        expect(call.method, 'flush');
        expect(call.arguments, isNull);
        return value;
      });
      if (value == true) {
        await NativeStorageCommitBarrier.flush();
      } else {
        await expectLater(NativeStorageCommitBarrier.flush(), throwsStateError);
      }
    }
    messenger.setMockMethodCallHandler(
      NativeStorageCommitBarrier.channel,
      (_) async =>
          throw PlatformException(code: 'synthetic', message: 'private'),
    );
    await expectLater(
      NativeStorageCommitBarrier.flush(),
      throwsA(
        isA<StateError>().having(
          (e) => e.toString(),
          'sanitized',
          isNot(contains('private')),
        ),
      ),
    );
    messenger.setMockMethodCallHandler(
      NativeStorageCommitBarrier.channel,
      null,
    );
    await expectLater(NativeStorageCommitBarrier.flush(), throwsStateError);
  });
  testWidgets('missing acknowledgement times out fail closed', (tester) async {
    final held = Completer<Object?>();
    messenger.setMockMethodCallHandler(
      NativeStorageCommitBarrier.channel,
      (_) => held.future,
    );
    final waiting = expectLater(
      NativeStorageCommitBarrier.flush(),
      throwsStateError,
    );
    await tester.pump(const Duration(seconds: 6));
    await waiting;
    held.complete(true);
    await tester.pump();
    debugDefaultTargetPlatformOverride = null;
  });
  test(
    'iOS leaves native keychain path unchanged without Android bridge call',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      var count = 0;
      messenger.setMockMethodCallHandler(NativeStorageCommitBarrier.channel, (
        _,
      ) async {
        count++;
        return false;
      });
      await NativeStorageCommitBarrier.flush();
      expect(count, 0);
    },
  );
}
