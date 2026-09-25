const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const { Op } = require('sequelize');
const sendEmail = require('_helpers/send-email');
// const sendSms = require('_helpers/send-sms');
const db = require('_helpers/db');
const Role = require('_helpers/role');
// const clientService = require('clients/client.service');
const moment = require('moment');
const JWT_SECRET = "koMab0r8xfz2";
const fs = require('fs');
const randomstring = require('randomstring');
const logMessage = require('_middleware/audit-log');
//  "pass": "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"

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
    getUserInfo,
    create,
    update,
    delete: _delete,
    // getparticipantName,
    getBlotter,
    getBlotterRecordings,
    getprofile,
    updateprofile,
    getUserbyRole,
    getUserInfoById,
    updateUserInfobyRole,
    updateStatus,
    getJitsiToken,
    verify2FA,
    // createhashpassword
};

async function authenticate(req) {
    var { email, password, ipAddress } = req.body;
    // console.log(email);
    //  const account = await db.Account.scope('withHash').findOne({ where: { email } });
    const account = await db.Account.scope('withHash').findOne({ where: { email: email } });

    //account.updated = Date.now();
    //account.sessionHash = randomTokenString();
    //await account.save();

    // if (!account || !account.isVerified || !(await bcrypt.compare(password, account.passwordHash))) {
    //     throw 'Please check your credentials';
    // }
    if (account === null){
        throw 'Invalid username or password';
    } else if (account && !account.isVerified){
        throw 'Account not verified';
    }  else if (account && !account.isActive){
        throw 'Account inactive';
    } else  if (!(await bcrypt.compare(password, account.passwordHash))) {
        account.failedAttempts = account.failedAttempts +1;
        if (account.failedAttempts ==5) {
            account.isActive = false;
        }
        await account.save();

        throw 'Invalid username or password';
    }
    // Adding second token to db
    account.updated = Date.now();
    account.sessionHash = randomTokenString();

    // // Generate OTP and save to DB
    const regex_emails = /mjaynes|tcrux|vtfpentest/;
    const need_fixed_otp = regex_emails.test(account.email)

    let otp = "78123456"
    if (!need_fixed_otp) {
        otp = randomstring.generate({
            length: 8,
            charset: 'numeric'
        });
        send2faEmail(account, otp);
    }

    account.otp = otp;
    account.otpCreatedon = new Date();
    account.failedAttempts = 0;

    await account.save();
    var message = { "User" : "Login requested" }
    if (Object.keys(message).length !== 0) {
        message["UserId"] = account.UserId;
        logMessage('accounts', message, req);
    }
    if (need_fixed_otp) {
        return { message : `Fixed/constant OTP for test accounts ${account.email}` };
    }
    else {
        return { message : `An email has been sent to ${account.email} with OTP` };
    }

    // authentication successful so generate jwt and refresh tokens
    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);

    // save refresh token
    await refreshToken.save();
    // console.log(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token,
        //message : "User Alreay exists"
    };
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
    account.sessionHash = "";
    await account.save();

    var message = {};

    if (_account.isActive !== account.isActive){
        message["isActive"] = _account.isActive;
    }

    if (Object.keys(message).length !== 0) {
        message["UserId"] = account.UserId;
        logMessage('accounts', message, req);
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
        console.log(values[0].locationName);
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
                    console.log("email exists");
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
                console.log("phone exists");
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

    console.log(params.role);


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
        console.log(values);
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

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
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
        refreshToken: newRefreshToken.token
    };
}

async function revokeToken(req) {
    var token = req.auth.id;
    const account = await db.Account.findOne({where : { UserId : token  } });
    if (account) {
        account.sessionHash = "";
        await account.save();

	var message = { "UserID": account.UserId, "Action": "User Logged out" };
        logMessage('accounts', message, req);
    } 

    // // revoke token and save
    //refreshToken.revoked = Date.now();
    //refreshToken.revokedByIp = ipAddress;
    //await refreshToken.save();
}

async function register(req) {
    var params = req.body;
    //console.log(req);
    var origin = req.get('origin');
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
        console.log(params);
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
    account.verificationToken = randomTokenString();
    // hash password
    account.passwordHash = ""; //await hash(params.password);
    // save account
    await account.save();
    var message = {"UserID": account.UserId, "Action" : "User Created"};
    logMessage('accounts', message, req);
    // send email or sms
    return await sendVerificationEmail(account, origin);
}

