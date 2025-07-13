const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

/**
 * CSV Format Tester
 * Tests if the service can correctly parse the actual CSV format from the ID scanner
 */

// Simulate the CSV data from your scanner
const testCSVContent = `"FIRST NAME","LAST NAME","INS.ID NO","INS.CO","FULL ADDRESS","CITY","STATE","CODE","COUNTRY","PHONE","ISSUED ON","DRV LC NO","EXPIRES ON","INS.MEMBR","LASTNAME","CREATED","USER1","USER2","BIRTHDATE","AGE","NOTES"
"JOSEPH EARL","SPERBER","","","12572 208TH TRCE","OBRIEN","FL","32071-2236","","","2017-12-01","S161485824200","2025-11-20","","SPERBER, JOSEPH EARL","2025/07/10 11:20:07 (Thu Jul 10)","","","1982-11-20","42","[DAR]: E    [DAS]: A          [DAT]: NONE [DBC]: M [DBH]: Y [DAU]: 511 [ZFA]: REPLACED: 00000000 [ZFB]:  [ZFC]: X631712013564 [ZFD]:  [ZFE]: 06-01-14 [ZFF]:  "`;

// Create test CSV file
const testFile = path.join(__dirname, 'test-format.csv');
fs.writeFileSync(testFile, testCSVContent);

console.log('🧪 Testing CSV Format Parsing...\n');

// Transform function (copied from the service)
function transformCustomerData(row) {
  // Skip empty rows or header rows
  if (!row['FIRST NAME'] && !row['LAST NAME'] && !row['DRV LC NO']) {
    return null;
  }

  const customer = {
    first_name: row['FIRST NAME']?.trim() || null,
    last_name: row['LAST NAME']?.trim() || null,
    lastname_alt: row['LASTNAME']?.trim() || null,
    birthdate: parseDate(row['BIRTHDATE']),
    age: row['AGE'] ? parseInt(row['AGE']) : null,
    full_address: row['FULL ADDRESS']?.trim() || null,
    city: row['CITY']?.trim() || null,
    state: row['STATE']?.trim() || null,
    postal_code: row['CODE']?.trim() || null,
    country: row['COUNTRY']?.trim() || 'USA',
    phone: row['PHONE']?.trim() || null,
    drivers_license_no: row['DRV LC NO']?.trim() || null,
    license_issued_on: parseDate(row['ISSUED ON']),
    license_expires_on: parseDate(row['EXPIRES ON']),
    insurance_id_no: row['INS.ID NO']?.trim() || null,
    insurance_company_code: row['INS.CO']?.trim() || null,
    insurance_member_no: row['INS.MEMBR']?.trim() || null,
    scanner_created_at: parseDateTime(row['CREATED']) || new Date().toISOString(),
    user_field_1: row['USER1']?.trim() || null,
    user_field_2: row['USER2']?.trim() || null,
    notes: row['NOTES']?.trim() || null,
    synced_at: new Date().toISOString()
  };

  return customer;
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

function parseDateTime(dateTimeString) {
  if (!dateTimeString) return null;
  
  try {
    // Handle the scanner format: "2025/07/10 11:20:07 (Thu Jul 10)"
    if (dateTimeString.includes('(')) {
      dateTimeString = dateTimeString.split('(')[0].trim();
    }
    
    const date = new Date(dateTimeString);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch (error) {
    return null;
  }
}

// Test parsing
const customers = [];
fs.createReadStream(testFile)
  .pipe(csv())
  .on('data', (row) => {
    console.log('📄 Raw CSV Row:');
    console.log(JSON.stringify(row, null, 2));
    console.log('\n🔄 Transformed Customer Data:');
    
    const customer = transformCustomerData(row);
    if (customer) {
      customers.push(customer);
      console.log(JSON.stringify(customer, null, 2));
    } else {
      console.log('❌ Row was skipped (empty or invalid)');
    }
    console.log('\n' + '='.repeat(50) + '\n');
  })
  .on('end', () => {
    console.log(`✅ Successfully parsed ${customers.length} customer(s)`);
    
    if (customers.length > 0) {
      console.log('\n📊 Summary of parsed data:');
      customers.forEach((customer, index) => {
        console.log(`Customer ${index + 1}:`);
        console.log(`  • Name: ${customer.first_name} ${customer.last_name}`);
        console.log(`  • License: ${customer.drivers_license_no}`);
        console.log(`  • Address: ${customer.full_address}, ${customer.city}, ${customer.state}`);
        console.log(`  • Scanner Created: ${customer.scanner_created_at}`);
        console.log(`  • Age: ${customer.age}`);
        console.log('');
      });
      
      console.log('🎉 CSV format parsing is working correctly!');
    } else {
      console.log('⚠️  No customers were parsed. Check the CSV format.');
    }
    
    // Cleanup
    fs.unlinkSync(testFile);
  })
  .on('error', (error) => {
    console.error('❌ Error parsing CSV:', error);
    // Cleanup
    fs.unlinkSync(testFile);
  });
