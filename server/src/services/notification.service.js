import { Notification } from '../models/Notification.js';
import { Opportunity } from '../models/Opportunity.js';
import { Application } from '../models/Application.js';
import { CalendarEvent } from '../models/CalendarEvent.js';

export async function createNotification(userId, data = {}) {
  const {
    title,
    message,
    type,
    opportunityId,
    applicationId,
    calendarEventId,
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

  // Validate linked CalendarEvent if provided (must belong to userId)
  let linkedCalEvent = null;
  if (calendarEventId) {
    linkedCalEvent = await CalendarEvent.findOne({
      _id: calendarEventId,
      userId,
    }).lean();

    if (!linkedCalEvent) {
      return {
        status: 400,
        message: 'Referenced calendar event not found or access denied',
      };
    }
  }

  // Relationship consistency checks
  if (linkedApp && linkedOpp) {
    if (linkedApp.opportunityId.toString() !== linkedOpp._id.toString()) {
      return {
        status: 400,
        message: 'Inconsistent relationship: Application and Opportunity do not match',
      };
    }
  }

  if (linkedCalEvent && linkedApp) {
    if (linkedCalEvent.applicationId && linkedCalEvent.applicationId.toString() !== linkedApp._id.toString()) {
      return {
        status: 400,
        message: 'Inconsistent relationship: Calendar event and Application do not match',
      };
    }
  }

  if (linkedCalEvent && linkedOpp) {
    if (linkedCalEvent.opportunityId && linkedCalEvent.opportunityId.toString() !== linkedOpp._id.toString()) {
      return {
        status: 400,
        message: 'Inconsistent relationship: Calendar event and Opportunity do not match',
      };
    }
  }

  const doc = await Notification.create({
    userId,
    title,
    message,
    type,
    read: false,
    dismissed: false,
    opportunityId: opportunityId || undefined,
    applicationId: applicationId || undefined,
    calendarEventId: calendarEventId || undefined,
  });

  return {
    status: 201,
    data: {
      success: true,
      notification: doc.toObject(),
    },
  };
}

export async function getNotification(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  })
    .populate({
      path: 'opportunityId',
      select: '_id title organization type deadline status',
    })
    .populate({
      path: 'applicationId',
      select: '_id type status appliedAt registeredAt',
    })
    .populate({
      path: 'calendarEventId',
      select: '_id title type startAt status',
    })
    .lean();

  if (!notification) {
    return {
      status: 404,
      message: 'Notification not found',
    };
  }

  const opportunity = notification.opportunityId || null;
  const application = notification.applicationId || null;
  const calendarEvent = notification.calendarEventId || null;
  delete notification.opportunityId;
  delete notification.applicationId;
  delete notification.calendarEventId;

  return {
    status: 200,
    data: {
      success: true,
      notification: {
        ...notification,
        opportunity,
        application,
        calendarEvent,
      },
    },
  };
}

export async function listNotifications(userId, params = {}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const query = { userId };

  if (params.read !== undefined) {
    query.read = params.read;
  }

  if (params.dismissed !== undefined) {
    query.dismissed = params.dismissed;
  }

  if (params.type) {
    if (Array.isArray(params.type)) {
      query.type = { $in: params.type };
    } else {
      query.type = params.type;
    }
  }

  const total = await Notification.countDocuments(query);

  const docs = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'opportunityId',
      select: '_id title organization type deadline status',
    })
    .populate({
      path: 'applicationId',
      select: '_id type status appliedAt registeredAt',
    })
    .populate({
      path: 'calendarEventId',
      select: '_id title type startAt status',
    })
    .lean();

  const pages = Math.ceil(total / limit);

  const notifications = docs.map((doc) => {
    const opportunity = doc.opportunityId || null;
    const application = doc.applicationId || null;
    const calendarEvent = doc.calendarEventId || null;
    delete doc.opportunityId;
    delete doc.applicationId;
    delete doc.calendarEventId;
    return {
      ...doc,
      opportunity,
      application,
      calendarEvent,
    };
  });

  return {
    status: 200,
    data: {
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    return {
      status: 404,
      message: 'Notification not found',
    };
  }

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return {
    status: 200,
    data: {
      success: true,
      notification: notification.toObject(),
    },
  };
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { userId, read: false },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    }
  );

  return {
    status: 200,
    data: {
      success: true,
      updatedCount: result.modifiedCount || 0,
    },
  };
}

export async function dismissNotification(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    return {
      status: 404,
      message: 'Notification not found',
    };
  }

  if (!notification.dismissed) {
    notification.dismissed = true;
    notification.dismissedAt = new Date();
    await notification.save();
  }

  return {
    status: 200,
    data: {
      success: true,
      notification: notification.toObject(),
    },
  };
}

export async function deleteNotification(userId, notificationId) {
  const result = await Notification.deleteOne({
    _id: notificationId,
    userId,
  });

  if (result.deletedCount === 0) {
    return {
      status: 404,
      message: 'Notification not found',
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      deleted: true,
    },
  };
}

export async function getUnreadCount(userId) {
  const unreadCount = await Notification.countDocuments({
    userId,
    read: false,
  });

  return {
    status: 200,
    data: {
      success: true,
      unreadCount,
    },
  };
}
