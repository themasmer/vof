module.exports = errorHandler;

function errorHandler(err, req, res, next) {
    switch (true) {
        case typeof err === 'string':
            // custom application error
            const is404 = err.toLowerCase().endsWith('not found');
            const statusCode = is404 ? 404 : 400;
            return res.status(statusCode).json({ message: err });
        case err.name === 'UnauthorizedError':
            // jwt authentication error
            return res.status(401).json({ message: 'Unauthorized' });
        default:
            console.error('Unhandled request error', { name: err.name, message: err.message, path: req.path });
            return res.status(err.status || 500).json({ message: err.status === 403 ? 'Forbidden' : 'An unexpected error occurred' });
    }
}
