const csv = require('to-csv');
const csvtojson=require('csvtojson');
const fs = require('fs');
const nodemailer = require('nodemailer');
const config = require('./credintials');
const moment = require('moment');

let systemDate = moment().format("YYYY-MM-DD");
if(process.argv.length>3){
    systemDate = process.argv[2];
}

async function run() {
    const sites = ['rigzone','newpark','halliburton'];
    let emailBody = ``;
    let combinedSearchResultArray = [];
    for (let site of sites){

        const csvFilePath = `${site}_search_result_${systemDate}.csv`;
        console.log(csvFilePath);
        if(fs.existsSync(csvFilePath)){
            const jsonArray=await csvtojson().fromFile(csvFilePath);
            console.log(jsonArray);
            console.log('file len '+jsonArray.length);
            emailBody += `<p> ${jsonArray.length} result found in ${site}</p>`;
            combinedSearchResultArray = combinedSearchResultArray.concat(jsonArray);
        }
        else {
            console.log(csvFilePath+' does not exists');
            emailBody += `<p> No result found in ${site}</p>`;
        }

    }

//'jobs@mudjobs.com',
    const mailOptions = {
        senderEmail:`nodedevloper@gmail.com`,
        customReceivers:['na5703hansitha@gmail.com'],
        subject: `Job Search(Drilling Fluids) - Daily Report ${systemDate}`,
        isAttachmentAvailable:false
    };

    const isAttachmentAvailable = combinedSearchResultArray.length;
    if(isAttachmentAvailable){
        let csvData = csv(combinedSearchResultArray);

        mailOptions.isAttachmentAvailable = true;
        mailOptions.csvData = csvData;
        mailOptions.filename = `combined_job_search_result_${systemDate}.csv`;
        mailOptions.html = emailBody;

        try {
            fs.writeFileSync(mailOptions.filename,csvData,'utf8');
            console.log(mailOptions.filename+' file saved successfully');
        }
        catch (e) {
            console.log('something went wrong with file saving: '+e);
        }

    }
    else {
        mailOptions.html = emailBody;
    }

    sendEmail(mailOptions);





}
function sendEmail(options){
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: config.username, // generated ethereal user
            pass: config.password // generated ethereal password
        }
    });

    let mailOptions = {
        from:  `<${options.senderEmail}>`, // sender address
        to: options.customReceivers.join(','), // list of receivers
        subject: options.subject, // Subject line
        // text: 'Hello world?', // plain text body
        html: options.html // html body
    };

    if(options.isAttachmentAvailable){
        mailOptions.attachments =  [{
            filename: `${options.filename}`,
            content: options.csvData
        }]
    }


    try {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('nodemailer error:'+error);
            }
            else {
                console.log('mail sent successfully');
            }

        });
    }
    catch (e) {
        console.log('nodemailer catch: '+e);
    }


}

run();