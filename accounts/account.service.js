const config = require('_helpers/config');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const { Op } = require('sequelize');
const sendEmail = require('_helpers/send-email');
// const sendSms = require('_helpers/send-sms');
const db = require('_helpers/db');
const Role = require('_helpers/role');
// const clientService = require('clients/client.service');
const fs = require('fs');
const logMessage = require('_middleware/audit-log');
const { escapeHtml } = require('_helpers/html');
const { assertPasswordPolicy } = require('_helpers/password-policy');

module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    setPassword,
    resetPassword,
    changepassword,
    getAll,
    getAllActiveUsers,
    getAllUserNames,
    getById,
    create,
    update,
    // getparticipantName,
    getBlotter,
    getBlotterRecordings,
    getprofile,
    updateprofile,
    updateStatus,
    getJitsiToken,
    verify2FA,
    getCsrfSession,
    // createhashpassword
};

async function authenticate(req) {
    const { email, password } = req.body;
    const account = await db.Account.scope('withHash').findOne({ where: { email } });
    const validPassword = account && account.isVerified && account.isActive && await bcrypt.compare(password, account.passwordHash);

    // Deliberately use one response for unknown, inactive, unverified, and invalid-password accounts.
    if (!validPassword) {
        if (account) await db.Account.increment('failedAttempts', { by: 1, where: { id: account.id } });
        throw 'Invalid username or password';
    }

    const otp = crypto.randomInt(10000000, 100000000).toString();
    account.otp = hashToken(otp);
    account.otpCreatedon = new Date();
    account.failedAttempts = 0;
    await account.save();
    await send2faEmail(account, otp);
    await logMessage('accounts', { UserId: account.UserId, Action: 'Login requested' }, req);
    return { message: 'If the credentials are valid, a one-time passcode has been sent.' };
}

async function updateStatus(req) {
    var params = req.body;
    const account = await db.Account.findOne(({ where: { UserId: params.id } }));
    if (!account) return 'Account not found';

    const _account = JSON.parse(JSON.stringify(account));

    //check if email already registered
    if (params.isActive) {

        account.isActive = params.isActive;
    }

    Object.assign(account, params);
    account.updated = Date.now();
    if (!account.isActive) {
        account.sessionHash = null;
        await revokeAllRefreshTokens(account, req.ip);
    }
    await account.save();

    var message = {};

    if (_account.isActive !== account.isActive){
        message["isActive"] = _account.isActive;
    }

    if (Object.keys(message).length !== 0) {
        message["UserId"] = account.UserId;
        await logMessage('accounts', message, req);
    }

    return {message: "Updated successfully"};
}

async function getUserInfo(params) {


    //const account = await db.Account.findOne(({ where: { email: params.email } }));
    const account = await db.Account.findOne(({ where: { [Op.or]: [{ email: params.email }, { phone: params.email }] } }));
    if (!account) throw 'Account not found';
    var locationName = "";
    var rolemap = "";
    // if(account.locationid != null && account.locationid != 0)
    // {
    // locationName = (await  clientService.getLocationName({"lid" : account.locationid}))[0].locationName;
    // }

    if (account.role == "User") {

        const [accounts, metadata] = await sequelize.query("select GROUP_CONCAT(l.locationName SEPARATOR ', ') as locationName from locations l join userlocations u on u.locationId = l.id where u.accountId =  " + account.id + ";");
        const values = accounts.map(x => {

            const { locationName } = x;
            return { locationName };

        });
        locationName = values[0].locationName;

    }


    //get the user secondary roles
    const [accounts, metadata] = await sequelize.query("select  GROUP_CONCAT(role SEPARATOR ', ') as rolemap from roles where accountId = " + account.id + ";");
    const values = accounts.map(x => {

        const { rolemap } = x;
        return { rolemap };

    });
    rolemap = values[0].rolemap;



    const { id, title, firstName, lastName, email, role} = account;
    return { id, title, firstName, lastName, email, role, phone, rolemap };


}

async function getUserInfoById(params) {


    //const account = await db.Account.findOne(({ where: { email: params.email } }));
    const account = await db.Account.findOne(({ where: { id: params.userid } }));
    if (!account) return 'Account not found';

    const [accounts, metadata] = await sequelize.query("select a.id,a.title,a.firstName,a.lastName,a.phone as phone,a.email as email,a.role,a.clientid ,l.id as locationid,c.clientName,l.locationName from accounts a left outer join clients c ON c.id = a.clientid left outer join userlocations u on u.accountId = a.id left outer join locations l on l.id = u.locationid where a.id = " + params.userid);

    const values = accounts.map(x => {

        const { id, title, firstName, lastName, email, role, phone } = x;
        return { id, title, firstName, lastName, email, role, phone };

    });
    return values;



}

