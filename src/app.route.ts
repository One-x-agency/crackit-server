import { Router } from 'express';
import learnerRoutes from '@/modules/learner/learner.route.js';
import attemptRoutes from '@/modules/attempt/attempt.route.js';
import analyticsRoutes from '@/modules/analytics/analytics.route.js';

const router = Router();

router.use('/learners', learnerRoutes);
router.use('/attempts', attemptRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
