const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios').default;
const mysql = require('mysql2');
const CONFIG = require('./config.json');
const schedule = require('node-schedule');

//http://www.faqs.org/rfcs/rfc2822.html

// declare global variable for mySQL connection
global.sqlConnection = mysql.createConnection(CONFIG.sqlConnection);

// name of db table
const tableName = 'test_events';

// Create a new instance of express
const app = express();

// Tell express to use the body-parser middleware and to not parse extended bodies
app.use(bodyParser.urlencoded({
    extended: false
}));

// Parse application/json
app.use(bodyParser.json());

// Define function for adding days to a date
Date.prototype.addDays = function (days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date
};

// requesting access token from ms graph
async function getAccessToken() {
    const res = await axios.post(CONFIG.tokenEndpoint, CONFIG.tokenRequest);
    return res.data;
}
app.get('/subscribe', function (req, res) {console.log('hello');});
// Route that receives a POST request
app.post('/subscribe', function (req, res) {
    if ("validationToken" in req.query) {
        // Return a response containing the validation token
        res.set('Content-Type', 'application/json');
        res.send(req.query.validationToken);
    } else {
        let changeType = req.body.value[0].changeType;
        // Delete the row containing the event ID if change type == deleted
        if (changeType == 'deleted') {
            sqlConnection.query(`DELETE FROM ${tableName} WHERE EventID = '${req.body.value[0].resourceData.id}'`, function (err, results) {
                if (err) {
                    return console.error(err.message)
                } else {
                    console.log(`Deleted ${results.affectedRows} rows`);
                }
            });
        } else {
            // Retreive access token and request the event details from the Microsoft Graph API
            // Update the database with changed/ added event details
            getAccessToken().then(function (tokenResponse) {
                axios.get(CONFIG.singleEventURL + req.body.value[0].resourceData.id, {
                    headers: {
                        Authorization: `Bearer ${tokenResponse.access_token}`
                    },
                }).then(function (res) {
                    if (changeType == 'created') {
                        sqlConnection.query(`INSERT INTO ${tableName} (EventID, Subject, Type, Start, End) 
                                            VALUES ('${res.data.id}', '${res.data.subject}', '${res.data.type}', '${res.data.start.dateTime}', '${res.data.end.dateTime}')`, function (err) {
                            if (err) {
                                return console.error(err.message)
                            } else {
                                console.log('Event added to database');
                            }
                        });
                    } else if (changeType == 'updated') {
                        sqlConnection.query(`UPDATE ${tableName} 
                                            SET Subject = '${res.data.subject}', Type = '${res.data.type}', Start = '${res.data.start.dateTime}', End = '${res.data.end.dateTime}' 
                                            WHERE EventID = '${res.data.id}'`, function (err) {
                            if (err) {
                                return console.error(err.message)
                            } else {
                                console.log('Event updated in database');
                            }
                        })
                    }
                })
            })
        }
    }
})

// const job = schedule.scheduleJob('*/20 * * * *', function () {
//     console.log("Running job");
//     getAccessToken()
//     .then(data => {
//         let accessToken = data.access_token;
//         sqlConnection.query(`SELECT * FROM subscriptions`, function (err, results) {
//             if (err) {
//                 console.log(err.message);
//             } else {
//                 try {
//                     for (let i = 0; i < results.length; i++) {
//                         if (new Date().addDays(2) >= results[i].expiration) {
//                             axios.patch(CONFIG.subscriptionURL + `${results[i].sub_id}`, {
//                                 expirationDateTime: new Date().addDays(2.9).toISOString()
//                             }, {
//                                 headers: {
//                                     Authorization: `Bearer ${accessToken}`
//                                 }
//                             }).then(function (res) {
//                                 console.log(res);
//                             })
//                         }
//                     }
//                 } catch (error) {
//                     console.log(error);
//                 }
//             }
//         })
//     })
// });

// Tell our app to listen on port 5000
app.listen(5000, function (err) {
    if (err) {
        throw err
    }
    console.log('Server started on port 5000');
    getAccessToken().then(function (tokenResponse) {
        axios.post("https://graph.microsoft.com/v1.0/subscriptions", {
            changeType: "created,updated,deleted",
            notificationUrl: "https://alodish.dev.bluehive.com/subscribe",
            resource: "me/calendars/AAMkADEyYTAyY2YzLTI5NTAtNDI5Ni04NWQ2LWMxZWQzMjQ1NTdiYwBGAAAAAAAm5EBbdk2kQLjc8O4qX905BwCfkUvXF2nyQ5Ac5rmmjk-UAAAAAAEGAACfkUvXF2nyQ5Ac5rmmjk-UAAAC_2WgAAA=/events",
            expirationDateTime: "2022-06-16T12:42:18.2257768+00:00",
            lifecycleNotificationUrl: "https://alodish.dev.bluehive.com",
        }, {
            headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`
            },
        }).then(function (res) {
            console.log(res);
        })
    })
})