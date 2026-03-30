# Release Readiness Checklist

Last updated: 2026-03-29
Owner: Team APL Appen

## Current status
- [x] Internal test ongoing with 2 students via debug APK
- [x] Multiple bugs found and fixed during test cycle
- [ ] Release candidate build pipeline validated (Android + iOS)
- [ ] Store listing assets complete (Google Play + App Store)
- [ ] Final go/no-go review done

## Release stabilization policy (2026-03-29)
- [x] Feature freeze: no new features before release candidate approval
- [x] Safety rule: no refactors that can remove or alter existing core flows
- [x] Allowed changes: only blocker/critical bug fixes, release signing, store metadata, and monitoring setup
- [x] UI/design changes postponed unless they are strictly cosmetic and zero-risk

Decision note:
- Priority is stable release behavior over scope growth. Existing app and web functionality must remain intact.
- Play Console prep details: see GOOGLE_PLAY_PREP_CHECKLIST.md

## 1) Stability and regression gate
- [ ] No blocker bugs in teacher/student core flows
- [x] Login recovery flow: forgot password sends reset email without crash
- [ ] No blocker bugs in statistics view
- [ ] No blocker bugs in timesheet submit/approve flow
- [ ] No blocker bugs in assessment visibility rules
- [ ] Regression check: pending assessments are never shown as submitted

Exit criteria:
- 0 blocker bugs
- 0 critical open bugs

## 2) Test coverage gate
- [x] Add/verify test: pending assessment hidden
- [x] Add/verify test: submitted/approved assessment visible
- [x] Add/verify test: fallback non-zero rating visible
- [x] Run full flutter test successfully

Exit criteria:
- All targeted tests green

## 3) Android release gate (Google Play)
- [x] Set release versionCode/versionName
- [x] Configure release signing setup in Gradle (key.properties wiring)
- [x] Build signed Android App Bundle (.aab)
- [ ] Verify app startup/login/core flow on release build
- [ ] Upload to Internal testing track
- [ ] Collect tester feedback and crash reports

Progress notes (2026-03-28):
- Built release AAB: build/app/outputs/bundle/release/app-release.aab (53.5MB)
- Built release APK: build/app/outputs/flutter-apk/app-release.apk (68.5MB)
- Current blocker for "signed AAB": release buildType uses debug signing in android/app/build.gradle.kts.
- Current blocker for runtime verification: no Android device/emulator connected in this environment (only Windows/Chrome/Edge detected).

Progress notes (2026-03-29):
- Updated android/app/build.gradle.kts to support release signing via android/key.properties.
- Release build now uses release key when key.properties exists; otherwise it falls back to debug signing.
- Built release AAB again: build/app/outputs/bundle/release/app-release.aab (53.5MB).
- Build environment check: android/key.properties is currently missing, so release build falls back to debug signing.
- Sanity tests passed (3/3): test/assessment_visibility_test.dart, test/timesheet_calculation_test.dart, test/activity_template_test.dart.
- Cleaned non-source artifacts before release work: removed android_startup_log.txt (flutter_02.png expected to be removed manually).

Progress notes (2026-03-29, later):
- Created local upload keystore: android/keystore/upload-keystore.jks.
- Created local signing config: android/key.properties.
- Built release AAB with release-signing enabled: build/app/outputs/bundle/release/app-release.aab (53.5MB).
- Signature verification confirms CN=APL Appen certificate on AAB.

Exit criteria:
- Internal testing approved by team

## 4) iOS release gate (App Store)
- [ ] Confirm signing/certificates/profiles
- [ ] Build iOS release archive
- [ ] Upload to TestFlight
- [ ] Validate teacher/student core flows on TestFlight build
- [ ] Resolve TestFlight feedback

Exit criteria:
- TestFlight build approved by team

## 5) Store readiness gate
- [ ] Privacy Policy URL verified
- [ ] App description finalized
- [ ] Screenshots finalized (phone sizes)
- [ ] Support contact and website verified
- [ ] Age rating/content declarations complete
- [ ] Account deletion/data handling flow verified against policy

Exit criteria:
- Both store metadata packages complete

## 6) Production monitoring gate
- [ ] Crash reporting enabled and verified
- [ ] Basic analytics events verified
- [ ] Incident owner and rollback plan documented
- [ ] First-week monitoring checklist prepared

Exit criteria:
- Team can detect and respond to production issues quickly

## 7) Launch decision
- [ ] Go/No-Go meeting completed
- [ ] Risk list reviewed and accepted
- [ ] Rollout strategy selected (staged rollout recommended)

Recommended rollout:
1. Google Play staged rollout (10% -> 50% -> 100%)
2. App Store release after first stable window

## Weekly beta log
Use this section to track progress from your two active student testers.

### Week of 2026-03-26
- Active testers: 2 students (debug APK)
- Bugs found: several
- Bugs fixed: several
- Open blockers: none confirmed in this note
- Notes: Continue focused testing in teacher/student statistics and assessment flows. Forgot-password flow added in app login and verified (email reset link dispatch + no runtime assertion after route refactor).

## Bug triage template
Copy this for each new issue found during beta.

- Title:
- Environment (Android/iOS/Web + app version):
- Role (teacher/student/supervisor):
- Steps to reproduce:
- Expected result:
- Actual result:
- Severity (blocker/critical/major/minor):
- Status (open/in-progress/fixed/verified):
- Owner:
- Fix version:
