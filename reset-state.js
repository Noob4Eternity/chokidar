const fs = require('fs');
const path = require('path');

/**
 * Reset CSV Sync State
 * Deletes the state file to force reprocessing of all CSV data
 */

const stateFile = path.join(__dirname, '.csv-sync-state.json');

try {
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
    console.log('✅ State file deleted. All CSV rows will be reprocessed on next run.');
    console.log('🔄 The service will now treat all existing CSV rows as new data.');
  } else {
    console.log('ℹ️  No state file found. Service will process all rows on next run anyway.');
  }
} catch (error) {
  console.error('❌ Error deleting state file:', error.message);
  process.exit(1);
}
