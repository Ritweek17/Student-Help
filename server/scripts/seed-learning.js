import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { LearningTrack } from '../src/models/LearningTrack.js';
import { LearningItem } from '../src/models/LearningItem.js';
import { LearningResource } from '../src/models/LearningResource.js';
import { UserLearningProgress } from '../src/models/UserLearningProgress.js';

import { MOCK_LEARNING_TRACKS } from '../../src/data/demo/learningTracks.js';
import { MOCK_LEARNING_ITEMS } from '../../src/data/demo/learningItems.js';
import { MOCK_LEARNING_RESOURCES } from '../../src/data/demo/learningResources.js';

async function seedLearning() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('Connected to MongoDB.');

    await LearningTrack.deleteMany({});
    await LearningItem.deleteMany({});
    await LearningResource.deleteMany({});
    await UserLearningProgress.deleteMany({});
    console.log('Cleared existing learning content.');

    const trackIdMap = {};
    const resourceIdMap = {};

    // 1. Seed Tracks
    for (const mockTrack of MOCK_LEARNING_TRACKS) {
      const track = await LearningTrack.create({
        title: mockTrack.title,
        category: mockTrack.category,
        description: mockTrack.description,
        targetDate: mockTrack.targetDate ? new Date(mockTrack.targetDate) : undefined,
        image: mockTrack.image,
        isActive: true
      });
      trackIdMap[mockTrack.id] = track._id;
    }
    console.log(`Seeded ${Object.keys(trackIdMap).length} tracks.`);

    // 2. Seed Resources
    for (const mockRes of MOCK_LEARNING_RESOURCES) {
      const res = await LearningResource.create({
        trackId: trackIdMap[mockRes.trackId],
        title: mockRes.title,
        type: mockRes.type,
        provider: mockRes.provider,
        author: mockRes.author,
        url: mockRes.url,
        itemCount: mockRes.itemCount,
        description: mockRes.description,
      });
      resourceIdMap[mockRes.id] = res._id;
    }
    console.log(`Seeded ${Object.keys(resourceIdMap).length} resources.`);

    // 3. Seed Items
    let itemsSeeded = 0;
    for (const mockItem of MOCK_LEARNING_ITEMS) {
      await LearningItem.create({
        trackId: trackIdMap[mockItem.trackId],
        resourceId: mockItem.resourceId ? resourceIdMap[mockItem.resourceId] : undefined,
        title: mockItem.title,
        duration: mockItem.duration,
        order: mockItem.order,
      });
      itemsSeeded++;
    }
    console.log(`Seeded ${itemsSeeded} items.`);

  } catch (error) {
    console.error('Error seeding learning data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedLearning();
