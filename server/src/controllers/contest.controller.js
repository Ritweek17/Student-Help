import { getContest, listContests } from '../services/contest.service.js';
import { validateContestId, validateContestQuery } from '../validators/contest.validator.js';

export async function list(req, res, next) {
  try {
    const params = validateContestQuery(req.query);
    const result = await listContests(params);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const contestId = validateContestId(req.params.id);
    const contest = await getContest(contestId);
    res.status(200).json({ success: true, contest });
  } catch (error) {
    next(error);
  }
}
