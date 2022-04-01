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
    const uri = `${location.protocol}//${location.host}${location.pathname}?${sp.toString()}`
    return uri
}

const newEventButton = document.getElementById('create')
const clientOffset = document.getElementById('clientOffset')
newEventButton.addEventListener('click', function(event) {
    const eventTimeEl = document.getElementById('newEvent')
    if (eventTimeEl.value !== '') {
        let eventUtcTime = getEventTime(eventTimeEl.value)
        let queryParams = {
            'date': eventUtcTime
        }
        let url = constructUrl(queryParams)
        clientOffset.value = url
    } else {
        throw new Error('Must select a date/time for an event.')
    }
})

const queryString = window.location.search;
const currentEventEl = document.getElementById('existingEvent')
if (queryString) {
    let searchParams = new URLSearchParams(queryString)
    let date = ''
    if (searchParams.has('date')) {
        date = new Date(searchParams.get('date'))
    }
    currentEventEl.value = date
}