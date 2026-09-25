require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const router = express.Router()

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

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
    console.error(err)
    //var stack = err.stack;
    //you can also notify the err/stack to support via email or other APIs
});


// start server
//const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
const port = process.env.PORT || 8080
app.listen(port,"0.0.0.0", () => {
    console.log('VOFAPI Server listening on port ' + port)
})
