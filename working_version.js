const axios = require('axios').default;
const mysql = require('mysql2');
const CONFIG = require('./config.js');

// start a timer
console.time('test');

// declare global variable for mySQL connection
global.sqlConnection = mysql.createConnection(CONFIG.secrets.sqlConnection);

// name of db table
const eventTable = 'events';
const eventLocationTable = 'event_locations';
const attendeeTable = 'event_attendees';

// http://www.faqs.org/rfcs/rfc2822.html
// create the table if it doesn't exist
let dropEvents = `DROP TABLE IF EXISTS ${eventTable};`;
let createEventsTable = `CREATE TABLE IF NOT EXISTS ${eventTable} (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id VARCHAR(1024) CHARACTER SET utf8 COLLATE utf8_bin COMMENT 'RFC2938 says length between 5 and 1024 characters -- https://www.rfc-editor.org/rfc/rfc2938#section-3.1.2',
    last_modified DATETIME COMMENT 'ISO 8601 format aways UTC',
    icaluid VARCHAR(512) COMMENT 'RFC has no max length. Requires id to be globally unique. MS EWS says max is 512 bytes -- https://blogs.msdn.microsoft.com/exchangedev/2012/04/03/ews-item-identifier-and-your-database/',
    reminder_min INT COMMENT 'Min before event reminder as INT32. INT32 is 4 bytes. MYSQL INT is 4 bytes -- https://dev.mysql.com/doc/refman/8.0/en/integer-types.html | https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/event.md#:~:text=for%20the%20event.-,reminderMinutesBeforeStart,-Int32',
    is_reminder BOOLEAN COMMENT 'Is reminder set? boolean value',
    has_attachments BOOLEAN COMMENT 'Is there an attachment? boolean value',
    subject VARCHAR(255) COMMENT 'UPDATE: after testingaccording to RFC 78 is the length -- http://www.faqs.org/rfcs/rfc2822.html',
    importance VARCHAR(8) COMMENT 'low, normal, high -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/event.md#:~:text=and%20read%2Donly.-,importance,-importance',
    is_cancelled BOOLEAN COMMENT 'Is event cancelled? boolean value',
    response_requested BOOLEAN COMMENT 'Is response requested? boolean value',
    is_organizer BOOLEAN COMMENT 'Is this the calendar owner (see propery owner for calendar resource) the event organizer? boolean value',
    series_master_id VARCHAR(255) CHARACTER SET utf8 COLLATE utf8_bin,
    weblink VARCHAR(512) CHARACTER SET 'ascii' COLLATE 'ascii_general_ci' COMMENT 'URL to open the event in Outlook on the web. Max length/ byte size is not clear',
    online_meeting_url VARCHAR(512) CHARACTER SET 'ascii' COLLATE 'ascii_general_ci' COMMENT 'Similar to weblink. Wil be deprecated in future versions. -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/event.md#:~:text=remains%20available%20online.-,onlineMeetingUrl,-String',
    is_online_meeting BOOLEAN COMMENT 'Is this an online meeting? boolean value',
    join_url VARCHAR(512) CHARACTER SET 'ascii' COLLATE 'ascii_general_ci' COMMENT 'null if False. Otherwise, the URL of the online meeting. -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/event.md#:~:text=new%20location%20value.-,onlineMeeting,-OnlineMeetingInfo',
    allow_new_time_prop BOOLEAN COMMENT 'Is new time proposal allowed? boolean value',
    is_draft BOOLEAN COMMENT 'Is this a draft? boolean value',
    type VARCHAR(16) COMMENT 'The event type. singleInstance, occurrence, exception, seriesMaster. -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/event.md#:~:text=set%20it.%20Optional.-,type,-String',
    start DATETIME COMMENT 'The start date, time, and time zone of the event. By default, the start time is in UTC.',
    start_tz VARCHAR(64) COMMENT 'defualt is UTC. Longest possible timezone is 38 characters. -- https://stackoverflow.com/questions/33465054/storing-timezone-in-a-database',
    end DATETIME COMMENT 'The end date, time, and time zone of the event. By default, the end time is in UTC.',
    end_tz VARCHAR(64) COMMENT 'see start_tz',
    location TEXT COMMENT 'The locations of the event. Max length/ byte size is not clear. Multiple locatoins are semi-colon delimited. -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/location.md',
    location_type VARCHAR(16) COMMENT 'default, confererenceRoom, homeAddress, businessAddress, geoCoordinates, streetAddress, hotel, restaurant, localBusiness, postalAddress'
    );`

