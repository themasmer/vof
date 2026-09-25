
﻿const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const accountService = require('./account.service');
const { validatePassword } = require('_helpers/password-policy');
const config = require('_helpers/config');
const rateLimit = require('_middleware/rate-limit');
const { setCsrfCookie, clearCsrfCookie, requireCsrf, validateCsrf, requireTrustedOrigin } = require('_middleware/csrf');
const REFRESH_COOKIE = config.cookieSecure ? '__Host-refreshToken' : 'refreshToken';

const authRateLimit = rateLimit({
    ...config.loginRateLimit,
    keyGenerator: req => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`
});

// routes
router.post('/authenticate', requireTrustedOrigin, authRateLimit, authenticateSchema, authenticate);
router.post('/refresh-token', requireTrustedOrigin, authRateLimit, refreshToken);
router.post('/revoke-token', authorize(), requireCsrf, revokeTokenSchema, revokeToken);
router.post('/register', authorize([Role.Admin]), requireCsrf, registerSchema, register);
router.post('/verify-email', requireTrustedOrigin, authRateLimit, verifyEmailSchema, verifyEmail);
router.post('/forgot-password', requireTrustedOrigin, authRateLimit, forgotPasswordSchema, forgotPassword);

router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', requireTrustedOrigin, authRateLimit, resetPasswordSchema, resetPassword);
router.post('/set-password', requireTrustedOrigin, authRateLimit, setPasswordSchema, setPassword);
// router.get('/', authorize(Role.Admin), getAll);

router.get('/getAllUsers', authorize([Role.Admin]), getAll);  // Temporarily removed authentication
router.get('/getAllActiveUsers', authorize([Role.Admin]), getAllActiveUsers);
router.get('/getAllUserNames', authorize([Role.Admin]), getAllUserNames);
// router.post('/', authorize(Role.Admin), createSchema, create);
// router.put('/:id', authorize(), updateSchema, update);
// router.delete('/:id', authorize(), _delete);

//Added
// router.get('/:email', authorize(), getUserInfo);
router.get('/getById/:id', authorize([Role.Admin]), getById); //
router.post('/updateUser', authorize([Role.Admin]), requireCsrf, updateSchema, update); 
router.post('/updateStatus', authorize([Role.Admin]), requireCsrf, updateStatusSchema, updateStatus); 

router.post('/getBlotter', authorize([Role.Admin]), blotterSchema, getBlotter); 
router.post('/getBlotterRecordings', authorize([Role.Admin]), blotterRecordingsSchema, getBlotterRecordings);

// router.post('/getPractitionerInfo', authorize(), getPractitionerInfo);
// router.get('/getparticipantName/:pid', authorize(), getparticipantName);
router.post('/updateprofile', authorize(), requireCsrf, updateProfileschema, updateProfile);
router.post('/verify-2fa', requireTrustedOrigin, authRateLimit, verify2FASchema, verify2FA);
router.get('/getprofile', authorize(), getprofile);
router.get('/getJitsiToken/:id', authorize(), uuidParam, getJitsiToken);
router.post('/changepassword', authorize(), requireCsrf, changepassword);
// router.post('/resetpwdfromQR', resetpwdfromQRSchema, resetpwdfromQR);
// router.get('/getUserbyRole/:role', authorize(), getUserbyRole);
// router.get('/getUserInfobyRole/:userid', authorize(), getUserInfobyRole);
// router.post('/updateUserInfobyRole/:id', authorize(), updateUserInfobyRoleschema, updateUserInfobyRole);
// router.get('/getIps/:clientId/:locationId', authorize(), getIps);

// router.post('/sendmessageforExisitingUsers',  sendmessageforExisitingUsers);



//test
//router.post('/sendSms', authorize(), sendSms);


module.exports = router;

/* function sendSms(req, res, next) {
   // console.log(req.user);
    accountService.updateSms(req.user.id)
        .then(account => res.json(account))
        .catch(next);
} */


function authenticateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(128).required()
    });
    validateRequest(req, next, schema);
}

function authenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    accountService.authenticate(req)
        .then(({ refreshToken, ...account }) => {
            //setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

async function refreshToken(req, res, next) {
    const token = req.cookies[REFRESH_COOKIE];
    const ipAddress = req.ip;
    try {
        const sessionHash = await accountService.getCsrfSession(token);
        if (!validateCsrf(req, sessionHash)) return res.status(403).json({ message: 'Invalid CSRF token' });
        const { refreshToken, csrfSessionHash, ...account } = await accountService.refreshToken({ token, ipAddress });
            setTokenCookie(res, refreshToken);
            setCsrfCookie(res, csrfSessionHash);
            res.json(account);
    } catch (err) {
        next(err);
    }
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
    // accept token from request body or cookie
    const token = req.body.token || req.cookies[REFRESH_COOKIE] || req.auth.id;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    // users can revoke their own tokens and admins can revoke any tokens
    // if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
    //     return res.status(401).json({ message: 'Unauthorized' });
    // }

    accountService.revokeToken(req)
        .then(() => {
            clearTokenCookie(res);
            clearCsrfCookie(res);
            res.json({ message: 'Token revoked' });
        })
        .catch(next);
}

function registerSchema(req, res, next) {
    const schema = Joi.object({
        // title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        // password: Joi.string().min(4).required(),
        role: Joi.string().required(),
        phone: Joi.string().empty(''),

        // confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        // acceptTerms: Joi.boolean().valid(true).required(),
        // clientid :  Joi.number().required(),
        // locationid :  Joi.number().required(),
        // locationmap :  Joi.string(),
        // rolemap :  Joi.string()

    });
    validateRequest(req, next, schema);
}


function register(req, res, next) {
    accountService.register(req)
        // .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .then(client => res.json(client))
        .catch(next);
}

function verifyEmailSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function verifyEmail(req, res, next) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now set your password' }))
        .catch(next);
}

function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function forgotPassword(req, res, next) {
    accountService.forgotPassword(req)
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function changepassword(req, res, next) {
    accountService.changepassword(req)
        .then(client => res.json({ message: 'Please check your email for change instructions' }))
        .catch(next);
}

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function setPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(12).max(128).custom(validatePassword).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function setPassword(req, res, next) {
    accountService.setPassword(req.body)
        .then(() => res.json({ message: 'Password set successful, you can now login' }))
        .catch(next);
}

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(12).max(128).custom(validatePassword).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

function getAll(req, res, next) {
    accountService.getAll(req.query)
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getAllUserNames(req, res, next) {
    accountService.getAllUserNames(req)
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getAllActiveUsers(req, res, next) {
    accountService.getAllActiveUsers(req)
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getById(req, res, next) {
    // users can get their own account and admins can get any account
    // if (Number(req.params.id) !== req.user.id) {
    //     return res.status(401).json({ message: 'Unauthorized' });
    // }

    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}




function getUserInfo(req, res, next) {
    //const { email } = req.params.email;
    //console.log(req.params.email);
    accountService.getUserInfo(req.params)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}


function getUserbyRole(req, res, next) {

    accountService.getUserbyRole(req.params)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}


function getUserInfobyRole(req, res, next) {

    accountService.getUserInfobyRole(req.params)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

function createSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().empty(''),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(12).max(128).custom(validatePassword).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User, Role.practitioner, Role.client).required()
    });
    validateRequest(req, next, schema);
}

function create(req, res, next) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

function updateSchema(req, res, next) {
    const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        id: Joi.string().required(),
        role: Joi.number().integer().required(),
    });
    validateRequest(req, next, schema);
}

function update(req, res, next) {
    // users can update their own account and admins can update any account
    // if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
    //     return res.status(401).json({ message: 'Unauthorized' });
    // }

    accountService.update(req)
        .then(account => res.json(account))
        .catch(next);
}

function updateStatusSchema(req, res, next) {
    const schema = Joi.object({
        id: Joi.string().required(),
        isActive: Joi.boolean().required(),
    });
    validateRequest(req, next, schema);
}

function updateStatus(req, res, next) {
    accountService.updateStatus(req)
        .then(account => res.json(account))
        .catch(next);
}


function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.delete(req.params.id)
        .then(account => res.json(account))
        .catch(next);
}

function verify2FASchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().empty('').required(),
        otp: Joi.string().empty('').required(),
    });
    validateRequest(req, next, schema);
}

function verify2FA(req, res, next) {
    accountService.verify2FA(req)
        .then(({ refreshToken, csrfSessionHash, ...account }) => {
            setTokenCookie(res, refreshToken);
            setCsrfCookie(res, csrfSessionHash);
            res.json(account);
        })
	//.then(client => res.json(client))
        .catch(next);
}

//update profile

function updateProfileschema(req, res, next) {
    const schema = Joi.object({
        // title: Joi.string().empty(''),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        // clientid: Joi.number().empty(''),
        // locationid: Joi.number().empty(''),
        // phone: Joi.string().required(),
        // password: Joi.string()

    });
    validateRequest(req, next, schema);
}

function updateProfile(req, res, next) {
    accountService.updateprofile(req)
        .then(client => res.json(client))
        .catch(next);
}

function blotterSchema(req, res, next) {
    const schema = Joi.object({
        searchDate: Joi.date().iso().required(),
        searchPit: Joi.string().trim().max(100).allow('').default(''),
        searchUser: Joi.string().trim().max(100).allow('').default('')
    });
    validateRequest(req, next, schema);
}

function blotterRecordingsSchema(req, res, next) {
    const schema = Joi.object({
        searchDate: Joi.date().iso().required(),
        searchPitID: Joi.string().guid({ version: 'uuidv4' }).allow('').default(''),
        searchPitName: Joi.string().trim().max(100).required()
    });
    validateRequest(req, next, schema);
}

function getBlotter(req, res, next) {
   const {searchDate, searchPit, searchUser } = req.body;

    accountService.getBlotter(req, res, searchDate, searchPit, searchUser)
        .catch(next);
}

function getBlotterRecordings(req, res, next) {
   const {searchDate, searchPitID, searchPitName } = req.body;

    accountService.getBlotterRecordings(req, searchDate, searchPitID, searchPitName)
        .then(client => res.json(client))
        .catch(next);
}

function getprofile(req, res, next) {
    accountService.getprofile(req)
        .then(client => res.json(client))
        .catch(next);
}

function getJitsiToken(req, res, next) {
    const pitID = req.params.id;
    accountService.getJitsiToken(req, pitID)
        .then(client => res.json(client))
        .catch(next);
}

function updateUserInfobyRoleschema(req, res, next) {

    const schema = Joi.object({

        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().empty(''),
        // clientid: Joi.number().empty(''),
        // locationid: Joi.number().empty(''),
        phone: Joi.string().required(),
        // locationmap:Joi.string(),
        // rolemap:Joi.string().empty('')



    });
    validateRequest(req, next, schema);
}
function updateUserInfobyRole(req, res, next) {

    accountService.updateUserInfobyRole(req.params.id, req.body, req.get('origin'))
        .then(client => res.json(client))
        .catch(next);

}

// helper functions

function setTokenCookie(res, token) {
    const cookieOptions = {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        path: '/',
        maxAge: config.session.refreshToken * 60 * 1000
    };
    res.cookie(REFRESH_COOKIE, token, cookieOptions);
}

function uuidParam(req, res, next) {
    const { error } = Joi.string().guid({ version: 'uuidv4' }).validate(req.params.id);
    if (error) return res.status(400).json({ message: 'Invalid identifier' });
    next();
}

function clearTokenCookie(res) {
    res.clearCookie(REFRESH_COOKIE, { secure: config.cookieSecure, sameSite: config.cookieSameSite, path: '/' });
}
