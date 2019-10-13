const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const csv = require('to-csv');
const moment = require('moment');
const nodemailer = require('nodemailer');
const config = require('./credintials');


let doSendEmail = false;
if(process.argv.length===3){
    doSendEmail = process.argv[3];
}


let systemDate = moment().format("YYYY-MM-DD");
if(process.argv.length>3){
    systemDate = process.argv[2];
}
console.log('processing oc99 script on '+systemDate);
doSendEmail = false;


const loggerEnabled = true;
const loginGetOptions = {
    jar:true,
    followAllRedirects: true,
    url: "https://www.oc99.com/job-search/Drilling%20Fluids/0/0/0",
    method: "GET",
};


async function run() {
    try {
        request.get(loginGetOptions,async (err,response,html)=>{

            if(err){
                console.log('response error :'+err);
            }
            else {
                if(html != undefined){


                    const formattedJobResultSet =   await extractDataFromHtml(html);
                    const {hasNext,filteredResult} = filerDataSet(formattedJobResultSet,systemDate);
                    const csvDataInput = formatForCSVConversion(filteredResult);

                    processCsvData(csvDataInput)


                }
            }

        });
    }
    catch (e) {
        console.log(e);
    }
}



function getSearchParameters() {
    const formData = {
        "SearchCriteria.SearchText":"",
        "SearchCriteria.DisplayLocation":"",
        "SearchCriteria.SelectedCategory":"",
        "SearchCriteria.SelectedSkill":	564,
        "SearchCriteria.SelectedExperience":"",
        "SearchCriteria.SelectedEmploymentType":"",
        "SearchCriteria.Radius":35,
        "SearchCriteria.RadiusUnit":"MI",
        "hdnTypeAheadCheck":	1,
        "SearchCriteria.SearchLocation":"",
        "SearchCriteria.SearchCountryCode":"",
        "SearchCriteria.SearchCountry":"",
        "SearchCriteria.SearchState":"",
        "SearchCriteria.Location_LatLon":"",
        "SearchCriteria.SearchRegion":"",
        "SearchCriteria.CurrentPage":1,
        "SearchCriteria.SortingOption":"date",
        "SearchCriteria.IsRadiusSearch":false,
        "SearchCriteria.fSkillList_s":"",
        "SearchCriteria.fJobLocation_s":"",
        "SearchCriteria.fCompanyName_s":"",
        "SearchCriteria.fIndustryExpMin":"",
        "SearchCriteria.facetExperMax":"",
        "hdnSaveSearchTerms":"1",
        "hdnSearchType":"A"
    };

    return formData;
}

function extractDataFromHtml(html){

    return new Promise(resolve => {
        const results = [];



        const apiGetOptions = {
            jar: true,
            followAllRedirects: true,
            method: 'GET',
            url: 'https://www.oc99.com/api/jobs/search/Drilling%20Fluids/0/0/0/undefined'
        };

        try {
            request.get(apiGetOptions,(err,response,html)=>{
                if(err){
                    console.log('get err '+err);
                    resolve(results);
                }
                else {

                    const jsonResponse =JSON.parse(html);
                    const jobs = jsonResponse.jobs;

                    if(jobs != undefined && jobs.length>0){
                        jobs.map(o=>{
                            results.push({
                                title:o['Blurb'],
                                link : `https://www.oc99.com`+
                                    `/vacancy/${o['ID']}/${o['Discipline'] ? o['Discipline']:0}/${o['Level'] ? o['Level']:0}/${o['Location'] ? o['Location']:0}`,
                                location : o['Location'],
                                date : o['DateAdded'].split(" ")[0].trim()

                            });
                        });
                    }

                    resolve(results);
                }
            });
        }
        catch (e) {
            console.log('catch in extractDataFromHtml: '+e);
            resolve(results);
        }
    });



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
        case 'Jan':
            month = "01";
            break;
        case 'Feb':
            month = "02";
            break;
        case 'Mar':
            month = "03";
            break;
        case 'Apr':
            month = "04";
            break;
        case 'May':
            month = "05";
            break;
        case 'Jun':
            month = "06";
            break;
        case 'Jul':
            month = "07";
            break;
        case 'Aug':
            month = "08";
            break;
        case 'Sep':
            month = "09";
            break;
        case 'Oct':
            month = "10";
            break;
        case 'Nov':
            month = "11";
            break;
        case 'Dec':
            month = "12";
            break;

    }

    return moment(`${year}-${month}-${date.length==1?'0'+date:date}`).format('YYYY-MM-DD');
}

function filerDataSet(unfilteredResults,filterDate){
    const currentDate = filterDate;//new Date().toLocaleDateString();
    const filteredResult = [];

    for (let job of unfilteredResults){
        const postedDate = job.date;
        if(postedDate === currentDate){
            filteredResult.push(job);
        }
    }

    return {'hasNext':unfilteredResults.length===filteredResult.length,'filteredResult':filteredResult};
}

function formatForCSVConversion(formattedJobResultSet){
    const csvDataInput = [];
    for (let job of formattedJobResultSet){

        csvDataInput.push({
            'Site':'Oc99',
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
        subject: `Oc99 - Daily Report ${systemDate}`,
        isAttachmentAvailable:false
    };

    const isAttachmentAvailable = csvDataInput.length;
    if(isAttachmentAvailable){
        let csvData = csv(csvDataInput);

        mailOptions.isAttachmentAvailable = true;
        mailOptions.csvData = csvData;
        mailOptions.filename = `oc99_search_result_${systemDate}.csv`;
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

run();