import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class AssignmentDetailScreen extends StatefulWidget {
  final String assignmentId;

  const AssignmentDetailScreen({super.key, required this.assignmentId});

  @override
  State<AssignmentDetailScreen> createState() => _AssignmentDetailScreenState();
}

class _SelectedMedia {
  final XFile file;
  final bool isVideo;

  _SelectedMedia({required this.file, required this.isVideo});
}

class _AssignmentDetailScreenState extends State<AssignmentDetailScreen> {
  final _textCtrl = TextEditingController();
  final _picker = ImagePicker();
  final List<_SelectedMedia> _media = [];
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    final images = await _picker.pickMultiImage(imageQuality: 75);
    if (images.isEmpty) return;
    setState(() {
      _media.addAll(images.map((img) => _SelectedMedia(file: img, isVideo: false)));
    });
  }

  Future<void> _pickVideo() async {
    final video = await _picker.pickVideo(source: ImageSource.gallery);
    if (video == null) return;
    setState(() {
      _media.add(_SelectedMedia(file: video, isVideo: true));
    });
  }

  Future<void> _recordVideo() async {
    final video = await _picker.pickVideo(source: ImageSource.camera, maxDuration: const Duration(minutes: 2));
    if (video == null) return;
    setState(() {
      _media.add(_SelectedMedia(file: video, isVideo: true));
    });
  }

  Future<void> _submit({required Map<String, dynamic> assignmentData}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _error = 'Du måste vara inloggad.');
      return;
    }

    final text = _textCtrl.text.trim();
    if (text.isEmpty && _media.isEmpty) {
      setState(() => _error = 'Skriv ett svar eller bifoga media innan du skickar in.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final submissionRef = FirebaseFirestore.instance
          .collection('assignments')
          .doc(widget.assignmentId)
          .collection('submissions')
          .doc(user.uid);

      final existing = await submissionRef.get();
      if (existing.exists) {
        setState(() {
          _submitting = false;
          _error = 'Du har redan skickat in denna uppgift.';
        });
        return;
      }

      final urls = <String>[];
      final mediaTypes = <String>[];

      for (final media in _media) {
        final originalName = media.file.path.split(RegExp(r'[\\/]')).last;
        final safeName = originalName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
        final fileName = '${DateTime.now().millisecondsSinceEpoch}_$safeName';
        final path = 'assignments/${widget.assignmentId}/${user.uid}/$fileName';

        final fileRef = FirebaseStorage.instance.ref(path);
        final metadata = SettableMetadata(contentType: _contentTypeFor(media));
        if (kIsWeb) {
          final bytes = await media.file.readAsBytes();
          await fileRef.putData(bytes, metadata);
        } else {
          await fileRef.putData(await media.file.readAsBytes(), metadata);
        }
        final url = await fileRef.getDownloadURL();

        urls.add(url);
        mediaTypes.add(media.isVideo ? 'video' : 'image');
      }

      final studentName = ((assignmentData['studentName'] ?? '')).toString();

      await submissionRef.set({
        'studentId': user.uid,
        'studentName': studentName,
        'textAnswer': text,
        'mediaUrls': urls,
        'mediaTypes': mediaTypes,
        'submittedAt': Timestamp.now(),
        'updatedAt': Timestamp.now(),
        'status': 'submitted',
        'teacherComment': null,
        'reviewedAt': null,
        'reviewedBy': null,
      });

      await FirebaseFirestore.instance.collection('assignments').doc(widget.assignmentId).set({
        'updatedAt': Timestamp.now(),
        'totalSubmitted': FieldValue.increment(1),
      }, SetOptions(merge: true));

      await FirebaseFirestore.instance
          .collection('assignments')
          .doc(widget.assignmentId)
          .collection('assignees')
          .doc(user.uid)
          .set({
        'studentId': user.uid,
        'isNew': false,
        'seenAt': Timestamp.now(),
        'submittedAt': Timestamp.now(),
      }, SetOptions(merge: true));

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Uppgift inlämnad!')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      setState(() {
        _error = 'Kunde inte skicka in uppgiften. Försök igen.\n$e';
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Uppgift')),
        body: const Center(child: Text('Du måste vara inloggad.')),
      );
    }

    final assignmentRef = FirebaseFirestore.instance.collection('assignments').doc(widget.assignmentId);
    final submissionRef = assignmentRef.collection('submissions').doc(user.uid);

    return Scaffold(
      appBar: AppBar(title: const Text('Uppgift')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: assignmentRef.snapshots(),
        builder: (context, assignmentSnap) {
          if (assignmentSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!assignmentSnap.hasData || !assignmentSnap.data!.exists) {
            return const Center(child: Text('Uppgiften finns inte längre.'));
          }

          final assignmentData = assignmentSnap.data!.data()!;
          final assignedTo = ((assignmentData['assignedTo'] ?? []) as List).map((e) => e.toString()).toList();
          if (!assignedTo.contains(user.uid)) {
            return const Center(child: Text('Du har inte behörighet till denna uppgift.'));
          }

          final title = (assignmentData['title'] ?? 'Uppgift').toString();
          final description = (assignmentData['description'] ?? '').toString();
          final dueDate = assignmentData['dueDate'] as Timestamp?;

          return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: submissionRef.snapshots(),
            builder: (context, submissionSnap) {
              final hasSubmission = submissionSnap.data?.exists == true;
              final submissionData = submissionSnap.data?.data();

              return SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.orange.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(description, style: TextStyle(color: Colors.grey.shade700, height: 1.35)),
                          const SizedBox(height: 12),
                          Text(
                            dueDate == null ? 'Ingen deadline' : 'Deadline: ${_dateText(dueDate.toDate())}',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (hasSubmission) ...[
                      _submittedCard(submissionData),
                      _teacherFeedbackCard(submissionData),
                    ] else
                      _submissionForm(assignmentData),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _submittedCard(Map<String, dynamic>? submissionData) {
    final submittedAt = submissionData?['submittedAt'] as Timestamp?;
    final mediaUrls = (submissionData?['mediaUrls'] as List?)?.map((e) => e.toString()).toList() ?? [];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Du har redan lämnat in denna uppgift.',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green),
          ),
          const SizedBox(height: 8),
          Text('Skickad: ${submittedAt == null ? '-' : _dateTimeText(submittedAt.toDate())}'),
          const SizedBox(height: 12),
          if ((submissionData?['textAnswer'] ?? '').toString().isNotEmpty) ...[
            const Text('Ditt svar:', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text((submissionData?['textAnswer'] ?? '').toString()),
          ],
          if (mediaUrls.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Bifogad media:', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text('${mediaUrls.length} filer uppladdade'),
          ],
        ],
      ),
    );
  }

  Widget _teacherFeedbackCard(Map<String, dynamic>? submissionData) {
    final status = (submissionData?['status'] ?? '').toString();
    final comment = (submissionData?['teacherComment'] ?? '').toString().trim();
    final reviewedAt = submissionData?['reviewedAt'] as Timestamp?;
    if (status != 'reviewed') return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.rate_review_outlined, color: Colors.blue.shade700, size: 20),
              const SizedBox(width: 8),
              Text(
                'Lärarens feedback',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue.shade700,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.blue.shade100,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Granskad',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.blue.shade800,
                  ),
                ),
              ),
            ],
          ),
          if (reviewedAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Granskad: ${_dateTimeText(reviewedAt.toDate())}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              comment,
              style: const TextStyle(fontSize: 14),
            ),
          ] else ...[
            const SizedBox(height: 8),
            Text(
              'Ingen kommentar lämnad.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }

  Widget _submissionForm(Map<String, dynamic> assignmentData) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Din inlämning',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _textCtrl,
            maxLines: 6,
            decoration: const InputDecoration(
              hintText: 'Skriv ditt svar här...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _submitting ? null : _pickImages,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Lägg till bilder'),
              ),
              OutlinedButton.icon(
                onPressed: _submitting ? null : _pickVideo,
                icon: const Icon(Icons.video_library_outlined),
                label: const Text('Lägg till video'),
              ),
              OutlinedButton.icon(
                onPressed: _submitting ? null : _recordVideo,
                icon: const Icon(Icons.videocam_outlined),
                label: const Text('Spela in video'),
              ),
            ],
          ),
          if (_media.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Valda filer:', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ..._media.asMap().entries.map(
                  (entry) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(entry.value.isVideo ? Icons.videocam : Icons.image),
                    title: Text(entry.value.file.path.split(RegExp(r'[\\/]')).last),
                    trailing: IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: _submitting
                          ? null
                          : () {
                              setState(() => _media.removeAt(entry.key));
                            },
                    ),
                  ),
                ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : () => _submit(assignmentData: assignmentData),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Skicka in uppgift'),
            ),
          ),
        ],
      ),
    );
  }
}

String _contentTypeFor(_SelectedMedia media) {
  final path = media.file.path.toLowerCase();

  if (media.isVideo) {
    if (path.endsWith('.mov')) return 'video/quicktime';
    if (path.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }

  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

String _dateText(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

String _dateTimeText(DateTime d) {
  final date = _dateText(d);
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '$date $hh:$mm';
}
