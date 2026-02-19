import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class TeacherDashboardScreen extends StatefulWidget {
  final VoidCallback? onNavigateToApproval;

  const TeacherDashboardScreen({super.key, this.onNavigateToApproval});

  @override
  State<TeacherDashboardScreen> createState() => _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Välkomstmeddelande
              const SizedBox(height: 16),
              const Text(
                'Lärarvy',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Översikt och status',
                style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 32),

              // Status-kort
              _buildStatusCard(),
              const SizedBox(height: 32),

              // Instruktioner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Så här använder du lärarvyn:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildInstructionItem(
                      '1. Lägg till elever i klasser och tilldela roller',
                    ),
                    _buildInstructionItem(
                      '2. Eleverna fyller i tidkort varje vecka',
                    ),
                    _buildInstructionItem(
                      '3. Granska och godkänn tidkortet + ersättning',
                    ),
                    _buildInstructionItem(
                      '4. Låsa kortet så elev inte kan ändra',
                    ),
                    _buildInstructionItem(
                      '5. Övervaka elevernas totala timmar',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('classes')
          .where('teacherUid', isEqualTo: user.uid)
          .snapshots(),
      builder: (context, classSnap) {
        if (classSnap.connectionState == ConnectionState.waiting) {
          return _buildStatusCardContent(0, 0);
        }

        final classes = classSnap.data?.docs ?? [];

        // Hämta alla tidkort för att räkna de ogodkända från lärarens klasser
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('timesheets')
              .snapshots(),
          builder: (context, tsSnap) {
            if (tsSnap.connectionState == ConnectionState.waiting) {
              return _buildStatusCardContent(classes.length, 0);
            }

            final allTimesheets = tsSnap.data?.docs ?? [];
            final classIds = classes.map((c) => c.id).toSet();
            int pendingCount = 0;

            // Räkna ogodkända tidkort från lärarens klasser
            for (var doc in allTimesheets) {
              final data = doc.data();
              final approved = data['approved'] as bool? ?? false;

              // Hoppa över redan godkända
              if (approved) continue;

              final classId = data['classId'] as String?;

              // Kolla om tidkortet tillhör en av lärarens klasser
              if (classId != null && classIds.contains(classId)) {
                pendingCount++;
              }
            }

            return _buildStatusCardContent(classes.length, pendingCount);
          },
        );
      },
    );
  }

  Widget _buildStatusCardContent(int classCount, int pendingCount) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange.shade400, Colors.orange.shade600],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$classCount',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const Text('Klasser', style: TextStyle(color: Colors.white70)),
            ],
          ),
          InkWell(
            onTap: widget.onNavigateToApproval,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$pendingCount',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const Text(
                    'Väntar på\ngodkännande',
                    textAlign: TextAlign.right,
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '• ',
            style: TextStyle(
              color: Colors.orange.shade700,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: TextStyle(color: Colors.orange.shade900)),
          ),
        ],
      ),
    );
  }
}
