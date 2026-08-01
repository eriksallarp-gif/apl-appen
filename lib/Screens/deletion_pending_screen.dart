import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';

class DeletionPendingScreen extends StatefulWidget {
  final User user;
  final DateTime? deletionRequestedAt;

  const DeletionPendingScreen({
    super.key,
    required this.user,
    this.deletionRequestedAt,
  });

  @override
  State<DeletionPendingScreen> createState() => _DeletionPendingScreenState();
}

class _DeletionPendingScreenState extends State<DeletionPendingScreen> {
  bool _isLoading = false;

  int get _daysRemaining {
    if (widget.deletionRequestedAt == null) return 30;
    final elapsed =
        DateTime.now().difference(widget.deletionRequestedAt!).inDays;
    return (30 - elapsed).clamp(0, 30);
  }

  Future<void> _cancelDeletion() async {
    setState(() => _isLoading = true);
    try {
      final fn = FirebaseFunctions.instance;
      await fn.httpsCallable('cancelAccountDeletion').call();
      // AuthGate rebuilds automatically when Firestore user doc changes.
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fel: ${e.toString()}')),
        );
      }
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8F2),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35).withAlpha(25),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.delete_outline_rounded,
                  size: 64,
                  color: Color(0xFFFF6B35),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Konto schemalagt för radering',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A1A2E),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'Ditt konto kommer att raderas om $_daysRemaining dagar.\n\n'
                'All din information anonymiseras. Vill du ångra dig och '
                'behålla kontot kan du återställa det nedan.',
                style: const TextStyle(
                  fontSize: 15,
                  color: Colors.black54,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _cancelDeletion,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF6B35),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Återställ mitt konto',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _logout,
                child: const Text(
                  'Logga ut',
                  style: TextStyle(color: Colors.black45, fontSize: 15),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
