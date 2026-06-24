require('dotenv').config({ path: './admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearVccCards() {
  console.log('Clearing vcc_cards table...');
  const { data, error } = await supabase
    .from('vcc_cards')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows

  if (error) {
    console.error('Error deleting vcc_cards:', error);
  } else {
    console.log('Successfully cleared vcc_cards table. Existing users will now be prompted to create new Codego cards.');
  }
}

clearVccCards();
