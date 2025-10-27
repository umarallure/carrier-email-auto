import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSessions() {
  try {
    const { data: sessions, error } = await supabase
      .from('gtl_scraper_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Recent sessions:');
    sessions.forEach(session => {
      console.log(`- ${session.id}: ${session.status} (${new Date(session.created_at).toLocaleString()})`);
    });

    const readySessions = sessions.filter(s => s.status === 'ready');
    console.log(`\nReady sessions: ${readySessions.length}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

checkSessions();