import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class _UserScope {
  final String school;
  final String teacherId;
  final String classId;

  const _UserScope({
    required this.school,
    required this.teacherId,
    required this.classId,
  });
}

Future<_UserScope> _resolveUserScope(String uid) async {
  final userRef = FirebaseFirestore.instance.collection('users').doc(uid);
  final userSnap = await userRef.get();
  final userData = userSnap.data() ?? {};

  var school = ((userData['school'] ?? userData['schoolId']) ?? '')
      .toString()
      .trim();
  var teacherId = ((userData['teacherId'] ?? userData['teacherUid']) ?? '')
      .toString()
      .trim();
  final classId = (userData['classId'] ?? '').toString().trim();
  final role = (userData['role'] ?? '').toString().trim();

  if (teacherId.isEmpty && (role == 'teacher' || role == 'admin')) {
    teacherId = uid;
  }

  if (teacherId.isNotEmpty && (userData['teacherId'] == null)) {
    await userRef.set({'teacherId': teacherId}, SetOptions(merge: true));
  }

  if (school.isEmpty && teacherId.isNotEmpty) {
    final teacherSnap = await FirebaseFirestore.instance
        .collection('users')
        .doc(teacherId)
        .get();
    final teacherSchool = (teacherSnap.data()?['school'] ?? '').toString().trim();
    if (teacherSchool.isNotEmpty) {
      school = teacherSchool;
      await userRef.set({'school': teacherSchool}, SetOptions(merge: true));
    }
  }

  if (school.isNotEmpty && userData['school'] == null) {
    await userRef.set({'school': school}, SetOptions(merge: true));
  }

  return _UserScope(school: school, teacherId: teacherId, classId: classId);
}

class _AplDocumentCategory {
  final String id;
  final String name;
  final IconData icon;

  const _AplDocumentCategory({
    required this.id,
    required this.name,
    required this.icon,
  });
}

IconData _iconForCategory(String id) {
  switch (id) {
    case 'kontakt_foretag':
      return Icons.business_outlined;
    case 'kontakt_skola':
      return Icons.school_outlined;
    case 'forsakringar':
      return Icons.verified_user_outlined;
    case 'apl_tider':
      return Icons.calendar_today_rounded;
    case 'skadeanmalan':
      return Icons.warning_amber_rounded;
    case 'arbetsmiljoverket':
      return Icons.health_and_safety_outlined;
    case 'ovrigt':
      return Icons.attach_file_rounded;
    default:
      return Icons.insert_drive_file_outlined;
  }
}

const _fallbackCategories = [
  _AplDocumentCategory(
    id: 'kontakt_foretag',
    name: 'Kontakt företag',
    icon: Icons.business_outlined,
  ),
  _AplDocumentCategory(
    id: 'kontakt_skola',
    name: 'Kontakt skola',
    icon: Icons.school_outlined,
  ),
  _AplDocumentCategory(
    id: 'forsakringar',
    name: 'Försäkringar',
    icon: Icons.verified_user_outlined,
  ),
  _AplDocumentCategory(
    id: 'apl_tider',
    name: 'APL-tider för läsår',
    icon: Icons.calendar_today_rounded,
  ),
  _AplDocumentCategory(
    id: 'skadeanmalan',
    name: 'Skadeanmälan',
    icon: Icons.warning_amber_rounded,
  ),
  _AplDocumentCategory(
    id: 'arbetsmiljoverket',
    name: 'Arbetsmiljöverket',
    icon: Icons.health_and_safety_outlined,
  ),
  _AplDocumentCategory(
    id: 'ovrigt',
    name: 'Övrigt',
    icon: Icons.attach_file_rounded,
  ),
];

Future<List<_AplDocumentCategory>> _loadAplDocumentCategories() async {
  try {
    final rawJson = await rootBundle.loadString(
      'web_dashboard/src/lib/aplDocumentCategories.json',
    );
    final decoded = jsonDecode(rawJson);
    if (decoded is! List) return _fallbackCategories;

    final categories = decoded
        .whereType<Map>()
        .map((entry) {
          final id = (entry['id'] ?? '').toString().trim();
          final name = (entry['name'] ?? '').toString().trim();
          if (id.isEmpty || name.isEmpty) return null;
          return _AplDocumentCategory(
            id: id,
            name: name,
            icon: _iconForCategory(id),
          );
        })
        .whereType<_AplDocumentCategory>()
        .toList();

    return categories.isEmpty ? _fallbackCategories : categories;
  } catch (_) {
    return _fallbackCategories;
  }
}