async function updateUserInfobyRole(userid, params) {
    const account = await db.Account.findOne(({ where: { id: userid } }));
    if (!account) return 'Account not found';


    //check if email already registered
    if (params.email) {

        if (params.email != "null") {
            const oldaccount = await db.Account.findOne({ where: { email: params.email } });
            if (oldaccount) {
                if (oldaccount.id != account.id) {
                    return "This email is already registered";
                }
            }
        }
        else
            params.email = "";


    }

    //check if phone is already registered
    if (params.phone) {
        const oldaccount = await db.Account.findOne({ where: { phone: params.phone } });
        if (oldaccount) {
            if (oldaccount.id != account.id) {
                return "This phone number is already registered";
            }
        }
    }
    
    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();
    

    return "updated successfully";

}


async function getUserbyRole(params) {



    if (params.role == "User") {
        // const [results, metadata] = await sequelize.query("select a.id,a.firstName,a.lastName,IFNULL(l.locationName, 'All locations') AS locationName,max(date(s.sessionDate)) as recentdate,a.phone as phone,a.email as email , a.clientid ,r.role, IFNULL(c.clientName, 'All clients') AS clientName  from accounts a left outer join roles r on a.id = r.accountId  left outer join clients c on a.clientid = c.id left outer join locations l ON l.id = a.locationid  left join sessions s ON s.patientId = a.id where r.role = 'User'  group by a.id,a.firstName,l.locationName order by a.firstName");
        //const [results, metadata] = await sequelize.query("select a.id,a.firstName,a.lastName,l.id, IFNULL(GROUP_CONCAT(l.locationName SEPARATOR ', '),'All locations') AS locationName,max(date(s.sessionDate)) as recentdate,a.phone as phone,a.email as email , a.clientid ,r.role, IFNULL(c.clientName, 'All clients') AS clientName  from accounts a left outer join roles r on a.id = r.accountId left outer join userlocations u on u.accountId = a.id left outer join clients c on a.clientid = c.id left outer join locations l ON l.id = u.locationid  left join sessions s ON s.patientId = a.id where r.role = 'User'  group by a.id order by a.firstName");
        const [results, metadata] = await sequelize.query("SELECT  a.id , a.phone, a.firstName, a.lastName, a.email, IFNULL(GROUP_CONCAT(distinct l.locationName ORDER BY l.locationName ASC SEPARATOR ', '),'All locations') as locationName, MAX(s.sessionDate) AS recentdate,IFNULL(c.clientName ,'All clients') AS clientName FROM accounts a left outer JOIN userlocations u ON a.id = u.accountId left outer JOIN locations l ON u.locationId = l.id left outer JOIN clients c ON a.clientid = c.id LEFT JOIN sessions s ON a.id = s.patientId LEFT JOIN  roles r ON r.accountId = a.id  where r.role = 'User' GROUP BY a.id, a.firstName, a.lastName, a.email, c.clientName;");
        const values = results.map(x => {
            const firstName = x.firstName + " " + x.lastName;
            var recentdate = x.recentdate;

            //  if(recentdate != null)
            // recentdate = moment(x.recentdate,"DD/MM/YYYY hh:mm A").format("DD/MM/YYYY hh:mm A");

            const { id, email, phone, role, clientName, locationName } = x;
            return { id, firstName, email, phone, role, clientName, locationName, recentdate };
        });
        return values;
    }
    else if (params.role == "Client") {
        // const accounts = await db.Account.findAll(({ where: { role: params.role} }));
        const [accounts, metadata] = await sequelize.query("select a.id,a.title,a.firstName,a.lastName,a.phone as phone,a.email as email,r.role,a.clientid ,c.clientName from roles r join accounts a on r.accountId = a.id join clients c ON c.id = a.clientid where r.role = 'Client' group by a.id,a.firstName,c.clientName order by a.firstName");

        const values = accounts.map(x => {
            const firstName = x.firstName + " " + x.lastName;
            const { id, title, email, role, clientid, clientName, phone } = x;
            return { id, title, firstName, email, role, clientid, clientName, phone };

        });


        return values;
    }
    else if (params.role == Role.Admin) {

        /*   const accounts = await db.Account.findAll(({ where: { role: params.role} }));
          const values = accounts.map(x => 
              {
                  const firstName = x.firstName +" " + x.lastName;
                  const { id, title,  email, role,phone} = x;
                  return {  id, title, firstName,  email, role,phone };
          
              });
  
         
          return values; */


        const [accounts, metadata] = await sequelize.query("select distinct r.role,a.firstName,a.lastName,a.id,a.title,a.email,a.phone from roles r join accounts a on a.id = r.accountId where r.role = '" + params.role + "' ;");
        const values = accounts.map(x => {
            const firstName = x.firstName + " " + x.lastName;
            const { id, title, email, role, phone } = x;
            return { id, title, firstName, email, role, phone };

        });


        return values;

    }



}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();
    if (!account || !account.isActive || !account.sessionHash) throw 'Invalid token';

    // replace old refresh token with a new one and save
    const { refreshToken: newRefreshToken, token: newToken } = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newToken,
        csrfSessionHash: account.sessionHash
    };
}

