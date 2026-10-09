import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Contest } from '../src/models/Contest.js';

const mockContests = [
  {
    name: 'LeetCode Weekly Contest 412',
    platform: 'LeetCode',
    platformLogo: '🟡',
    contestUrl: 'https://leetcode.com/contest',
    eventDate: new Date('2026-09-06T08:00:00Z'),
    endDate: new Date('2026-09-06T09:30:00Z'),
    duration: '1h 30m',
    difficulty: 'Medium-Hard',
    registrationStatus: 'Open',
  },
  {
    name: 'CodeChef Starters 150',
    platform: 'CodeChef',
    platformLogo: '🟤',
    contestUrl: 'https://codechef.com/contests',
    eventDate: new Date('2026-09-02T20:00:00Z'),
    endDate: new Date('2026-09-02T22:00:00Z'),
    duration: '2h 00m',
    difficulty: 'Div 2, 3 & 4',
    registrationStatus: 'Open',
  },
  {
    name: 'Codeforces Round 980 (Div. 2)',
    platform: 'Codeforces',
    platformLogo: '🔵',
    contestUrl: 'https://codeforces.com/contests',
    eventDate: new Date('2026-09-04T20:05:00Z'),
    endDate: new Date('2026-09-04T22:20:00Z'),
    duration: '2h 15m',
    difficulty: 'Div. 2',
    registrationStatus: 'Upcoming',
  },
  {
    name: 'AtCoder Beginner Contest 370',
    platform: 'AtCoder',
    platformLogo: '⚪',
    contestUrl: 'https://atcoder.jp/contests',
    eventDate: new Date('2026-09-05T17:30:00Z'),
    endDate: new Date('2026-09-05T19:10:00Z'),
    duration: '1h 40m',
    difficulty: 'Beginner - Intermediate',
    registrationStatus: 'Upcoming',
  }
];

async function seedContests() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('Connected to MongoDB.');

    await Contest.deleteMany({});
    console.log('Cleared existing contests.');

    const created = await Contest.create(mockContests);
    console.log(`Seeded ${created.length} contests.`);
  } catch (error) {
    console.error('Error seeding contests:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedContests();
