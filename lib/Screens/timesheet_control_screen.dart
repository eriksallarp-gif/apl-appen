import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

// Helper för att beräkna veckonummer
int _getWeekNumber(DateTime date) {
  final jan4 = DateTime(date.year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final weekNum = date.difference(monday).inDays ~/ 7 + 1;
  return weekNum;
}

// Helper för att formatera kort datum
String _formatShortDate(DateTime date) {
  return '${date.day}/${date.month}';
}

class TimesheetControlScreen extends StatefulWidget {
  const TimesheetControlScreen({super.key});

  @override
  State<TimesheetControlScreen> createState() => _TimesheetControlScreenState();
}

class _TimesheetControlScreenState extends State<TimesheetControlScreen> {
  String? _selectedClassId;
  String? _selectedStudentUid;
  final Set<String> _selectedTimesheetIds = {};
  bool _selectionMode = false;
  bool _isProcessing = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tidkort (markering)'), elevation: 0),
      body: Stack(
        children: [
          Column(
            children: [
              // Selection action bar
              if (_selectionMode)
                Container(
                  color: Colors.grey.shade100,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: Row(
                    children: [
                      Text('${_selectedTimesheetIds.length} markerade'),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: _selectAllFiltered,
                        icon: const Icon(Icons.select_all),
                        label: const Text('Markera alla'),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: _selectedTimesheetIds.isEmpty
                            ? null
                            : _bulkApprove,
                        icon: const Icon(
                          Icons.check_circle,
                          color: Colors.green,
                        ),
                        label: const Text('Godkänn'),
                      ),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: _selectedTimesheetIds.isEmpty
                            ? null
                            : _bulkReject,
                        icon: const Icon(Icons.cancel, color: Colors.orange),
                        label: const Text('Avslå'),
                      ),
                      IconButton(
                        onPressed: () => setState(() {
                          _selectionMode = false;
                          _selectedTimesheetIds.clear();
                        }),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),

              // Klassväljare
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Klass',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _ClassSelector(
                      onClassSelected: (classId) {
                        setState(() {
                          _selectedClassId = classId;
                          _selectedStudentUid = null;
                          _selectedTimesheetIds.clear();
                          _selectionMode = false;
                        });
                      },
                    ),
                  ],
                ),
              ),

              // Elevväljare (om klass är vald)
              if (_selectedClassId != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Elev (valfritt)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _StudentSelector(
                        classId: _selectedClassId!,
                        onStudentSelected: (studentUid) {
                          setState(() {
                            _selectedStudentUid = studentUid;
                            _selectedTimesheetIds.clear();
                            _selectionMode = false;
                          });
                        },
                      ),
                    ],
                  ),
                ),

              // Tidkortslista
              if (_selectedClassId != null)
                Expanded(
                  child: _TimesheetList(
                    classId: _selectedClassId!,
                    studentUid: _selectedStudentUid,
                    selectedTimesheetIds: _selectedTimesheetIds,
                    selectionMode: _selectionMode,
                    onSelectionModeChanged: (enabled) =>
                        setState(() => _selectionMode = enabled),
                    onTimesheetSelected: (id) =>
                        setState(() => _selectedTimesheetIds.add(id)),
                    onTimesheetDeselected: (id) =>
                        setState(() => _selectedTimesheetIds.remove(id)),
                  ),
                ),
            ],
          ),

          // Processing overlay
          if (_isProcessing)
            Positioned.fill(
              child: Container(
                color: Colors.black.withOpacity(0.3),
                child: const Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
    );
  }

  void _selectAllFiltered() {
    // Denna används från _TimesheetList widget
    // Markera alla synliga tidkort
  }

  Future<void> _bulkApprove() async {
    if (_selectedTimesheetIds.isEmpty) return;

    setState(() => _isProcessing = true);

    try {
      final batch = FirebaseFirestore.instance.batch();

      for (final timesheetId in _selectedTimesheetIds) {
        batch.set(
          FirebaseFirestore.instance.collection('timesheets').doc(timesheetId),
          {'approved': true},
          SetOptions(merge: true),
        );
      }

      await batch.commit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedTimesheetIds.length} tidkort godkända ✅'),
          ),
        );
        setState(() {
          _selectedTimesheetIds.clear();
          _selectionMode = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel: $e')));
      }
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _bulkReject() async {
    if (_selectedTimesheetIds.isEmpty) return;

    setState(() => _isProcessing = true);

    try {
      final batch = FirebaseFirestore.instance.batch();

      for (final timesheetId in _selectedTimesheetIds) {
        batch.set(
          FirebaseFirestore.instance.collection('timesheets').doc(timesheetId),
          {'approved': false},
          SetOptions(merge: true),
        );
      }

      await batch.commit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedTimesheetIds.length} tidkort avslagna'),
          ),
        );
        setState(() {
          _selectedTimesheetIds.clear();
          _selectionMode = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel: $e')));
      }
    } finally {
      setState(() => _isProcessing = false);
    }
  }
}

class _ClassSelector extends StatelessWidget {
  final Function(String) onClassSelected;

  const _ClassSelector({required this.onClassSelected});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
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
          items: classes
              .map(
                (doc) => DropdownMenuItem(
                  value: doc.id,
                  child: Text(doc.data()['name'] ?? 'Okänd klass'),
                ),
              )
              .toList(),
          onChanged: (classId) {
            if (classId != null) onClassSelected(classId);
          },
        );
      },
    );
  }
}

class _StudentSelector extends StatelessWidget {
  final String classId;
  final Function(String) onStudentSelected;

  const _StudentSelector({
    required this.classId,
    required this.onStudentSelected,
  });

  @override
  Widget build(BuildContext context) {
    // Läs elever både från users och classes/{classId}/students
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .where('classId', isEqualTo: classId)
          .snapshots(),
      builder: (context, usersSnap) {
        if (usersSnap.connectionState == ConnectionState.waiting) {
          return const CircularProgressIndicator();
        }

        // Läs även från classes/{classId}/students
        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('classes')
              .doc(classId)
              .collection('students')
              .snapshots(),
          builder: (context, classStudentsSnap) {
            if (classStudentsSnap.connectionState == ConnectionState.waiting) {
              return const CircularProgressIndicator();
            }

            // Kombinera båda källorna
            final usersFromUsersCollection = usersSnap.data?.docs ?? [];
            final usersFromClassCollection = classStudentsSnap.data?.docs ?? [];

            final Map<String, String> combined = {};

            for (final doc in usersFromUsersCollection) {
              combined[doc.id] = doc.data()['displayName'] ?? 'Okänd elev';
            }

            for (final doc in usersFromClassCollection) {
              if (!combined.containsKey(doc.id)) {
                combined[doc.id] = doc.data()['displayName'] ?? 'Okänd elev';
              }
            }

            return DropdownButton<String>(
              hint: const Text('Alla elever'),
              isExpanded: true,
              items: [
                const DropdownMenuItem(value: '', child: Text('Alla elever')),
                ...combined.entries.map(
                  (entry) => DropdownMenuItem(
                    value: entry.key,
                    child: Text(entry.value),
                  ),
                ),
              ],
              onChanged: (studentUid) {
                if (studentUid != null) onStudentSelected(studentUid);
              },
            );
          },
        );
      },
    );
  }
}

class _TimesheetList extends StatefulWidget {
  final String classId;
  final String? studentUid;
  final Set<String> selectedTimesheetIds;
  final bool selectionMode;
  final Function(bool) onSelectionModeChanged;
  final Function(String) onTimesheetSelected;
  final Function(String) onTimesheetDeselected;

  const _TimesheetList({
    required this.classId,
    this.studentUid,
    required this.selectedTimesheetIds,
    required this.selectionMode,
    required this.onSelectionModeChanged,
    required this.onTimesheetSelected,
    required this.onTimesheetDeselected,
  });

  @override
  State<_TimesheetList> createState() => _TimesheetListState();
}