final Future<List<_AplDocumentCategory>> _aplDocumentCategoriesFuture =
    _loadAplDocumentCategories();

Future<QueryDocumentSnapshot<Map<String, dynamic>>?> _findCompanyForStudent(
  String studentUid,
) async {
  final companiesRef = FirebaseFirestore.instance.collection('companies');

  final byStudentId = await companiesRef
      .where('studentId', isEqualTo: studentUid)
      .limit(1)
      .get();
  if (byStudentId.docs.isNotEmpty) {
    return byStudentId.docs.first;
  }

  // Fallback for newer company links stored in studentIds.
  // This query can be blocked by stricter rules in some environments,
  // so we treat failures as "no match" instead of breaking the page.
  try {
    final byStudentIds = await companiesRef
        .where('studentIds', arrayContains: studentUid)
        .limit(1)
        .get();
    if (byStudentIds.docs.isNotEmpty) {
      return byStudentIds.docs.first;
    }
  } catch (_) {
    // Ignore and continue with null result.
  }

  return null;
}

class AplDocumentsScreen extends StatelessWidget {
  const AplDocumentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('APL-dokument'), elevation: 0),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Viktiga dokument och information',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Här hittar du dokument och information som din lärare har delat.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: FutureBuilder<List<_AplDocumentCategory>>(
                future: _aplDocumentCategoriesFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final categories = snapshot.data ?? _fallbackCategories;

                  return ListView.separated(
                    itemCount: categories.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      if (category.id == 'kontakt_foretag') {
                        return _ContactCompanyCard(
                          categoryName: category.name,
                          icon: category.icon,
                        );
                      }
                      if (category.id == 'kontakt_skola') {
                        return _SchoolContactCard(
                          categoryName: category.name,
                          icon: category.icon,
                        );
                      }
                      return _CategoryCard(
                        categoryId: category.id,
                        categoryName: category.name,
                        icon: category.icon,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContactCompanyCard extends StatelessWidget {
  final String categoryName;
  final IconData icon;

  const _ContactCompanyCard({required this.categoryName, required this.icon});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return _SimpleCard(
        icon: icon,
        title: categoryName,
        subtitle: 'Logga in igen för att se företagsinfo',
        onTap: null,
      );
    }

    return FutureBuilder<QueryDocumentSnapshot<Map<String, dynamic>>?>(
      future: _findCompanyForStudent(user.uid),
      builder: (context, snapshot) {
        final hasCompany = snapshot.data != null;
        final subtitle = hasCompany
            ? 'Visa kontaktuppgifter till ditt APL-företag'
            : 'Ingen företagskoppling ännu';

        return _SimpleCard(
          icon: icon,
          title: categoryName,
          subtitle: subtitle,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CompanyContactScreen()),
            );
          },
        );
      },
    );
  }
}

class _SchoolContactCard extends StatelessWidget {
  final String categoryName;
  final IconData icon;

  const _SchoolContactCard({required this.categoryName, required this.icon});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return _SimpleCard(
        icon: icon,
        title: categoryName,
        subtitle: 'Logga in igen för att se skolkontakter',
        onTap: null,
      );
    }

    return FutureBuilder<_UserScope>(
      future: _resolveUserScope(user.uid),
      builder: (context, scopeSnapshot) {
        final scope = scopeSnapshot.data;
        final hasScope = scope != null && scope.school.isNotEmpty && scope.teacherId.isNotEmpty;

        return _SimpleCard(
          icon: icon,
          title: categoryName,
          subtitle: hasScope
              ? 'Visa kontaktuppgifter till skolan'
              : 'Kunde inte hitta skolkoppling',
          onTap: hasScope
              ? () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SchoolContactScreen()),
                  );
                }
              : null,
        );
      },
    );
  }
}

