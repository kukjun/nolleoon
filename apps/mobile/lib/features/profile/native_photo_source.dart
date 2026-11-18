import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_picker_android/image_picker_android.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';

import 'photo_source.dart';

/// No path, filename, or EXIF fields cross this port.
abstract interface class GalleryPhotoFile {
  Future<int> length();
  Stream<List<int>> openRead();
}

abstract interface class GalleryPickerPort {
  Future<void> discardLostSelection();
  Future<GalleryPhotoFile?> select();
}

class _SelectedXFile implements GalleryPhotoFile {
  _SelectedXFile(this._file);
  final XFile _file;
  @override
  Future<int> length() => _file.length();
  @override
  Stream<List<int>> openRead() => _file.openRead();
}

/// Calls only the official gallery picker, never camera or video APIs.
class FlutterGalleryPicker implements GalleryPickerPort {
  FlutterGalleryPicker({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;
  @override
  Future<GalleryPhotoFile?> select() async {
    final platform = ImagePickerPlatform.instance;
    if (platform is ImagePickerAndroid) platform.useAndroidPhotoPicker = true;
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      requestFullMetadata: false,
    );
    return file == null ? null : _SelectedXFile(file);
  }

  @override
  Future<void> discardLostSelection() async {
    // Never restore a file selected in a terminated/possibly different account.
    // Consume plugin recovery metadata only; do not open returned file handles.
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      await _picker.retrieveLostData();
    }
  }
}

/// Production stays disabled until native configuration AND device privacy
/// gates are verified. Desktop/web selection is deliberately not enabled.
ProfilePhotoSource? configuredNativePhotoSource({
  required bool nativeConfigurationVerified,
}) {
  if (!nativeConfigurationVerified ||
      kIsWeb ||
      ![
        TargetPlatform.android,
        TargetPlatform.iOS,
      ].contains(defaultTargetPlatform)) {
    return null;
  }
  return NativeProfilePhotoSource(
    picker: FlutterGalleryPicker(),
    nativeConfigurationVerified: true,
  );
}

class NativeProfilePhotoSource implements ProfilePhotoSource {
  NativeProfilePhotoSource({
    required this.picker,
    required this.nativeConfigurationVerified,
  });
  final GalleryPickerPort picker;
  final bool nativeConfigurationVerified;
  bool _selecting = false;
  @override
  Future<PhotoInput?> pick() async {
    if (!nativeConfigurationVerified) {
      throw StateError('Native photo configuration is not verified');
    }
    if (_selecting) throw StateError('A photo selection is already active');
    _selecting = true;
    try {
      await picker.discardLostSelection();
      final selected = await picker.select();
      if (selected == null) return null;
      final length = await selected.length();
      if (length < 1 || length > 1048576) {
        throw const FormatException('사진은 1MiB 이하여야 해요.');
      }
      final builder = BytesBuilder(copy: false);
      var read = 0;
      await for (final chunk in selected.openRead()) {
        read += chunk.length;
        if (read > 1048576 || read > length) {
          throw const FormatException('사진 크기가 바뀌었어요. 다시 선택해 주세요.');
        }
        builder.add(chunk);
      }
      final bytes = builder.takeBytes();
      if (bytes.length != length) {
        bytes.fillRange(0, bytes.length, 0);
        throw const FormatException('사진을 읽지 못했어요.');
      }
      final mime = _mime(bytes);
      if (mime == null) {
        bytes.fillRange(0, bytes.length, 0);
        throw const FormatException('JPEG·PNG·WebP 사진을 선택해 주세요.');
      }
      // The route validates pixel budget, normalizes orientation via Flutter codec,
      // crops to 256px and previews. This adapter owns no upload client.
      return PhotoInput(bytes, mime);
    } on FormatException {
      rethrow;
    } catch (_) {
      throw const FormatException('사진 선택을 완료하지 못했어요.');
    } finally {
      _selecting = false;
    }
  }

  String? _mime(Uint8List b) {
    if (b.length >= 8 &&
        listEquals(b.sublist(0, 8), [137, 80, 78, 71, 13, 10, 26, 10])) {
      return 'image/png';
    }
    if (b.length >= 3 && b[0] == 255 && b[1] == 216 && b[2] == 255) {
      return 'image/jpeg';
    }
    if (b.length >= 12 &&
        listEquals(b.sublist(0, 4), [82, 73, 70, 70]) &&
        listEquals(b.sublist(8, 12), [87, 69, 66, 80])) {
      return 'image/webp';
    }
    return null;
  }
}