async function revokeToken(req) {
    const account = await db.Account.findOne({where : { UserId: req.auth.id, sessionHash: req.auth.sessionHash } });
    if (account) {
        account.sessionHash = null;
        await account.save();
        await revokeAllRefreshTokens(account, req.ip);
        await logMessage('accounts', { UserId: account.UserId, Action: 'User logged out' }, req);
    } 
}

async function register(req) {
    var params = req.body;
    if (params.email) {
        // validate
        if (await db.Account.findOne({
            where: {
                [Op.or]: [
                    { email: params.email }
                ]
            }
        })) {
            // send already registered error in email to prevent account enumeration
            //return await sendAlreadyRegisteredEmail(params.email, origin);
            return "Already Registered";
        }
    }
    else {
        params.email = "";
        // validate
        if (await db.Account.findOne({ where: { phone: params.phone } })) {
            return "Already Registered";
        }
    }
    // create account object
    const account = new db.Account(params);
    // first registered account is an admin
    // const isFirstAccount = (await db.Account.count()) === 0;
    //if(isFirstAccount)
    //account.role =  Role.Admin;
    account.UserId = crypto.randomUUID();
    const verificationToken = randomTokenString();
    account.verificationToken = hashToken(verificationToken);
    account.resetTokenExpires = new Date(Date.now() + config.verification.validMinutes * 60 * 1000);
    // hash password
    account.passwordHash = ""; //await hash(params.password);
    // save account
    await account.save();
    var message = {"UserID": account.UserId, "Action" : "User Created"};
    await logMessage('accounts', message, req);
    // send email or sms
    return await sendVerificationEmail(account, verificationToken);
}

async function verifyEmail({ token }) {
    const account = await db.Account.findOne({ where: { verificationToken: hashToken(token), resetTokenExpires: { [Op.gt]: Date.now() } } });
    if (!account) throw 'Verification failed';
    account.verified = Date.now();
    account.verificationToken = null;
    account.resetTokenExpires = null;
    await account.save();
}

async function changepassword(req) {
    var id = req.auth.id;
    var params = req.body;
    const validTill =config.passwordReset.validMinutes;

    const account = await getAccount(id);
    // hash password
    // account.passwordHash = await hash(params.password);
    const resetToken = randomTokenString();
    account.resetToken = hashToken(resetToken);
    account.resetTokenExpires = new Date(Date.now() + validTill * 60 * 1000);
    // if (account.verificationToken == "new user")
    //     account.verificationToken = null;
    // save account
    await account.save();
    var message = { "UserID" : account.UserID, "Action": "Change Password Requested" }
    if (Object.keys(message).length !== 0) {
        await logMessage('accounts', message, req);
    }
    await sendPasswordResetEmail(account, resetToken);
}

// async function createhashpassword() {
//     const [accounts, metadata1] = await sequelize.query("select id,passwordHash from accounts ");//where verificationToken = 'Migrated User';");
//     accounts.map(async x => {
//         var pwd = await hash(x.passwordHash);
//         var vt = randomTokenString();
//         const [results, metadata] = await sequelize.query("update accounts set passwordHash = '" + pwd + "' where id = " + x.id + ";");
//         const [results1, metadata1] = await sequelize.query("update accounts set verificationToken = '" + vt + "' where id = " + x.id + ";");
//         const [results2, metadata2] = await sequelize.query("update accounts set verified = NULL where id = " + x.id + ";");
//         console.log(pwd);
//     });
// }

