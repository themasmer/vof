const twilio = require('twilio');


//const accountSid = 'AC632ad31481895e060497be60d070c215';
const accountSid = 'AC29a706dbcd183483a539079487d8b03d';
//const authToken =  '7a6db145dfcc6c94652ad585c48c6d42';
const authToken = '5f5677bb7113fbc1ca7977abf7621fe7';

//const client = new twilio(accountSid, authToken);

module.exports = sendSms;

async function sendSms(message,tonumber){
    
    const client = new twilio(accountSid, authToken);
    console.log(tonumber);
    console.log(message);
  
client.messages
  .create({
     body: message,
    //from: '+12344153569',
    from : '+15128080969',
   //from: '+18663831830',
     to:   '+91' + tonumber
   })
  .then(message => console.log("message sent to " + tonumber))
  .catch((error) => {
    
    console.log("message not sent " + error);
  });
  

}