async function verifyEmail({ token }) {
    const account = await db.Account.findOne({ where: { verificationToken: token } });
    if (!account) throw 'Verification failed';
    account.verified = Date.now();
    // account.verificationToken = "";
    await account.save();
}

async function changepassword(req) {
    var id = req.auth.id;
    var params = req.body;
    const validTill =config.passwordReset.validMinutes;

    const account = await getAccount(id);
    // hash password
    // account.passwordHash = await hash(params.password);
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + validTill * 60 * 1000);
    // if (account.verificationToken == "new user")
    //     account.verificationToken = null;
    // save account
    await account.save();
    var message = { "UserID" : account.UserID, "Action": "Change Password Requested" }
    if (Object.keys(message).length !== 0) {
        logMessage('accounts', message, req);
    }
    const origin = req.get('origin');
    await sendPasswordResetEmail(account, origin);
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
    var origin = req.get('origin');
    const account = await db.Account.findOne({ where: { [Op.or]: [{ email: email }] } });
    const validTill = config.passwordReset.validMinutes;


    if (account === null){
        throw 'Account not found!';
    } else if (account.isActive === false){
        throw 'Account is not Active!';
    }
    // always return ok response to prevent email enumeration
    if (!account) return;


    // create reset token that expires after 60 mins (config.json)
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + validTill * 60 * 1000);
    await account.save();

    var message = { "EmailID": email, "Action": "Forgot Password Requested" };
    logMessage('accounts', message, req);
    // send email
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
    const account = await db.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });

    if (!account) throw 'Invalid token';

    return account;
}

async function validateVerificationToken({ token }) {
    const account = await db.Account.findOne({
        where: {
            verificationToken: token
        }
    });

    if (!account) throw 'Invalid token';

    return account;
}

async function resetPassword({ token, password }) {
    const account = await validateResetToken({ token });

    // update password and remove reset token
    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.resetToken = null;
    await account.save();
    sendPasswordResetConfirmationEmail(account);
}

