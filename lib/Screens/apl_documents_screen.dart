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
                  final categoryId = category['id'] as String;
                  if (categoryId == 'kontakt_foretag') {
                    return _ContactCompanyCard(
                      categoryName: category['name'] as String,
                      icon: category['icon'] as IconData,
                    );
                  }
                  return _CategoryCard(
                    categoryId: categoryId,
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
                Icons.arrow_forward_ios,
                size: 16,
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
                      _InfoRow(icon: Icons.person, label: contact),
                    if (address != null && address.isNotEmpty)
                      _InfoRow(icon: Icons.location_on, label: address),
                    if (phone != null && phone.isNotEmpty)
                      _InfoRow(icon: Icons.phone, label: phone),
                    if (email != null && email.isNotEmpty)
                      _InfoRow(icon: Icons.email, label: email),
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
    // Räkna antal dokument i kategorin
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('aplDocuments')
          .where('category', isEqualTo: categoryId)
          .snapshots(),
      builder: (context, snapshot) {
        final docCount = snapshot.data?.docs.length ?? 0;

        // Debug: Log all documents in this category
        if (snapshot.hasData && snapshot.data!.docs.isNotEmpty) {
          print('📋 $categoryName: Found $docCount documents');
          for (var doc in snapshot.data!.docs) {
            final data = doc.data() as Map<String, dynamic>;
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
    return Scaffold(
      appBar: AppBar(title: Text(categoryName), elevation: 0),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('aplDocuments')
            .where('category', isEqualTo: categoryId)
            .orderBy('uploadedAt', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          // Debug logging
          if (snapshot.hasData) {
            print(
              '📦 Category: $categoryId - Found ${snapshot.data!.docs.length} documents',
            );
            for (var doc in snapshot.data!.docs) {
              final data = doc.data() as Map<String, dynamic>;
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
