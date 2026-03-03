#!/usr/bin/env node

/**
 * Backfill script to set status='active' on all users that don't have a status field
 * Usage:
 *   node backfill-user-status.js [--dry-run] [--cred=path/to/serviceAccountKey.json]
 * 
 * Examples:
 *   node backfill-user-status.js --dry-run
 *   node backfill-user-status.js --cred=/path/to/key.json
 *   node backfill-user-status.js
 */

const admin = require('firebase-admin');

// Parse command-line arguments
const args = process.argv.slice(2);
let dryRun = false;
let credPath = null;

for (const arg of args) {
  if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg.startsWith('--cred=')) {
    credPath = arg.substring(7);
  }
}

// Initialize Firebase Admin
if (credPath) {
  const serviceAccount = require(credPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

async function backfillUserStatus() {
  console.log('🔄 Starting backfill of user status...');
  console.log(`DRY RUN: ${dryRun ? 'Yes (no changes will be made)' : 'No (changes will be committed)'}`);
  console.log('');

  try {
    // Get all users
    const usersSnap = await db.collection('users').get();
    console.log(`📊 Found ${usersSnap.size} total users`);

    const usersWithoutStatus = [];
    const usersWithStatus = [];

    // Categorize users
    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      if (userData.status) {
        usersWithStatus.push(doc.id);
      } else {
        usersWithoutStatus.push(doc.id);
      }
    }

    console.log(`  ✅ Users with status field: ${usersWithStatus.length}`);
    console.log(`  ⚠️  Users without status field: ${usersWithoutStatus.length}`);
    console.log('');

    if (usersWithoutStatus.length === 0) {
      console.log('✨ All users already have status field. Nothing to do!');
      return;
    }

    // Prepare batch updates
    let batch = db.batch();
    let ops = 0;
    let updateCount = 0;

    for (const uid of usersWithoutStatus) {
      const userRef = db.collection('users').doc(uid);
      batch.update(userRef, {
        status: 'active',
        statusSetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ops++;
      updateCount++;

      if (ops >= 450) {
        // Firebase limits batch operations
        if (!dryRun) {
          await batch.commit();
          console.log(`  ✔️  Committed batch of ${ops} updates`);
        } else {
          console.log(`  [DRY RUN] Would commit batch of ${ops} updates`);
        }
        batch = db.batch();
        ops = 0;
      }
    }

    // Commit remaining operations
    if (ops > 0) {
      if (!dryRun) {
        await batch.commit();
        console.log(`  ✔️  Committed final batch of ${ops} updates`);
      } else {
        console.log(`  [DRY RUN] Would commit final batch of ${ops} updates`);
      }
    }

    console.log('');
    if (!dryRun) {
      console.log(`✨ Successfully updated ${updateCount} users with status='active'`);
    } else {
      console.log(`✨ [DRY RUN] Would have updated ${updateCount} users with status='active'`);
    }

    // Summary
    console.log('');
    console.log('Summary:');
    console.log(`  • Total users checked: ${usersSnap.size}`);
    console.log(`  • Users updated: ${updateCount}`);
    console.log(`  • Status: ${ dryRun ? 'DRY RUN ONLY' : 'COMMITTED'}`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillUserStatus()
  .then(() => {
    console.log('');
    console.log('🏁 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
