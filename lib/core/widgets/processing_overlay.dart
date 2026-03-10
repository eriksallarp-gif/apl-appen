import 'package:flutter/material.dart';

class ProcessingOverlay extends StatelessWidget {
  final bool isVisible;

  const ProcessingOverlay({
    super.key,
    required this.isVisible,
  });

  @override
  Widget build(BuildContext context) {
    if (!isVisible) return const SizedBox.shrink();

    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.3),
        child: const Center(
          child: CircularProgressIndicator(),
        ),
      ),
    );
  }
}
