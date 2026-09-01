import { Opportunity } from '../models/Opportunity.js';

function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listOpportunities(params = {}) {
  // Always enforce status = 'published' for student discovery
  const filter = { status: 'published' };

  // 1. Search: q across title, organization, shortDescription, description, skills, tags
  if (params.q) {
    const safeQ = escapeRegex(params.q);
    const regex = new RegExp(safeQ, 'i');
    filter.$or = [
      { title: regex },
      { organization: regex },
      { shortDescription: regex },
      { description: regex },
      { skills: regex },
      { tags: regex },
    ];
  }

  // 2. Enum filters: type, workMode
  if (params.type && params.type.length > 0) {
    filter.type = { $in: params.type };
  }

  if (params.workMode && params.workMode.length > 0) {
    filter.workMode = { $in: params.workMode };
  }

  // 3. Boolean filters: verified, featured
  if (params.verified !== undefined) {
    filter.verified = Boolean(params.verified);
  }

  if (params.featured !== undefined) {
    filter.featured = Boolean(params.featured);
  }

  // 4. Skills filter
  if (params.skills && params.skills.length > 0) {
    filter.skills = { $in: params.skills };
  }

  // 5. Location filters: country, state, city
  if (params.country) {
    filter['location.country'] = new RegExp('^' + escapeRegex(params.country) + '$', 'i');
  }
  if (params.state) {
    filter['location.state'] = new RegExp('^' + escapeRegex(params.state) + '$', 'i');
  }
  if (params.city) {
    filter['location.city'] = new RegExp('^' + escapeRegex(params.city) + '$', 'i');
  }

  // 6. Deadline filters
  if (params.deadlineBefore || params.deadlineAfter) {
    filter.deadline = {};
    if (params.deadlineAfter) {
      filter.deadline.$gte = params.deadlineAfter;
    }
    if (params.deadlineBefore) {
      filter.deadline.$lte = params.deadlineBefore;
    }
  }

  // 7. Event Date filters
  if (params.eventDateBefore || params.eventDateAfter) {
    filter.eventDate = {};
    if (params.eventDateAfter) {
      filter.eventDate.$gte = params.eventDateAfter;
    }
    if (params.eventDateBefore) {
      filter.eventDate.$lte = params.eventDateBefore;
    }
  }

  // 8. Sort mapping
  const sortMap = {
    deadline_asc: { deadline: 1, createdAt: -1 },
    deadline_desc: { deadline: -1, createdAt: -1 },
    event_asc: { eventDate: 1, createdAt: -1 },
    event_desc: { eventDate: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    featured: { featured: -1, createdAt: -1 },
  };

  const sortOption = sortMap[params.sort] || sortMap.deadline_asc;

  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const total = await Opportunity.countDocuments(filter);
  const opportunities = await Opportunity.find(filter)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  return {
    opportunities,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  };
}

export async function getOpportunityById(id) {
  if (!id) return null;
  return Opportunity.findOne({ _id: id, status: 'published' }).lean();
}
