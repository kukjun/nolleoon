import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

const profilePresets = <String, String>{
  'preset-01': '판사',
  'preset-02': '검사',
  'preset-03': '변호사',
  'preset-04': '피고',
  'preset-05': '여우',
  'preset-06': '고양이',
  'preset-07': '강아지',
  'preset-08': '토끼',
  'preset-09': '곰',
  'preset-10': '펭귄',
};

/// Private decoded photo is explicitly disposed, never entered in Flutter's
/// shared ImageCache (unlike Image.network / MemoryImage). Public presets cache.
class ProfileAvatar extends StatefulWidget {
  const ProfileAvatar({
    super.key,
    this.bytes,
    this.presetId,
    this.size = 80,
    this.label = '내 프로필 사진',
  });
  final Uint8List? bytes;
  final String? presetId;
  final double size;
  final String label;
  @override
  State<ProfileAvatar> createState() => _ProfileAvatarState();
}

class _ProfileAvatarState extends State<ProfileAvatar> {
  ui.Image? _image;
  int _generation = 0;
  @override
  void initState() {
    super.initState();
    _decode();
  }

  @override
  void didUpdateWidget(ProfileAvatar old) {
    super.didUpdateWidget(old);
    if (!identical(old.bytes, widget.bytes)) _decode();
  }

  Future<void> _decode() async {
    final generation = ++_generation;
    _image?.dispose();
    _image = null;
    final data = widget.bytes;
    if (data == null) return;
    final copy = Uint8List.fromList(data);
    ui.Codec? codec;
    ui.ImmutableBuffer? buffer;
    ui.ImageDescriptor? descriptor;
    try {
      buffer = await ui.ImmutableBuffer.fromUint8List(copy);
      descriptor = await ui.ImageDescriptor.encoded(buffer);
      if (descriptor.width > 256 || descriptor.height > 256) {
        throw const FormatException('Unexpected avatar dimensions');
      }
      codec = await descriptor.instantiateCodec();
      final image = (await codec.getNextFrame()).image;
      if (!mounted || generation != _generation) {
        image.dispose();
      } else {
        setState(() => _image = image);
      }
    } catch (_) {
      /* Cosmetic fallback, no photo/API error content exposed. */
    } finally {
      codec?.dispose();
      descriptor?.dispose();
      buffer?.dispose();
      copy.fillRange(0, copy.length, 0);
    }
  }

  @override
  void dispose() {
    _generation++;
    _image?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: widget.label,
    image: true,
    child: ClipOval(
      child: SizedBox.square(
        dimension: widget.size,
        child: _image != null
            ? RawImage(image: _image, fit: BoxFit.contain)
            : profilePresets.containsKey(widget.presetId)
            ? Image.asset(
                'assets/avatars/${widget.presetId}.webp',
                fit: BoxFit.contain,
                excludeFromSemantics: true,
              )
            : const Icon(Icons.person_outline, size: 48),
      ),
    ),
  );
}