async function forgotPassword(req) {
    var email = req.body.email;
    const account = await db.Account.findOne({ where: { [Op.or]: [{ email: email }] } });
    const validTill = config.passwordReset.validMinutes;


    // Always return the same public result to prevent account enumeration.
    if (!account || account.isActive === false) return;


    // create reset token that expires after 60 mins (config.json)
    const resetToken = randomTokenString();
    account.resetToken = hashToken(resetToken);
    account.resetTokenExpires = new Date(Date.now() + validTill * 60 * 1000);
    await account.save();

    var message = { "EmailID": email, "Action": "Forgot Password Requested" };
    await logMessage('accounts', message, req);
    // send email
    await sendPasswordResetEmail(account, resetToken);
}

async function validateResetToken({ token }) {
    const account = await db.Account.findOne({
        where: {
            resetToken: hashToken(token),
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });

    if (!account) throw 'Invalid token';

    return account;
}

async function validateVerificationToken({ token }) {
    const account = await db.Account.findOne({
        where: {
            verificationToken: hashToken(token),
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });

    if (!account) throw 'Invalid token';

    return account;
}

async function resetPassword({ token, password }) {
    const account = await validateResetToken({ token });

    // update password and remove reset token
    await assertPasswordPolicy(password);
    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.resetToken = null;
    account.resetTokenExpires = null;
    account.sessionHash = null;
    await account.save();
    await revokeAllRefreshTokens(account);
    await sendPasswordResetConfirmationEmail(account);
}

async function setPassword({ token, password }) {
    const account = await validateVerificationToken({ token });

    // update password and remove reset token
    await assertPasswordPolicy(password);
    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.verificationToken = null;
    account.resetTokenExpires = null;
    await account.save();
}

async function getAllUserNames(req) {
    const accounts = await db.Account.findAll({ attributes: [['UserId', 'Id'], 'firstName', 'lastName'] });
    return accounts;
}

async function getAllActiveUsers(req) {
    const accounts = await db.Account.findAll({ where: { isActive: true } });
    return accounts.map(x => basicDetails(x));
}

async function getAll(params) {
    const draw = params.draw;
    const start = Math.max(0, Number.parseInt(params.start, 10) || 0);
    const length = Math.min(100, Math.max(1, Number.parseInt(params.length, 10) || 25));
    const allowedColumns = ['createdAt', 'firstName', 'lastName', 'email', 'role', 'isActive'];
    const requestedColumn = params.order?.[0] && params.columns?.[params.order[0].column]?.data;
    const columnName = allowedColumns.includes(requestedColumn) ? requestedColumn : 'createdAt';
    const columnSortOrder = params.order?.[0]?.dir === 'asc' ? 'ASC' : 'DESC';
    const searchValue = String(params.search?.value || '').trim().slice(0, 100);
    const where = searchValue ? {
        [Op.or]: ['firstName', 'lastName', 'email'].map(field => ({ [field]: { [Op.like]: `%${searchValue}%` } }))
    } : {};
    const totalRecords = await db.Account.count();
    const { count, rows } = await db.Account.findAndCountAll({
        where,
        attributes: [['UserId', 'id'], 'firstName', 'lastName', 'email', 'role', 'isActive', 'verified', 'verificationToken'],
        order: [[columnName, columnSortOrder]],
        offset: start,
        limit: length,
        raw: true
    });
    const accounts = rows.map(account => ({
        ...account,
        isVerified: Boolean(account.verified && !account.verificationToken),
        verificationToken: undefined
    }));
    return {
        'draw': draw,
        'iTotalRecords': totalRecords,
        'iTotalDisplayRecords': count,
        'aaData': accounts
    };
}

async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function create(params) {
    // validate
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    await assertPasswordPolicy(params.password);
    const account = new db.Account(params);
    account.verified = Date.now();
    account.updated = Date.now();

    // hash password
    account.passwordHash = await hash(params.password);

    // save account
    await account.save();

    return basicDetails(account);
}

async function updateprofile(req) {
    var id = req.auth.id;
    var params = req.body;
    const account = await getAccount(id);
    const _account = JSON.parse(JSON.stringify(account));
    var sendchangeemail = false;
    let verificationToken;
    // copy params to account and save
    if (params.email && account.email !== params.email && await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already taken';
    } else if (account.email !== params.email){
        sendchangeemail = true;
        verificationToken = randomTokenString();
        account.verificationToken = hashToken(verificationToken);
        account.resetTokenExpires = new Date(Date.now() + config.verification.validMinutes * 60 * 1000);
        account.verified = null;
    }
    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();
    var message = {};

    if (_account.firstName !== account.firstName){
        message["firstName"] = _account.firstName;
    }

    if (_account.lastName !== account.lastName){
        message["lastName"] = _account.lastName;
    }

    if (_account.email !== account.email){
        message["email"] = _account.email;
    }

    if (Object.keys(message).length !== 0) {
        message["UserId"] = account.UserId;
        await logMessage('accounts', message, req);
    }

    if (sendchangeemail) {
        account.sessionHash = null;
        await account.save();
        await revokeAllRefreshTokens(account, req.ip);
        await sendChangeOfEmail(account, verificationToken);
    }

    return basicUserInfo(account);
}

async function getBlotterRecordings(req, searchDate, searchPitID, searchPitName){
    const fs = require('fs')
    var results = [];
    const pit_name = searchPitName.toLowerCase()
    var today = Date.parse(searchDate);
    today = new Date(today).toISOString().slice(0, 10);
    const homepath = '/var/log/recordings/blotterVideo';

    //var files = fs.readdirSync(path).filter(fn => fn.includes(today));
    const dirs = fs.readdirSync(homepath).filter(function (file) {return fs.statSync(homepath+'/'+file).isDirectory();});
    const scanPit = searchPitID==""?true:false;

    dirs.map(function (dir) {
        var path = `${homepath}/${dir}`;

        var files = fs.readdirSync(path).filter(fn => fn.includes(today));
        files.map(function (name) {
            if (scanPit || name.includes(pit_name)) {

                const stats = fs.statSync(path + "/" + name);
                const birthtime = new Date(stats.birthtime);
                const fileSize =  (stats.size/(1024*1024)).toFixed(2);
                results.push({Filename:name, Created:birthtime, Size:fileSize, ID:dir});
            }
        });

    });

    return results;
}

async function getBlotter(req, res, searchDate, searchPit, searchUser){
    var id = req.auth.id;
    const csv = require('csv-parser')
    const fs = require('fs')
    const results = [];
    const scanPit = searchPit==""?false:true;
    const scanUser = searchUser==""?false:true;
    const homepath = '/var/log/recordings/blotterLog';

    var today = Date.parse(searchDate);
    today = new Date(today).toISOString().slice(0, 10);
    const filename = `${homepath}/${today}.log`

    if (scanPit)
        searchPit = decodeURI(searchPit).toLowerCase() + '@muc.meet.jitsi';

    await fs.createReadStream(filename)
        .pipe(csv(['Timestamp','UserID','DisplayName','PitName','MessageID','Message']))
	.on('data', async function (data) {
            var match = false;
            if (scanPit) {
                if (decodeURI(data.PitName).toLowerCase() === searchPit){
                    match = true;
                } else {
		            match = false;
		        }
            }
            else {
                match = true;
            }

            if (scanUser) {
                if (data.UserID == searchUser){
                    match = match && true;
                }
                else {
                    match = false;
                }
            }
            else {
                //match = match && true;
            }
	    //console.log(match)

            if (match === true) {
                data.Message = data.Message.replace("[CLOSED]","[COMPLETED]");
                data.Message = data.Message.replace("[CANCEL]","[CANCELLED]");
		data.PitName = data.PitName.replace(/%20/g, " ");
	        results.push(data);
            }
	})
        .on('end', () => {
            //console.log(results);
            res.send(results);
        });
}

async function verify2FA(req) {
    var params = req.body;
    const account = await db.Account.scope('withHash').findOne({ where: { email: params.email } });
    const ALLOWED_ATTEMPTS = config.otp.allowedAttempts;
    const OTP_VALID_MINUTES = config.otp.validMinutes;

    const staleOtp = new Date(Date.now() - (OTP_VALID_MINUTES * 60 * 1000));
    const validOtp = account && account.isActive && account.otp && account.otpCreatedon >= staleOtp && safeTokenMatch(account.otp, hashToken(params.otp));
    if (!validOtp) {
        if (account) {
            await db.Account.increment('failedAttempts', { by: 1, where: { id: account.id } });
        }
        throw 'Invalid one-time passcode';
    }

    const { refreshToken, token } = generateRefreshToken(account, req.ip);
    account.sessionHash = randomTokenString();
    const jwtToken = generateJwtToken(account);
    account.failedAttempts = 0;
    account.otp = null;
    account.otpCreatedon = null;
    await account.save();
    await refreshToken.save();
    await logMessage('accounts', { UserId: account.UserId, Action: 'Login verified' }, req);
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: token,
        csrfSessionHash: account.sessionHash
    };

}

async function getprofile(req){
    var id = req.auth.id;
    const account = await getAccount(id);

    return basicDetails(account);
}

async function update(req) {
    var id = req.body.id;
    var params = req.body;

    const account = await getAccount(id);
    const _account = JSON.parse(JSON.stringify(account));
    var sendchangeemail = false;
    let verificationToken;
    // validate (if email was changed)
    if (params.email && account.email !== params.email && await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already taken';
    } else if (account.email !== params.email){
        sendchangeemail = true;
        verificationToken = randomTokenString();
        account.verificationToken = hashToken(verificationToken);
        account.resetTokenExpires = new Date(Date.now() + config.verification.validMinutes * 60 * 1000);
        account.verified = null;
    }

    // // hash password if it was entered
    // if (params.password) {
    //     params.passwordHash = await hash(params.password);
    // }

    // copy params to account and save
    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();
    var message = {};

    if (_account.firstName !== account.firstName){
        message["firstName"] = _account.firstName;
    }
    if (_account.lastName !== account.lastName){
        message["lastName"] = _account.lastName;
    }

    if (_account.email !== account.email){
        message["email"] = _account.email;
    }

    if (_account.role !== account.role){
        message["role"] = _account.role;
    }

    if (Object.keys(message).length !== 0) {
        message["UserId"] = account.UserId;
        await logMessage('accounts', message, req);
    }
    if (sendchangeemail) {
        account.sessionHash = null;
        await account.save();
        await revokeAllRefreshTokens(account, req.ip);
        await sendChangeOfEmail(account, verificationToken);
    }
    return basicDetails(account);
}

async function _delete(id) {
    const account = await getAccount(id);
    if (account) {
        if (account.role == "User") {
            await sequelize.query("delete from userlocations where accountId =  " + id);
            await sequelize.query("delete from roles where accountId =  " + id);
            await sequelize.query("delete from sessions where patientId =  " + id);
            await account.destroy();
            return "User is deleted successfully";
        }
        else {
            var msg = account.role + " user cannot be deleted";
            return msg;
        }
    }
}

// helper functions

async function getAccount(id) {
    const account = await db.Account.findOne({ where: { UserId: id } });
    if (!account) throw 'Account not found';
    return account;
}

// async function getparticipantName(params) {

//     const [results, metadata] = await sequelize.query("select a.firstName,a.lastName, i.dob from accounts a left join intakeforms i on  a.id = i.accountId where a.id = " + params.pid + " ;");
//     console.log([results, metadata]);
//     var firstName = "";
//     const name = results.map(x => {
//         // const { firstName } = x;
//         if (x.dob != null) {
//             const dob = getage(x.dob);
//             if (dob > 0)
//                 firstName = x.firstName + " " + x.lastName + " " + dob + " Years";
//             else
//                 firstName = x.firstName + " " + x.lastName;
//         }
//         else
//             firstName = x.firstName + " " + x.lastName;
//         return { firstName };
//     });

//     return name;

// }

// function getage(dob) {
//     const age = moment().diff(dob, 'years');
//     console.log(age);
//     return age;
// }
async function getRefreshToken(token) {
    if (!token) throw 'Invalid token';
    const refreshToken = await db.RefreshToken.findOne({ where: { token: hashToken(token) } });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

async function hash(password) {
    return await bcrypt.hash(password, 12);
}

/**
 * Returns a random number between min (inclusive) and max (inclusive)
 */
function between(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1) + min
    )
}