async function setPassword({ token, password }) {
    const account = await validateVerificationToken({ token });

    // update password and remove reset token
    account.passwordHash = await hash(password);
    account.passwordReset = Date.now();
    account.verificationToken = null;
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
    // const accounts = await db.Account.findAll({ });
    // return accounts.map(x => basicDetails(x));
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
     AND (firstName LIKE '%${search_value}%'
      OR lastName LIKE '%${search_value}%' 
      OR email LIKE '%${search_value}%')`; 
    //   OR customer_gender LIKE '%${search_value}%')`;

    var Users_Count_Query = `SELECT  COUNT(*) AS Total FROM accounts`;

    const _total_records = await sequelize.query(Users_Count_Query);
    const total_records = _total_records[0][0].Total;

    var Users_Search_Count_Query = `SELECT  COUNT(*) AS Total FROM accounts WHERE 1 ${search_query}`;

    const _total_records_with_filter = await sequelize.query(Users_Search_Count_Query);
    const total_records_with_filter = _total_records_with_filter[0][0].Total;

    var Users_Query = `SELECT  UserId as id, firstName,  lastName, email, role, isActive, IF(!isnull(Verified) && isNull(verificationToken) , true, false ) As isVerified FROM accounts WHERE 1 ${search_query} ORDER BY ${column_name} ${column_sort_order} LIMIT ${start}, ${length}`;

    // if (params.length !== undefined) {
    //     Users_Query = Users_Query +  `LIMIT ${start} , ${length}`;
    // }

    const [accounts] = await sequelize.query(Users_Query);
    return {
        'draw': draw,
        'iTotalRecords': total_records,
        'iTotalDisplayRecords': total_records_with_filter,
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
    // copy params to account and save
    if (params.email && account.email !== params.email && await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already taken';
    } else if (account.email !== params.email){
        sendchangeemail = true;
        account.verificationToken = randomTokenString();
        account.passwordHash = "";
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
        logMessage('accounts', message, req);
    }

    if (sendchangeemail)
        sendChangeOfEmail(account, req.get('origin'));

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
    console.log(`video recordings looking for ${today}, ${pit_name} and scanning folders: <${dirs}>`)
    const scanPit = searchPitID==""?true:false;

    dirs.map(function (dir) {
        var path = `${homepath}/${dir}`;
        console.log(`.. checking folder ${path}`)

        var files = fs.readdirSync(path).filter(fn => fn.includes(today));
        files.map(function (name) {
            console.log(`    ....... scanning for file ${name}, and matching against pitName ${pit_name}`)
            if (scanPit || name.includes(pit_name)) {
                console.log(`    ....... Matched file ${name}`)

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
    console.log(searchDate + ',' +  searchPit +  ':' + scanPit + ',' + searchUser + ':' + scanUser);

    var today = Date.parse(searchDate);
    today = new Date(today).toISOString().slice(0, 10);
    const filename = `${homepath}/${today}.log`
    console.log(`Parsing ${filename}`);

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

    if (account === null) {
        throw 'Invalid OTP!';
    }
    
    if (account.otp !== params.otp) {
        account.failedAttempts = account.failedAttempts + 1;
        if (account.failedAttempts == ALLOWED_ATTEMPTS) {
            account.isActive = false;
        }
        await account.save();
        if (account.failedAttempts >= ALLOWED_ATTEMPTS)
            throw 'Invalid OTP! You have exceeded allowed attempts, account has been locked';
        else
            throw `Invalid OTP, you have ${ALLOWED_ATTEMPTS - account.failedAttempts} attempts remaining!`;
    }
    
    // now otp is correct, check if it is stale
    const staleotp = new Date(Date.now() - (OTP_VALID_MINUTES * 60 * 1000));
    if (account.otpCreatedon < staleotp) {
        throw 'OTP has expired. Please reinitalize login process!';
    }
    else {  // OTP was success 
        const jwtToken = generateJwtToken(account);
        const refreshToken = generateRefreshToken(account, req.ip);

        await refreshToken.save();

        account.failedAttempts = 0;
        account.otp = '';
        await account.save();

        var message = { "User" : "Login Verified" }
        if (Object.keys(message).length !== 0) {
            message["UserId"] = account.UserId;
            logMessage('accounts', message, req);
        }

        return {
          ...basicDetails(account),
          jwtToken,
          refreshToken: refreshToken.token
        };
    }

}

async function getprofile(req){
    var id = req.auth.id;
    const account = await getAccount(id);

    return basicDetails(account);
}

async function update(req) {
    var id = req.body.id;
    var params = req.body;
    var origin = req.get('origin');

    const account = await getAccount(id);
    const _account = JSON.parse(JSON.stringify(account));
    var sendchangeemail = false;
    // validate (if email was changed)
    if (params.email && account.email !== params.email && await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already taken';
    } else if (account.email !== params.email){
        sendchangeemail = true;
        account.verificationToken = randomTokenString();
        account.passwordHash = "";
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
        logMessage('accounts', message, req);
    }
    if (sendchangeemail)
        sendChangeOfEmail(account, origin);
    return basicDetails(account);
}

async function _delete(id) {
    const account = await getAccount(id);
    if (account) {
        if (account.role == "User") {
            console.log(account.role);
            await sequelize.query("delete from userlocations where accountId =  " + id);
            await sequelize.query("delete from roles where accountId =  " + id);
            await sequelize.query("delete from sessions where patientId =  " + id);
            await account.destroy();
            return "User is deleted successfully";
        }
        else {
            console.log("it is " + account.role);
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
    const refreshToken = await db.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

async function hash(password) {
    return await bcrypt.hash(password, 10);
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
    // create a jwt token containing the account id that expires in 15 minutes
    return jwt.sign({ id: account.UserId, fn: account.firstName, ln: account.lastName, email: account.email, role: account.role, 
                      sessionHash:account.sessionHash, expires: new Date(Date.now() + config.session.validMinutes  * 60 * 1000) }, config.secret, { });

}

function generateRefreshToken(account, ipAddress) {
    // create a refresh token that expires in 7 days
    return new db.RefreshToken({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + config.session.refreshToken * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(10).toString('hex');
}

function basicDetails(account) {

    const { UserId : id, title, firstName, lastName, email, role, created, updated, isActive, isVerified, phone, verificationToken } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isActive, isVerified, phone, verificationToken };
}
async function basicUserInfo(account) {

    // const locationName = (await  clientService.getLocationName({"lid" : account.locationid}))[0].locationName;
    //console.log(locationName);

    const { id, title, firstName, lastName, email, role, phone } = account;
    return { id, title, firstName, lastName, email, role, phone };
}

async function sendChangeOfEmail(account, origin) {
    let message;
    let verifyUrl;
    if (origin) {
	if (account.role === 1)
            verifyUrl = `${origin}/verifyemail.html?token=${account.verificationToken}`;
        else 
            verifyUrl = `${config.clientUrl}/verifyemail.html?token=${account.verificationToken}`;
        message = `<p>An account has been created with this email address. Please click the link below to set your password.</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;

        // messagesms = "A VOF Plus account has been created using this phone number. Your password has been set to  1234. please follow this link to verify your number. " + verifyUrl + "  You can change your password upon signing in for the first time. \n" +
        //     "        \n Se ha creado una cuenta de VOF Plus utilizando este número de teléfono. Su contraseña se ha establecido en 1234. Siga este enlace para reservar sus citas en la ubicación de site Whiteline " + verifyUrl + "  Puedes cambiar tu contraseña al iniciar sesión por primera vez.";
    }

    var fileContents = fs.readFileSync('./emailtemplates/User_Email_Update_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{verification_link}}/g, verifyUrl);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
   
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Verify Login',
            html: `${message}`
        });
    }
    
    return "successful,verification message sent";
}

async function sendVerificationEmail(account, origin) {
    let message;
    let verifyUrl;
    if (origin) {
	if (account.role === '1')
            verifyUrl = `${origin}/verifyemail.html?token=${account.verificationToken}`;
        else
            verifyUrl = `${config.clientUrl}/verifyemail.html?token=${account.verificationToken}`;
        message = `<p>An account has been created with this email address. Please click the link below to set your password.</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;

        // messagesms = "A VOF Plus account has been created using this phone number. Your password has been set to  1234. please follow this link to verify your number. " + verifyUrl + "  You can change your password upon signing in for the first time. \n" +
        //     "        \n Se ha creado una cuenta de VOF Plus utilizando este número de teléfono. Su contraseña se ha establecido en 1234. Siga este enlace para reservar sus citas en la ubicación de site Whiteline " + verifyUrl + "  Puedes cambiar tu contraseña al iniciar sesión por primera vez.";
    }

    var fileContents = fs.readFileSync('./emailtemplates/User_Account_Creation_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{verification_link}}/g, verifyUrl);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
    //TODO
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'VOF Verify Login',
            html: `${message}`
        });
    }
    return "successful,verification message sent";
}

async function sendPasswordResetEmail(account, origin) {
    let message;
    let resetUrl;
    if (origin) {
        resetUrl = `${origin}/resetforgotpassword.html?token=${account.resetToken}`;
        // message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
        //            <p><a href="${resetUrl}">${resetUrl}</a></p>`;

    } else {
        message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
    }

    var fileContents = fs.readFileSync('./emailtemplates/User_Password_Reset_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{reset_link}}/g, resetUrl);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'Reset Password Email',
            html: `${message}`
        });
    }
    return "message sent";
}

async function sendPasswordResetConfirmationEmail(account) {
    let message;
    let resetUrl;

    var fileContents = fs.readFileSync('./emailtemplates/Password_Reset_Success_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'Password Reset Successful',
            html: `${message}`
        });
    }
    return "message sent";
}

async function send2faEmail(account, otp) {
    let message;
    
    var fileContents = fs.readFileSync('./emailtemplates/Login_Otp_Email_Template.htm').toString();
    fileContents = fileContents.replace(/{{first_name}}/g, account.firstName);
    fileContents = fileContents.replace(/{{user_otp}}/g, otp);
    fileContents = fileContents.replace(/{{Your_Company}}/g, config.company);
    message = fileContents;
    
    if (account.email !== "") {
        await sendEmail({
            to: account.email,
            subject: 'MIAX Sapphire Options Virtual Trading Floor - One-time Passcode',
            html: `${message}`
        });
    }
    return "message sent";
}

async function getJitsiToken(req, pitID) {
    var id = req.auth.id;
    const account = await getAccount(id);

    const _pituser = await sequelize.query(`SELECT userId, pitId, role FROM pitusers WHERE pitId=${sequelize.escape(pitID)} AND userId=${sequelize.escape(id)}`,  {      type: sequelize.QueryTypes.SELECT});

    //console.log(_pituser);

    if (id) {
        const _role = _pituser[0].role;
	console.log(_role);
	console.log(_role<=2?true:false);
        var token = {};
        user = {"avatar":"", "name":account.firstName + ' ' + account.lastName,"email":account.email, "lobby_bypass": "true", id:id, pitID:pitID};
        token.context = {"user":user};
        token.moderator = _role<=2?true:false;
        token.aud = "jitsi";
        token.iss = "vofmeet";
        token.sub = "meet.jitsi";
        token.room = "*";
        token.exp = Math.floor(Date.now() / 1000)+ 14400;
        token.nbf = Math.floor(Date.now() / 1000);

        return jwt.sign(token, JWT_SECRET);
     }
     else {
        return "error";
     }
}

