import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class WeekManagementScreen extends StatefulWidget {
  const WeekManagementScreen({super.key});

  @override
  State<WeekManagementScreen> createState() => _WeekManagementScreenState();
}

class _WeekManagementScreenState extends State<WeekManagementScreen> {
  String? _selectedClassId;
  String? _selectedStudentUid;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              const Text(
                'Vecko-styrning',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Bestäm vilka veckor eleverna kan fylla i tidkort',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 24),

              // Klassväljare
              const Text(
                'Välj klass',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('classes')
                    .where('teacherUid', isEqualTo: user.uid)
                    .snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const CircularProgressIndicator();
                  }
                  final classes = snap.data?.docs ?? [];
                  return DropdownButton<String>(
                    hint: const Text('Välj klass'),
                    isExpanded: true,
                    value: _selectedClassId,
                    items: classes
                        .map(
                          (doc) => DropdownMenuItem(
                            value: doc.id,
                            child: Text(doc['name'] ?? 'Okänd klass'),
                          ),
                        )
                        .toList(),
                    onChanged: (classId) {
                      setState(() {
                        _selectedClassId = classId;
                        _selectedStudentUid = null;
                      });
                    },
                  );
                },
              ),
              const SizedBox(height: 24),

              // Elevväljare
              if (_selectedClassId != null) ...[
                const Text(
                  'Välj elev (eller ställ in för hela klassen)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                  stream: FirebaseFirestore.instance
                      .collection('users')
                      .where('role', isEqualTo: 'student')
                      .snapshots(),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const CircularProgressIndicator();
                    }

                    // Filtrera elever som tillhör denna klass
                    final allUsers = snap.data?.docs ?? [];
                    final classStudents = allUsers.where((doc) {
                      final userClassId = (doc.data()['classId'] ?? '')
                          .toString()
                          .trim();
                      final isMatch = userClassId == _selectedClassId;
                      // Debug-logg
                      print(
                        'DEBUG: Checking student ${doc.data()['displayName']}: classId=$userClassId vs selected=$_selectedClassId => match=$isMatch',
                      );
                      return isMatch;
                    }).toList();

                    return DropdownButton<String?>(
                      hint: const Text('Alla elever i klassen'),
                      isExpanded: true,
                      value: _selectedStudentUid,
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('Alla elever i klassen'),
                        ),
                        ...classStudents.map(
                          (doc) => DropdownMenuItem(
                            value: doc.id,
                            child: Text(doc['displayName'] ?? 'Okänd elev'),
                          ),
                        ),
                      ],
                      onChanged: (uid) {
                        setState(() => _selectedStudentUid = uid);
                      },
                    );
                  },
                ),
                const SizedBox(height: 24),

                // Veckokontroller
                _buildWeekSelector(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWeekSelector() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Vilka veckor ska eleverna kunna fylla i?',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 16),
          // Om en elev är vald, läs elevens personliga inställningar
          // Annars läs klassens inställningar
          StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: _selectedStudentUid != null
                ? FirebaseFirestore.instance
                      .collection('classes')
                      .doc(_selectedClassId)
                      .collection('studentWeekOverrides')
                      .doc(_selectedStudentUid)
                      .snapshots()
                : FirebaseFirestore.instance
                      .collection('classes')
                      .doc(_selectedClassId)
                      .snapshots(),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const CircularProgressIndicator();
              }

              if (!snap.hasData) {
                return const Center(child: Text('Ingen data'));
              }

              // Läs weekEnabled på ett säkert sätt
              Map<int, bool> weekEnabled = {};
              final rawData = snap.data?.data()?['weekEnabled'];

              if (rawData is Map) {
                // Konvertera till Map<int, bool>
                for (var entry in (rawData).entries) {
                  final key = int.tryParse(entry.key.toString());
                  final value = entry.value;
                  if (key != null && value is bool) {
                    weekEnabled[key] = value;
                  }
                }
              }

              return GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1,
                ),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: 52,
                itemBuilder: (context, index) {
                  final weekNumber = index + 1;
                  final isEnabled = weekEnabled[weekNumber] ?? false;

                  return GestureDetector(
                    onTap: () => _toggleWeek(weekNumber, isEnabled),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isEnabled ? Colors.orange : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isEnabled
                              ? Colors.orange
                              : Colors.grey.shade300,
                        ),
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'V$weekNumber',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isEnabled ? Colors.white : Colors.grey,
                              ),
                            ),
                            if (isEnabled)
                              const Icon(
                                Icons.check,
                                size: 16,
                                color: Colors.white,
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
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: _enableAllWeeks,
                icon: const Icon(Icons.check_circle),
                label: const Text('Aktivera alla'),
              ),
              ElevatedButton.icon(
                onPressed: _disableAllWeeks,
                icon: const Icon(Icons.cancel),
                label: const Text('Inaktivera alla'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _toggleWeek(int weekNumber, bool isCurrentlyEnabled) async {
    if (_selectedClassId == null) return;

    try {
      if (_selectedStudentUid != null) {
        // Spara för enskild elev
        final studentRef = FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .collection('studentWeekOverrides')
            .doc(_selectedStudentUid);

        final studentDoc = await studentRef.get();

        // Konvertera säkert från Firestore (String-nycklar) till int-nycklar
        Map<int, bool> weekEnabled = {};
        final rawData = studentDoc.data()?['weekEnabled'];
        if (rawData is Map) {
          for (var entry in (rawData).entries) {
            final key = int.tryParse(entry.key.toString());
            final value = entry.value;
            if (key != null && value is bool) {
              weekEnabled[key] = value;
            }
          }
        }

        // Växla veckan
        weekEnabled[weekNumber] = !isCurrentlyEnabled;

        // Konvertera till String-nycklar för Firestore
        final weekEnabledAsStrings = weekEnabled.map(
          (k, v) => MapEntry(k.toString(), v),
        );

        await studentRef.set({'weekEnabled': weekEnabledAsStrings});
      } else {
        // Spara för hela klassen
        final classRef = FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId);

        final classDoc = await classRef.get();

        // Konvertera säkert från Firestore (String-nycklar) till int-nycklar
        Map<int, bool> weekEnabled = {};
        final rawData = classDoc.data()?['weekEnabled'];
        if (rawData is Map) {
          for (var entry in (rawData).entries) {
            final key = int.tryParse(entry.key.toString());
            final value = entry.value;
            if (key != null && value is bool) {
              weekEnabled[key] = value;
            }
          }
        }

        // Växla veckan
        weekEnabled[weekNumber] = !isCurrentlyEnabled;

        // Konvertera till String-nycklar för Firestore
        final weekEnabledAsStrings = weekEnabled.map(
          (k, v) => MapEntry(k.toString(), v),
        );

        await classRef.update({'weekEnabled': weekEnabledAsStrings});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isCurrentlyEnabled
                  ? 'Vecka $weekNumber inaktiverad'
                  : 'Vecka $weekNumber aktiverad',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel: $e')));
      }
    }
  }

  Future<void> _enableAllWeeks() async {
    if (_selectedClassId == null) return;

    try {
      final weekEnabled = <int, bool>{};
      for (int i = 1; i <= 52; i++) {
        weekEnabled[i] = true;
      }

      // Konvertera till String-nycklar för Firestore
      final weekEnabledAsStrings = weekEnabled.map(
        (k, v) => MapEntry(k.toString(), v),
      );

      if (_selectedStudentUid != null) {
        // Spara för enskild elev
        await FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .collection('studentWeekOverrides')
            .doc(_selectedStudentUid)
            .set({'weekEnabled': weekEnabledAsStrings});
      } else {
        // Spara för hela klassen
        await FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .update({'weekEnabled': weekEnabledAsStrings});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Alla veckor aktiverade ✅')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel: $e')));
      }
    }
  }

  Future<void> _disableAllWeeks() async {
    if (_selectedClassId == null) return;

    try {
      if (_selectedStudentUid != null) {
        // För enskild elev: radera override-dokumentet så att klassens veckor används
        await FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .collection('studentWeekOverrides')
            .doc(_selectedStudentUid)
            .delete();
      } else {
        // Spara för hela klassen
        await FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .update({'weekEnabled': <int, bool>{}});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _selectedStudentUid != null
                  ? 'Elevens överskrivningar borttagna (använder nu klassens veckor)'
                  : 'Alla veckor inaktiverade',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel: $e')));
      }
    }
  }
}
