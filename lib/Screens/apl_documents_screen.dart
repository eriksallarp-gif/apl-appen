import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class _UserScope {
  final String school;
  final String teacherId;

  const _UserScope({required this.school, required this.teacherId});
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

  return _UserScope(school: school, teacherId: teacherId);
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

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('companies')
          .where('studentId', isEqualTo: user.uid)
          .limit(1)
          .snapshots(),
      builder: (context, snapshot) {
        final hasCompany = (snapshot.data?.docs ?? []).isNotEmpty;
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
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('companies')
            .where('studentId', isEqualTo: user.uid)
            .limit(1)
            .snapshots(),
        builder: (context, snapshot) {
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

          final data = docs.first.data() as Map<String, dynamic>;
          final name = data['name'] as String? ?? 'Företag';
          final address = data['address'] as String?;
          final contact = data['contactPerson'] as String?;
          final phone = data['phone'] as String?;
          final email = data['email'] as String?;

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
                    if (contact != null && contact.isNotEmpty)
                      _InfoRow(icon: Icons.person_outline_rounded, label: contact),
                    if (address != null && address.isNotEmpty)
                      _InfoRow(icon: Icons.location_on_outlined, label: address),
                    if (phone != null && phone.isNotEmpty)
                      _InfoRow(icon: Icons.phone_outlined, label: phone),
                    if (email != null && email.isNotEmpty)
                      _InfoRow(icon: Icons.mail_outline_rounded, label: email),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoRow({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.orange.shade600),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
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
            const _UserScope(school: '', teacherId: '');
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

          final scope =
              userSnapshot.data ?? const _UserScope(school: '', teacherId: '');
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
