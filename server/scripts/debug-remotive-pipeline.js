import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';
import { RemotiveAdapter } from '../src/services/ingestion/adapters/remotive.adapter.js';
import { processOpportunityItem } from '../src/services/ingestion/pipeline.service.js';

async function debug() {
  try {
    await connectDatabase();
    const source = await OpportunitySource.findOne({ slug: 'remotive' });
    const adapter = new RemotiveAdapter(source);
    
    console.log('Fetching...');
    const items = await adapter.fetchOpportunities({ limit: 1 });
    console.log('Fetched 1 item:', items[0]?.title);
    
    try {
      const result = await processOpportunityItem({
        rawItem: adapter.normalize(items[0]),
        source,
        ingestionRunId: null
      });
      console.log('Pipeline result:', result);
    } catch (e) {
      console.error('Pipeline threw:', e);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await disconnectDatabase();
  }
}
debug();