class _TimesheetListState extends State<_TimesheetList> {
  @override
  Widget build(BuildContext context) {
    // Skapa query baserat på student
    Query<Map<String, dynamic>> query = FirebaseFirestore.instance.collection(
      'timesheets',
    );

    if (widget.studentUid != null && widget.studentUid!.isNotEmpty) {
      query = query.where('studentUid', isEqualTo: widget.studentUid);
    } else {
      // Hämta alla elever i klassen först
      query = query.where(
        'teacherUid',
        isEqualTo: FirebaseAuth.instance.currentUser!.uid,
      );
    }

    query = query.orderBy('weekStart', descending: true);

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: query.snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final timesheets = snap.data?.docs ?? [];

        if (timesheets.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.description, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                const Text(
                  'Inga tidkort i denna klass ännu',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ],
            ),
          );
        }

        return Column(
          children: [
            // Markera alla knapp
            if (timesheets.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () {
                        widget.onSelectionModeChanged(true);
                        for (final ts in timesheets) {
                          widget.onTimesheetSelected(ts.id);
                        }
                      },
                      icon: const Icon(Icons.select_all),
                      label: const Text('Markera alla'),
                    ),
                  ],
                ),
              ),

            // Tidkortslista
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: timesheets.length,
                itemBuilder: (context, index) {
                  final timesheet = timesheets[index];
                  final id = timesheet.id;
                  final data = timesheet.data();

                  final weekStart = data['weekStart'] ?? '';
                  final approved = data['approved'] ?? false;

                  // Beräkna veckonummer och datumintervall
                  String weekDisplayTitle = 'Vecka: $weekStart';
                  String weekDisplaySubtitle = '';
                  try {
                    final weekStartDate = DateTime.parse(weekStart);
                    final weekNumber = _getWeekNumber(weekStartDate);
                    final weekEndDate = weekStartDate.add(
                      const Duration(days: 4),
                    ); // Fredag
                    final dateRange =
                        '${_formatShortDate(weekStartDate)} - ${_formatShortDate(weekEndDate)}';
                    weekDisplayTitle = 'V. $weekNumber';
                    weekDisplaySubtitle = dateRange;
                  } catch (e) {
                    weekDisplayTitle = 'Vecka: $weekStart';
                  }

                  final selected = widget.selectedTimesheetIds.contains(id);

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    color: selected ? Colors.orange.shade50 : null,
                    child: ListTile(
                      leading: widget.selectionMode
                          ? Checkbox(
                              value: selected,
                              onChanged: (v) {
                                if (v == true) {
                                  widget.onTimesheetSelected(id);
                                } else {
                                  widget.onTimesheetDeselected(id);
                                }
                              },
                            )
                          : Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: approved
                                    ? Colors.green.shade100
                                    : Colors.orange.shade100,
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: Icon(
                                  approved
                                      ? Icons.check_circle
                                      : Icons.pending_actions,
                                  color: approved
                                      ? Colors.green
                                      : Colors.orange,
                                ),
                              ),
                            ),
                      title: Text(weekDisplayTitle),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (weekDisplaySubtitle.isNotEmpty)
                            Text(
                              weekDisplaySubtitle,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.grey,
                              ),
                            ),
                          Text(
                            approved ? 'Godkänd ✅' : 'Väntar på godkännande',
                            style: TextStyle(
                              color: approved ? Colors.green : Colors.orange,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      trailing: widget.selectionMode
                          ? null
                          : PopupMenuButton(
                              itemBuilder: (context) => [
                                PopupMenuItem(
                                  child: const Row(
                                    children: [
                                      Icon(Icons.visibility, size: 20),
                                      SizedBox(width: 8),
                                      Text('Visa'),
                                    ],
                                  ),
                                  onTap: () {
                                    // TODO: Öppna tidkortsvyn för denna vecka
                                  },
                                ),
                                PopupMenuItem(
                                  child: Row(
                                    children: [
                                      Icon(
                                        approved
                                            ? Icons.cancel
                                            : Icons.check_circle,
                                        size: 20,
                                        color: approved
                                            ? Colors.orange
                                            : Colors.green,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(approved ? 'Avslå' : 'Godkänn'),
                                    ],
                                  ),
                                  onTap: () async {
                                    await FirebaseFirestore.instance
                                        .collection('timesheets')
                                        .doc(id)
                                        .set({
                                          'approved': !approved,
                                        }, SetOptions(merge: true));
                                  },
                                ),
                              ],
                            ),
                      onLongPress: () {
                        widget.onSelectionModeChanged(true);
                        widget.onTimesheetSelected(id);
                      },
                      onTap: () {
                        if (widget.selectionMode) {
                          if (selected) {
                            widget.onTimesheetDeselected(id);
                          } else {
                            widget.onTimesheetSelected(id);
                          }
                        }
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