function generateJwtToken(account) {
    return jwt.sign(
        { id: account.UserId, fn: account.firstName, ln: account.lastName, email: account.email, role: account.role, sessionHash: account.sessionHash },
        config.jwtSecret,
        { expiresIn: config.session.validMinutes * 60, issuer: config.jwtIssuer, audience: config.jwtAudience }
    );

}

function generateRefreshToken(account, ipAddress) {
    const token = randomTokenString();
    return {
        token,
        refreshToken: new db.RefreshToken({
            accountId: account.id,
            token: hashToken(token),
            expires: new Date(Date.now() + config.session.refreshToken * 60 * 1000),
            createdByIp: ipAddress
        })
    };
}

async function getCsrfSession(token) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();
    if (!account || !account.isActive || !account.sessionHash) throw 'Invalid token';
    return account.sessionHash;
}

function randomTokenString() {
    return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('base64url');
}

function safeTokenMatch(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function revokeAllRefreshTokens(account, ipAddress) {
    await db.RefreshToken.update(
        { revoked: new Date(), revokedByIp: ipAddress || null },
        { where: { accountId: account.id, revoked: null } }
    );
}

function basicDetails(account) {

    const { UserId : id, title, firstName, lastName, email, role, created, updated, isActive, isVerified, phone } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isActive, isVerified, phone };
}
async function basicUserInfo(account) {

    // const locationName = (await  clientService.getLocationName({"lid" : account.locationid}))[0].locationName;
    //console.log(locationName);

    const { id, title, firstName, lastName, email, role, phone } = account;
    return { id, title, firstName, lastName, email, role, phone };
}

