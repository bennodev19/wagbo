import dotenv from 'dotenv';

// Calling before loading the configurations to load the environment first.
const ENVIRONMENT = process.env.NODE_ENV || 'local'; // https://stackoverflow.com/questions/11104028/why-is-process-env-node-env-undefined
dotenv.config({ path: `.env.${ENVIRONMENT}` });

// Configs
import appConfig from './app.config';
import twitterConfig from './twitter.config';

export const config = {
    app: appConfig,
    twitter: twitterConfig,
};

console.log(`Loaded Environment Variables from '.env.${ENVIRONMENT}'`, config);

export default config;