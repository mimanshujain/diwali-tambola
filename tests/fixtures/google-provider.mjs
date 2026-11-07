// Test-only provider transport. Production loads neither this file nor its keys.
// Keep the real google-auth-library signature, issuer, audience and expiry verification.
import {OAuth2Client} from 'google-auth-library';
import {generateKeyPairSync,sign} from 'node:crypto';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
OAuth2Client.prototype.getToken=async function({code}){
 const claims=JSON.parse(Buffer.from(code,'base64url').toString());
 const now=Math.floor(Date.now()/1000),payload={iss:'https://accounts.google.com',aud:'test-google-client',iat:now,exp:now+3600,email_verified:true,...claims};
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const input=encode({alg:'RS256',kid:'test-key'})+'.'+encode(payload);
 return {tokens:{id_token:input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')}};
};
OAuth2Client.prototype.getFederatedSignonCertsAsync=async function(){return {certs:{'test-key':publicKey.export({type:'spki',format:'pem'})},format:'PEM'};};
