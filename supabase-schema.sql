-- Pawn Shop Customer Database Schema
-- This creates the customers table with all necessary fields for ID scanner integration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers_testing table
CREATE TABLE IF NOT EXISTS customers_testing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal Information
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  lastname_alt VARCHAR(100), -- Alternative/maiden name
  birthdate DATE,
  age INTEGER,
  
  -- Contact Information
  full_address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(20),
  
  -- License/ID Information
  drivers_license_no VARCHAR(50),
  license_issued_on DATE,
  license_expires_on DATE,
  
  -- Insurance Information
  insurance_id_no VARCHAR(50),
  insurance_company_code VARCHAR(50),
  insurance_member_no VARCHAR(50),
  
  -- System Fields
  scanner_created_at TIMESTAMP WITH TIME ZONE,
  user_field_1 VARCHAR(255),
  user_field_2 VARCHAR(255),
  notes TEXT,
  
  -- Tracking Fields
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_testing_drivers_license ON customers_testing(drivers_license_no);
CREATE INDEX IF NOT EXISTS idx_customers_testing_phone ON customers_testing(phone);
CREATE INDEX IF NOT EXISTS idx_customers_testing_name ON customers_testing(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_customers_testing_synced_at ON customers_testing(synced_at);
CREATE INDEX IF NOT EXISTS idx_customers_testing_created_at ON customers_testing(created_at);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at when a row is modified
DROP TRIGGER IF EXISTS update_customers_testing_updated_at ON customers_testing;
CREATE TRIGGER update_customers_testing_updated_at
    BEFORE UPDATE ON customers_testing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for better security
ALTER TABLE customers_testing ENABLE ROW LEVEL SECURITY;

-- Create policies for different access levels
-- Policy for service role (full access)
CREATE POLICY "Service role can manage all customers_testing" ON customers_testing
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for authenticated users (read access)
CREATE POLICY "Authenticated users can view customers_testing" ON customers_testing
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for authenticated users (insert new customers)
CREATE POLICY "Authenticated users can insert customers_testing" ON customers_testing
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create a view for recent customers (last 24 hours)
CREATE OR REPLACE VIEW recent_customers AS
SELECT 
    id,
    first_name,
    last_name,
    phone,
    drivers_license_no,
    scanner_created_at,
    synced_at,
    created_at
FROM customers_testing
WHERE synced_at >= NOW() - INTERVAL '24 hours'
ORDER BY synced_at DESC;

-- Create a view for customer statistics
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE synced_at >= NOW() - INTERVAL '24 hours') as customers_today,
    COUNT(*) FILTER (WHERE synced_at >= NOW() - INTERVAL '7 days') as customers_this_week,
    COUNT(*) FILTER (WHERE synced_at >= NOW() - INTERVAL '30 days') as customers_this_month,
    MAX(synced_at) as last_sync_time,
    COUNT(DISTINCT drivers_license_no) as unique_licenses
FROM customers_testing;

-- Add comments to document the table structure
COMMENT ON TABLE customers_testing IS 'Customer data synchronized from ID scanner CSV files';
COMMENT ON COLUMN customers_testing.id IS 'Unique identifier for each customer record';
COMMENT ON COLUMN customers_testing.drivers_license_no IS 'Driver''s license number - used for duplicate detection';
COMMENT ON COLUMN customers_testing.scanner_created_at IS 'Timestamp when the record was created by the ID scanner';
COMMENT ON COLUMN customers_testing.synced_at IS 'Timestamp when the record was synchronized to the database';
COMMENT ON COLUMN customers_testing.user_field_1 IS 'Flexible field for custom data from scanner';
COMMENT ON COLUMN customers_testing.user_field_2 IS 'Flexible field for custom data from scanner';

-- Create a function to get customer by license number
CREATE OR REPLACE FUNCTION get_customer_by_license(license_number TEXT)
RETURNS TABLE (
    id UUID,
    first_name VARCHAR,
    last_name VARCHAR,
    phone VARCHAR,
    full_address TEXT,
    drivers_license_no VARCHAR,
    synced_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.phone,
        c.full_address,
        c.drivers_license_no,
        c.synced_at
    FROM customers_testing c
    WHERE c.drivers_license_no = license_number
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON recent_customers TO authenticated;
GRANT SELECT ON customer_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_by_license(TEXT) TO authenticated;
