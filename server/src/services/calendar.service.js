import { CalendarEvent } from '../models/CalendarEvent.js';
import { Opportunity } from '../models/Opportunity.js';
import { Application } from '../models/Application.js';

export async function createCalendarEvent(userId, data = {}) {
  const {
    title,
    description,
    type,
    startAt,
    endAt,
    allDay,
    location,
    url,
    status,
    reminderMinutes,
    source,
    opportunityId,
    applicationId,
  } = data;

  // Validate linked Opportunity if provided
  let linkedOpp = null;
  if (opportunityId) {
    linkedOpp = await Opportunity.findById(opportunityId).lean();
    if (!linkedOpp) {
      return {
        status: 400,
        message: 'Referenced opportunity not found',
      };
    }
  }

  // Validate linked Application if provided (must belong to userId)
  let linkedApp = null;
  if (applicationId) {
    linkedApp = await Application.findOne({
      _id: applicationId,
      userId,
    }).lean();

    if (!linkedApp) {
      return {
        status: 400,
        message: 'Referenced application record not found or access denied',
      };
    }
  }

  // Verify link consistency if both provided
  if (linkedOpp && linkedApp) {
    if (linkedApp.opportunityId.toString() !== linkedOpp._id.toString()) {
      return {
        status: 400,
        message: 'Inconsistent linkage: Application and Opportunity do not match',
      };
    }
  }

  const doc = await CalendarEvent.create({
    userId,
    opportunityId: opportunityId || undefined,
    applicationId: applicationId || undefined,
    title,
    description,
    type,
    startAt,
    endAt,
    allDay: Boolean(allDay),
    location,
    url,
    status,
    reminderMinutes,
    source,
  });

  return {
    status: 201,
    data: {
      success: true,
      event: doc.toObject(),
    },
  };
}

export async function getCalendarEvent(userId, eventId) {
  const event = await CalendarEvent.findOne({
    _id: eventId,
    userId,
  })
    .populate({
      path: 'opportunityId',
      select: '_id title organization type deadline eventDate status workMode location',
    })
    .populate({
      path: 'applicationId',
      select: '_id type status appliedAt registeredAt',
    })
    .lean();

  if (!event) {
    return {
      status: 404,
      message: 'Calendar event not found',
    };
  }

  // Format response keys nicely
  const opportunity = event.opportunityId || null;
  const application = event.applicationId || null;
  delete event.opportunityId;
  delete event.applicationId;

  return {
    status: 200,
    data: {
      success: true,
      event: {
        ...event,
        opportunity,
        application,
      },
    },
  };
}

export async function listCalendarEvents(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const query = { userId };

  if (params.type) query.type = params.type;
  if (params.status) query.status = params.status;

  if (params.startAfter || params.startBefore) {
    query.startAt = {};
    if (params.startAfter) query.startAt.$gte = params.startAfter;
    if (params.startBefore) query.startAt.$lte = params.startBefore;
  }

  const total = await CalendarEvent.countDocuments(query);

  const docs = await CalendarEvent.find(query)
    .sort({ startAt: 1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'opportunityId',
      select: '_id title organization type deadline eventDate status workMode location',
    })
    .populate({
      path: 'applicationId',
      select: '_id type status appliedAt registeredAt',
    })
    .lean();

  const pages = Math.ceil(total / limit);

  const events = docs.map((doc) => {
    const opportunity = doc.opportunityId || null;
    const application = doc.applicationId || null;
    delete doc.opportunityId;
    delete doc.applicationId;
    return {
      ...doc,
      opportunity,
      application,
    };
  });

  return {
    status: 200,
    data: {
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  };
}

export async function updateCalendarEvent(userId, eventId, data = {}) {
  const event = await CalendarEvent.findOne({
    _id: eventId,
    userId,
  });

  if (!event) {
    return {
      status: 404,
      message: 'Calendar event not found',
    };
  }

  const targetOppId = data.opportunityId !== undefined ? data.opportunityId : event.opportunityId?.toString();
  const targetAppId = data.applicationId !== undefined ? data.applicationId : event.applicationId?.toString();

  let linkedOpp = null;
  if (targetOppId) {
    linkedOpp = await Opportunity.findById(targetOppId).lean();
    if (!linkedOpp) {
      return {
        status: 400,
        message: 'Referenced opportunity not found',
      };
    }
  }

  let linkedApp = null;
  if (targetAppId) {
    linkedApp = await Application.findOne({
      _id: targetAppId,
      userId,
    }).lean();

    if (!linkedApp) {
      return {
        status: 400,
        message: 'Referenced application record not found or access denied',
      };
    }
  }

  if (linkedOpp && linkedApp) {
    if (linkedApp.opportunityId.toString() !== linkedOpp._id.toString()) {
      return {
        status: 400,
        message: 'Inconsistent linkage: Application and Opportunity do not match',
      };
    }
  }

  if (data.title !== undefined) event.title = data.title;
  if (data.description !== undefined) event.description = data.description;
  if (data.type !== undefined) event.type = data.type;
  if (data.startAt !== undefined) event.startAt = data.startAt;
  if (data.endAt !== undefined) event.endAt = data.endAt;
  if (data.allDay !== undefined) event.allDay = data.allDay;
  if (data.location !== undefined) event.location = data.location;
  if (data.url !== undefined) event.url = data.url;
  if (data.status !== undefined) event.status = data.status;
  if (data.reminderMinutes !== undefined) event.reminderMinutes = data.reminderMinutes;
  if (data.source !== undefined) event.source = data.source;

  if (data.opportunityId !== undefined) {
    event.opportunityId = data.opportunityId || undefined;
  }
  if (data.applicationId !== undefined) {
    event.applicationId = data.applicationId || undefined;
  }

  await event.save();

  return {
    status: 200,
    data: {
      success: true,
      event: event.toObject(),
    },
  };
}

export async function deleteCalendarEvent(userId, eventId) {
  const res = await CalendarEvent.deleteOne({
    _id: eventId,
    userId,
  });

  if (res.deletedCount === 0) {
    return {
      status: 404,
      message: 'Calendar event not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Calendar event deleted successfully',
    },
  };
}
