const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const csv = require('to-csv');
const moment = require('moment');
const nodemailer = require('nodemailer');
const config = require('./credintials');
const WTS_CONFIG_FILE = 'wts_config.txt';

let doSendEmail = false;
if(process.argv.length===3){
    doSendEmail = process.argv[3];
}
let systemDate = moment().format("YYYY-MM-DD");
if(process.argv.length>3){
    systemDate = process.argv[2];
}
console.log('processing wtsenergy script on '+systemDate);
doSendEmail = false;

const loggerEnabled = true;
const loginGetOptions = {
    rejectUnauthorized: false,
    jar:true,
    followAllRedirects: true,
    url: "https://www.wtsenergy.com/vacancies",
    headers:{
        'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
    },
    method: "GET",
};

const loginPostOptions = {
    rejectUnauthorized: false,
    jar:true,
    followAllRedirects: true,
    url: "https://www.wtsenergy.com/vacancies",
    headers:{
        'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
    },
    method: "POST",
};

function run() {
    try {
        request.get(loginGetOptions,async (err,response,html)=>{

            if(err){
                console.log('response error :'+err);
            }
            else {
                if(html != undefined){

                    const formattedJobResultSet =  await searchJobRecords(1);
                    const csvDataInput = formatForCSVConversion(formattedJobResultSet);

                    processCsvData(csvDataInput)



                }
            }

        });
    }
    catch (e) {
        console.log(e);
    }
}

async function searchJobRecords(pageNumber) {
    loginPostOptions.form = getSearchParameters();

    return new Promise(resolve => {
        try {
            request.post(loginPostOptions,async (err,response,html)=>{
                if(err){
                    console.log('post error '+err);
                    resolve([]);
                }
                else {


                    const unfilteredResult = extractDataFromHtml(html);
                    const {hasNext,filteredResult} = await filerDataSet(unfilteredResult,systemDate,html);
                    if(hasNext){

                        pageNumber++;
                        const nextPageResult = searchJobRecords(pageNumber);
                        resolve(filteredResult.concat(nextPageResult));
                    }

                    resolve(filteredResult) ;
                }
            });
        }
        catch (e) {
            console.log('reqest post exception '+e);
            resolve([]);
        }
    });
}

function getSearchParameters() {
    const formData = {
        'query':'Drilling Fluids'
    };

    return formData;
}

function extractDataFromHtml(html){
    const results = [];

    if(html != undefined){
        const $ = cheerio.load(html);

        const liTags = $('.results .job');

        liTags.each(async function () {
            const liTagsData = {};
            const title  = $(this).find('h3').text().trim();
            const link  = $(this).find('a').attr('href');
           const jobId = $(this).find('a[href*="apply"]').attr('href').split("=")[1];
            const date = systemDate;

            liTagsData.title = title;
            liTagsData.link = link;
            liTagsData.date = date;
            liTagsData.jobId = jobId;

            results.push(liTagsData);
        });

    }
    return results;
}

function convertDateString(dateString) {

    if(dateString ===''){
        return ''
    }
    const dateParts = dateString.split(",");
    const year = dateParts[1].trim();
    const date = dateParts[0].split(" ")[1];
    const monthString = dateParts[0].split(" ")[0];

    switch (monthString) {
        case 'January':
            month = "01";
            break;
        case 'February':
            month = "02";
            break;
        case 'March':
            month = "03";
            break;
        case 'April':
            month = "04";
            break;
        case 'May':
            month = "05";
            break;
        case 'June':
            month = "06";
            break;
        case 'July':
            month = "07";
            break;
        case 'August':
            month = "08";
            break;
        case 'September':
            month = "09";
            break;
        case 'October':
            month = "10";
            break;
        case 'November':
            month = "11";
            break;
        case 'December':
            month = "12";
            break;

    }

    return  moment(`${year}-${month}-${date}`).format('YYYY-MM-DD');;
}

