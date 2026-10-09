import * as learningService from '../services/learning.service.js';
import { validateObjectId, validateProgressUpdate } from '../validators/learning.validator.js';

export async function getTracks(req, res, next) {
  try {
    const tracks = await learningService.listTracks(req.auth.userId);
    res.status(200).json({ success: true, data: tracks });
  } catch (error) {
    next(error);
  }
}

export async function getTrack(req, res, next) {
  try {
    const trackId = validateObjectId(req.params.id, 'Track ID');
    const track = await learningService.getTrack(trackId, req.auth.userId);
    res.status(200).json({ success: true, data: track });
  } catch (error) {
    next(error);
  }
}

export async function getTrackItems(req, res, next) {
  try {
    const trackId = validateObjectId(req.params.id, 'Track ID');
    const items = await learningService.listItems(trackId, req.auth.userId);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getResources(req, res, next) {
  try {
    const trackId = req.query.trackId ? validateObjectId(req.query.trackId, 'Track ID') : null;
    const resources = await learningService.listResources(trackId);
    res.status(200).json({ success: true, data: resources });
  } catch (error) {
    next(error);
  }
}

export async function updateProgress(req, res, next) {
  try {
    const { itemId, trackId, status } = validateProgressUpdate(req.body);
    const progress = await learningService.updateProgress(req.auth.userId, trackId, itemId, status);
    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
}

export async function getRecommendedNext(req, res, next) {
  try {
    const recommended = await learningService.getRecommendedNext(req.auth.userId);
    res.status(200).json({ success: true, data: recommended });
  } catch (error) {
    next(error);
  }
}
