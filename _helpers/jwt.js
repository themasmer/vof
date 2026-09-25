import fs from "fs";
import * as jose from "jose";
import { v4 as uuidv4 } from "uuid";

// read JWT and keys from the files where we stored them
const jwk = JSON.parse(fs.readFileSync("./jwk.json").toString());
const keys = JSON.parse(fs.readFileSync("./jwk-meta.json").toString());

const generateJwt = async (subject, userName, secondsToExpire, algorithm = "RS256", keyId = jwk.kid, jwtId = uuidv4()) => {
    // import keys to jose objects
    const privateKey = await jose.importPKCS8(keys.privateKeyPem, algorithm);
    const publicKey = await jose.importSPKI(keys.publicKeyPem, algorithm);

    // get current time from epoch in seconds for "issued at" claim
    const now = Math.round(Date.now() / 1000);

    // setup protected claims of the token
    const claims = {
        sub: subject, // subject of the token (user login in GoodData Cloud)
        name: userName, // name of the user
        iat: now, // time when token was issued
        jti: jwtId, // unique JWT id
    };

    // set token expiration, protected header attributes, and sign it with our private key
    const token = await new jose.SignJWT(claims)
        .setProtectedHeader({ alg: algorithm, typ: "JWT", kid: keyId })
        .setExpirationTime(`${secondsToExpire}s`)
        .sign(privateKey);

    // verify that token was encoded and signed correctly, write out the decrypted token
    try {
        const decryptedToken = await jose.jwtVerify(token, publicKey);
//        console.log("Token signature verified:");
//        console.log(decryptedToken, "\n");
    } catch (error) {
//        console.error("Token verification failed:", error);
    }

    return token;
};

const verifyJwt = async (token) => {
    // import keys to jose objects
    const publicKey = await jose.importSPKI(keys.publicKeyPem, algorithm);

    try {
        const decryptedToken = await jose.jwtVerify(token, publicKey);
            return true;
    } catch (error) {
	    return false;
    }
};


module.exports = generateJwt;

