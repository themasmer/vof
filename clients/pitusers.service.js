// const { Op } = require('sequelize');
const db = require('_helpers/db');
const role = require('../_helpers/role');
// const Op = require('@sequelize/core');
const { Op } = require("sequelize");
const config = require('_helpers/config');
const { escapeHtml } = require('_helpers/html');
const sendEmail = require('_helpers/send-email');
const fs = require('fs');
const logMessage = require('_middleware/audit-log');

module.exports = {
    // createPit,
    // getPitById,
    getAllPitUsers,
    getAllUserPits,
    setPitUsers,
    // updatePit
};

async function setPitUsers(req) {
    const params = req.body;
    const moderators = splitUserIds(params.moderators);
    const users = splitUserIds(params.users);
    const assignments = [...moderators.map(userId => ({ userId, role: 2 })), ...users.map(userId => ({ userId, role: 4 }))];
    if (new Set(assignments.map(item => item.userId)).size !== assignments.length) throw 'Same user assigned with multiple roles';

    const pit = await db.Pits.findOne({ where: { PitID: params.pitId, isActive: true } });
    if (!pit) throw 'Pit not found';
    const accounts = await db.Account.findAll({ where: { UserId: { [Op.in]: assignments.map(item => item.userId) }, isActive: true } });
    if (accounts.length !== assignments.length) throw 'One or more users are invalid or inactive';

    const transaction = await db.sequelize.transaction();
    let removed = [];
    try {
        const existing = await db.PitUsers.findAll({ where: { pitId: params.pitId }, transaction });
        const selected = new Set(assignments.map(item => item.userId));
        removed = existing.filter(item => !selected.has(item.userId));
        for (const assignment of assignments) {
            const current = existing.find(item => item.userId === assignment.userId);
            if (current) await current.update({ role: assignment.role }, { transaction });
            else await db.PitUsers.create({ pitId: params.pitId, userId: assignment.userId, role: assignment.role }, { transaction });
        }
        if (removed.length) await db.PitUsers.destroy({ where: { Id: { [Op.in]: removed.map(item => item.Id) } }, transaction });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    const accountById = new Map(accounts.map(account => [account.UserId, account]));
    for (const assignment of assignments) {
        await logMessage('pitusers', { UserId: assignment.userId, PitId: params.pitId, Action: 'Assigned to pit' }, req);
        await sendPitInviteEmail(accountById.get(assignment.userId), pit, assignment.role === 2 ? 'Moderator' : 'User');
    }
    for (const assignment of removed) {
        const account = await db.Account.findOne({ where: { UserId: assignment.userId } });
        await logMessage('pitusers', { UserId: assignment.userId, PitId: params.pitId, Action: 'Removed from pit' }, req);
        if (account) await sendPitRemovalEmail({ ...account.toJSON(), pitName: pit.pitName }, assignment.role === 2 ? 'Moderator' : 'User');
    }
    return { message: 'Users assigned to Pits Successfully!' };
}

async function getAllUserPits(_userId) {
    const assignments = await db.PitUsers.findAll({ where: { userId: _userId } });
    const result = [];
    for (const assignment of assignments) {
        const pit = await db.Pits.findOne({ where: { PitID: assignment.pitId, isActive: true } });
        if (pit) result.push({ pitId: assignment.pitId, role: assignment.role, pitName: pit.pitName });
    }
    return result;
}

async function getAllPitUsers(pitid) {
    const assignments = await db.PitUsers.findAll({ where: { pitId: pitid } });
    const result = [];
    for (const assignment of assignments) {
        const account = await db.Account.findOne({ where: { UserId: assignment.userId, isActive: true } });
        if (account) result.push({ UserId: account.UserId, pitId: assignment.pitId, role: assignment.role, firstName: account.firstName, lastName: account.lastName });
    }
    return result;
}

function splitUserIds(value) {
    if (!value) return [];
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

async function sendPitInviteEmail(account, pit, role) {
    let message;
    var fileContents = fs.readFileSync('./emailtemplates/User_Pit_Invite_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, escapeHtml(account.firstName));
    fileContents = fileContents.replace(/{{pit_name}}/g, escapeHtml(pit.pitName));
    fileContents = fileContents.replace(/{{pit_user_role}}/g, escapeHtml(role));
    fileContents = fileContents.replace(/{{Your_Company}}/g, escapeHtml(config.company));
    message = fileContents;
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Pit Assignment',
            html: message
        });
    }
    return "successful, Invite sent to pit";
}

async function sendPitRemovalEmail(account, role) {
    let message;
    var fileContents = fs.readFileSync('./emailtemplates/Pit_Removal_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, escapeHtml(account.firstName));
    fileContents = fileContents.replace(/{{pit_name}}/g, escapeHtml(account.pitName));
    fileContents = fileContents.replace(/{{pit_user_role}}/g, escapeHtml(role));
    fileContents = fileContents.replace(/{{Your_Company}}/g, escapeHtml(config.company));
    message = fileContents;
   
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Pit Removal',
            html: message
        });
    }
    
    return "successful, removed from pit";
}
