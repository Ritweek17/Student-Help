import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';

async function setup() {
  try {
    await connectDatabase();
    
    // Disable all sources
    await OpportunitySource.updateMany({}, { enabled: false });

    // Enable Remotive
    const remotive = await OpportunitySource.findOneAndUpdate(
      { slug: 'remotive' },
      { enabled: true, name: 'Remotive', type: 'api', priority: 30 },
      { upsert: true, new: true }
    );
    console.log('Remotive source enabled:', remotive.slug, remotive.enabled);

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
