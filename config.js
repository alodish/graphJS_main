const CONFIG = require('./config.json');   

let reqUrls = {
        subscriptionURL: "https://graph.microsoft.com/v1.0/subscriptions/",
        tokenEndpoint: "https://login.microsoftonline.com/b02da655-019b-4282-9490-530ed9153fc8/oauth2/token",
        userEventsURL: "https://graph.microsoft.com/v1.0/users/{}/",
        singleEventURL: "https://graph.microsoft.com/v1.0/me/events/",
        reqURL: "https://graph.microsoft.com/v1.0/me/calendars/AAMkADEyYTAyY2YzLTI5NTAtNDI5Ni04NWQ2LWMxZWQzMjQ1NTdiYwBGAAAAAAAm5EBbdk2kQLjc8O4qX905BwCfkUvXF2nyQ5Ac5rmmjk-UAAAAAAEGAACfkUvXF2nyQ5Ac5rmmjk-UAAAC_2WgAAA=/events",
        reqURL2: "https://graph.microsoft.com/v1.0/users/horner@mieweb.com/events/?$filter=start/dateTime le '2022-05-04'&$top=1000&$select=subject,id,start,end,type",
        reqURL3: "https://graph.microsoft.com/v1.0/users/horner@mieweb.com/events?$top=999&$filter=sensitivity ne 'private'",
        exceptionURL: "https://graph.microsoft.com/v1.0/me/calendars/AAMkADEyYTAyY2YzLTI5NTAtNDI5Ni04NWQ2LWMxZWQzMjQ1NTdiYwBGAAAAAAAm5EBbdk2kQLjc8O4qX905BwCfkUvXF2nyQ5Ac5rmmjk-UAAAAAAEGAACfkUvXF2nyQ5Ac5rmmjk-UAAAC_2WgAAA=/calendarView?startDateTime=2022-05-01T19:00:00-08:00&endDateTime=2024-09-01T19:00:00-08:00"
};

// From gitignored config.json file
let secrets = {
    tokenRequest: CONFIG.tokenRequest,
    tokenBody: CONFIG.tokenBody,
    sqlConnection: CONFIG.sqlConnection
};

module.exports = CONFIG;