async function sendChangeOfEmail(account, token) {
    return sendVerificationMessage(account, token, './emailtemplates/User_Email_Update_Email_Template.htm');
}

async function sendVerificationEmail(account, token) {
    return sendVerificationMessage(account, token, './emailtemplates/User_Account_Creation_Email_Template.htm');
}

async function sendVerificationMessage(account, token, templatePath) {
    const verifyUrl = clientTokenUrl('/verifyemail.html', token);
    const message = renderEmailTemplate(templatePath, {
        first_name: account.firstName,
        verification_link: verifyUrl,
        Your_Company: config.company
    });
    if (account.email) await sendEmail({ to: account.email, subject: 'VOF Verify Login', html: message });
    return 'verification message sent';
}

async function sendPasswordResetEmail(account, token) {
    const resetUrl = clientTokenUrl('/resetforgotpassword.html', token);
    const message = renderEmailTemplate('./emailtemplates/User_Password_Reset_Email_Template.htm', {
        first_name: account.firstName,
        reset_link: resetUrl,
        Your_Company: config.company
    });
    if (account.email) await sendEmail({ to: account.email, subject: 'Reset Password Email', html: message });
    return 'message sent';
}

function clientTokenUrl(pathname, token) {
    const url = new URL(pathname, config.clientUrl);
    url.searchParams.set('token', token);
    return url.toString();
}

