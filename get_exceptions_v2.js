const axios = require('axios').default;
const mysql = require('mysql2');
const CONFIG = require('./config_doug.json');

// start a timer
console.time('test');

// declare global variable for mySQL connection
const sqlConnection = mysql.createConnection(CONFIG.sqlConnection);

// trying new concept of pushing entire array of events to db
let events = [];

// name of db table
const tableName = 'test_exceptions';

// name of user
const userName = 'horner@mieweb.com';

// drop table if exists **TESTING ONLY**
let dropEventsTable = `DROP TABLE IF EXISTS ${tableName}`;

sqlConnection.query(dropEventsTable, function (err, results, fields) {
    if (err) {
        console.log(err.message);
    }
});

// create the table if it doesn't exist CHARACTER SET utf8 COLLATE utf8_bin
let createEventsTable = `CREATE TABLE IF NOT EXISTS ${tableName} (
    ID INT PRIMARY KEY AUTO_INCREMENT,
    EventID VARCHAR(255),
    iCalUId VARCHAR(255),
    SeriesMasterID VARCHAR(255),
    Subject VARCHAR(255),
    Type VARCHAR(255),
    Start VARCHAR(255),
    End VARCHAR(255),
    User VARCHAR(255)
    );`

sqlConnection.query(createEventsTable, function (err, results, fields) {
    if (err) {
        console.log(err.message);
    }
});

// requesting access token from ms graph
async function getAccessToken() {
    const res = await axios.post(CONFIG.tokenEndpoint, CONFIG.tokenRequest);
    return res.data;
}
// process events by extracting the values of the desired keys
// continue processing events until nextLink absent from response
function processEvents(body) {
    let bodyData = body.data;
    let bodyVals = bodyData.value;
    let filteredVals = bodyVals.map(function (vals) {
        return {
            id: vals.id,
            iCalUId: vals.iCalUId,
            seriesMasterID: vals.seriesMasterId,
            subject: vals.subject,
            type: vals.type,
            start: vals.start.dateTime,
            end: vals.end.dateTime
        }
    });
    for (let i = 0; i < filteredVals.length; i++) {
        console.log(i, filteredVals[i]);
        events.push(
            [
                filteredVals[i].id,
                filteredVals[i].iCalUId,
                filteredVals[i].seriesMasterID,
                filteredVals[i].subject,
                filteredVals[i].type,
                filteredVals[i].start,
                filteredVals[i].end,
                userName
            ]);
    };
    // console.log(filteredVals);

    // if response contains key indicating more results are present, begin paging
    if ('@odata.nextLink' in bodyData) {
        axios.get(bodyData['@odata.nextLink'], {
            headers: {
                Authorization: body.config.headers.Authorization
            }
        }, ).then(function (res) {
            processEvents(res)
        })
    } else {
        console.log(events);
        // insert events into db
        let sqlStatement = `INSERT INTO ${tableName} (EventID, iCalUId, SeriesMasterID, Subject, Type, Start, End, User) VALUES ?`;
        let query = sqlConnection.query(sqlStatement, [events], function (err, results, fields) {
            if (err) {
                console.log(err.message);
            }
        });
        sqlConnection.end();
        console.timeEnd('test');
        process.exit();
    }
}
getAccessToken()
    .then(data => {
        var accessToken = data.access_token;
        axios.get(CONFIG.exceptionURL, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
        }, ).then(function (res) {
            processEvents(res)
        })
    })