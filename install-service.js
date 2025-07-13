const Service = require('node-windows').Service;
const path = require('path');
require('dotenv').config();

// Create a new service object
const svc = new Service({
  name: process.env.SERVICE_NAME || 'PawnShopCSVSync',
  description: process.env.SERVICE_DESCRIPTION || 'Monitors CSV file from ID scanner and syncs customer data to Supabase',
  script: path.join(__dirname, 'csv-sync-service.js'),
  workingDirectory: __dirname,
  nodeOptions: [
    '--max_old_space_size=2048'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "SERVICE_WORKING_DIR",
      value: __dirname
    }
  ]
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', () => {
  console.log('✅ Service installed successfully!');
  console.log(`Service Name: ${svc.name}`);
  console.log(`Service Description: ${svc.description}`);
  console.log(`Script Path: ${svc.script}`);
  console.log('');
  console.log('🚀 Starting the service...');
  svc.start();
});

// Listen for the "alreadyinstalled" event, which indicates the service is already installed.
svc.on('alreadyinstalled', () => {
  console.log('⚠️  Service is already installed.');
  console.log('To reinstall, first uninstall the service by running: npm run uninstall-service');
  process.exit(1);
});

// Listen for the "start" event and let us know the service started
svc.on('start', () => {
  console.log('✅ Service started successfully!');
  console.log('');
  console.log('📋 Service Management Commands:');
  console.log('  • View logs: Check Windows Event Viewer or the log file specified in .env');
  console.log('  • Stop service: net stop "' + svc.name + '"');
  console.log('  • Start service: net start "' + svc.name + '"');
  console.log('  • Service status: sc query "' + svc.name + '"');
  console.log('  • Uninstall service: npm run uninstall-service');
  console.log('');
  console.log('🔍 The service is now monitoring the CSV file specified in your .env configuration.');
});

// Listen for errors
svc.on('error', (err) => {
  console.error('❌ Service installation error:', err);
});

console.log('🔧 Installing Pawn Shop CSV Sync Service...');
console.log('');

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('Please ensure your .env file contains:');
  console.error('  - SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - CSV_FILE_PATH');
  console.error('');
  console.error('Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

// Validate CSV file path
if (!process.env.CSV_FILE_PATH) {
  console.error('❌ CSV_FILE_PATH not specified in .env file!');
  process.exit(1);
}

console.log('📝 Configuration:');
console.log(`  • CSV File Path: ${process.env.CSV_FILE_PATH}`);
console.log(`  • Supabase URL: ${process.env.SUPABASE_URL}`);
console.log(`  • Service Name: ${svc.name}`);
console.log('');

// Install the service
svc.install();
