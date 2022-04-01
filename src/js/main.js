require("flatpickr/dist/themes/dark.css")
import flatpickr from "flatpickr"
import '../css/main.css'

const tzEventTimer = () => {
    flatpickr('#newEvent', {
        enableTime: true,
        dateFormat: "Y-m-d H:i"
    });
};
tzEventTimer();


function getEventTime(localTimeString) {
    return new Date(localTimeString).toUTCString();
}


function constructUrl(queryParameters = {}){
    let sp = new URLSearchParams(queryParameters);
    const uri = `${location.protocol}//${location.host}:${location.port}${location.pathname}?${sp.toString()}`
    return uri
}

const newEventButton = document.getElementById('create')
newEventButton.addEventListener('click', function(event) {
    const eventTimeEl = document.getElementById('newEvent')
    if (eventTimeEl.value !== '') {
        let eventUtcTime = getEventTime(eventTimeEl.value)
        let queryParams = {
            'date': eventUtcTime
        }
        let url = constructUrl(queryParams)

        console.log({
            eventUtcTime,
            queryParams,
            url
        })
        // clientOffset.value = utcTime.toUTCString()
    } else {
        throw new Error('Must select a date/time for an event.')
    }
})
