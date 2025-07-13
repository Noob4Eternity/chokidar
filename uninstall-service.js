const Service = require('node-windows').Service;
const path = require('path');
require('dotenv').config();

// Create a new service object with the same configuration as the installer
const svc = new Service({
  name: process.env.SERVICE_NAME || 'PawnShopCSVSync',
  description: process.env.SERVICE_DESCRIPTION || 'Monitors CSV file from ID scanner and syncs customer data to Supabase',
  script: path.join(__dirname, 'csv-sync-service.js')
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', () => {
  console.log('✅ Service uninstalled successfully!');
  console.log(`Service "${svc.name}" has been removed from the system.`);
});

// Listen for the "invalidinstallation" event, which indicates the service is not installed.
svc.on('invalidinstallation', () => {
  console.log('⚠️  Service is not installed.');
  console.log('Nothing to uninstall.');
});

// Listen for errors
svc.on('error', (err) => {
  console.error('❌ Service uninstallation error:', err);
});

console.log('🗑️  Uninstalling Pawn Shop CSV Sync Service...');
console.log(`Service Name: ${svc.name}`);
console.log('');

// Uninstall the service
svc.uninstall();
