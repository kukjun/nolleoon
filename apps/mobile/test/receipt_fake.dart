import 'package:nolleoon_mobile/features/account_deletion/deletion_receipt_store.dart';

class ReceiptFake implements DeletionReceiptStore {
  DeletionReceipt? value;
  bool failRead = false, failWrite = false, failClear = false;
  int writes = 0, clears = 0;
  @override
  Future<DeletionReceipt?> read() async {
    if (failRead) throw const FormatException('synthetic invalid receipt');
    return value == null
        ? null
        : DeletionReceipt.decode(value!.encode(), now: DateTime.now());
  }

  @override
  Future<void> write(DeletionReceipt receipt) async {
    if (failWrite) throw StateError('synthetic storage failure');
    writes++;
    value = DeletionReceipt.decode(receipt.encode(), now: DateTime.now());
  }

  @override
  Future<void> clear() async {
    if (failClear) throw StateError('synthetic clear failure');
    clears++;
    value = null;
    failRead = false;
  }
}