class _SimpleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _SimpleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.orange.shade200),
            borderRadius: BorderRadius.circular(12),
            color: Colors.white,
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: Colors.orange.shade600, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: Colors.grey.shade400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CompanyContactScreen extends StatelessWidget {
  const CompanyContactScreen({super.key});

  Future<void> _openDocument(
    BuildContext context,
    String url,
    String title,
  ) async {
    final pdfViewerUrl = Uri(
      scheme: 'https',
      host: 'apl-appen.com',
      path: '/view-pdf',
      queryParameters: {'url': url, 'title': title},
    ).toString();

    try {
      await launchUrl(
        Uri.parse(pdfViewerUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fel: Kunde inte öppna dokument ($e)'),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  IconData _getFileIcon(String? fileType) {
    if (fileType == null) return Icons.insert_drive_file_outlined;
    if (fileType.contains('pdf')) return Icons.picture_as_pdf_outlined;
    if (fileType.contains('doc')) return Icons.description_outlined;
    if (fileType.contains('image') ||
        fileType.contains('jpg') ||
        fileType.contains('png')) {
      return Icons.image_outlined;
    }
    if (fileType.contains('excel') || fileType.contains('spreadsheet')) {
      return Icons.table_chart_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  String _formatDate(Timestamp? timestamp) {
    if (timestamp == null) return '';
    final date = timestamp.toDate();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kontakt företag'), elevation: 0),
        body: const Center(
          child: Text('Logga in igen för att se information.'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Kontakt företag'), elevation: 0),
      body: FutureBuilder<QueryDocumentSnapshot<Map<String, dynamic>>?>(
        future: _findCompanyForStudent(user.uid),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final companyDoc = snapshot.data;
          if (companyDoc == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.business_outlined,
                      size: 64,
                      color: Colors.grey.shade300,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Inget företag kopplat än',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Din lärare har inte kopplat något företag till dig ännu.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          final data = companyDoc.data();
          final companyId = companyDoc.id;
            final companyTeacherId =
              (data['teacherUid'] ?? '').toString().trim();
          final name = data['name'] as String? ?? 'Företag';
          final contactHeading = data['contactHeading'] as String?;
          final address = data['address'] as String?;
          final contact = data['contactPerson'] as String?;
          final phone = data['phone'] as String?;
          final email = data['email'] as String?;

          final List<Map<String, String>> contactSections = [];
          final rawSections = data['contactSections'];
          if (rawSections is List) {
            for (final raw in rawSections) {
              if (raw is Map) {
                final heading = (raw['heading'] ?? '').toString().trim();
                final content = (raw['content'] ?? '').toString().trim();
                if (heading.isNotEmpty || content.isNotEmpty) {
                  contactSections.add({
                    'heading': heading,
                    'content': content,
                  });
                }
              }
            }
          }

          if (contactSections.isEmpty &&
              ((contactHeading != null && contactHeading.isNotEmpty) ||
                  (contact != null && contact.isNotEmpty))) {
            contactSections.add({
              'heading': (contactHeading ?? '').trim(),
              'content': (contact ?? '').trim(),
            });
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.shade200),
                  color: Colors.white,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (address != null && address.isNotEmpty)
                      _InfoRow(icon: Icons.location_on_outlined, label: address),
                    if (phone != null && phone.isNotEmpty)
                      _InfoRow(
                        icon: Icons.phone_outlined,
                        label: phone,
                        linkifyPhones: true,
                      ),
                    if (email != null && email.isNotEmpty)
                      _InfoRow(icon: Icons.mail_outline_rounded, label: email),
                    if (contactSections.isNotEmpty) const SizedBox(height: 8),
                    ...contactSections.map(
                      (section) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if ((section['heading'] ?? '').isNotEmpty) ...[
                              Text(
                                section['heading']!,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.grey.shade800,
                                ),
                              ),
                              const SizedBox(height: 6),
                            ],
                            if ((section['content'] ?? '').isNotEmpty)
                              _InfoRow(
                                icon: Icons.person_outline_rounded,
                                label: section['content']!,
                                linkifyPhones: true,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FutureBuilder<_UserScope>(
                future: _resolveUserScope(user.uid),
                builder: (context, scopeSnapshot) {
                  if (scopeSnapshot.connectionState == ConnectionState.waiting) {
                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                        color: Colors.white,
                      ),
                      child: const Center(child: CircularProgressIndicator()),
                    );
                  }

                  final scope = scopeSnapshot.data;
                  if (scope == null || scope.school.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                        color: Colors.white,
                      ),
                      child: const Text(
                        'Kunde inte ladda företagsdokument.',
                        style: TextStyle(fontSize: 14),
                      ),
                    );
                  }

                  Query<Map<String, dynamic>> documentsQuery = FirebaseFirestore
                      .instance
                      .collection('aplDocuments')
                      .where('school', isEqualTo: scope.school)
                      .where('category', isEqualTo: 'kontakt_foretag');

                  final teacherFilter = companyTeacherId.isNotEmpty
                      ? companyTeacherId
                      : scope.teacherId;
                  if (teacherFilter.isNotEmpty) {
                    documentsQuery = documentsQuery.where(
                      'teacherId',
                      isEqualTo: teacherFilter,
                    );
                  }

                  return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    stream: documentsQuery.snapshots(),
                    builder: (context, documentsSnapshot) {
                      if (documentsSnapshot.connectionState ==
                          ConnectionState.waiting) {
                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                            color: Colors.white,
                          ),
                          child: const Center(child: CircularProgressIndicator()),
                        );
                      }

                      final companyDocs = (documentsSnapshot.data?.docs ?? [])
                          .where((doc) {
                            final docData = doc.data();
                            return (docData['companyId'] ?? '').toString() ==
                                companyId;
                          })
                          .toList()
                        ..sort((a, b) {
                          final aTs = a.data()['uploadedAt'] as Timestamp?;
                          final bTs = b.data()['uploadedAt'] as Timestamp?;
                          if (aTs == null && bTs == null) return 0;
                          if (aTs == null) return 1;
                          if (bTs == null) return -1;
                          return bTs.compareTo(aTs);
                        });

                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.shade200),
                          color: Colors.white,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Företagsdokument',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 10),
                            if (companyDocs.isEmpty)
                              Text(
                                'Inga dokument uppladdade ännu.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey.shade600,
                                ),
                              )
                            else
                              ...companyDocs.map((docSnap) {
                                final docData = docSnap.data();
                                final title =
                                    (docData['title'] ?? 'Dokument').toString();
                                final url = (docData['url'] ?? '').toString();
                                final fileType = docData['fileType'] as String?;
                                final uploadedAt =
                                    docData['uploadedAt'] as Timestamp?;

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      onTap: url.isEmpty
                                          ? null
                                          : () => _openDocument(
                                                context,
                                                url,
                                                title,
                                              ),
                                      borderRadius: BorderRadius.circular(10),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 10,
                                        ),
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(10),
                                          border: Border.all(
                                            color: Colors.grey.shade200,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Icon(
                                              _getFileIcon(fileType),
                                              size: 22,
                                              color: Colors.blue.shade600,
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    title,
                                                    style: const TextStyle(
                                                      fontSize: 14,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                  if (uploadedAt != null)
                                                    Text(
                                                      _formatDate(uploadedAt),
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        color: Colors
                                                            .grey.shade600,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                            Icon(
                                              Icons.open_in_new_rounded,
                                              size: 18,
                                              color: Colors.grey.shade500,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class SchoolContactScreen extends StatelessWidget {
  const SchoolContactScreen({super.key});

  List<QueryDocumentSnapshot<Map<String, dynamic>>> _filterForStudent(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
    String studentUid,
    String studentClassId,
  ) {
    return docs.where((doc) {
      final data = doc.data();
      final singleStudentId = (data['studentId'] ?? '').toString().trim();
      final rawStudentIds = data['studentIds'];
      final rawClassIds = data['classIds'];

      final studentIds = <String>[];
      if (rawStudentIds is List) {
        for (final value in rawStudentIds) {
          final id = value.toString().trim();
          if (id.isNotEmpty) studentIds.add(id);
        }
      }

      final classIds = <String>[];
      if (rawClassIds is List) {
        for (final value in rawClassIds) {
          final id = value.toString().trim();
          if (id.isNotEmpty) classIds.add(id);
        }
      }

      if (studentIds.isEmpty && singleStudentId.isEmpty && classIds.isEmpty) {
        return true;
      }
      if (singleStudentId == studentUid) {
        return true;
      }
      if (studentIds.contains(studentUid)) {
        return true;
      }
      if (studentClassId.isNotEmpty && classIds.contains(studentClassId)) {
        return true;
      }
      return false;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kontakt skola'), elevation: 0),
        body: const Center(
          child: Text('Logga in igen för att se information.'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Kontakt skola'), elevation: 0),
      body: FutureBuilder<_UserScope>(
        future: _resolveUserScope(user.uid),
        builder: (context, scopeSnapshot) {
          if (scopeSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final scope = scopeSnapshot.data;
          if (scope == null || scope.school.isEmpty || scope.teacherId.isEmpty) {
            return const Center(
              child: Text('Kunde inte ladda skolkontakter.'),
            );
          }

          final contactsQuery = FirebaseFirestore.instance
              .collection('schoolContacts')
              .where('school', isEqualTo: scope.school)
              .where('teacherUid', isEqualTo: scope.teacherId);

          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: contactsQuery.snapshots(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              final filtered = _filterForStudent(
                snapshot.data?.docs ?? [],
                user.uid,
                scope.classId,
              );

              if (filtered.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.school_outlined,
                          size: 64,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Inga skolkontakter ännu',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Din lärare har inte lagt upp några kontakter ännu.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final data = filtered[index].data();
                  final name = (data['name'] ?? 'Kontakt').toString();
                  final address = (data['address'] ?? '').toString();
                  final phone = (data['phone'] ?? '').toString();
                  final email = (data['email'] ?? '').toString();

                  final List<Map<String, String>> sections = [];
                  final rawSections = data['contactSections'];
                  if (rawSections is List) {
                    for (final raw in rawSections) {
                      if (raw is Map) {
                        final heading = (raw['heading'] ?? '').toString().trim();
                        final content = (raw['content'] ?? '').toString().trim();
                        if (heading.isNotEmpty || content.isNotEmpty) {
                          sections.add({'heading': heading, 'content': content});
                        }
                      }
                    }
                  }

                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.shade200),
                      color: Colors.white,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (address.isNotEmpty)
                          _InfoRow(icon: Icons.location_on_outlined, label: address),
                        if (phone.isNotEmpty)
                          _InfoRow(
                            icon: Icons.phone_outlined,
                            label: phone,
                            linkifyPhones: true,
                          ),
                        if (email.isNotEmpty)
                          _InfoRow(icon: Icons.mail_outline_rounded, label: email),
                        if (sections.isNotEmpty) const SizedBox(height: 8),
                        ...sections.map(
                          (section) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if ((section['heading'] ?? '').isNotEmpty) ...[
                                  Text(
                                    section['heading']!,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.grey.shade800,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                ],
                                if ((section['content'] ?? '').isNotEmpty)
                                  _InfoRow(
                                    icon: Icons.person_outline_rounded,
                                    label: section['content']!,
                                    linkifyPhones: true,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool linkifyPhones;

  const _InfoRow({
    required this.icon,
    required this.label,
    this.linkifyPhones = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.orange.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: linkifyPhones
                ? _PhoneLinkifiedText(text: label)
                : Text(label, style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }
}

class _PhoneLinkifiedText extends StatelessWidget {
  final String text;

  const _PhoneLinkifiedText({required this.text});

  static final RegExp _phoneRegex = RegExp(r'\+?[0-9][0-9\s\-]{5,}[0-9]');

  String _toDialable(String raw) {
    return raw.replaceAll(RegExp(r'[^0-9+]'), '');
  }

  Future<void> _callNumber(String rawNumber) async {
    final dialable = _toDialable(rawNumber);
    if (dialable.isEmpty) return;
    await launchUrl(Uri(scheme: 'tel', path: dialable));
  }

  @override
  Widget build(BuildContext context) {
    final lines = text.split('\n');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < lines.length; i++) ...[
          _PhoneRichLine(
            line: lines[i],
            phoneRegex: _phoneRegex,
            onTapPhone: _callNumber,
          ),
          if (i != lines.length - 1) const SizedBox(height: 2),
        ],
      ],
    );
  }
}

class _PhoneRichLine extends StatelessWidget {
  final String line;
  final RegExp phoneRegex;
  final Future<void> Function(String rawNumber) onTapPhone;

  const _PhoneRichLine({
    required this.line,
    required this.phoneRegex,
    required this.onTapPhone,
  });

  @override
  Widget build(BuildContext context) {
    final matches = phoneRegex.allMatches(line).toList();
    if (matches.isEmpty) {
      return Text(line, style: const TextStyle(fontSize: 14));
    }

    final spans = <InlineSpan>[];
    var start = 0;

    for (final match in matches) {
      if (match.start > start) {
        spans.add(
          TextSpan(
            text: line.substring(start, match.start),
            style: const TextStyle(fontSize: 14, color: Colors.black87),
          ),
        );
      }

      final rawNumber = line.substring(match.start, match.end);
      spans.add(
        TextSpan(
          text: rawNumber,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.blue,
            decoration: TextDecoration.underline,
          ),
          recognizer: TapGestureRecognizer()
            ..onTap = () {
              onTapPhone(rawNumber);
            },
        ),
      );

      start = match.end;
    }

    if (start < line.length) {
      spans.add(
        TextSpan(
          text: line.substring(start),
          style: const TextStyle(fontSize: 14, color: Colors.black87),
        ),
      );
    }

    return RichText(text: TextSpan(children: spans));
  }
}

class _CategoryCard extends StatelessWidget {
  final String categoryId;
  final String categoryName;
  final IconData icon;

  const _CategoryCard({
    required this.categoryId,
    required this.categoryName,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    if (categoryId == 'kontakt_skola') {
      return _SchoolContactCard(categoryName: categoryName, icon: icon);
    }

    final currentUser = FirebaseAuth.instance.currentUser;

    if (currentUser == null) {
      return _SimpleCard(
        icon: icon,
        title: categoryName,
        subtitle: 'Logga in igen för att se dokument',
        onTap: null,
      );
    }

    return FutureBuilder<_UserScope>(
      future: _resolveUserScope(currentUser.uid),
      builder: (context, userSnapshot) {
        if (userSnapshot.connectionState == ConnectionState.waiting) {
          return _SimpleCard(
            icon: icon,
            title: categoryName,
            subtitle: 'Laddar...',
            onTap: null,
          );
        }

        final scope = userSnapshot.data ??
          const _UserScope(school: '', teacherId: '', classId: '');
        final schoolId = scope.school;
        final teacherId = scope.teacherId;

        if (schoolId.isEmpty) {
          return _SimpleCard(
            icon: icon,
            title: categoryName,
            subtitle: 'Saknar school på användaren',
            onTap: null,
          );
        }

        Query<Map<String, dynamic>> documentsQuery = FirebaseFirestore.instance
            .collection('aplDocuments')
            .where('category', isEqualTo: categoryId)
            .where('school', isEqualTo: schoolId);

        if (teacherId.isNotEmpty) {
          documentsQuery = documentsQuery.where('teacherId', isEqualTo: teacherId);
        }

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: documentsQuery.snapshots(),
          builder: (context, snapshot) {
            final docCount = snapshot.data?.docs.length ?? 0;

            // Debug: Log all documents in this category
            if (snapshot.hasData && snapshot.data!.docs.isNotEmpty) {
              print('📋 $categoryName: Found $docCount documents');
              for (var doc in snapshot.data!.docs) {
                final data = doc.data();
                print('   - ${data['title']}');
              }
            }

            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CategoryDocumentsScreen(
                        categoryId: categoryId,
                        categoryName: categoryName,
                      ),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.orange.shade200),
                    borderRadius: BorderRadius.circular(12),
                    color: Colors.white,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(icon, color: Colors.orange.shade600, size: 28),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              categoryName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              docCount == 0
                                  ? 'Inga dokument ännu'
                                  : '$docCount ${docCount == 1 ? 'dokument' : 'dokument'}',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: Colors.grey.shade400,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class CategoryDocumentsScreen extends StatelessWidget {
  final String categoryId;
  final String categoryName;

  const CategoryDocumentsScreen({
    super.key,
    required this.categoryId,
    required this.categoryName,
  });

  Future<void> _openDocument(
    BuildContext context,
    String url,
    String title,
    String? fileType,
  ) async {
    // Öppna all dokumenttyper via webdashboarden PDF-visare
    // Det fungerar för PDF och många andra filtyper
    final pdfViewerUrl = Uri(
      scheme: 'https',
      host: 'apl-appen.com',
      path: '/view-pdf',
      queryParameters: {'url': url, 'title': title},
    ).toString();

    try {
      await launchUrl(
        Uri.parse(pdfViewerUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      print('❌ Error opening document: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fel: Kunde inte öppna dokument ($e)'),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  IconData _getFileIcon(String? fileType) {
    if (fileType == null) return Icons.insert_drive_file_outlined;

    if (fileType.contains('pdf')) return Icons.picture_as_pdf_outlined;
    if (fileType.contains('doc')) return Icons.description_outlined;
    if (fileType.contains('image') ||
        fileType.contains('jpg') ||
        fileType.contains('png')) {
      return Icons.image_outlined;
    }
    if (fileType.contains('excel') || fileType.contains('spreadsheet')) {
      return Icons.table_chart_outlined;
    }

    return Icons.insert_drive_file_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;

    if (currentUser == null) {
      return Scaffold(
        appBar: AppBar(title: Text(categoryName), elevation: 0),
        body: const Center(child: Text('Logga in igen för att se dokument.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(categoryName), elevation: 0),
      body: FutureBuilder<_UserScope>(
        future: _resolveUserScope(currentUser.uid),
        builder: (context, userSnapshot) {
          if (userSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

            final scope = userSnapshot.data ??
              const _UserScope(school: '', teacherId: '', classId: '');
          final schoolId = scope.school;
          final teacherId = scope.teacherId;

          if (schoolId.isEmpty) {
            return const Center(
              child: Text('Saknar school på användaren. Kontakta lärare.'),
            );
          }

          Query<Map<String, dynamic>> documentsQuery = FirebaseFirestore.instance
              .collection('aplDocuments')
              .where('category', isEqualTo: categoryId)
              .where('school', isEqualTo: schoolId);

          if (teacherId.isNotEmpty) {
            documentsQuery = documentsQuery.where('teacherId', isEqualTo: teacherId);
          }

          documentsQuery = documentsQuery.orderBy('uploadedAt', descending: true);

          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: documentsQuery.snapshots(),
            builder: (context, snapshot) {
          // Debug logging
          if (snapshot.hasData) {
            print(
              '📦 Category: $categoryId - Found ${snapshot.data!.docs.length} documents',
            );
            for (var doc in snapshot.data!.docs) {
              final data = doc.data();
              print('  - ${data['title']} (category: ${data['category']})');
            }
          }
          if (snapshot.hasError) {
            print(
              '❌ Error fetching documents for $categoryId: ${snapshot.error}',
            );
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final docs = snapshot.data?.docs ?? [];

          if (docs.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.folder_open_rounded,
                      size: 64,
                      color: Colors.grey.shade300,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Inga dokument än',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Din lärare har inte lagt upp några dokument i denna kategori ännu.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final doc = docs[index].data();
              final title = doc['title'] as String? ?? 'Dokument';
              final url = doc['url'] as String? ?? '';
              final fileType = doc['fileType'] as String?;
              final uploadedAt = (doc['uploadedAt'] as Timestamp?)?.toDate();

              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _openDocument(context, url, title, fileType),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(12),
                      color: Colors.white,
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            _getFileIcon(fileType),
                            color: Colors.blue.shade600,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (uploadedAt != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Uppladdad ${uploadedAt.day}/${uploadedAt.month} ${uploadedAt.year}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.open_in_new_rounded,
                          size: 20,
                          color: Colors.grey.shade400,
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
            },
          );
        },
      ),
    );
  }
}
