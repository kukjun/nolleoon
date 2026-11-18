import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:nolleoon_mobile/features/profile/photo_source.dart';
import 'package:nolleoon_mobile/features/profile/photo_selection_owner.dart';

class PendingSource implements ProfilePhotoSource {
  final result = Completer<PhotoInput?>();
  int calls = 0;
  @override
  Future<PhotoInput?> pick() {
    calls++;
    return result.future;
  }
}

void main() {
  test(
    'account handoff consumes once and wrong scope cannot take bytes',
    () async {
      final source = PendingSource();
      final owner = PhotoSelectionOwner('A', source);
      final pick = owner.pick();
      final bytes = Uint8List.fromList([1, 2, 3]);
      source.result.complete(PhotoInput(bytes, 'image/png'));
      await pick;
      expect(owner.take('B'), isNull);
      expect(owner.take('A')!.bytes, same(bytes));
      expect(owner.take('A'), isNull);
      bytes.fillRange(0, bytes.length, 0);
      owner.dispose();
    },
  );
  test(
    'logout/dispose drops late bytes and never restarts an OS picker',
    () async {
      final source = PendingSource();
      final owner = PhotoSelectionOwner('A', source);
      final pick = owner.pick();
      owner.cancel();
      await owner.pick();
      expect(source.calls, 1);
      owner.dispose();
      final bytes = Uint8List.fromList([1, 2, 3]);
      source.result.complete(PhotoInput(bytes, 'image/png'));
      await pick;
      expect(bytes.every((x) => x == 0), true);
    },
  );
  test(
    'cancel clears ready buffer and oversized late input never retained',
    () async {
      final source = PendingSource();
      final owner = PhotoSelectionOwner('A', source);
      final pick = owner.pick();
      final bytes = Uint8List(1048577)..fillRange(0, 1048577, 2);
      source.result.complete(PhotoInput(bytes, 'image/png'));
      await pick;
      expect(owner.hasReady, false);
      expect(owner.failed, true);
      expect(bytes.every((x) => x == 0), true);
      owner.dispose();
    },
  );
}