let dropLocation = `DROP TABLE IF EXISTS ${eventLocationTable};`
let createLocationTable = `CREATE TABLE IF NOT EXISTS ${eventLocationTable} (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT,
    location VARCHAR(256) COMMENT 'Max length not specified. Using same data type as name from attendees table.',
    location_uri VARCHAR(512) COMMENT 'Max length not specified. IBM article says 259. Went with 512 due to ambiguity. -- https://www.ibm.com/support/pages/uri-length-limit-259-characters-imposed',
    location_type VARCHAR(16) COMMENT 'default, confererenceRoom, homeAddress, businessAddress, geoCoordinates, streetAddress, hotel, restaurant, localBusiness, postalAddress',
    street VARCHAR(64) COMMENT 'longest street name in the US is 38 characters -- https://atkinsbookshelf.wordpress.com/tag/longest-street-name-in-america/',
    city VARCHAR(168) COMMENT 'longest city name is 168 characters',
    state VARCHAR(64) COMMENT 'longest state name is MS in US, using 64 for safety net',
    country VARCHAR(64) COMMENT 'longest country name is 56 characters -- https://www.worldatlas.com/articles/what-is-the-longest-country-name-in-the-world.html',
    postal_code VARCHAR(10) COMMENT 'Graph object uses 5 digit codes. Using varchar(10) in to catch the possibility of +4 formated zip codes'
);`
/*
Address Documentaion 
https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/physicaladdress.md
Example structure of the location property
{
    "location": {
                "displayName": "Conference Room - Primary; https://mieweb.webex.com/meet/horner; 6302 Constitution Dr",
                "locationType": "default",
                "uniqueId": "Conference Room - Primary; https://mieweb.webex.com/meet/horner; 6302 Constitution Dr",
                "uniqueIdType": "private"
    "locations": [
        {
                    "displayName": "Conference Room - Primary",
                    "locationUri": "ConfRoomPrimary@mie.mieweb.com",
                    "locationType": "conferenceRoom",
                    "uniqueId": "",
                    "uniqueIdType": "unknown",
                    "address": {
                        "street": "",
                        "city": "",
                        "state": "",
                        "countryOrRegion": "",
                        "postalCode": ""
                    },...
    ]
}

*/

let dropAttendee = `DROP TABLE IF EXISTS ${attendeeTable};`
let createAttendeeTable = `CREATE TABLE IF NOT EXISTS ${attendeeTable} (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT,
    requirement VARCHAR(10) COMMENT 'either required or optional -- https://support.microsoft.com/en-au/office/schedule-a-meeting-with-other-people-5c9877bc-ab91-4a7c-99fb-b0b68d7ea94f',
    response VARCHAR(20) COMMENT 'none, organizer, tentativelyAccepted, accepted, declined, notResponded -- https://github.com/microsoftgraph/microsoft-graph-docs/blob/main/api-reference/v1.0/resources/responsestatus.md',
    response_time DATETIME COMMENT 'The time the attendee replied to the meeting request. -- SEE COMMENT FOR RESPONSE',
    name VARCHAR(256) COMMENT 'max length from MS is 256 -- https://docs.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0#:~:text=on%20null%20values).-,displayName,-String',
    email VARCHAR(255) COMMENT 'max length is 254 https://docs.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0#:~:text=%24select.-,mail,-String | https://www.rfc-editor.org/errata_search.php?rfc=3696&eid=1690'
);`

/*
Example structure of the attendee property
attendees": [
                {
                    "type": "required",
                    "status": {
                        "response": "none",
                        "time": "0001-01-01T00:00:00Z"
                    },
                    "emailAddress": {
                        "name": "Austin Lodish",
                        "address": "alodish@mieweb.com"
                    }
                },...
*/

