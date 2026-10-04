import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { OpportunityIngestionRun } from '../src/models/OpportunityIngestionRun.js';
import { Opportunity } from '../src/models/Opportunity.js';
import { OpportunitySource } from '../src/models/OpportunitySource.js';

async function validate() {
  try {
    await connectDatabase();
    
    const remotiveSource = await OpportunitySource.findOne({ slug: 'remotive' });
    const run = await OpportunityIngestionRun.findOne({ source: remotiveSource._id }).sort({ startedAt: -1 });
    
    console.log('--- LATEST RUN ---');
    console.log(JSON.stringify(run, null, 2));
    
    const opps = await Opportunity.find({ sourceRef: remotiveSource._id }).sort({ createdAt: -1 }).limit(5);
    console.log('--- LATEST OPPS ---');
    console.log(JSON.stringify(opps, null, 2));
    
    // Admin Curation step: Approve the first one, archive the second one.
    if (opps.length >= 2) {
      console.log('--- ADMIN CURATION ---');
      const opp1 = opps[0];
      opp1.status = 'active'; // Assuming 'active' or 'publishable'
      opp1.verified = true;
      opp1.verifiedBy = 'admin_system_validation';
      opp1.verifiedAt = new Date();
      await opp1.save();
      console.log(`Approved record: ${opp1._id} | status: ${opp1.status} | verified: ${opp1.verified}`);
      
      const opp2 = opps[1];
      opp2.status = 'archived';
      await opp2.save();
      console.log(`Archived record: ${opp2._id} | status: ${opp2.status}`);
    }

    // Rollback: Disable Remotive
    remotiveSource.enabled = false;
    await remotiveSource.save();
    console.log('Remotive disabled successfully.');

  } catch (error) {
    console.error(error);
  } finally {
    await disconnectDatabase();
  }
}
validate();
