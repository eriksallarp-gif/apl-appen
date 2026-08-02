import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../core/assessment_templates.dart';

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
  AssessmentTemplateConfig _assessmentTemplateConfig =
      defaultAssessmentTemplateConfig;

  // Bedömningskriterier (1-5 skala)
  Map<String, int> _ratings = {};

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
    _applyAssessmentTemplateConfig(defaultAssessmentTemplateConfig);
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
      final callable = FirebaseFunctions.instance.httpsCallable(
        'getSupervisorAssessmentRequest',
      );
      final result = await callable.call({
        'requestId': widget.requestId,
        'token': widget.token,
      });

      final resultData = (result.data as Map?)?.cast<String, dynamic>() ?? {};
      final data =
          (resultData['request'] as Map?)?.cast<String, dynamic>() ?? {};
      final templateConfig = sanitizeAssessmentTemplateConfig(
        data['assessmentTemplateSnapshot'],
      );

      if (data.isEmpty) {
        setState(() {
          _isLoading = false;
          _isValid = false;
          _errorMessage = 'Bedömningsförfrågan hittades inte';
        });
        return;
      }

      // Allt OK - sätt initial ersättning från elevens förslag
      _lunchApprovedController.text = (data['lunchCount'] as int? ?? 0)
          .toString();
      _travelApprovedController.text = (data['travelCount'] as int? ?? 0)
          .toString();

      setState(() {
        _applyAssessmentTemplateConfig(templateConfig);
        _isLoading = false;
        _isValid = true;
        _requestData = data;
      });
    } on FirebaseFunctionsException catch (e) {
      var message = 'Ogiltig eller utgången länk';
      if (e.code == 'not-found') {
        message = 'Bedömningsförfrågan hittades inte';
      } else if (e.code == 'failed-precondition') {
        message = e.message ?? 'Denna länk är inte längre giltig';
      } else if (e.code == 'invalid-argument') {
        message = 'Felaktig länk';
      }

      setState(() {
        _isLoading = false;
        _isValid = false;
        _errorMessage = message;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _isValid = false;
        _errorMessage = 'Ett fel uppstod: $e';
      });
    }
  }

  void _applyAssessmentTemplateConfig(AssessmentTemplateConfig config) {
    final nextRatings = <String, int>{};
    for (final criterion in config.supervisorCriteria) {
      nextRatings[criterion.key] = _ratings[criterion.key] ?? 0;
    }

    _assessmentTemplateConfig = config;
    _ratings = nextRatings;
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
      appBar: AppBar(title: const Text('Bedömning - Handledare')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Elevinfo
            Card(
              color: const Color(0xFFFFF1E5),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.person, color: Color(0xFFE56A00)),
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
                          color: Color(0xFFE56A00),
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
                          color: Color(0xFFE56A00),
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

            ..._assessmentTemplateConfig.supervisorCriteria.map((criterion) {
              return Card(
                key: ValueKey(criterion.key),
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        criterion.label,
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
                          final isSelected = _ratings[criterion.key] == rating;
                          return InkWell(
                            onTap: () {
                              setState(() {
                                _ratings[criterion.key] = rating;
                              });
                            },
                            child: Container(
                              width: 50,
                              height: 50,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFFFF6A00)
                                    : Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFFE65A00)
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
                          _comments[criterion.key] = value;
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

    final missingCriteria = _assessmentTemplateConfig.supervisorCriteria.where(
      (criterion) => (_ratings[criterion.key] ?? 0) <= 0,
    );
    if (missingCriteria.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vänligen betygsätt alla kriterier'),
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
      for (final criterion in _assessmentTemplateConfig.supervisorCriteria) {
        assessmentData[criterion.key] = {
          'label': criterion.label,
          'rating': _ratings[criterion.key] ?? 0,
          'comment': _comments[criterion.key] ?? '',
        };
      }

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
      final totalRating = _assessmentTemplateConfig.supervisorCriteria
          .fold<int>(
            0,
            (sum, criterion) => sum + (_ratings[criterion.key] ?? 0),
          );
      final averageRating =
          _assessmentTemplateConfig.supervisorCriteria.isNotEmpty
          ? (totalRating / _assessmentTemplateConfig.supervisorCriteria.length)
                .toStringAsFixed(1)
          : '0';

      await FirebaseFunctions.instance
          .httpsCallable('submitSupervisorAssessment')
          .call({
            'requestId': widget.requestId,
            'token': widget.token,
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
              Icon(Icons.check_circle, color: Color(0xFFE56A00), size: 32),
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
    final selfAssessment =
        _requestData!['studentSelfAssessment'] as Map<String, dynamic>? ?? {};
    final cards = <Widget>[];

    for (final entry
        in _assessmentTemplateConfig.selfAssessmentFields.asMap().entries) {
      final index = entry.key;
      final field = entry.value;
      if (!shouldShowSelfAssessmentFieldForSupervisor(_assessmentTemplateConfig, field.key)) {
        continue;
      }
      final answer = selfAssessment[field.key] as String? ?? '';
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
                      Icon(
                        field.inputType == 'number' ? Icons.star : Icons.notes,
                        color: const Color(0xFFE56A00),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '${index + 1}. ${field.label}',
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
                    child: Text(answer, style: const TextStyle(fontSize: 15)),
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
