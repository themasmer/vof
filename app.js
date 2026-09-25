require('rootpath')();
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');
const config = require('_helpers/config');
const securityHeaders = require('_middleware/security-headers');
const db = require('_helpers/db');

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(securityHeaders);

const router = express.Router()

app.use(cors({
    origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
        const error = new Error('Origin is not allowed');
        error.status = 403;
        return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token']
}));

// api routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/clients', require('./clients/clients.controller'));
app.use('/pitUsers', require('./clients/pitusers.controller'));
app.use('/health', require('./_helpers/health'))
// swagger docs route
// app.use('/api-docs', require('_helpers/swagger'));


// global error handler
app.use(errorHandler);

process.on('uncaughtException', function (err) {
    console.error('Uncaught exception; shutting down', { name: err.name, message: err.message });
    process.exit(1);
});


// start server
//const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
const port = process.env.PORT || 8080
db.ready
    .then(() => app.listen(port, '0.0.0.0', () => console.log('VOFAPI Server listening on port ' + port)))
    .catch(err => {
        console.error('Database initialization failed', { name: err.name, message: err.message });
        process.exit(1);
    });
