module.exports = logMessage;
async function logMessage(tableName, message, req){
    if (Object.keys(message).length !== 0) {
        const audits = new db.Audits();
        audits.tableName = tableName;
        audits.message = JSON.stringify(message);
        if (req.auth && req.auth.id)
            audits.UserId = req.auth.id;
        else if (message.UserId)
            audits.UserId = message.UserId;
        else
            audits.UserId = "--"; 
	audits.ipaddress = req.headers['x-real-ip']; //req.ip;
        await audits.save();
    }
}
