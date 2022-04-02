require("flatpickr/dist/themes/dark.css")
import flatpickr from "flatpickr"
import '../css/main.css'
import '../css/flip.css'

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

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('copied')
    });
}

const newEventButton = document.getElementById('create')
let url = ''
newEventButton.addEventListener('click', function(event) {
    const eventTimeEl = document.getElementById('newEvent')
    if (eventTimeEl.value !== '') {
        let eventUtcTime = getEventTime(eventTimeEl.value)
        let eventDescription = document.getElementById('newEventDesc').value
        let queryParams = {
            'date': eventUtcTime,
            'desc': eventDescription
        }
        url = constructUrl(queryParams)
        let linkEl = document.getElementById('link')
        linkEl.innerHTML = `<a href="${url}">${url}</a>`
        linkEl.dataset.link = url;
        document.getElementById('linkContainer').style.display = 'block';
    } else {
        throw new Error('Must select a date/time for an event.')
    }
})

const copyUrlButton = document.getElementById('copyUrl')
copyUrlButton.addEventListener('click', function(event) {
    navigator.clipboard.writeText(document.getElementById('link').dataset.link)
})


const queryString = window.location.search;
if (queryString) {
    let searchParams = new URLSearchParams(queryString)

    let date = ''

    if (searchParams.has('date')) {
        date = new Date(searchParams.get('date'))
    }

    document.getElementById('existingEventHeader').innerHTML = 'Currently Scheduled Event'
    document.getElementById('existingEventTime').innerHTML = date
    document.getElementById('eventDesc').innerText = searchParams.get('desc')

    const second = 1000,
        minute = second * 60,
        hour = minute * 60,
        day = hour * 24;

    const countDown = new Date(date).getTime()
    const cntr = setInterval(function () {

            const now = new Date().getTime(),
                distance = countDown - now;

            document.getElementById("days").innerText = Math.floor(distance / (day)),
                document.getElementById("hours").innerText = Math.floor((distance % (day)) / (hour)),
                document.getElementById("minutes").innerText = Math.floor((distance % (hour)) / (minute)),
                document.getElementById("seconds").innerText = Math.floor((distance % (minute)) / second);

            //do something later when date is reached
            if (distance < 0) {
                document.getElementById("existingEventHeader").innerText = "Event start has passed.";
                document.getElementById("countdown").style.display = "none";
                clearInterval(cntr);
            }
            //seconds
        }, 0)
}

