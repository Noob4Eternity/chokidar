const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Pawn Shop CSV Sync Service
 * Monitors CSV file from ID scanner and syncs customer data to Supabase
 */
class CSVSyncService {
  constructor() {
    this.initializeLogger();
    this.initializeSupabase();
    this.initializeConfig();
    this.isProcessing = false;
    this.processedHashes = new Set(); // Track processed row hashes instead of file size
    this.watcher = null;
  }

  /**
   * Initialize Winston logger with file and console transports
   */
  initializeLogger() {
    const logDir = path.dirname(process.env.LOG_FILE_PATH || './logs/csv-sync.log');
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'csv-sync-service' },
      transports: [
        new winston.transports.File({ 
          filename: process.env.LOG_FILE_PATH || './logs/csv-sync.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Initialize Supabase client
   */
  initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.info('Supabase client initialized');
  }

  /**
   * Initialize service configuration
   */
  initializeConfig() {
    this.config = {
      csvFilePath: process.env.CSV_FILE_PATH || './scanner_data.csv',
      pollingInterval: parseInt(process.env.CSV_POLLING_INTERVAL) || 1000,
      batchSize: parseInt(process.env.BATCH_SIZE) || 50,
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 5000,
      defaultCountry: process.env.DEFAULT_COUNTRY || 'USA',
      requireDriversLicense: process.env.REQUIRE_DRIVERS_LICENSE === 'true'
    };

    this.logger.info('Service configuration loaded', this.config);
  }

  /**
   * Start the CSV monitoring service
   */
  async start() {
    try {
      this.logger.info('Starting CSV Sync Service...');

      // Validate CSV file exists or can be created
      await this.validateCSVFile();

      // Load previously processed row hashes
      this.loadProcessedHashes();

      // Start file watcher
      this.startFileWatcher();

      this.logger.info('CSV Sync Service started - monitoring for new ID scanner entries only');
      this.logger.info('Existing CSV data will be ignored - only new scans will be processed');

    } catch (error) {
      this.logger.error('Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the CSV monitoring service
   */
  async stop() {
    try {
      this.logger.info('Stopping CSV Sync Service...');

      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      // Save processed hashes state before shutdown
      this.saveProcessedHashes();

      this.logger.info('CSV Sync Service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping service:', error);
    }
  }

  /**
   * Validate that CSV file exists or directory is accessible
   */
  async validateCSVFile() {
    const csvDir = path.dirname(this.config.csvFilePath);
    
    try {
      // Ensure directory exists
      if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
        this.logger.info(`Created directory: ${csvDir}`);
      }

      // Create empty CSV file with headers if it doesn't exist
      if (!fs.existsSync(this.config.csvFilePath)) {
        const headers = 'id,first_name,last_name,lastname_alt,birthdate,age,full_address,city,state,postal_code,country,phone,drivers_license_no,license_issued_on,license_expires_on,insurance_id_no,insurance_company_code,insurance_member_no,scanner_created_at,user_field_1,user_field_2,notes\n';
        fs.writeFileSync(this.config.csvFilePath, headers);
        this.logger.info(`Created CSV file with headers: ${this.config.csvFilePath}`);
      }

      // Test file access
      fs.accessSync(this.config.csvFilePath, fs.constants.R_OK);
      this.logger.info(`CSV file validated: ${this.config.csvFilePath}`);
    } catch (error) {
      throw new Error(`Cannot access CSV file: ${this.config.csvFilePath}. ${error.message}`);
    }
  }

  /**
   * Update the last processed file size
   */
  async updateLastProcessedSize() {
    try {
      const stats = fs.statSync(this.config.csvFilePath);
      this.lastProcessedSize = stats.size;
      this.logger.debug(`Updated last processed size: ${this.lastProcessedSize} bytes`);
    } catch (error) {
      this.logger.warn('Could not get file stats:', error.message);
      this.lastProcessedSize = 0;
    }
  }

  /**
   * Generate a hash for a row to track if we've processed it
   */
  generateRowHash(customerData) {
    const key = `${customerData.first_name || ''}_${customerData.last_name || ''}_${customerData.drivers_license_no || ''}_${customerData.scanner_created_at || ''}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Load previously processed row hashes from a state file
   */
  loadProcessedHashes() {
    try {
      const stateFile = path.join(__dirname, '.csv-sync-state.json');
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        this.processedHashes = new Set(state.processedHashes || []);
        this.logger.info(`Loaded ${this.processedHashes.size} previously processed row hashes`);
      } else {
        this.processedHashes = new Set();
        this.logger.info('No previous state found, starting fresh');
      }
    } catch (error) {
      this.logger.warn('Could not load previous state, starting fresh', { error: error.message });
      this.processedHashes = new Set();
    }
  }

  /**
   * Save processed row hashes to state file
   */
  saveProcessedHashes() {
    try {
      const stateFile = path.join(__dirname, '.csv-sync-state.json');
      const state = {
        processedHashes: Array.from(this.processedHashes),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      this.logger.debug(`Saved ${this.processedHashes.size} processed row hashes to state file`);
    } catch (error) {
      this.logger.error('Failed to save processed hashes state', { error: error.message });
    }
  }

  /**
   * Start file watcher using chokidar with polling
   */
  startFileWatcher() {
    this.watcher = chokidar.watch(this.config.csvFilePath, {
      usePolling: true,
      interval: this.config.pollingInterval,
      persistent: true,
      ignoreInitial: true  // Ignore existing file, only watch for changes
    });

    this.watcher.on('change', (filePath) => {
      this.logger.info(`CSV file changed: ${filePath} - processing latest row`);
      this.processCSVFile();
    });

    this.watcher.on('error', (error) => {
      this.logger.error('File watcher error:', error);
    });

    this.logger.info(`File watcher started for: ${this.config.csvFilePath} (monitoring changes only)`);
  }

  /**
   * Process CSV file and sync new data to Supabase
   * Only processes the last row when file changes are detected
   */
  async processCSVFile() {
    if (this.isProcessing) {
      this.logger.debug('CSV processing already in progress, skipping');
      return;
    }

    if (!fs.existsSync(this.config.csvFilePath)) {
      this.logger.warn('CSV file does not exist', { filePath: this.config.csvFilePath });
      return;
    }

    this.isProcessing = true;
    this.logger.info('Processing latest CSV entry - checking last row only', { filePath: this.config.csvFilePath });

    const startTime = Date.now();

    try {
      const rows = [];
      
      // Read all rows from CSV to get the last one
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(this.config.csvFilePath)
          .pipe(csv())
          .on('data', (row) => {
            rows.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (rows.length === 0) {
        this.logger.info('No rows found in CSV file');
        return;
      }

      // Get the last row (most recently added by ID scanner)
      const lastRow = rows[rows.length - 1];
      const customerData = this.transformCustomerData(lastRow);
      
      // Skip if the last row is empty
      if (!customerData) {
        this.logger.info('Latest row contains no valid customer data');
        return;
      }

      const rowHash = this.generateRowHash(customerData);
      
      // Check if we've already processed this exact row
      if (this.processedHashes.has(rowHash)) {
        this.logger.info('Latest row already processed, no new data to sync', { 
          name: `${customerData.first_name} ${customerData.last_name}`,
          hash: rowHash 
        });
        return;
      }

      this.logger.info('Processing new customer from latest scan', { 
        name: `${customerData.first_name} ${customerData.last_name}`,
        driversLicenseNo: customerData.drivers_license_no,
        hash: rowHash,
        rowNumber: rows.length
      });

      // Insert customer data
      const result = await this.insertCustomerWithRetry(customerData);
      
      if (result.success) {
        if (result.duplicate) {
          this.logger.info('Customer from latest scan already exists in database', {
            name: `${customerData.first_name} ${customerData.last_name}`,
            driversLicenseNo: customerData.drivers_license_no
          });
        } else {
          this.logger.info('✅ Successfully inserted new customer from latest scan', {
            name: `${customerData.first_name} ${customerData.last_name}`,
            driversLicenseNo: customerData.drivers_license_no
          });
        }
        
        // Mark this row as processed
        this.processedHashes.add(rowHash);
        this.saveProcessedHashes();
      } else {
        this.logger.error('❌ Failed to process customer from latest scan', { 
          name: `${customerData.first_name} ${customerData.last_name}`,
          error: result.error 
        });
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Latest CSV entry processed', {
        success: result.success,
        duplicate: result.duplicate,
        processingTimeMs: processingTime
      });

    } catch (error) {
      this.logger.error('Error processing latest CSV entry', { 
        error: error.message,
        filePath: this.config.csvFilePath 
      });
    } finally {
      this.isProcessing = false;
    }
  }
  async insertCustomerWithRetry(customerData, retries = 3) {
    try {
      const { data, error } = await this.supabase
        .from('customers_testing')
        .insert([customerData])
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate key error (unique constraint violation)
        if (error.code === '23505') {
          this.logger.info('Customer already exists (duplicate license number)', { 
            driversLicenseNo: customerData.drivers_license_no,
            name: `${customerData.first_name} ${customerData.last_name}`
          });
          return { success: true, duplicate: true };
        }
        
        throw error;
      }

      this.logger.info('Successfully inserted customer', { 
        id: data.id,
        name: `${customerData.first_name} ${customerData.last_name}`,
        driversLicenseNo: customerData.drivers_license_no
      });

      return { success: true, data, duplicate: false };
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Retrying insert for customer (${retries} retries left)`, { 
          error: error.message,
          name: `${customerData.first_name} ${customerData.last_name}`
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
        return this.insertCustomerWithRetry(customerData, retries - 1);
      }

      this.logger.error('Failed to insert customer after retries', { 
        error: error.message,
        customerData
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Transform CSV row data to customer object
   */
  transformCustomerData(row) {
    // Skip empty rows or header rows
    if (!row['FIRST NAME'] && !row['LAST NAME'] && !row['DRV LC NO']) {
      return null;
    }

    const customer = {
      first_name: row['FIRST NAME']?.trim() || null,
      last_name: row['LAST NAME']?.trim() || null,
      lastname_alt: row['LASTNAME']?.trim() || null,
      birthdate: this.parseDate(row['BIRTHDATE']),
      age: row['AGE'] ? parseInt(row['AGE']) : null,
      full_address: row['FULL ADDRESS']?.trim() || null,
      city: row['CITY']?.trim() || null,
      state: row['STATE']?.trim() || null,
      postal_code: row['CODE']?.trim() || null,
      country: row['COUNTRY']?.trim() || this.config.defaultCountry,
      phone: row['PHONE']?.trim() || null,
      drivers_license_no: row['DRV LC NO']?.trim() || null,
      license_issued_on: this.parseDate(row['ISSUED ON']),
      license_expires_on: this.parseDate(row['EXPIRES ON']),
      insurance_id_no: row['INS.ID NO']?.trim() || null,
      insurance_company_code: row['INS.CO']?.trim() || null,
      insurance_member_no: row['INS.MEMBR']?.trim() || null,
      scanner_created_at: this.parseDateTime(row['CREATED']) || new Date().toISOString(),
      user_field_1: row['USER1']?.trim() || null,
      user_field_2: row['USER2']?.trim() || null,
      notes: row['NOTES']?.trim() || null,
      synced_at: new Date().toISOString()
    };

    // Generate unique ID if drivers license is missing but required
    if (!customer.drivers_license_no && this.config.requireDriversLicense) {
      customer.drivers_license_no = `GENERATED_${uuidv4().substring(0, 8)}`;
      this.logger.info(`Generated ID for customer: ${customer.first_name} ${customer.last_name}`);
    }

    return customer;
  }

  /**
   * Parse date string to ISO format
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse datetime string to ISO format
   */
  parseDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    try {
      // Handle the scanner format: "2025/07/10 11:20:07 (Thu Jul 10)"
      if (dateTimeString.includes('(')) {
        dateTimeString = dateTimeString.split('(')[0].trim();
      }
      
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch (error) {
      this.logger.warn(`Error parsing datetime: ${dateTimeString}`, { error: error.message });
      return null;
    }
  }

  /**
   * Process customers in batches and sync to Supabase
   */
  async procesCustomersBatch(customers) {
    for (let i = 0; i < customers.length; i += this.config.batchSize) {
      const batch = customers.slice(i, i + this.config.batchSize);
      await this.syncCustomersBatch(batch);
    }
  }

  /**
   * Sync a batch of customers to Supabase
   */
  async syncCustomersBatch(customers) {
    for (const customer of customers) {
      await this.syncCustomer(customer);
    }
  }

  /**
   * Sync a single customer to Supabase with duplicate checking
   */
  async syncCustomer(customer) {
    let attempt = 0;
    
    while (attempt < this.config.retryAttempts) {
      try {
        // Check for existing customer by drivers license number
        const existingCustomer = await this.findExistingCustomer(customer);
        
        if (existingCustomer) {
          this.logger.debug(`Customer already exists: ${customer.drivers_license_no}`);
          return;
        }

        // Insert new customer
        const { data, error } = await this.supabase
          .from('customers_testing')
          .insert([customer])
          .select();

        if (error) {
          throw error;
        }

        this.logger.info(`Successfully synced customer: ${customer.first_name} ${customer.last_name} (${customer.drivers_license_no})`);
        return data[0];

      } catch (error) {
        attempt++;
        this.logger.warn(`Attempt ${attempt} failed for customer ${customer.drivers_license_no}:`, error.message);
        
        if (attempt >= this.config.retryAttempts) {
          this.logger.error(`Failed to sync customer after ${this.config.retryAttempts} attempts:`, {
            customer: customer.drivers_license_no,
            error: error.message
          });
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  /**
   * Find existing customer by drivers license number or other unique identifiers
   */
  async findExistingCustomer(customer) {
    try {
      // Primary check: drivers license number
      if (customer.drivers_license_no) {
        const { data, error } = await this.supabase
          .from('customers_testing')
          .select('id')
          .eq('drivers_license_no', customer.drivers_license_no)
          .limit(1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          return data[0];
        }
      }

      // Secondary check: phone number (if provided)
      if (customer.phone) {
        const { data, error } = await this.supabase
          .from('customers_testing')
          .select('id')
          .eq('phone', customer.phone)
          .eq('first_name', customer.first_name)
          .eq('last_name', customer.last_name)
          .limit(1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          return data[0];
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error checking for existing customer:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  getStatus() {
    return {
      isRunning: this.watcher !== null,
      processedHashes: this.processedHashes.size,
      isProcessing: this.isProcessing,
      csvFilePath: this.config.csvFilePath,
      supabaseConnected: !!this.supabase
    };
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (global.csvSyncService) {
    await global.csvSyncService.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (global.csvSyncService) {
    await global.csvSyncService.stop();
  }
  process.exit(0);
});

// Start service if run directly
if (require.main === module) {
  const service = new CSVSyncService();
  global.csvSyncService = service;
  
  service.start().catch((error) => {
    console.error('Failed to start service:', error);
    process.exit(1);
  });
}

module.exports = CSVSyncService;
