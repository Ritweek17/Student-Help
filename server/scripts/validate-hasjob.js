import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunityIngestionRun } from '../src/models/OpportunityIngestionRun.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';

async function validate() {
  try {
    await connectDatabase();
    
    const source = await OpportunitySource.findOne({ slug: 'hasjob' });
    const run = await OpportunityIngestionRun.findOne({ sourceId: source._id }).sort({ startedAt: -1 });
    
    console.log('--- LATEST RUN ---');
    console.log(JSON.stringify(run, null, 2));
    
    const opps = await Opportunity.find({ sourceRef: source._id }).sort({ createdAt: -1 }).limit(10);
    console.log('--- LATEST OPPS ---');
    console.log(JSON.stringify(opps, null, 2));
    
    // Rollback: Disable Hasjob
    source.enabled = false;
    await source.save();
    console.log('Hasjob disabled successfully.');

  } catch (error) {
    console.error(error);
  } finally {
    await disconnectDatabase();
  }
}
validate();
