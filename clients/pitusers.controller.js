const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const pitService = require('./pitusers.service');
const { requireCsrf } = require('_middleware/csrf');
var url = require('url');

//session
router.post('/setPitUsers', authorize([Role.Admin]), requireCsrf, setPitUsersSchema, setPitUsers);
router.get('/getAllUserPits/:userId', authorize([Role.Admin, Role.User]), getAllUserPits);
router.get('/getAllPitUsers/:pitId', authorize([Role.Admin]), getAllPitUsers);
module.exports = router;

function setPitUsersSchema(req, res, next) {
    const schema = Joi.object({
        pitId: Joi.string().guid({ version: 'uuidv4' }).required(),
        moderators: Joi.string().allow('').default(''),
        users: Joi.string().allow('').default('')
    });
    validateRequest(req, next, schema);
}

function setPitUsers(req, res, next) {
    try {
        pitService.setPitUsers(req)
        .then(pit => res.json(pit))
        .catch(next);
        //return res.status(200).json({ message: "Users assigned to Pits Successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error });
    }
}

function getAllUserPits(req, res, next) {
    if (req.params.userId === undefined) // query.userId
        return res.status(400).json({ message: "Invalid Url" });
    if (req.auth.role !== Role.Admin && req.params.userId !== req.auth.id) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    pitService.getAllUserPits(req.params.userId)
        .then(pits => res.json(pits))
        .catch(next);
}

function getAllPitUsers(req, res, next) {
    if (req.params.pitId === undefined) // query.pitId
        return res.status(400).json({ message: "Invalid Url" });

    pitService.getAllPitUsers(req.params.pitId)
        .then(pits => res.json(pits))
        .catch(next);
}
