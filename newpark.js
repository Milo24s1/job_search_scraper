const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const csv = require('to-csv');
const moment = require('moment');
const nodemailer = require('nodemailer');
const config = require('./credintials');
const loggerEnabled = true;

let doSendEmail = false;
if(process.argv.length===3){
    doSendEmail = process.argv[3];
}

let systemDate = moment().format("YYYY-MM-DD");
if(process.argv.length>3){
    systemDate = process.argv[2];
}
console.log('processing newpark script on '+systemDate);
doSendEmail = false;

const loginGetOptions = {
    jar:true,
    followAllRedirects: true,
    url: "https://jobs.newpark.com:443/OA_HTML/IrcVisitor.jsp",
    headers:{
        'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
    },
    method: "GET",
};

const loginPostOptions = {
    jar:true,
    followAllRedirects: true,
    uri: "https://jobs.newpark.com",
    headers:{
        'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
    },
    method: "POST",
};

function run() {
    logger('run','start');
    try {
        request.get(loginGetOptions,async (err,response,html)=>{

            if(err){
                console.log('response error :'+err);
            }
            else {
                if(html != undefined){

                    const formattedJobResultSet =  await searchJobRecords(html,1);
                    const csvDataInput = formatForCSVConversion(formattedJobResultSet);

                    processCsvData(csvDataInput)


                }
            }

        });
    }
    catch (e) {
        console.log('run catch: '+e);
    }
}

function searchJobRecords(html,pageNumber) {
    if(pageNumber>1)return;

    logger('searchJobRecords','begin '+pageNumber);
    const {formData,actionUrl} = getSearchParameters(html);
    loginPostOptions.form = formData;
    loginPostOptions.uri= loginPostOptions.uri+actionUrl;


    return new Promise(resolve => {
        try {
            request.post(loginPostOptions,(err,response,html)=>{
                if(err){
                    console.log('post error '+err);
                    resolve([]);
                }
                else {

                    const unfilteredResult = extractDataFromHtml(html);
                    const {hasNext,filteredResult} = filerDataSet(unfilteredResult,systemDate);

                    //TODO pagination is not handled
                    // if(hasNext){
                    //
                    //     pageNumber++;
                    //     const nextPageResult = searchJobRecords(pageNumber);
                    //     resolve(filteredResult.concat(nextPageResult));
                    // }

                    resolve(filteredResult) ;
                }
            });
        }
        catch (e) {
            console.log('reqest post exception'+e);
            resolve([]);
        }
    });
}

function getSearchParameters(html) {

    const $ = cheerio.load(html);

    const AM_TX_ID_FIELD = $("#_AM_TX_ID_FIELD").val();
    const DEFAULT_FROM_NAME = $("#_FORM").val();
    const fwkAbsolutePageName = $("#_fwkAbsolutePageName").val();
    const fwkActBtnNameEnableSreenReaderImage = $("#_fwkActBtnName_EnableSreenReaderImage_update\\$\\$serverUnvalidated").val();
    const fwkActBtnNameSearchupdate = $("#_fwkActBtnName_Search_update\\$\\$serverUnvalidated").val();
    const fwkActBtnNameClearupdate = $("#_fwkActBtnName_Clear_update\\$\\$serverUnvalidated").val();
    const fwkActBtnNameLoginupdate = $("#_fwkActBtnName_Login_update\\$\\$serverUnvalidated").val();
    const openPopupSourceId = $("#openPopupSourceId").val();
    const pkVisitorAMObjectId = $("#_pkVisitorAM\\.IrcCandidateSearchCriteriaVOObjectId").val();
    const pkVisitorAMObjectType = $("#_pkVisitorAM\\.IrcCandidateSearchCriteriaVOObjectType").val();
    const FORM_MAC_LIST = $("#FORM_MAC_LIST").val();

    const formData = {
        "_AM_TX_ID_FIELD":AM_TX_ID_FIELD, //dynamic
        "_FORM":DEFAULT_FROM_NAME, //dynamic
        "VisAdvancedSearchRedirect":"",
        "Keywords":"Drilling Fluids",
        "DatePosted2":"",
        "VacancyListLocationId":"",
        "GoNext":"",
        "UserName":"",
        "Password":"",
        "IrcRegFunction":"",
        "_fwkAbsolutePageName":fwkAbsolutePageName, //dynamic
    "_fwkActBtnName_EnableSreenReaderImage_update$$serverUnvalidated":	fwkActBtnNameEnableSreenReaderImage, //dynamic
    "_fwkActBtnName_Search_update$$serverUnvalidated":fwkActBtnNameSearchupdate , //dynamic
    "_fwkActBtnName_Clear_update$$serverUnvalidated":fwkActBtnNameClearupdate, //dynamic
    "_fwkActBtnName_Login_update$$serverUnvalidated":fwkActBtnNameLoginupdate, //dynamic
    "openPopupSourceId":openPopupSourceId,
    "_pkVisitorAM.IrcCandidateSearchCriteriaVOObjectId":pkVisitorAMObjectId,
        "_pkVisitorAM.IrcCandidateSearchCriteriaVOObjectType": pkVisitorAMObjectType,
            "FORM_MAC_LIST":	FORM_MAC_LIST,
                "_FORMEVENT":"",
            "serverValidate":"",
            "evtSrcRowIdx":"",
            "evtSrcRowId":"",
            "event":	"update",
            "source"	:"Search",
            "IrcAction"	:"Go",
            "IrcActionType":"",
            "IrcActionValue":"",
            "IrcFunction":"",
            "Enterkey":""
    };
    const actionUrl = $('#DefaultFormName').attr('action');
    return {'formData':formData,'actionUrl':actionUrl};

}

function extractDataFromHtml(html){
    logger('extractDataFromHtml','begin');
    const results = [];

    if(html != undefined){
        const $ = cheerio.load(html);

        const trs = $("#JobSearchTable\\:Content tr.xfm");
        trs.each(function () {
            const trTagsData = {};

            const title  = $(this).find('td:nth-child(3) span').text().trim();
            const link  = $(this).find("td:nth-child(2) span a").attr('href');
            const location = $(this).find('td:nth-child(7) span[id*="LocationResult"]').text().trim();
            const date = convertDateString($(this).find('td:nth-child(8) span').text().trim());

            trTagsData.title = title;
            trTagsData.link = 'https://jobs.newpark.com/OA_HTML/'+link;
            trTagsData.location = location;
            trTagsData.date = date;


            results.push(trTagsData);
        });

    }
    return results;
}

function convertDateString(dateString) {

    if(dateString ===''){
        return ''
    }
    const dateParts = dateString.split("-");
    const year = dateParts[2].trim();
    const date = dateParts[0].trim();
    const monthString = dateParts[1].trim();

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

    return  moment(`${year}-${month}-${date}`).format('YYYY-MM-DD');;
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
            'Site':'Newpark',
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
        subject: `Newpark - Daily Report ${systemDate}`,
        isAttachmentAvailable:false
    };

    const isAttachmentAvailable = csvDataInput.length;
    if(isAttachmentAvailable){
        let csvData = csv(csvDataInput);

        mailOptions.isAttachmentAvailable = true;
        mailOptions.csvData = csvData;
        mailOptions.filename = `newpark_search_result_${systemDate}.csv`;
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
