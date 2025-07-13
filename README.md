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
- **File Monitoring**: Uses chokidar with polling to monitor CSV file changes
- **Data Parsing**: Processes CSV data with proper validation and transformation
- **Duplicate Prevention**: Checks for existing customers using driver's license number
- **Batch Processing**: Handles large CSV files efficiently with configurable batch sizes
- **Error Handling**: Comprehensive error handling with retry logic
- **Logging**: Detailed logging with Winston to file and console

### Windows Service
- **Auto-start**: Automatically starts on Windows boot
- **Service Management**: Easy install/uninstall scripts
- **Background Operation**: Runs silently in the background
- **Event Logging**: Integrates with Windows Event Viewer

### Real-time Features
- **Supabase Integration**: Real-time database updates
- **Web Dashboard**: Live customer dashboard with subscriptions
- **Notifications**: Browser notifications for new customers
- **Statistics**: Real-time customer statistics and metrics

## 📁 File Structure

```
pawnshop-csv-sync-service/
├── csv-sync-service.js      # Main service file
├── install-service.js       # Windows service installer
├── uninstall-service.js     # Windows service uninstaller
├── test-service.js          # Service testing script
├── web-dashboard.html       # Customer dashboard web app
├── customer-api-example.js  # API integration examples
├── validate-config.js       # Configuration validator
├── package.json            # Node.js dependencies
├── .env.example            # Environment variables template
└── README.md              # This file
```

## 🗄️ Database Requirements

The service expects a `customers_testing` table in your Supabase database with the following structure:

- **Personal Information**: first_name, last_name, lastname_alt, birthdate, age
- **Contact Information**: full_address, city, state, postal_code, country, phone
- **License Information**: drivers_license_no, license_issued_on, license_expires_on
- **Insurance Information**: insurance_id_no, insurance_company_code, insurance_member_no
- **System Fields**: scanner_created_at, user_field_1, user_field_2, notes
- **Tracking Fields**: synced_at, created_at, updated_at

The service uses the `drivers_license_no` field for duplicate detection.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Required |
| `CSV_FILE_PATH` | Path to the CSV file to monitor | `./scanner_data.csv` |
| `CSV_POLLING_INTERVAL` | File polling interval in milliseconds | `1000` |
| `BATCH_SIZE` | Number of records to process at once | `50` |
| `RETRY_ATTEMPTS` | Number of retry attempts for failed operations | `3` |
| `RETRY_DELAY` | Delay between retries in milliseconds | `5000` |
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

## 🎯 Usage

### Running as Development Service

```powershell
# Reset processed state (forces reprocessing of all CSV data)
npm run reset-state

# Test CSV format parsing
npm run test-csv

# Start in development mode with auto-restart
npm run dev

# Or start normally
npm start

# Test the service
npm test
```

### Windows Service Management

```powershell
# Install as Windows service
npm run install-service

# Uninstall Windows service
npm run uninstall-service

# Check service status
sc query "PawnShopCSVSync"

# Start/stop service manually
net start "PawnShopCSVSync"
net stop "PawnShopCSVSync"
```

### Web Dashboard

1. Open `web-dashboard.html` in a web browser
2. Update the Supabase configuration in the HTML file
3. View real-time customer data and statistics
4. Get notifications for new customers

## 📝 Logging

The service provides comprehensive logging:

- **File Logging**: Rotated log files in the specified directory
- **Console Logging**: Colored output for development
- **Error Tracking**: Detailed error information with stack traces
- **Performance Metrics**: Processing times and statistics

### Log Locations

- **Development**: Console and `./logs/csv-sync.log`
- **Windows Service**: Windows Event Viewer and configured log file
- **Log Rotation**: Automatic rotation at 5MB with 5 file retention

## 🔍 Monitoring

### Service Health

Check the service status programmatically:

```javascript
const service = new CSVSyncService();
const status = service.getStatus();
console.log(status);
```

### Database Monitoring

Use the provided SQL views for monitoring:

```sql
-- Recent customers (last 24 hours)
SELECT * FROM recent_customers;

-- Customer statistics
SELECT * FROM customer_stats;

-- Find customer by license
SELECT * FROM get_customer_by_license('D123456789');
```

## 🚨 Error Handling

The service includes robust error handling:

- **File Access Errors**: Graceful handling of locked or missing files
- **Database Errors**: Retry logic with exponential backoff
- **Data Validation**: Comprehensive validation of CSV data
- **Network Issues**: Automatic reconnection to Supabase
- **Memory Management**: Efficient processing of large files

## 🔐 Security

- **Row Level Security**: Enabled on the customers table
- **Service Role**: Uses Supabase service role for secure access
- **Input Validation**: All CSV data is validated before insertion
- **SQL Injection Prevention**: Parameterized queries only
- **Access Control**: Limited permissions for authenticated users

## 🛠️ Troubleshooting

### Common Issues

1. **Service won't start**
   - Check `.env` configuration
   - Verify Supabase credentials
   - Ensure CSV file path is accessible

2. **CSV file not being processed**
   - Check file permissions
   - Verify polling interval
   - Review log files for errors

3. **Database connection issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review RLS policies

4. **Duplicate customers**
   - Verify driver's license number format
   - Check duplicate detection logic
   - Review existing customer data

### Debug Mode

Enable debug logging for detailed information:

```env
LOG_LEVEL=debug
```

### Service Logs

View Windows service logs:

```powershell
# View in Event Viewer
eventvwr.msc

# Or check log file
Get-Content "C:\PawnShop\logs\csv-sync.log" -Tail 50
```

## 🤝 Integration Examples

### Adding Custom Fields

To add custom fields to the customer data:

1. Update the database schema
2. Modify the `transformCustomerData` method
3. Update the CSV column mapping

### Real-time Notifications

The web dashboard includes real-time notifications. To extend this:

```javascript
// Subscribe to customer updates
const subscription = supabase
  .channel('customers')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'customers'
  }, (payload) => {
    // Handle new customer
    console.log('New customer:', payload.new);
  })
  .subscribe();
```

### API Integration

Create RESTful endpoints using Supabase:

```javascript
// Get recent customers
const { data } = await supabase
  .from('customers')
  .select('*')
  .order('synced_at', { ascending: false })
  .limit(10);
```

## 📈 Performance

The service is optimized for:

- **Large Files**: Efficient streaming and batch processing
- **Real-time Processing**: Fast file change detection
- **Memory Usage**: Minimal memory footprint
- **Database Performance**: Indexed queries and optimized schema

### Performance Tuning

Adjust these settings for your environment:

```env
BATCH_SIZE=100          # Increase for better throughput
CSV_POLLING_INTERVAL=500 # Decrease for faster detection
RETRY_ATTEMPTS=5        # Increase for unreliable networks
```

## 📄 License

MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review log files
3. Verify configuration
4. Test with the provided test script

---

**Note**: This service is designed specifically for Windows environments and requires administrative privileges for service installation.
