const { expressjwt: jwt } = require('express-jwt');
// const jwt = require('jsonwebtoken');
const config = require('_helpers/config');
const db = require('_helpers/db');

module.exports = authorize;

// function authorize(req, res, next) {
//     // roles param can be a single role string (e.g. Role.User or 'User') 
//     // or an array of roles (e.g. [Role.Admin, Role.User] or ['Admin', 'User'])
//     const token = req.headers['authorization'];

//     // if (typeof roles === 'string') {
//     //     roles = [roles];
//     // }

//     // return [
//         // authenticate JWT token and attach user to request object (req.user)
//         // expressjwt({ secret, algorithms: ['HS256'] }),
//         jwt.verify(token && token.split(' ')[1], secret, (err, decoded) => {
//             if (err) {
//                 return res.status(401).json({ message: 'Failed to authenticate token' });
//             }
//             if (decoded.role !== 1) {
//                 return res.status(401).json({ message: 'You dont have previlages to do the action' });
//             }
//             // Save the decoded information in the request object
//             req.user = decoded;
//             next();
//         });
//     // ];
// }

function authorize(roles = []) {
    // roles param can be a single role string (e.g. Role.User or 'User') 
    // or an array of roles (e.g. [Role.Admin, Role.User] or ['Admin', 'User'])
    if (typeof roles === 'number') {
        roles = [roles];
    }


    return [
        // authenticate JWT token and attach user to request object (req.user)
        jwt({
            secret: config.jwtSecret,
            algorithms: ['HS256'],
            issuer: config.jwtIssuer,
            audience: config.jwtAudience
        }),
        // authorize based on user role
        async (req, res, next) => {
            //req.auth.id)
            const account = await db.Account.findOne({
                where: { UserId: req.auth.id, sessionHash: req.auth.sessionHash, isActive: true }
            });

            // if (!account && (roles.length && !roles.includes(account.role))) {
            //     return res.status(401).json({ message: 'Unauthorized' });
            // }
            if (account && account.sessionHash) {
                if (roles.length && !roles.includes(account.role)) {
                    // role not authorized
                    return res.status(401).json({ message: 'Unauthorized' });
                }
            } else if (!account) {
                // account no longer exists or role not authorized
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // authentication and authorization successful
            req.auth.role = account.role;
            req.auth.ownsToken = () => false;
            next();
        }
    ];
}
