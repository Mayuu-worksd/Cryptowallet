import { supabase } from './supabaseClient';

export interface BankAccount {
  id: string;
  beneficiary_name: string;
  bank_name: string;
  routing_number: string;
  account_number: string;
  account_type: string;
  currency: string;
  iban?: string;
  swift_code?: string;
  deposit_instructions?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class BankAccountService {
  
  // Get all active bank accounts for a specific currency
  static async getBankAccountsByCurrency(currency: string): Promise<BankAccount[]> {
    try {
      const { data, error } = await supabase.rpc('get_bank_accounts_by_currency', {
        p_currency: currency
      });
      
      if (error) {
        console.error('Error fetching bank accounts:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception in getBankAccountsByCurrency:', error);
      return [];
    }
  }

  // Check if any bank accounts are configured for a currency
  static async hasBankAccountsForCurrency(currency: string): Promise<boolean> {
    const accounts = await this.getBankAccountsByCurrency(currency);
    return accounts.length > 0;
  }

  // Get all active bank accounts (for admin purposes)
  static async getAllActiveBankAccounts(): Promise<BankAccount[]> {
    try {
      const { data, error } = await supabase
        .from('admin_bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching all bank accounts:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception in getAllActiveBankAccounts:', error);
      return [];
    }
  }

  // Get supported currencies (based on configured bank accounts)
  static async getSupportedCurrencies(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('admin_bank_accounts')
        .select('currency')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching supported currencies:', error);
        return [];
      }
      
      // Return unique currencies
      const currencies = [...new Set((data || []).map(account => account.currency))];
      return currencies.sort();
    } catch (error) {
      console.error('Exception in getSupportedCurrencies:', error);
      return [];
    }
  }
}