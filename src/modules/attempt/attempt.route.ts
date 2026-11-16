import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import authenticate from '@/modules/learner/middlewares/authenticate.js';
import {
    Controller as saveAttempt,
    ValidationSchema as saveAttemptValidationSchema,
} from '@/modules/attempt/controllers/save-attempt.js';

const router = Router();

router.route('/').post(authenticate, validate(saveAttemptValidationSchema), withDatabase(saveAttempt));

export default router;
