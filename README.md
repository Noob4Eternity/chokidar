# Pawn Shop CSV Sync Service

A complete Node.js service that monitors a local CSV file from an ID scanning machine and syncs new customer data to a Supabase database. Designed for pawn shop applications with real-time updates and Windows service integration.

## 🚀 Quick Start

### Prerequisites

- Node.js 16 or higher
- Windows operating system (for Windows service functionality)
- Supabase project with PostgreSQL database
- ID scanner that outputs CSV files

### Installation

1. **Clone or download this project**
   ```powershell
   cd C:\Users\Ved\Desktop\projects\chokidar
   ```

2. **Install dependencies**
   ```powershell
   npm install
   ```

3. **Configure environment variables**
   ```powershell
   copy .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   CSV_FILE_PATH=C:\PawnShop\scanner_data.csv
   ```

4. **Test the service**
   ```powershell
   npm test
   ```

5. **Install as Windows service**
   ```powershell
   npm run install-service
   ```

## 📊 Features

### Core Functionality
- **Latest Entry Processing**: Detects CSV file changes and processes the entry with the most recent timestamp
- **Data Parsing**: Processes CSV data with proper validation and transformation
- **Duplicate Prevention**: Uses hash-based tracking to prevent reprocessing the same customer
- **Error Handling**: Comprehensive error handling with retry logic and detailed logging
- **Logging**: Detailed logging with Winston to file and console

### Windows Service
- **Auto-start**: Automatically starts on Windows boot
- **Service Management**: Easy install/uninstall with npm commands
- **Background Operation**: Runs silently in the background
- **Event Logging**: Integrates with Windows Event Viewer

### Real-time Features
- **Supabase Integration**: Real-time database updates to customers_testing table
- **Timestamp-based Detection**: Uses CSV CREATED field to identify the newest entry
- **State Persistence**: Remembers processed entries across service restarts

## 📁 File Structure

```
pawnshop-csv-sync-service/
├── csv-sync-service.js      # Main service file
├── install-service.js       # Windows service installer
├── manage.bat              # Service management console
├── web-dashboard.html       # Customer dashboard web app
├── supabase-schema.sql     # Database schema and setup
├── package.json            # Node.js dependencies and scripts
├── .env.example            # Environment variables template
└── README.md              # This file
```

## 🗄️ Database Requirements

The service expects a `customers_testing` table in your Supabase database. Use the provided `supabase-schema.sql` file to create the required tables and views.

Key fields:
- **Personal Information**: first_name, last_name, birthdate, age
- **Contact Information**: full_address, city, state, postal_code, country, phone
- **License Information**: drivers_license_no, license_issued_on, license_expires_on
- **System Fields**: scanner_created_at, notes
- **Tracking Fields**: synced_at, created_at, updated_at

The service uses hash-based duplicate detection to prevent reprocessing the same customer entry.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Required |
| `CSV_FILE_PATH` | Path to the CSV file to monitor | `./test-scanner-data.csv` |
| `CSV_POLLING_INTERVAL` | File polling interval in milliseconds | `1000` |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `LOG_FILE_PATH` | Path to log file | `./logs/csv-sync.log` |

### CSV File Format

The service expects a CSV file with the following columns (as produced by the ID scanner):

```csv
"FIRST NAME","LAST NAME","INS.ID NO","INS.CO","FULL ADDRESS","CITY","STATE","CODE","COUNTRY","PHONE","ISSUED ON","DRV LC NO","EXPIRES ON","INS.MEMBR","LASTNAME","CREATED","USER1","USER2","BIRTHDATE","AGE","NOTES"
```

Example data:
```csv
"JOSEPH EARL","SPERBER","","","12572 208TH TRCE","OBRIEN","FL","32071-2236","","","2017-12-01","S161485824200","2025-11-20","","SPERBER, JOSEPH EARL","2025/07/10 11:20:07 (Thu Jul 10)","","","1982-11-20","42","[DAR]: E [DAS]: A..."
```

The **CREATED** field contains the timestamp when the entry was added to the CSV. The service uses this to identify the most recent entry.

## 🎯 Usage

### Available NPM Commands

