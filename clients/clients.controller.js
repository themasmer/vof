const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const pitService = require('./client.service');
const { requireCsrf } = require('_middleware/csrf');

//session
router.post('/createPit', authorize([Role.Admin]), requireCsrf, createPitSchema, createPit);
router.post('/setPitStatus', authorize([Role.Admin]), requireCsrf, setPitStatusSchema,setPitStatus);
router.post('/updatePitDetails', authorize([Role.Admin]), requireCsrf, updatePitDetailsSchema, updatePitDetails);
router.get('/getPitById/:id', authorize([Role.Admin]), getPitById);
router.get('/getAllPits', authorize([Role.Admin]), getAllPits);
router.get('/getAllPitNames', authorize([Role.Admin]), getAllPitNames);

module.exports = router;

function setPitStatusSchema(req, res, next) {
    const schema = Joi.object({
        isActive: Joi.boolean().required(),
        id: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

function setPitStatus(req, res, next) {
    pitService.setPitStatus(req)
        .then(pit => res.json(pit))
        .catch(next);
}

function updatePitDetails(req, res, next) {
    pitService.updatePit(req)
        .then(pit => res.json(pit))
        .catch(next);
}

function updatePitDetailsSchema(req, res, next) {
    const schema = Joi.object({
        Id: Joi.string().guid({ version: 'uuidv4' }).required(),
        pitName: Joi.string().trim().min(1).max(100).required()
    });
    validateRequest(req, next, schema);
}

function getPitById(req, res, next) {
    pitService.getPitById(req.params)
        .then(pit => res.json(pit))
        .catch(next);
}

function getAllPits(req, res, next) {
    pitService.getAllPits(req.query)
        .then(pits => res.json(pits))
        .catch(next);
}

function getAllPitNames(req, res, next) {
    pitService.getAllPitNames(req.query)
        .then(pits => res.json(pits))
        .catch(next);
}

function createPitSchema(req, res, next) {
    const schema = Joi.object({
        pitName: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

function createPit(req, res, next) {
    pitService.createPit(req)
        .then(pit => res.json(pit))
        .catch(next);
}
