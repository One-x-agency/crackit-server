import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import Logger from './shared/configs/logger.js';
import errorHandler from './shared/middlewares/error-handler.js';
import requestId from './shared/middlewares/request-id.js';
import appRoute from './app.route.js';
import env from './shared/configs/env.js';

const app = express();

app.use(requestId);
app.use(
    morgan(':method :url Status : :status, Time taken: :response-time ms', {
        stream: { write: (message) => Logger.info(message) },
    }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const serverStartTimeStamp = new Date().toISOString();

app.get('/', (req, res) => {
    res.status(200).json({
        status: 'OK',
        version: '1.0.0',
        startTime: serverStartTimeStamp,
        service: env.SERVICE_NAME,
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.use('/', appRoute);

app.use(errorHandler);

export default app;
