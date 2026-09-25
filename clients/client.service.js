const crypto = require("crypto");
const DOMPurify = require('isomorphic-dompurify');
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
        logMessage('pits', message, req);
    }
    return { message: 'Pit Status Changed Successfully' };
}

async function updatePit(req) {
    var params = req.body;
    const pit = await db.Pits.findOne({
        where: { PitID: params.Id }
    });

    var pitName = DOMPurify.sanitize(params.pitName);

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
        logMessage('pits', message, req);
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
    var draw = params.draw;
    var start = params.start || 0;
    var length = params.length || 100;
    var order_data = params.order;
    var column_name = "";
    var column_sort_order = "";

    if (order_data === undefined) {
        column_name = 'createdAt';
        column_sort_order = 'desc';
    } else {
        var column_index = params.order[0]['column'];
        column_name = params.columns[column_index]['data'];
        column_sort_order = params.order[0]['dir'];
    }

    var search_value = (params.search && params.search['value']) || "";

    var search_query = `
     AND (pitName LIKE '%${search_value}%')`;

    var Pit_Count_Query = `SELECT  COUNT(*) AS Total FROM pits`;

    const _total_records = await sequelize.query(Pit_Count_Query);
    const total_records = _total_records[0][0].Total;

    var Pit_Search_Count_Query = `SELECT  COUNT(*) AS Total FROM pits WHERE 1 ${search_query}`;

    const _total_records_with_filter = await sequelize.query(Pit_Search_Count_Query);
    const total_records_with_filter = _total_records_with_filter[0][0].Total;

    var Pits_Query = `SELECT  PitID as Id, pitName, isActive, ( SELECT Count(*) FROM pitusers  JOIN accounts ON accounts.UserId = pitusers.UserId  WHERE pitId = pits.PitID  AND accounts.isActive = true) AS PitUsers, ( SELECT GROUP_CONCAT(CONCAT(firstName,' ', lastName) SEPARATOR ',  ') FROM pitusers INNER JOIN accounts ON pitusers.userId = accounts.UserId WHERE pitusers.role = 2  AND pitId = pits.PitID AND accounts.isActive = true ) AS Moderators FROM pits WHERE 1 ${search_query} ORDER BY ${column_name} ${column_sort_order} LIMIT ${start}, ${length}`;
    // if (params.limit !== undefined) {
    //     Pits_Query = Pits_Query + " Limit " + params.limit;
    // }
    // if (params.offset !== undefined) {
    //     Pits_Query = Pits_Query + " OFFSET " + params.offset;
    // }

    const [pits] = await sequelize.query(Pits_Query);
    return {
        'draw': draw,
        'iTotalRecords': total_records,
        'iTotalDisplayRecords': total_records_with_filter,
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
    logMessage('pit', message, req);
    // return pit.Id;
    return JSON.stringify({ message: 'Pit Created Successfully' });
}
