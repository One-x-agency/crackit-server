import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import authenticate from '@/modules/learner/middlewares/authenticate.js';
import { Controller as getOverview, ValidationSchema as getOverviewSchema } from '@/modules/analytics/controllers/get-overview.js';
import { Controller as getProgress, ValidationSchema as getProgressSchema } from '@/modules/analytics/controllers/get-progress.js';
import { Controller as getWeakItems, ValidationSchema as getWeakItemsSchema } from '@/modules/analytics/controllers/get-weak-items.js';

const router = Router();

router.use(authenticate);
router.get('/overview', validate(getOverviewSchema), withDatabase(getOverview));
router.get('/progress', validate(getProgressSchema), withDatabase(getProgress));
router.get('/weak-items', validate(getWeakItemsSchema), withDatabase(getWeakItems));

export default router;
