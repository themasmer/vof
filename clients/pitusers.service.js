// const { Op } = require('sequelize');
const db = require('_helpers/db');
const role = require('../_helpers/role');
// const Op = require('@sequelize/core');
const { Op } = require("sequelize");
const config = require('config.json');
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

let findDuplicates = arr => arr.filter((item, index) => arr.indexOf(item) !== index);

async function setPitUsers(req) {
    try {
	const params = req.body;
        moderators = params.moderators && params.moderators.split(',') || [];
        //marketmakers = params.marketmakers && params.marketmakers.split(',') || [];
        users = params.users && params.users.split(',') || [];

        var duplicateIds = findDuplicates([...moderators, ...users])

        if (duplicateIds.length > 0) {
            throw 'Same user assigned with multiple roles';
        }

        moderators.forEach(async element => {
            const _userid = element;
            const pitUser = await db.PitUsers.findAll({ where: { pitId: params.pitId, userId: _userid } });
            if (pitUser.length > 0) {
                await db.PitUsers.update(
                    { role: 2 },
                    { where: { pitId: params.pitId, userId: element } }
                );
            }
            else {
                try {
                    const userpit = new db.PitUsers({ pitId: params.pitId, userId: _userid, role: 2 });
                    // save UserPit Assignment
                    await userpit.save();
                    var account = await db.Account.findOne({ where: { UserId: _userid } });
                    var pit = await db.Pits.findOne({ where: { PitID: params.pitId } });
                    sendPitInviteEmail(account, pit, "Moderator");
		    var message = { "UserId": _userid, "PitId": params.pitId, "Action": "Added to pit" }
                    logMessage('pitusers', message, req);
                } catch (error) {
                }
            }
        });

        users.forEach(async element => {
            const _userid = element;
            const pitUser = await db.PitUsers.findAll({ where: { pitId: params.pitId, userId: _userid } });
            if (pitUser.length > 0) {
                await db.PitUsers.update(
                    { role: 4 },
                    { where: { pitId: params.pitId, userId: element } }
                );
            }
            else {
                try {
                    const userpit = new db.PitUsers({ pitId: params.pitId, userId: _userid, role: 4 });
                    // save UserPit Assignment
                    await userpit.save();
                    var account = await db.Account.findOne({ where: { UserId: _userid } });
                    var pit = await db.Pits.findOne({ where: { PitID: params.pitId } });
                    sendPitInviteEmail(account, pit, "User");
		    var message = { "UserId": _userid, "PitId": params.pitId, "Action": "Added to pit" }
                    logMessage('pitusers', message, req);
                } catch (error) {
                }
            }
        });

            //WHERE pitusers.pitId = '${params.pitId}' AND accounts.UserId not in (${[...moderators, ...users].map(function (item) { return "'" + item + "'" }).join(',')});`	 
	var usersForDeleteQuery = `Select accounts.UserId, accounts.firstName, accounts.lastName, accounts.email, pitusers.role, pits.pitName FROM pitusers 
            JOIN accounts on pitusers.userId = accounts.UserId AND accounts.isActive = true
            JOIN pits on pitusers.pitId = pits.PitID
            WHERE pitusers.pitId = :PITID AND accounts.UserId not in (${[...moderators, ...users].map(function (item) { return "'" + item + "'" }).join(',')});`

        const pitusers = await sequelize.query(usersForDeleteQuery, {
            replacements: { PITID: params.pitId },
            type: sequelize.QueryTypes.SELECT,
        });

            //WHERE pitId = '${params.pitId}' AND userId = '${pitusers[userIndex].UserId}'`;
        for (let userIndex = 0; userIndex < pitusers.length; userIndex++) {
            var deletQuery = `DELETE FROM pitusers
            WHERE pitId = :PITID AND userId = :USERID`;
            await sequelize.query(deletQuery, {
                replacements: { PITID: params.pitId, USERID: pitusers[userIndex].UserId },
                type: sequelize.QueryTypes.DELETE,
            });
            var role = pitusers[userIndex].role == 2 ? "Moderator" : "User";
            var message = { "UserId": pitusers[userIndex].UserId, "PitId": params.pitId, "Action": "Removed from pit" }
            logMessage('pitusers', message, req);
            sendPitRemovalEmail(pitusers[userIndex], role);
        }

        return { message: "Users assigned to Pits Successfully!" };
    } catch (error) {
        throw error;
    }
}

async function getAllUserPits(_userId) {
    // const [userpits] = await sequelize.query(`SELECT pitId, pitusers.role, pits.pitName FROM pitusers JOIN pits on pits.id = pitusers.pitId WHERE userId=:userId` , {
    //     replacements: { userId: _userId },
    //     type: sequelize.QueryTypes.SELECT
    // });

    const [userpits] = await sequelize.query(`SELECT pitusers.pitId, pitusers.role, pits.pitName FROM pitusers JOIN pits on pits.PitID = pitusers.pitId WHERE userId=${sequelize.escape(_userId)} AND pits.isActive = 1`);
    return userpits;

    // const pits = await db.PitUsers.findAll({
    //     attributes: ['role'],
    //     include: [
    //         { model: db.Pits, attributes: ['id', 'pitName'] }, 
    //         // { model: db.Account,  }
    //     ],
    //     where: { userId: _userId }
    // }).then(function (params) {
    //     console.log(params);
    //     return params;
    // });
    // return pits;
}

async function getAllPitUsers(pitid) {
    const [pitusers] = await sequelize.query(`SELECT accounts.UserId, pitId, pitusers.role, firstName, lastName  FROM pitusers JOIN accounts on accounts.UserId = pitusers.userId WHERE pitid=${sequelize.escape(pitid)} AND accounts.isActive = true`);

    // const pits = await db.PitUsers.findAll({
    //     attributes: ['role'],
    //     include: [
    //         { model: db.Pits, attributes: ['id', 'pitName'] }, 
    //         // { model: db.Account,  }
    //     ],
    //     where: { userId: _userId }
    // }).then(function (params) {
    //     console.log(params);
    //     return params;
    // });
    return pitusers;
}

async function sendPitInviteEmail(account, pit, role) {
    let message;
    var fileContents = fs.readFileSync('./emailtemplates/User_Pit_Invite_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{pit_name}}/g, pit.pitName);
    fileContents = fileContents.replace(/{{pit_user_role}}/g, role);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Pit Assignment',
            html: `${message}`
        });
    }
    return "successful, Invite sent to pit";
}

async function sendPitRemovalEmail(account, role) {
    let message;
    var fileContents = fs.readFileSync('./emailtemplates/Pit_Removal_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{pit_name}}/g, account.pitName);
    fileContents = fileContents.replace(/{{pit_user_role}}/g, role);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
   
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Pit Removal',
            html: `${message}`
        });
    }
    
    return "successful, removed from pit";
}
