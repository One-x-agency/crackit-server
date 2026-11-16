import http from 'http';
import env from './shared/configs/env.js';
import app from './app.js';
import Logger from './shared/configs/logger.js';

const server = http.createServer(app);

server.listen(env.PORT, () => {
    Logger.info(`Server is running on port ${env.PORT} in ${env.ENV} mode`);
});
