const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Customer API Integration Example
 * Shows how to interact with the customer data programmatically
 */

class CustomerAPI {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all customers with pagination
   */
  async getAllCustomers(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    const { data, error, count } = await this.supabase
      .from('customers_testing')
      .select('*', { count: 'exact' })
      .order('synced_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      customers: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * Search customers by name or license number
   */
  async searchCustomers(searchTerm) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .select('*')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,drivers_license_no.ilike.%${searchTerm}%`)
      .order('synced_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  }

  /**
   * Get customer by driver's license number
   */
  async getCustomerByLicense(licenseNumber) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .select('*')
      .eq('drivers_license_no', licenseNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No customer found
      }
      throw error;
    }

    return data;
  }

  /**
   * Get recent customers (last 24 hours)
   */
  async getRecentCustomers() {
    const { data, error } = await this.supabase
      .from('recent_customers')
      .select('*');

    if (error) throw error;
    return data;
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats() {
    const { data, error } = await this.supabase
      .from('customer_stats')
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId, updates) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Add notes to a customer
   */
  async addCustomerNote(customerId, note) {
    const customer = await this.getCustomerById(customerId);
    const existingNotes = customer.notes || '';
    const timestamp = new Date().toLocaleString();
    const newNotes = existingNotes 
      ? `${existingNotes}\n\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    return this.updateCustomer(customerId, { notes: newNotes });
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get customers by phone number
   */
  async getCustomersByPhone(phoneNumber) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .select('*')
      .eq('phone', phoneNumber)
      .order('synced_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Subscribe to real-time customer updates
   */
  subscribeToUpdates(callback) {
    const subscription = this.supabase
      .channel('customers_testing')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers_testing'
        },
        callback
      )
      .subscribe();

    return subscription;
  }

  /**
   * Get customers by date range
   */
  async getCustomersByDateRange(startDate, endDate) {
    const { data, error } = await this.supabase
      .from('customers_testing')
      .select('*')
      .gte('synced_at', startDate)
      .lte('synced_at', endDate)
      .order('synced_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Export customers to CSV format
   */
  async exportCustomersToCSV(filters = {}) {
    let query = this.supabase
      .from('customers_testing')
      .select('*');

    // Apply filters
    if (filters.startDate) {
      query = query.gte('synced_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('synced_at', filters.endDate);
    }
    if (filters.state) {
      query = query.eq('state', filters.state);
    }

    const { data, error } = await query.order('synced_at', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(customer => 
      Object.values(customer).map(value => 
        value === null ? '' : `"${String(value).replace(/"/g, '""')}"`
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }
}

// Example usage
async function demonstrateAPI() {
  try {
    const api = new CustomerAPI();

    console.log('🧪 Testing Customer API...\n');

    // Get statistics
    console.log('📊 Customer Statistics:');
    const stats = await api.getCustomerStats();
    console.log(stats);
    console.log('');

    // Get recent customers
    console.log('🕒 Recent Customers:');
    const recentCustomers = await api.getRecentCustomers();
    console.log(`Found ${recentCustomers.length} recent customers`);
    recentCustomers.slice(0, 3).forEach(customer => {
      console.log(`- ${customer.first_name} ${customer.last_name} (${customer.drivers_license_no})`);
    });
    console.log('');

    // Search example
    console.log('🔍 Search Example (searching for "John"):');
    const searchResults = await api.searchCustomers('John');
    console.log(`Found ${searchResults.length} customers matching "John"`);
    console.log('');

    // Real-time subscription example
    console.log('📡 Setting up real-time subscription...');
    const subscription = api.subscribeToUpdates((payload) => {
      console.log('Real-time update:', payload.eventType, payload.new || payload.old);
    });

    console.log('✅ API demonstration complete!');
    console.log('💡 Check the CustomerAPI class for more methods.');

    // Cleanup
    setTimeout(() => {
      subscription.unsubscribe();
      console.log('🔌 Subscription closed.');
    }, 5000);

  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

// Export the class for use in other modules
module.exports = CustomerAPI;

// Run demonstration if executed directly
if (require.main === module) {
  demonstrateAPI();
}
