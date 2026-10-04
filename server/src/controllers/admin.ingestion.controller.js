import mongoose from 'mongoose';
import { OpportunitySource } from '../models/OpportunitySource.js';
import { OpportunityIngestionRun } from '../models/OpportunityIngestionRun.js';
import { Opportunity } from '../models/Opportunity.js';

const SAFE_SOURCE_FIELDS = 'name slug type baseUrl enabled priority lastRunAt lastSuccessAt lastFailureAt lastError isLocked lockedAt metadata createdAt updatedAt';

export async function listSources(req, res, next) {
  try {
    const sources = await OpportunitySource.find()
      .select(SAFE_SOURCE_FIELDS)
      .sort({ priority: -1, createdAt: 1 })
      .lean();

    return res.status(200).json({ success: true, sources });
  } catch (error) {
    return next(error);
  }
}

export async function updateSource(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid source ID' });
    }

    const updates = {};
    if (typeof req.body.enabled === 'boolean') {
      updates.enabled = req.body.enabled;
    }
    if (typeof req.body.priority === 'number' && req.body.priority >= 0) {
      updates.priority = req.body.priority;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update (only enabled and priority allowed)' });
    }

    const source = await OpportunitySource.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(SAFE_SOURCE_FIELDS).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Source not found' });
    }

    return res.status(200).json({ success: true, source });
  } catch (error) {
    return next(error);
  }
}

export async function listIngestionRuns(req, res, next) {
  try {
    const { page = 1, limit = 20, sourceId, status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (sourceId) {
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        return res.status(400).json({ success: false, message: 'Invalid source ID filter' });
      }
      query.sourceId = sourceId;
    }
    if (status) {
      query.status = status;
    }

    const [runs, total] = await Promise.all([
      OpportunityIngestionRun.find(query)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('sourceId', 'name slug')
        .lean(),
      OpportunityIngestionRun.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      runs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getIngestionRunById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid run ID' });
    }

    const run = await OpportunityIngestionRun.findById(id)
      .populate('sourceId', 'name slug')
      .lean();

    if (!run) {
      return res.status(404).json({ success: false, message: 'Run not found' });
    }

    return res.status(200).json({ success: true, run });
  } catch (error) {
    return next(error);
  }
}

const MAX_BATCH_SIZE = 50;

export async function bulkCurateOpportunities(req, res, next) {
  try {
    const { action, ids } = req.body;
    
    if (!['approve', 'archive'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid bulk action (must be approve or archive)' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Must provide an array of opportunity IDs' });
    }

    if (ids.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ success: false, message: `Batch size exceeds maximum limit of ${MAX_BATCH_SIZE}` });
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid Opportunity IDs provided' });
    }

    // Only process eligible drafts
    const opportunities = await Opportunity.find({
      _id: { $in: validIds },
      status: 'draft',
      verified: false
    });

    const eligibleIds = opportunities.map(o => o._id.toString());
    const results = {
      successful: 0,
      failed: 0,
      skipped: ids.length - eligibleIds.length,
      errors: []
    };

    const adminUserId = req.auth.userId;

    // Process iteratively to ensure individual updates and isolated failures
    for (const opp of opportunities) {
      try {
        if (action === 'approve') {
          opp.status = 'published';
          opp.verified = true;
          opp.verifiedBy = adminUserId;
          opp.verifiedAt = new Date();
        } else if (action === 'archive') {
          opp.status = 'archived';
        }
        await opp.save();
        results.successful++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          id: opp._id.toString(),
          message: err.message || 'Unknown error during save'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${results.successful} opportunities. Skipped ${results.skipped}.`,
      results
    });
  } catch (error) {
    return next(error);
  }
}
