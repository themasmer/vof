const crypto = require("crypto");
const db = require('_helpers/db');
const { Op } = require('sequelize');
const logMessage = require('_middleware/audit-log');

module.exports = {
    createPit,
    getPitById,
    getAllPits,
    getAllPitNames,
    setPitStatus,
    updatePit
};

async function setPitStatus(req) {
    var params = req.body;
    const pit = await db.Pits.findOne({
        where: { PitID: params.id }
    });

    const _pit = JSON.parse(JSON.stringify(pit));
    // await sequelize.query("UPDATE pits set isActive = " + params.isActive + " where id = " + params.id + " ;");
    // return "Pit Status Updated succesfully";
    await db.Pits.update(
        { isActive: params.isActive},
        { where: { PitID: params.id } }
    )
    var message = {};

    if (_pit.isActive !== params.isActive){
        message["isActive"] = _pit.isActive;
    }

    if (Object.keys(message).length !== 0) {
        message["PitId"] = _pit.PitID;
        await logMessage('pits', message, req);
    }
    return { message: 'Pit Status Changed Successfully' };
}

async function updatePit(req) {
    var params = req.body;
    const pit = await db.Pits.findOne({
        where: { PitID: params.Id }
    });

    var pitName = params.pitName.trim();

    const _pit = JSON.parse(JSON.stringify(pit));

    if (pitName) {
        if (await db.Pits.findOne({
            where: { [Op.and]: [{ pitName: params.pitName, PitID: { [Op.ne]: params.Id } }] }
        })) {
            return JSON.stringify({ message: "Pitname Already Exists" });
        }
    }


    await db.Pits.update(
        { pitName: pitName },
        { where: { PitID: params.Id } }
    )

    var message = {};

    if (_pit.pitName !== pitName) {
        message["pitName"] = _pit.pitName;
    }

    if (Object.keys(message).length !== 0) {
        message["PitId"] = _pit.PitID;
        await logMessage('pits', message, req);
    }
    return JSON.stringify({ message: 'Pit Updated Successfully' });
}

function basicPitDetails(pit) {
    const { PitID : Id, pitName, isActive } = pit;
    return { Id, pitName, isActive };
}

async function getAllPitNames(req) {
    const pits = await db.Pits.findAll({ attributes: [['PitID', 'id'], 'pitName'] });
    return pits;
}

async function getAllPits(params) {
    const draw = params.draw;
    const start = Math.max(0, Number.parseInt(params.start, 10) || 0);
    const length = Math.min(100, Math.max(1, Number.parseInt(params.length, 10) || 25));
    const allowedColumns = ['createdAt', 'pitName', 'isActive'];
    const requestedColumn = params.order?.[0] && params.columns?.[params.order[0].column]?.data;
    const columnName = allowedColumns.includes(requestedColumn) ? requestedColumn : 'createdAt';
    const sortOrder = params.order?.[0]?.dir === 'asc' ? 'ASC' : 'DESC';
    const searchValue = String(params.search?.value || '').trim().slice(0, 100);
    const where = searchValue ? { pitName: { [Op.like]: `%${searchValue}%` } } : {};
    const totalRecords = await db.Pits.count();
    const { count, rows } = await db.Pits.findAndCountAll({ where, order: [[columnName, sortOrder]], offset: start, limit: length });
    const pits = await Promise.all(rows.map(async pit => {
        const assignments = await db.PitUsers.findAll({ where: { pitId: pit.PitID } });
        const activeAssignments = [];
        for (const assignment of assignments) {
            const account = await db.Account.findOne({ where: { UserId: assignment.userId, isActive: true } });
            if (account) activeAssignments.push({ assignment, account });
        }
        return {
            Id: pit.PitID,
            pitName: pit.pitName,
            isActive: pit.isActive,
            PitUsers: activeAssignments.length,
            Moderators: activeAssignments
                .filter(({ assignment }) => assignment.role === 2)
                .map(({ account }) => `${account.firstName} ${account.lastName}`)
                .join(',  ')
        };
    }));
    return {
        'draw': draw,
        'iTotalRecords': totalRecords,
        'iTotalDisplayRecords': count,
        'aaData': pits
    };
}

async function getPitById(params) {
    const pit = await db.Pits.findOne(({ where: { PitID: params.id } }));
    if (!pit) throw 'Pit not found';
    return basicPitDetails(pit);
}

async function createPit(req) {
    var params = req.body;
    if (params.pitName) {
        if (await db.Pits.findOne({
            where: { pitName: params.pitName }
        })) {
            return JSON.stringify({ message: "Pitname Already Exists" });
        }
    }

    // create account object
    const pit = new db.Pits(params);
    pit.PitID = crypto.randomUUID();
    // save account
    await pit.save();
    var message = {"PitID": pit.PitID, "Action" : "Pit Created"};
    await logMessage('pit', message, req);
    // return pit.Id;
    return JSON.stringify({ message: 'Pit Created Successfully' });
}
