const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Configuration Validator
 * Validates the service configuration and environment setup
 */

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  /**
   * Run all validation checks
   */
  async validateAll() {
    console.log('🔍 Validating Pawn Shop CSV Sync Service Configuration...\n');

    this.validateEnvironmentFile();
    this.validateEnvironmentVariables();
    this.validateCSVConfiguration();
    await this.validateSupabaseConnection();
    await this.validateDatabaseSchema();
    this.validateFilePermissions();
    this.validateNodeVersion();

    this.displayResults();
    return this.errors.length === 0;
  }

  /**
   * Validate .env file exists
   */
  validateEnvironmentFile() {
    if (!fs.existsSync('.env')) {
      this.errors.push('Missing .env file. Copy .env.example to .env and configure your settings.');
      return;
    }
    this.info.push('✅ Environment file (.env) exists');
  }

  /**
   * Validate required environment variables
   */
  validateEnvironmentVariables() {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'CSV_FILE_PATH'
    ];

    const optional = [
      'CSV_POLLING_INTERVAL',
      'BATCH_SIZE',
      'RETRY_ATTEMPTS',
      'LOG_LEVEL',
      'LOG_FILE_PATH'
    ];

    // Check required variables
    for (const variable of required) {
      if (!process.env[variable]) {
        this.errors.push(`Missing required environment variable: ${variable}`);
      } else {
        this.info.push(`✅ ${variable} is configured`);
      }
    }

    // Check optional variables
    for (const variable of optional) {
      if (!process.env[variable]) {
        this.warnings.push(`Optional environment variable not set: ${variable} (using default)`);
      } else {
        this.info.push(`✅ ${variable} is configured`);
      }
    }

    // Validate Supabase URL format
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('supabase.co')) {
      this.warnings.push('SUPABASE_URL format may be incorrect (should contain supabase.co)');
    }

    // Validate numeric values
    const numericVars = ['CSV_POLLING_INTERVAL', 'BATCH_SIZE', 'RETRY_ATTEMPTS', 'RETRY_DELAY'];
    for (const variable of numericVars) {
      if (process.env[variable] && isNaN(parseInt(process.env[variable]))) {
        this.errors.push(`${variable} must be a valid number`);
      }
    }
  }

  /**
   * Validate CSV file configuration
   */
  validateCSVConfiguration() {
    const csvPath = process.env.CSV_FILE_PATH;
    if (!csvPath) return;

    const csvDir = path.dirname(csvPath);

    // Check if directory exists or can be created
    try {
      if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
        this.info.push(`✅ Created CSV directory: ${csvDir}`);
      } else {
        this.info.push(`✅ CSV directory exists: ${csvDir}`);
      }
    } catch (error) {
      this.errors.push(`Cannot access CSV directory: ${csvDir} - ${error.message}`);
      return;
    }

    // Check if CSV file exists
    if (fs.existsSync(csvPath)) {
      this.info.push(`✅ CSV file exists: ${csvPath}`);
      
      // Check file size
      const stats = fs.statSync(csvPath);
      this.info.push(`📄 CSV file size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      this.warnings.push(`CSV file does not exist (will be created): ${csvPath}`);
    }

    // Test file permissions
    try {
      fs.accessSync(csvDir, fs.constants.R_OK | fs.constants.W_OK);
      this.info.push(`✅ CSV directory has read/write permissions`);
    } catch (error) {
      this.errors.push(`Insufficient permissions for CSV directory: ${csvDir}`);
    }
  }

  /**
   * Validate Supabase connection
   */
  async validateSupabaseConnection() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.errors.push('Cannot test Supabase connection - missing credentials');
      return;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test connection with a simple query
      const { data, error } = await supabase
        .from('customers_testing')
        .select('count', { count: 'exact', head: true });

      if (error) {
        this.errors.push(`Supabase connection failed: ${error.message}`);
      } else {
        this.info.push('✅ Supabase connection successful');
        this.info.push(`📊 Current customer count: ${data || 0}`);
      }
    } catch (error) {
      this.errors.push(`Supabase connection error: ${error.message}`);
    }
  }

  /**
   * Validate database schema
   */
  async validateDatabaseSchema() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) return;

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if customers_testing table exists
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'customers_testing');

      if (tablesError) {
        this.warnings.push('Could not verify database schema');
        return;
      }

      if (tables.length === 0) {
        this.errors.push('customers_testing table does not exist. Please ensure your Supabase database has the required table.');
        return;
      }

      this.info.push('✅ customers_testing table exists');

      // Check for required columns
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'customers_testing');

      if (!columnsError && columns) {
        const columnNames = columns.map(col => col.column_name);
        const requiredColumns = [
          'id', 'first_name', 'last_name', 'drivers_license_no', 
          'phone', 'synced_at', 'created_at'
        ];

        const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
        if (missingColumns.length > 0) {
          this.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
        } else {
          this.info.push('✅ All required columns exist');
        }
      }

      // Check for views
      const { data: views, error: viewsError } = await supabase
        .from('information_schema.views')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['recent_customers', 'customer_stats']);

      if (!viewsError && views) {
        const viewNames = views.map(view => view.table_name);
        if (viewNames.includes('recent_customers')) {
          this.info.push('✅ recent_customers view exists');
        }
        if (viewNames.includes('customer_stats')) {
          this.info.push('✅ customer_stats view exists');
        }
      }

    } catch (error) {
      this.warnings.push(`Could not validate database schema: ${error.message}`);
    }
  }

  /**
   * Validate file permissions and log directory
   */
  validateFilePermissions() {
    const logPath = process.env.LOG_FILE_PATH || './logs/csv-sync.log';
    const logDir = path.dirname(logPath);

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        this.info.push(`✅ Created log directory: ${logDir}`);
      }

      // Test write permissions
      const testFile = path.join(logDir, 'test-write.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      this.info.push('✅ Log directory has write permissions');
    } catch (error) {
      this.errors.push(`Cannot write to log directory: ${logDir} - ${error.message}`);
    }
  }

  /**
   * Validate Node.js version
   */
  validateNodeVersion() {
    const version = process.version;
    const majorVersion = parseInt(version.substring(1).split('.')[0]);

    if (majorVersion < 16) {
      this.errors.push(`Node.js version ${version} is not supported. Please upgrade to Node.js 16 or higher.`);
    } else {
      this.info.push(`✅ Node.js version ${version} is supported`);
    }
  }

  /**
   * Display validation results
   */
  displayResults() {
    console.log('\n📋 Validation Results:\n');

    // Display errors
    if (this.errors.length > 0) {
      console.log('❌ Errors (must be fixed):');
      this.errors.forEach(error => console.log(`   • ${error}`));
      console.log('');
    }

    // Display warnings
    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
      console.log('');
    }

    // Display info
    if (this.info.length > 0) {
      console.log('ℹ️  Information:');
      this.info.forEach(info => console.log(`   • ${info}`));
      console.log('');
    }

    // Summary
    if (this.errors.length === 0) {
      console.log('🎉 Configuration validation passed! The service is ready to run.');
      console.log('\n🚀 Next steps:');
      console.log('   • Run "npm test" to test the service');
      console.log('   • Run "npm run install-service" to install as Windows service');
    } else {
      console.log('❌ Configuration validation failed. Please fix the errors above.');
    }
  }
}

// Run validation if executed directly
if (require.main === module) {
  const validator = new ConfigValidator();
  validator.validateAll().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ConfigValidator;
