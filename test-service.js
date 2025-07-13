const CSVSyncService = require('./csv-sync-service');
const fs = require('fs');
const path = require('path');

/**
 * Test script for the CSV Sync Service
 * This script tests the service functionality without installing it as a Windows service
 */

async function testService() {
  console.log('🧪 Testing CSV Sync Service...');
  console.log('');

  try {
    // Check if .env file exists
    if (!fs.existsSync('.env')) {
      console.error('❌ .env file not found!');
      console.error('Please copy .env.example to .env and configure your settings.');
      process.exit(1);
    }

    // Initialize service
    const service = new CSVSyncService();
    
    // Test configuration
    console.log('📋 Testing service configuration...');
    const status = service.getStatus();
    console.log('Configuration Status:', status);
    console.log('');

    // Create test CSV file if it doesn't exist
    await createTestCSVFile(service.config.csvFilePath);

    // Reset state for testing
    console.log('🔄 Resetting state for clean test...');
    try {
      const stateFile = path.join(__dirname, '.csv-sync-state.json');
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
        console.log('✅ Previous state cleared');
      }
    } catch (error) {
      console.log('⚠️  Could not clear state:', error.message);
    }

    // Start service
    console.log('🚀 Starting service...');
    await service.start();
    
    console.log('✅ Service started successfully!');
    console.log('');
    console.log('📁 Monitoring CSV file:', service.config.csvFilePath);
    console.log('⏱️  Polling interval:', service.config.pollingInterval, 'ms');
    console.log('');
    console.log('🔄 Service is now running. Add data to the CSV file to test synchronization.');
    console.log('Press Ctrl+C to stop the service.');

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping service...');
      await service.stop();
      console.log('✅ Service stopped successfully!');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Create a test CSV file with sample data
 */
async function createTestCSVFile(csvFilePath) {
  const csvDir = path.dirname(csvFilePath);
  
  // Ensure directory exists
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
    console.log(`📁 Created directory: ${csvDir}`);
  }

  // Check if file exists
  if (fs.existsSync(csvFilePath)) {
    console.log(`📄 CSV file already exists: ${csvFilePath}`);
    return;
  }

  // Create CSV with headers and sample data
  const csvContent = `"FIRST NAME","LAST NAME","INS.ID NO","INS.CO","FULL ADDRESS","CITY","STATE","CODE","COUNTRY","PHONE","ISSUED ON","DRV LC NO","EXPIRES ON","INS.MEMBR","LASTNAME","CREATED","USER1","USER2","BIRTHDATE","AGE","NOTES"
"JOHN","DOE","INS123456","ABC123","123 Main St","Anytown","NY","12345","USA","(555) 123-4567","2020-06-15","D123456789","2025-06-15","MEM789","DOE, JOHN","${new Date().toISOString().replace('T', ' ').split('.')[0]} (${new Date().toDateString().split(' ').slice(0, 3).join(' ')})","VIP","Regular","1985-06-15","38","[DAR]: E    [DAS]: A          [DAT]: NONE [DBC]: M [DBH]: Y [DAU]: 511"
"JANE","SMITH","INS987654","XYZ456","456 Oak Ave","Springfield","CA","90210","USA","(555) 987-6543","2019-03-22","D987654321","2024-03-22","MEM456","SMITH, JANE","${new Date().toISOString().replace('T', ' ').split('.')[0]} (${new Date().toDateString().split(' ').slice(0, 3).join(' ')})","Premium","Frequent","1990-03-22","33","[DAR]: E    [DAS]: A          [DAT]: NONE [DBC]: F [DBH]: N [DAU]: 502"`;

  fs.writeFileSync(csvFilePath, csvContent);
  console.log(`📄 Created test CSV file: ${csvFilePath}`);
  console.log('💡 You can add more rows to this file to test real-time synchronization.');
  console.log('');
}

// Run the test
if (require.main === module) {
  testService();
}