async function filerDataSet(unfilteredResults,filterDate){

    const filteredResult = [];
    const txtData =  fs.readFileSync(WTS_CONFIG_FILE,'utf8');
    const existingJobIds = txtData.split(',');
    console.log(existingJobIds);

    for (let job of unfilteredResults){
        const postedJobId = job.jobId;
        if(!existingJobIds.includes(postedJobId)){
            delete job.jobId;
            let location = await getJobLocation(job.link);
            job.location = location;
            filteredResult.push(job);
            existingJobIds.push(postedJobId);
        }
        else {
            console.log('skipped adding existing job: '+postedJobId);
        }
    }
    fs.writeFileSync(WTS_CONFIG_FILE,existingJobIds,'utf8');

    console.log('unfiltered data set :'+unfilteredResults.length);
    console.log('filtered data set :'+filteredResult.length);

    //TODO pagniation part is not done since there was no pagniation for this specific job type
    return {'hasNext':false,'filteredResult':filteredResult};
}

function formatForCSVConversion(formattedJobResultSet){
    const csvDataInput = [];
    for (let job of formattedJobResultSet){

        csvDataInput.push({
            'Site':'Wtsenergy',
            'Title':job.title,
            'Location':job.location,
            'Date':job.date,
            'Link':job.link
        });
    }

    return csvDataInput;
}

function processCsvData(csvDataInput){

    logger('processCsvData','end');
    const mailOptions = {
        senderEmail:`nodedevloper@gmail.com`,
        customReceivers:['jobs@mudjobs.com','na5703hansitha@gmail.com'],
        subject: `Wtsenergy - Daily Report ${systemDate}`,
        isAttachmentAvailable:false
    };

    const isAttachmentAvailable = csvDataInput.length;
    if(isAttachmentAvailable){
        let csvData = csv(csvDataInput);

        mailOptions.isAttachmentAvailable = true;
        mailOptions.csvData = csvData;
        mailOptions.filename = `wtsenergy_search_result_${systemDate}.csv`;
        mailOptions.html = `<h3>See latest search results</h3>`;

        try {
            fs.writeFileSync(mailOptions.filename,csvData,'utf8');
            console.log(mailOptions.filename+' file saved successfully');
        }
        catch (e) {
            console.log('something went wrong with file saving: '+e);
        }

    }
    else {
        mailOptions.html = `
        <h3>No Results found </h3>
        `;
    }

    if(doSendEmail){
        sendEmail(mailOptions);
    }
}

function sendEmail(options){
    logger('sendEmail','start');
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
function logger(fuctionName,point){
    if(loggerEnabled){
        console.log(point+' of '+fuctionName+":");
    }

}

async function getJobLocation(jobUrl){

    const jobLocationRequestGetOptions = {
        rejectUnauthorized: false,
        jar:true,
        followAllRedirects: true,
        url: jobUrl,
        headers:{
            'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
        },
        method: "GET",
    };

    return new Promise(resolve => {

        try {
            request.get(jobLocationRequestGetOptions,(err,response,html)=>{
                if (err){
                    console.log('location request error :'+err);
                    resolve('');
                }
                else {

                    if(html!=undefined){

                        const $ = cheerio.load(html);
                        let  regions = '';
                        let country = '';
                        let city = '';
                        try {
                            if($(".job-info").length>0){

                                if($(".job-info .regions").length>0){
                                    regions = $(".job-info .regions .value").text().trim();
                                }

                                if($(".job-info .land").length>0){
                                    country = $(".job-info .land .value").text().trim();
                                }


                                if($(".job-info .companycity").length>0){
                                    city = $(".job-info .companycity .value").text().trim();
                                }
                            }
                        }
                        catch (e) {
                            console.log('joblocation parsing catch: '+e);
                        }


                        const location = `${regions} ${country} ${city}`;
                        resolve(location);
                    }
                    else {
                        resolve('');
                    }
                }
            });
        }
        catch (e) {
            console.log('location catch:'+e);
            resolve('');
        }

    });

}



run();
