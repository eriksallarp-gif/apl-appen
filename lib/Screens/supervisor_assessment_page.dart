import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class SupervisorAssessmentPage extends StatefulWidget {
  final String requestId;
  final String token;

  const SupervisorAssessmentPage({
    super.key,
    required this.requestId,
    required this.token,
  });

  @override
  State<SupervisorAssessmentPage> createState() =>
      _SupervisorAssessmentPageState();
}

class _SupervisorAssessmentPageState extends State<SupervisorAssessmentPage> {
  bool _isLoading = true;
  bool _isValid = false;
  String? _errorMessage;
  Map<String, dynamic>? _requestData;

  // Bedömningskriterier (1-5 skala)
  final Map<String, int> _ratings = {
    'Engagemang': 0,
    'Initiativtagande': 0,
    'Samarbetsförmåga': 0,
    'Problemlösning': 0,
    'Kvalitet på arbete': 0,
  };

  final Map<String, String> _comments = {};
  final TextEditingController _otherCommentController = TextEditingController();

  // Bildkommentarer
  final Map<String, TextEditingController> _imageCommentControllers = {};

  // Ersättning
  final TextEditingController _lunchApprovedController =
      TextEditingController();
  final TextEditingController _travelApprovedController =
      TextEditingController();

  // Signatur
  final TextEditingController _companyController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _validateAndLoadRequest();
  }

  @override
  void dispose() {
    _otherCommentController.dispose();
    _lunchApprovedController.dispose();
    _travelApprovedController.dispose();
    _companyController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    for (var controller in _imageCommentControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _validateAndLoadRequest() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('assessmentRequests')
          .doc(widget.requestId)
          .get();

      if (!doc.exists) {
        setState(() {
          _isLoading = false;
          _isValid = false;
          _errorMessage = 'Bedömningsförfrågan hittades inte';
        });
        return;
      }

      final data = doc.data()!;
      final token = data['token'] as String?;
      final status = data['status'] as String?;
      final expiresAt = (data['expiresAt'] as Timestamp?)?.toDate();

      // Validera token
      if (token != widget.token) {
        setState(() {
          _isLoading = false;
          _isValid = false;
          _errorMessage = 'Ogiltig eller utgången länk';
        });
        return;
      }

      // Kontrollera om redan inskickad
      if (status == 'submitted') {
        setState(() {
          _isLoading = false;
          _isValid = false;
          _errorMessage =
              'Denna bedömning har redan skickats in och kan inte ändras';
        });
        return;
      }

      // Kontrollera om utgången
      if (expiresAt != null && expiresAt.isBefore(DateTime.now())) {
        setState(() {
          _isLoading = false;
          _isValid = false;
          _errorMessage = 'Denna länk har utgått';
        });
        return;
      }

      // Allt OK - sätt initial ersättning från elevens förslag
      _lunchApprovedController.text = (data['lunchCount'] as int? ?? 0)
          .toString();
      _travelApprovedController.text = (data['travelCount'] as int? ?? 0)
          .toString();

      setState(() {
        _isLoading = false;
        _isValid = true;
        _requestData = data;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _isValid = false;
        _errorMessage = 'Ett fel uppstod: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_isValid) {
      return Scaffold(
        appBar: AppBar(title: const Text('Bedömning')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
                const SizedBox(height: 16),
                Text(
                  _errorMessage ?? 'Ett fel uppstod',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final studentName = _requestData!['studentName'] as String? ?? 'Elev';
    final weeks = (_requestData!['weeks'] as List?)?.cast<String>() ?? [];
    final totalHours = _requestData!['totalHours'] as int? ?? 0;
    final lunchCount = _requestData!['lunchCount'] as int? ?? 0;
    final travelCount = _requestData!['travelCount'] as int? ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bedömning - Handledare'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Elevinfo
            Card(
              color: Colors.orange.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.person, color: Colors.orange),
                        const SizedBox(width: 8),
                        Text(
                          studentName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(
                          Icons.event_note,
                          size: 20,
                          color: Colors.orange,
                        ),
                        const SizedBox(width: 8),
                        Text('Veckor: ${weeks.join(', ')}'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.access_time,
                          size: 20,
                          color: Colors.orange,
                        ),
                        const SizedBox(width: 8),
                        Text('Total arbetstid: $totalHours timmar'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Elevens självskattning
            if (_requestData!['studentSelfAssessment'] != null) ...[
              const Text(
                'Elevens Självskattning',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Elevens reflektioner över APL-perioden',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 12),
              ..._buildSelfAssessmentCards(),
              const SizedBox(height: 24),
            ],

            // Ersättning
            const Text(
              'Ersättning',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Kontrollera och justera vid behov',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Elevens förslag:'),
                              Text(
                                '$lunchCount luncher, $travelCount km',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _lunchApprovedController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Godkända luncher',
                        prefixIcon: Icon(Icons.lunch_dining),
                        border: OutlineInputBorder(),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _travelApprovedController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Godkända kilometer (km)',
                        prefixIcon: Icon(Icons.directions_car),
                        border: OutlineInputBorder(),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Bilder från APL
            if (_requestData!['images'] != null &&
                (_requestData!['images'] as List).isNotEmpty) ...[
              const Text(
                'Bilder från APL',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Granska bilderna och ge feedback',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 12),
              ...(_requestData!['images'] as List).asMap().entries.map((entry) {
                final index = entry.key;
                final imageData = entry.value as Map<String, dynamic>;
                final imageUrl = imageData['url'] as String;

                // Skapa controller för denna bild om den inte finns
                _imageCommentControllers.putIfAbsent(
                  index.toString(),
                  () => TextEditingController(),
                );

                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        onTap: () => _showFullImage(context, imageUrl),
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(12),
                          ),
                          child: Image.network(
                            imageUrl,
                            width: double.infinity,
                            height: 200,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, progress) {
                              if (progress == null) return child;
                              return const SizedBox(
                                height: 200,
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bild ${index + 1}',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller:
                                  _imageCommentControllers[index.toString()],
                              maxLines: 3,
                              decoration: const InputDecoration(
                                labelText: 'Din kommentar till bilden',
                                hintText: 'Skriv din feedback här...',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 24),
            ],

            // Bedömning
            const Text(
              'Bedömning',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Betygsätt eleven på en skala 1-5',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 12),

            ..._ratings.keys.map((criterion) {
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        criterion,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: List.generate(5, (index) {
                          final rating = index + 1;
                          final isSelected = _ratings[criterion] == rating;
                          return InkWell(
                            onTap: () {
                              setState(() {
                                _ratings[criterion] = rating;
                              });
                            },
                            child: Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? Colors.orange
                                    : Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected
                                      ? Colors.orange.shade700
                                      : Colors.grey.shade400,
                                  width: 2,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '$rating',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected
                                        ? Colors.white
                                        : Colors.black87,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        decoration: const InputDecoration(
                          hintText: 'Kommentar (valfritt)',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        maxLines: 2,
                        onChanged: (value) {
                          _comments[criterion] = value;
                        },
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 16),

            // Övrig kommentar
            const Text(
              'Övrigt',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _otherCommentController,
              decoration: const InputDecoration(
                hintText: 'Övriga kommentarer...',
                border: OutlineInputBorder(),
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 24),

            // Signatur
            const Text(
              'Signatur',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Obligatorisk information',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _companyController,
              decoration: const InputDecoration(
                labelText: 'Företag *',
                prefixIcon: Icon(Icons.business),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Namn *',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Mobilnummer *',
                prefixIcon: Icon(Icons.phone),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 32),

            // Skicka knapp
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _submitAssessment,
                icon: const Icon(Icons.send),
                label: const Text('Skicka bedömning'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Future<void> _submitAssessment() async {
    // Validera obligatoriska fält
    if (_companyController.text.trim().isEmpty ||
        _nameController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vänligen fyll i alla obligatoriska fält'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Kontrollera att minst en bedömning har gjorts
    final hasAnyRating = _ratings.values.any((rating) => rating > 0);
    if (!hasAnyRating) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vänligen betygsätt minst ett kriterium'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Visa bekräftelsedialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Bekräfta bedömning'),
        content: const Text(
          'Är du säker på att du vill skicka bedömningen? Den kan inte ändras efter att den har skickats.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Skicka'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      // Förbered bedömningsdata
      final assessmentData = <String, dynamic>{};
      _ratings.forEach((criterion, rating) {
        if (rating > 0) {
          assessmentData[criterion] = {
            'rating': rating,
            'comment': _comments[criterion] ?? '',
          };
        }
      });

      if (_otherCommentController.text.trim().isNotEmpty) {
        assessmentData['Övrigt'] = _otherCommentController.text.trim();
      }

      // Förbered bildkommentarer
      final imageComments = <String, String>{};
      _imageCommentControllers.forEach((index, controller) {
        if (controller.text.trim().isNotEmpty) {
          imageComments[index] = controller.text.trim();
        }
      });

      // Beräkna totalpoäng
      final totalRating = _ratings.values
          .where((r) => r > 0)
          .fold<int>(0, (sum, rating) => sum + rating);
      final ratedCount = _ratings.values.where((r) => r > 0).length;
      final averageRating = ratedCount > 0
          ? (totalRating / ratedCount).toStringAsFixed(1)
          : '0';

      // Uppdatera bedömningsförfrågan
      await FirebaseFirestore.instance
          .collection('assessmentRequests')
          .doc(widget.requestId)
          .update({
            'status': 'submitted',
            'submittedAt': FieldValue.serverTimestamp(),
            'supervisorCompany': _companyController.text.trim(),
            'supervisorName': _nameController.text.trim(),
            'supervisorPhone': _phoneController.text.trim(),
            'lunchApproved': int.tryParse(_lunchApprovedController.text) ?? 0,
            'travelApproved': int.tryParse(_travelApprovedController.text) ?? 0,
            'assessmentData': assessmentData,
            'imageComments': imageComments,
            'averageRating': averageRating,
          });

      // Visa framgångsmeddelande
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green, size: 32),
              SizedBox(width: 12),
              Text('Tack!'),
            ],
          ),
          content: const Text(
            'Bedömningen har skickats in och eleven kommer att se den i sin app.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                // Kan eventuellt navigera till en "färdig"-sida eller stänga appen
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Fel vid inskickning: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  List<Widget> _buildSelfAssessmentCards() {
    final selfAssessment = _requestData!['studentSelfAssessment'] as Map<String, dynamic>? ?? {};
    final cards = <Widget>[];

    final questions = [
      {
        'key': 'whatDidYouDo',
        'title': '1. Vad har du fått göra?',
        'icon': Icons.work,
      },
      {
        'key': 'whatWasPositive',
        'title': '2. Vad har varit positivt med APLen?',
        'icon': Icons.thumb_up,
      },
      {
        'key': 'whatCouldBeBetter',
        'title': '3. Vad skulle kunnat vara bättre?',
        'icon': Icons.lightbulb,
      },
      {
        'key': 'whatCouldYouDoDifferently',
        'title': '4. Vad kunde du som elev gjort annorlunda?',
        'icon': Icons.psychology,
      },
      {
        'key': 'overallRating',
        'title': '5. Vilket betyg för APL-perioden? (1-10)',
        'icon': Icons.star,
      },
    ];

    for (final q in questions) {
      final answer = selfAssessment[q['key']] as String? ?? '';
      if (answer.isNotEmpty) {
        cards.add(
          Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(q['icon'] as IconData, color: Colors.orange),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          q['title'] as String,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      answer,
                      style: const TextStyle(fontSize: 15),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }
    }

    return cards;
  }

  void _showFullImage(BuildContext context, String imageUrl) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: Image.network(imageUrl, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 32),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
