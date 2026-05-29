require('dotenv').config();
const { supabase } = require('../config/supabase');

async function count(table) {
  const { error, count } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function sample(table, limit = 3) {
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) throw error;
  return data || [];
}

(async () => {
  try {
    const tables = ['users','blogs','gallery_items','events','registrations','messages'];
    const results = {};
    for (const t of tables) {
      results[t] = {
        count: await count(t),
        sample: await sample(t, 3)
      };
    }

    console.log('Supabase table counts and samples:');
    for (const t of tables) {
      console.log(`- ${t}: ${results[t].count}`);
      console.log(JSON.stringify(results[t].sample, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('Error checking Supabase counts:', err.message || err);
    process.exit(2);
  }
})();