function renderEmailTemplate(templatePath, values) {
    let template = fs.readFileSync(templatePath).toString();
    for (const [key, value] of Object.entries(values)) {
        template = template.replace(new RegExp(`{{${key}}}`, 'g'), escapeHtml(value));
    }
    return template;
}

async function sendPasswordResetConfirmationEmail(account) {
    const message = renderEmailTemplate('./emailtemplates/Password_Reset_Success_Email_Template.htm', {
        first_name: account.firstName,
        Your_Company: config.company
    });
    if (account.email) await sendEmail({ to: account.email, subject: 'Password Reset Successful', html: message });
    return 'message sent';
}

async function send2faEmail(account, otp) {
    const message = renderEmailTemplate('./emailtemplates/Login_Otp_Email_Template.htm', {
        first_name: account.firstName,
        user_otp: otp,
        Your_Company: config.company
    });
    if (account.email) await sendEmail({ to: account.email, subject: 'One-time passcode', html: message });
    return 'message sent';
}

async function getJitsiToken(req, pitID) {
    const id = req.auth.id;
    const account = await getAccount(id);
    const pitUser = await db.PitUsers.findOne({ where: { pitId: pitID, userId: id } });
    const pit = await db.Pits.findOne({ where: { PitID: pitID, isActive: true } });
    if (!account || !pitUser || !pit) throw 'Unauthorized';

    const now = Math.floor(Date.now() / 1000);
    const token = {
        context: {
            user: {
                avatar: '',
                name: `${account.firstName} ${account.lastName}`,
                email: account.email,
                id
            }
        },
        moderator: pitUser.role <= 2,
        aud: 'jitsi',
        iss: 'vofmeet',
        sub: 'meet.jitsi',
        room: pit.PitID,
        exp: now + 15 * 60,
        nbf: now
    };
    return jwt.sign(token, config.jitsiSecret, { algorithm: 'HS256' });
}

