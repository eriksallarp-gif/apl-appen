import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class GdprConsentScreen extends StatefulWidget {
  final User user;
  final String consentVersion;

  const GdprConsentScreen({
    super.key,
    required this.user,
    required this.consentVersion,
  });

  @override
  State<GdprConsentScreen> createState() => _GdprConsentScreenState();
}

class _GdprConsentScreenState extends State<GdprConsentScreen> {
  bool _accepted = false;
  bool _saving = false;
  String? _error;

  Future<void> _approveConsent() async {
    if (!_accepted || _saving) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.user.uid)
          .set({
            'gdprConsentAccepted': true,
            'gdprConsentVersion': widget.consentVersion,
            'gdprConsentAcceptedAt': FieldValue.serverTimestamp(),
            'gdprConsentLocale': 'sv-SE',
          }, SetOptions(merge: true));
    } catch (e) {
      setState(() {
        _error = 'Kunde inte spara ditt godkännande. Försök igen.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Integritet och personuppgifter'),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Godkänn behandling av personuppgifter',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'För att använda appen behöver du godkänna att APL-appen lagrar och behandlar de uppgifter som krävs för APL-uppföljning.',
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Vi behandlar bland annat:',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    const Text('- Namn och kontaktuppgifter'),
                    const Text('- Skola, klass och lärarkoppling'),
                    const Text('- Tidkort, kommentarer och arbetstimmar'),
                    const Text('- Bedömningar och APL-relaterade bilagor'),
                    const SizedBox(height: 16),
                    Text(
                      'Policyversion: ${widget.consentVersion}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      value: _accepted,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Jag har tagit del av informationen och godkänner behandlingen av mina personuppgifter för APL-appen.',
                      ),
                      onChanged: _saving
                          ? null
                          : (value) {
                              setState(() {
                                _accepted = value ?? false;
                              });
                            },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _saving ? null : _logout,
                            child: const Text('Logga ut'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: (_accepted && !_saving)
                                ? _approveConsent
                                : null,
                            child: _saving
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('Godkann och fortsatt'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