```powershell
# Install dependencies
npm install

# Start the service in development mode
npm start

# Test the service with sample data
npm test

# Validate configuration
npm run validate

# Reset processed state (clears hash tracking)
npm run reset-state

# Install as Windows service
npm run install-service

# Uninstall Windows service
npm run uninstall-service
```

### Service Workflow

1. **Service monitors CSV file** for changes using chokidar
2. **When file changes**, reads entire CSV and finds entry with latest timestamp
3. **Processes the newest entry** if it hasn't been processed before (hash check)
4. **Inserts customer data** into Supabase `customers_testing` table
5. **Tracks processed entries** using hash-based state management

### Windows Service Management

After installation, manage the service using Windows tools:

```powershell
# Check service status
sc query "pawnshopcsvsync.exe"

# Start/stop service manually
net start "pawnshopcsvsync.exe"
net stop "pawnshopcsvsync.exe"

# View services in Windows Services Manager
services.msc
```

## 📝 Logging

The service provides comprehensive logging:

- **File Logging**: Rotated log files in the configured directory
- **Console Logging**: Colored output for development mode
- **Processing Details**: Shows which customers are being processed
- **Error Tracking**: Detailed error information with stack traces

### Log Locations

- **Development Mode**: Console output and log file
- **Windows Service**: Configured log file location
- **Default Location**: `./logs/csv-sync.log`

## 🔍 Monitoring

### Service Health

The service logs detailed information about:
- File monitoring status
- CSV processing results
- Database connection status
- Processed entry counts
- Error conditions

### Processing Logic

The service uses a **latest timestamp approach**:
1. **File change detected** → Triggers processing
2. **Scan entire CSV** → Parse all CREATED timestamps
3. **Find maximum timestamp** → Identifies newest entry
4. **Check if processed** → Uses hash to avoid duplicates
5. **Process if new** → Insert into database and update state

## 🚨 Error Handling

The service includes robust error handling:

- **File Access Errors**: Graceful handling of locked or missing files
- **Database Errors**: Retry logic for connection issues
- **Data Validation**: Comprehensive validation of CSV data
- **Duplicate Handling**: PostgreSQL unique constraint support
- **State Management**: Persistent tracking across service restarts

## 🔐 Security

- **Row Level Security**: Enabled on database tables
- **Service Role**: Uses Supabase service role for secure access
- **Input Validation**: All CSV data is validated before insertion
- **Parameterized Queries**: Prevents SQL injection
- **Hash-based Tracking**: Secure duplicate detection

## 🛠️ Troubleshooting

### Common Issues

1. **Service won't start**
   ```powershell
   npm run validate  # Check configuration
   ```

2. **CSV file not being processed**
   - Verify file path in `.env`
   - Check file permissions
   - Review log files

3. **Database connection issues**
   - Verify Supabase URL and keys
   - Test connection: `npm test`

4. **State management issues**
   ```powershell
   npm run reset-state  # Clear processed entries
   ```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## 🤝 Integration

### Workflow Integration

This service is designed for pawn shop operations:

1. **ID Scanner** → Adds new customer to CSV (sorted alphabetically)
2. **CSV Sync Service** → Detects newest entry and syncs to `customers_testing`  
3. **Employee Review** → Uses web interface to review and edit customer data
4. **Final Processing** → Moves approved customers to main `customers` table

### Real-time Updates

The service integrates with Supabase real-time features:
- **Instant synchronization** to database
- **Real-time subscriptions** for web interfaces
- **Event-driven architecture** for notifications

## 📈 Performance

The service is optimized for:

- **Efficient file monitoring** with configurable polling intervals
- **Minimal processing overhead** by only processing latest entries
- **Memory efficient** hash-based state management
- **Fast database operations** with indexed queries

### Performance Tuning

```env
CSV_POLLING_INTERVAL=500  # Faster change detection
LOG_LEVEL=warn           # Reduce logging overhead
```

## 📄 License

MIT License - see the LICENSE file for details.

## 🆘 Support

For troubleshooting:

1. **Run configuration validator**: `npm run validate`
2. **Check logs**: Review log files for errors
3. **Test with sample data**: `npm test`
4. **Reset state if needed**: `npm run reset-state`

---

**Note**: This service is designed for Windows environments and requires administrative privileges for service installation.