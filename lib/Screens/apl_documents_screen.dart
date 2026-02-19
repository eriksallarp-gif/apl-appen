import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:url_launcher/url_launcher.dart';

class AplDocumentsScreen extends StatelessWidget {
  const AplDocumentsScreen({super.key});

  static const categories = [
    {
      'id': 'kontakt_foretag',
      'name': 'Kontakt företag',
      'icon': Icons.business,
    },
    {'id': 'forsakringar', 'name': 'Försäkringar', 'icon': Icons.shield},
    {
      'id': 'apl_tider',
      'name': 'APL-tider för läsår',
      'icon': Icons.calendar_today,
    },
    {'id': 'skadeanmalan', 'name': 'Skadeanmälan', 'icon': Icons.warning},
    {
      'id': 'arbetsmiljoverket',
      'name': 'Arbetsmiljöverket',
      'icon': Icons.health_and_safety,
    },
  ];

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
              child: ListView.separated(
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final category = categories[index];
                  return _CategoryCard(
                    categoryId: category['id'] as String,
                    categoryName: category['name'] as String,
                    icon: category['icon'] as IconData,
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
    // Räkna antal dokument i kategorin
    final currentUser = FirebaseAuth.instance.currentUser;

    if (categoryId == 'kontakt_foretag' && currentUser != null) {
      return StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('companies')
            .where('studentUid', isEqualTo: currentUser.uid)
            .snapshots(),
        builder: (context, companySnapshot) {
          final companyCount = companySnapshot.data?.docs.length ?? 0;
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('aplDocuments')
                .where('category', isEqualTo: categoryId)
                .snapshots(),
            builder: (context, snapshot) {
              final docCount = snapshot.data?.docs.length ?? 0;
              final totalCount = docCount + (companyCount > 0 ? 1 : 0);

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
                          child: Icon(
                            icon,
                            color: Colors.orange.shade600,
                            size: 28,
                          ),
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
                                totalCount == 0
                                    ? 'Inga dokument ännu'
                                    : '$totalCount ${totalCount == 1 ? 'dokument' : 'dokument'}',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.arrow_forward_ios,
                          size: 16,
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

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('aplDocuments')
          .where('category', isEqualTo: categoryId)
          .snapshots(),
      builder: (context, snapshot) {
        final docCount = snapshot.data?.docs.length ?? 0;

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
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: Colors.grey.shade400,
                  ),
                ],
              ),
            ),
          ),
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

  Future<void> _openPhone(String phone) async {
    final phoneUri = Uri(scheme: 'tel', path: phone);
    await launchUrl(phoneUri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openEmail(String email) async {
    final emailUri = Uri(scheme: 'mailto', path: email);
    await launchUrl(emailUri, mode: LaunchMode.externalApplication);
  }

  IconData _getFileIcon(String? fileType) {
    if (fileType == null) return Icons.insert_drive_file;

    if (fileType.contains('pdf')) return Icons.picture_as_pdf;
    if (fileType.contains('doc')) return Icons.description;
    if (fileType.contains('image') ||
        fileType.contains('jpg') ||
        fileType.contains('png')) {
      return Icons.image;
    }
    if (fileType.contains('excel') || fileType.contains('spreadsheet')) {
      return Icons.table_chart;
    }

    return Icons.insert_drive_file;
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = FirebaseAuth.instance.currentUser;

    return Scaffold(
      appBar: AppBar(title: Text(categoryName), elevation: 0),
      body: (categoryId == 'kontakt_foretag' && currentUser != null)
          ? StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('companies')
                  .where('studentUid', isEqualTo: currentUser.uid)
                  .snapshots(),
              builder: (context, companySnapshot) {
                final companyDocs = companySnapshot.data?.docs ?? [];
                final companyData = companyDocs.isNotEmpty
                    ? (companyDocs.first.data() as Map<String, dynamic>)
                    : null;

                return StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance
                      .collection('aplDocuments')
                      .where('category', isEqualTo: categoryId)
                      .orderBy('uploadedAt', descending: true)
                      .snapshots(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final docs = snapshot.data?.docs ?? [];
                    final hasCompany = companyData != null;

                    if (docs.isEmpty && !hasCompany) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.folder_open,
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
                      itemCount: docs.length + (hasCompany ? 1 : 0),
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        if (hasCompany && index == 0) {
                          final companyName =
                              companyData?['name'] as String? ?? 'Företag';
                          final contactPerson =
                              companyData?['contactPerson'] as String?;
                          final phone = companyData?['phone'] as String?;
                          final email = companyData?['email'] as String?;
                          final address = companyData?['address'] as String?;

                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.orange.shade200),
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.orange.shade50,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.business,
                                      color: Colors.orange.shade700,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      companyName,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                                if (contactPerson != null &&
                                    contactPerson.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'Kontaktperson: $contactPerson',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                                if (address != null && address.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'Adress: $address',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                                if (phone != null && phone.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'Telefon: $phone',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                                if (email != null && email.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'E-post: $email',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    if (phone != null && phone.isNotEmpty)
                                      Expanded(
                                        child: ElevatedButton.icon(
                                          onPressed: () => _openPhone(phone),
                                          icon: const Icon(
                                            Icons.call,
                                            size: 18,
                                          ),
                                          label: const Text('Ring'),
                                        ),
                                      ),
                                    if (phone != null &&
                                        phone.isNotEmpty &&
                                        email != null &&
                                        email.isNotEmpty)
                                      const SizedBox(width: 12),
                                    if (email != null && email.isNotEmpty)
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () => _openEmail(email),
                                          icon: const Icon(
                                            Icons.email,
                                            size: 18,
                                          ),
                                          label: const Text('Maila'),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        }

                        final docIndex = hasCompany ? index - 1 : index;
                        final doc =
                            docs[docIndex].data() as Map<String, dynamic>;
                        final title = doc['title'] as String? ?? 'Dokument';
                        final url = doc['url'] as String? ?? '';
                        final fileType = doc['fileType'] as String?;
                        final uploadedAt = (doc['uploadedAt'] as Timestamp?)
                            ?.toDate();

                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () =>
                                _openDocument(context, url, title, fileType),
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                    Icons.open_in_new,
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
            )
          : StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('aplDocuments')
                  .where('category', isEqualTo: categoryId)
                  .orderBy('uploadedAt', descending: true)
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
                            Icons.folder_open,
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
                    final doc = docs[index].data() as Map<String, dynamic>;
                    final title = doc['title'] as String? ?? 'Dokument';
                    final url = doc['url'] as String? ?? '';
                    final fileType = doc['fileType'] as String?;
                    final uploadedAt = (doc['uploadedAt'] as Timestamp?)
                        ?.toDate();

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () =>
                            _openDocument(context, url, title, fileType),
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
                                Icons.open_in_new,
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
            ),
    );
  }
}
