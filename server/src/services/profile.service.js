import { Profile } from '../models/Profile.js';

export async function getProfileForUser(userId) {
  return Profile.findOne({ userId });
}

export async function updateProfileForUser(userId, profileData) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    return null;
  }



  const objectFields = ['personal', 'professionalLinks', 'careerPreferences', 'careerGoal'];
  const arrayFields = ['education', 'skills', 'interests', 'projects', 'experience', 'certifications', 'achievements', 'documents'];

  for (const field of objectFields) {
    if (profileData[field] && typeof profileData[field] === 'object' && !Array.isArray(profileData[field])) {
      for (const [subKey, subVal] of Object.entries(profileData[field])) {
        if (subVal && typeof subVal === 'object' && !Array.isArray(subVal) && !(subVal instanceof Date)) {
          for (const [deepKey, deepVal] of Object.entries(subVal)) {
            profile.set(`${field}.${subKey}.${deepKey}`, deepVal);
          }
        } else {
          profile.set(`${field}.${subKey}`, subVal);
        }
      }
    }
  }

  for (const field of arrayFields) {
    if (profileData[field] !== undefined) {
      profile.set(field, profileData[field]);
    }
  }

  await profile.save();
  return profile;
}
