import { LearningTrack } from '../models/LearningTrack.js';
import { LearningItem } from '../models/LearningItem.js';
import { LearningResource } from '../models/LearningResource.js';
import { UserLearningProgress } from '../models/UserLearningProgress.js';

function notFoundError(msg = 'Not found') {
  const error = new Error(msg);
  error.statusCode = 404;
  return error;
}

export async function listTracks(userId) {
  const tracks = await LearningTrack.find({ isActive: true }).lean();
  const progresses = await UserLearningProgress.find({ userId }).lean();
  const items = await LearningItem.find({}).lean();

  const progressByTrack = progresses.reduce((acc, p) => {
    if (!acc[p.trackId]) acc[p.trackId] = [];
    acc[p.trackId].push(p);
    return acc;
  }, {});

  const itemsByTrack = items.reduce((acc, i) => {
    if (!acc[i.trackId]) acc[i.trackId] = [];
    acc[i.trackId].push(i);
    return acc;
  }, {});

  return tracks.map(track => {
    const trackItems = itemsByTrack[track._id] || [];
    const trackProgress = progressByTrack[track._id] || [];
    
    // Sort items by order
    trackItems.sort((a, b) => a.order - b.order);

    const completed = trackProgress.filter(p => ['Completed', 'Practiced', 'Mastered'].includes(p.status)).length;
    const progressPercent = trackItems.length ? Math.round((completed / trackItems.length) * 100) : 0;
    
    let status = 'Not Started';
    if (progressPercent === 100) status = 'Completed';
    else if (progressPercent > 0) status = 'In Progress';

    // Find current topic and next topic
    let currentTopic = 'None';
    let nextSuggestedTopic = 'None';
    
    const firstIncomplete = trackItems.find(item => {
      const p = trackProgress.find(tp => tp.itemId.toString() === item._id.toString());
      return !p || !['Completed', 'Practiced', 'Mastered'].includes(p.status);
    });

    if (firstIncomplete) {
      nextSuggestedTopic = firstIncomplete.title;
      currentTopic = firstIncomplete.title; // simplified for phase 1 deterministic behavior
    }

    return {
      ...track,
      id: track._id.toString(), // Mock mapping for UI
      progress: progressPercent,
      completedItems: completed,
      totalItems: trackItems.length,
      status,
      currentTopic,
      nextSuggestedTopic
    };
  });
}

export async function getTrack(trackId, userId) {
  const tracks = await listTracks(userId);
  const track = tracks.find(t => t.id === trackId.toString());
  if (!track) throw notFoundError('Track not found');
  return track;
}

export async function listItems(trackId, userId) {
  const items = await LearningItem.find({ trackId }).sort({ order: 1 }).lean();
  const progresses = await UserLearningProgress.find({ userId, trackId }).lean();

  const progressMap = progresses.reduce((acc, p) => {
    acc[p.itemId] = p.status;
    return acc;
  }, {});

  return items.map(item => ({
    ...item,
    id: item._id.toString(), // Mock mapping for UI
    status: progressMap[item._id] || 'Not Started'
  }));
}

export async function listResources(trackId) {
  const query = trackId ? { trackId } : {};
  const resources = await LearningResource.find(query).lean();
  return resources.map(res => ({
    ...res,
    id: res._id.toString(), // Mock mapping for UI
  }));
}

export async function updateProgress(userId, trackId, itemId, status) {
  // Validate item belongs to track
  const item = await LearningItem.findOne({ _id: itemId, trackId });
  if (!item) throw notFoundError('Learning item not found in this track');

  const progress = await UserLearningProgress.findOneAndUpdate(
    { userId, itemId },
    { trackId, status },
    { new: true, upsert: true }
  );
  return progress;
}

export async function getRecommendedNext(userId) {
  // Simple deterministic algorithm: for each active track, find the first incomplete item
  const tracks = await listTracks(userId);
  const inProgressTracks = tracks.filter(t => t.status === 'In Progress' || t.status === 'Not Started');
  
  const recommendations = [];
  
  for (const track of inProgressTracks) {
    if (recommendations.length >= 3) break;
    
    const items = await listItems(track.id, userId);
    const nextItem = items.find(i => !['Completed', 'Practiced', 'Mastered'].includes(i.status));
    
    if (nextItem) {
      recommendations.push({
        title: nextItem.title,
        track: track.title,
        reason: 'Next in sequence',
        estTime: nextItem.duration
      });
    }
  }
  
  return recommendations;
}
