import { Router } from 'express';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';
import {
    Controller as createSession,
    ValidationSchema as createSessionValidationSchema,
} from '@/modules/learner/controllers/create-session.js';

const router = Router();

router.route('/session').post(validate(createSessionValidationSchema), withDatabase(createSession));

export default router;
