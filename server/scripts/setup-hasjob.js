import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';

async function setup() {
  try {
    await connectDatabase();
    
    // Disable all sources
    await OpportunitySource.updateMany({}, { enabled: false });

    // Enable Hasjob
    const hasjob = await OpportunitySource.findOneAndUpdate(
      { slug: 'hasjob' },
      { enabled: true, name: 'Hasjob', type: 'api', priority: 10 },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('Hasjob source enabled:', hasjob.slug, hasjob.enabled);

    // List all
    const all = await OpportunitySource.find();
    console.log('All sources state:');
    all.forEach(s => console.log(`- ${s.slug}: enabled=${s.enabled}`));
    
  } catch (error) {
    console.error(error);
  } finally {
    await disconnectDatabase();
  }
}
setup();
