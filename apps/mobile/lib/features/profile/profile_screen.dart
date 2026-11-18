import 'photo_selection_owner.dart';

import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../../design/app_components.dart';
import 'profile_avatar.dart';
import 'profile_controller.dart';
import 'profile_repository.dart';
import 'photo_source.dart';

/// Account-scoped route. Auth owner must dispose on logout/account change.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.repository,
    required this.accountScope,
    required this.onSessionLost,
    this.photoSource,
  });
  final ProfileRepository repository;
  final String accountScope;
  final VoidCallback onSessionLost;
  final ProfilePhotoSource? photoSource;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with WidgetsBindingObserver {
  late ProfileController controller;
  final name = TextEditingController();
  bool initialized = false, choosing = false;
  String? selection;
  Uint8List? photo;
  String? localError;
  bool picking = false, _preparingRecovered = false;
  int _pickGeneration = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bind();
    _listenPhoto();
  }

  void _bind() {
    controller = ProfileController(
      widget.repository,
      onSessionLost: () => widget.onSessionLost(),
    )..addListener(_changed);
    controller.load();
  }

  PhotoSelectionOwner? _photoOwner;
  void _listenPhoto() {
    _photoOwner?.removeListener(_recoverPhoto);
    _photoOwner = widget.photoSource is PhotoSelectionOwner
        ? widget.photoSource as PhotoSelectionOwner
        : null;
    _photoOwner?.addListener(_recoverPhoto);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _recoverPhoto();
    });
  }

  void _recoverPhoto() {
    final owner = _photoOwner;
    if (!mounted ||
        owner == null ||
        owner.accountScope != widget.accountScope ||
        !controller.foreground ||
        controller.account == null) {
      return;
    }
    if (owner.pending) {
      setState(() {
        choosing = true;
        picking = true;
      });
      return;
    }
    final input = owner.take(widget.accountScope);
    if (input != null) {
      setState(() {
        choosing = true;
        picking = true;
        localError = null;
      });
      _acceptPhoto(input, ++_pickGeneration);
    } else if (owner.failed) {
      owner.consumeError();
      setState(() {
        choosing = true;
        picking = false;
        localError = '사진을 준비하지 못했어요. 다른 사진을 선택해 주세요.';
      });
    } else if (picking && !_preparingRecovered) {
      setState(() => picking = false);
    }
  }

  Future<void> _acceptPhoto(PhotoInput input, int generation) async {
    _preparingRecovered = true;
    try {
      late final Uint8List prepared;
      try {
        prepared = await prepareProfilePhoto(input);
      } finally {
        input.bytes.fillRange(0, input.bytes.length, 0);
      }
      if (!mounted || !controller.foreground || generation != _pickGeneration) {
        prepared.fillRange(0, prepared.length, 0);
        return;
      }
      setState(() {
        _clearPhoto();
        photo = prepared;
        selection = null;
      });
    } catch (_) {
      if (mounted && generation == _pickGeneration) {
        setState(
          () => localError =
              '사진을 준비하지 못했어요. JPEG·PNG·WebP, 1MiB·400만 화소 이하 사진을 선택해 주세요.',
        );
      }
    } finally {
      if (mounted && generation == _pickGeneration) {
        setState(() {
          picking = false;
          _preparingRecovered = false;
        });
      }
    }
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.photoSource, widget.photoSource)) _listenPhoto();
    if (oldWidget.accountScope != widget.accountScope ||
        !identical(oldWidget.repository, widget.repository)) {
      controller.removeListener(_changed);
      controller.dispose();
      _pickGeneration++;
      _clearPhoto();
      name.clear();
      initialized = false;
      choosing = false;
      picking = false;
      _preparingRecovered = false;
      selection = null;
      localError = null;
      _bind();
    } else if (!identical(oldWidget.photoSource, widget.photoSource)) {
      _pickGeneration++;
      _clearPhoto();
      picking = false;
      _preparingRecovered = false;
      choosing = false;
      selection = null;
      localError = null;
    }
  }

  void _changed() {
    if (!mounted) return;
    setState(() {
      if (!initialized && controller.account != null) {
        name.text = controller.account!['displayName'] as String;
        initialized = true;
      }
    });
    _recoverPhoto();
  }

  void _clearPhoto() {
    photo?.fillRange(0, photo!.length, 0);
    photo = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    controller.setForeground(state == AppLifecycleState.resumed);
    if (state != AppLifecycleState.resumed) {
      _clearPhoto();
    }
  }

  @override
  void dispose() {
    _photoOwner?.removeListener(_recoverPhoto);
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_changed);
    controller.dispose();
    name.dispose();
    _clearPhoto();
    super.dispose();
  }

  Future<void> _pick() async {
    if (picking || widget.photoSource == null) return;
    setState(() {
      picking = true;
      localError = null;
    });
    final generation = ++_pickGeneration;
    try {
      final input = await widget.photoSource!.pick();
      if (input == null) return;
      if (!mounted || generation != _pickGeneration) {
        input.bytes.fillRange(0, input.bytes.length, 0);
        return;
      }
      late final Uint8List prepared;
      try {
        prepared = await prepareProfilePhoto(input);
      } finally {
        input.bytes.fillRange(0, input.bytes.length, 0);
      }
      if (!mounted || !controller.foreground || generation != _pickGeneration) {
        prepared.fillRange(0, prepared.length, 0);
        return;
      }
      setState(() {
        _clearPhoto();
        photo = prepared;
        selection = null;
      });
    } catch (_) {
      if (mounted && generation == _pickGeneration && choosing) {
        setState(
          () => localError =
              '사진을 준비하지 못했어요. JPEG·PNG·WebP, 1MiB·400만 화소 이하 사진을 선택해 주세요.',
        );
      }
    } finally {
      if (mounted && generation == _pickGeneration) {
        setState(() => picking = false);
      }
    }
  }

  void _closeChooser() {
    _photoOwner?.cancel();
    _pickGeneration++;
    setState(() {
      choosing = false;
      picking = false;
      _preparingRecovered = false;
      selection = null;
      _clearPhoto();
      localError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final current = controller.account;
    final avatar = current?['avatar'] as Map<String, Object?>?;
    return PopScope(
      canPop: !choosing,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _closeChooser();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(choosing ? '캐릭터·사진 선택' : '내 프로필'),
          leading: choosing
              ? IconButton(
                  onPressed: controller.busy ? null : _closeChooser,
                  tooltip: '선택 취소',
                  icon: const Icon(Icons.arrow_back),
                )
              : null,
        ),
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: ListView(
                key: ValueKey(choosing),
                padding: const EdgeInsets.all(20),
                children: [
                  if (!controller.foreground)
                    const AppStatus(message: '앱으로 돌아오면 프로필을 다시 확인해요')
                  else ...[
                    if (controller.busy || picking)
                      const AppStatus(message: '프로필을 확인하고 있어요'),
                    if (controller.error != null)
                      AppStatus(message: controller.error!, isError: true),
                    if (localError != null)
                      AppStatus(message: localError!, isError: true),
                    if (current == null && !controller.busy)
                      AppAction(label: '다시 불러오기', onPressed: controller.load),
                    if (current != null) ...[
                      if (!choosing) ...[
                        Center(
                          child: ProfileAvatar(
                            bytes: controller.imageBytes,
                            presetId: avatar?['presetId'] as String?,
                          ),
                        ),
                        if (controller.imageError != null)
                          AppStatus(message: controller.imageError!),
                        TextButton(
                          onPressed: controller.busy
                              ? null
                              : () => setState(() {
                                  choosing = true;
                                  selection = avatar?['presetId'] as String?;
                                  localError = null;
                                }),
                          child: const Text('캐릭터·사진 바꾸기'),
                        ),
                        TextField(
                          controller: name,
                          enabled: !controller.busy,
                          maxLength: 20,
                          decoration: const InputDecoration(labelText: '이름'),
                          onChanged: (_) => setState(() {}),
                        ),
                        Text('현재 서버 이름: ${current['displayName']}'),
                        if (name.text != current['displayName'])
                          TextButton(
                            onPressed: controller.busy
                                ? null
                                : () => setState(() {
                                    name.text =
                                        current['displayName'] as String;
                                  }),
                            child: const Text('최신 이름 사용'),
                          ),
                        AppAction(
                          label: '이름 저장',
                          enabled: !controller.busy,
                          onPressed: () => controller.saveName(name.text),
                        ),
                        if (controller.saved)
                          const AppStatus(message: '서버에 저장했어요.'),
                        TextButton(
                          onPressed: controller.busy ? null : controller.load,
                          child: const Text('최신 프로필 확인'),
                        ),
                      ] else ...[
                        Center(
                          child: ProfileAvatar(
                            bytes: photo,
                            presetId: selection,
                            label: '선택한 모습 미리보기',
                            size: 96,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text('캐릭터는 꾸미기용이에요. 게임 역할이나 권한을 정하지 않아요.'),
                        GridView.count(
                          crossAxisCount: 3,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          childAspectRatio: .9,
                          children: [
                            for (final entry in profilePresets.entries)
                              Semantics(
                                selected: selection == entry.key,
                                button: true,
                                label: entry.value,
                                child: InkWell(
                                  onTap: controller.busy || picking
                                      ? null
                                      : () => setState(() {
                                          _clearPhoto();
                                          selection = entry.key;
                                        }),
                                  child: Column(
                                    children: [
                                      ProfileAvatar(
                                        presetId: entry.key,
                                        size: 64,
                                        label: entry.value,
                                      ),
                                      Text(
                                        '${selection == entry.key ? '✓ ' : ''}${entry.value}',
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                        OutlinedButton(
                          onPressed:
                              controller.busy ||
                                  picking ||
                                  widget.photoSource == null
                              ? null
                              : _pick,
                          child: const Text('내 사진 선택'),
                        ),
                        if (widget.photoSource == null)
                          const Text(
                            '이 빌드에서는 기기 사진 선택이 아직 연결되지 않았어요. 기본 캐릭터는 바로 사용할 수 있어요.',
                          ),
                        if (photo != null)
                          const Text('중앙을 정사각형으로 잘랐어요. 미리보기를 확인한 뒤 저장해 주세요.'),
                        AppAction(
                          label: '선택한 모습 저장',
                          enabled:
                              !controller.busy &&
                              !picking &&
                              (photo != null || selection != null),
                          onPressed: () async {
                            if (photo != null) {
                              await controller.savePhoto(photo!);
                            } else {
                              await controller.savePreset(selection!);
                            }
                            if (mounted && controller.saved) _closeChooser();
                          },
                        ),
                        TextButton(
                          onPressed: controller.busy ? null : _closeChooser,
                          child: const Text('취소'),
                        ),
                      ],
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