let queries = [dropEvents, createEventsTable, dropLocation, createLocationTable, dropAttendee, createAttendeeTable];

queries.forEach(query => {
    sqlConnection.query(query, function (err) {
        if (err) {
            console.log(err.message);
        }
    });
});

// requesting access token from ms graph
async function getAccessToken() {
    const res = await axios.post(CONFIG.tokenEndpoint, CONFIG.secrets.tokenRequest);
    return res.data;
};

// process events by extracting the values of the desired keys
// continue processing events until nextLink absent from response
function processEvents(body) {
    body.data.value.forEach(property => {
        let sqlEventStatment = `INSERT INTO ${eventTable} (
            event_id, last_modified, icaluid, reminder_min, is_reminder, has_attachments, subject, importance, is_cancelled, response_requested,
            is_organizer, series_master_id, weblink, online_meeting_url, is_online_meeting, join_url, allow_new_time_prop, is_draft, type, start, start_tz,
            end, end_tz, location, location_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

        sqlConnection.query(sqlEventStatment, [
            property.id,
            new Date(property.lastModifiedDateTime),
            property.iCalUId,
            property.reminderMinutesBeforeStart,
            property.isReminderOn,
            property.hasAttachments,
            property.subject ? property.subject : null,
            property.importance,
            property.isCancelled,
            property.responseRequested,
            property.isOrganizer,
            property.seriesMasterID,
            property.webLink,
            property.onlineMeetingUrl ? property.onlineMeetingUrl : null,
            property.isOnlineMeeting,
            property.onlineMeeting != null ? property.onlineMeeting.joinUrl : null,
            property.allowNewTimeProposals,
            property.isDraft,
            property.type,
            new Date(property.start.dateTime),
            property.start.startTimeZone,
            new Date(property.end.dateTime),
            property.end.endTimeZone,
            property.location.displayName ? property.location.displayName : null,
            property.location.locationType
        ], (err) => {
            if (err) {
                return console.error('event table error', err.message)
            }
        });

        let sqlLocationStatment = `INSERT INTO ${eventLocationTable} (
            event_id, location, location_uri, location_type, street, city, state, country, postal_code) VALUES (
                (SELECT id FROM ${eventTable} WHERE event_id = '${property.id}'), ?, ?, ?, ?, ?, ?, ?, ?);`;
        property.locations.forEach(function (loc) {
            sqlConnection.query(sqlLocationStatment, [
                loc.displayName,
                loc.locationUri,
                loc.locationType,
                loc.address ? loc.address.street : null,
                loc.address ? loc.address.city : null,
                loc.address ? loc.address.state : null,
                loc.address ? loc.address.countryOrRegion : null,
                loc.address ? loc.address.postalCode : null
            ], (err) => {
                if (err) {
                    return console.error('location table error', err.message);
                }
            });
        });
        let sqlAttendeeStatment = `INSERT INTO ${attendeeTable} (
            event_id, requirement, response, response_time, name, email) VALUES (
                (SELECT id FROM ${eventTable} WHERE event_id = '${property.id}'), ?, ?, ?, ?, ?);`;
        property.attendees.forEach(function (att) {
            sqlConnection.query(sqlAttendeeStatment, [
                att.type,
                att.status.response,
                new Date(att.status.time),
                att.emailAddress.name,
                att.emailAddress.address
            ], (err) => {
                if (err) {
                    return console.error('attendee table error', err.message)
                };
            });
        });
    });

    // if response contains key indicating more results are present, begin paging
    if (body.data['@odata.nextLink'] !== undefined) {
        console.log(body.data['@odata.nextLink']);
        axios.get(body.data['@odata.nextLink'], {
            headers: {
                Authorization: body.config.headers.Authorization
            }
        }, ).then(function (res) {
            processEvents(res)
        })
    } else {
        sqlConnection.end();
        console.timeEnd('test');
        process.exit();
    }
}
getAccessToken()
    .then(data => {
        var accessToken = data.access_token;
        axios.get(CONFIG.reqURL3, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
        }, ).then(function (res) {
            processEvents(res)
        })
    });