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

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}


function constructUrl(queryParameters = {}) {
    let sp = new URLSearchParams(queryParameters);
    const uri = `${location.protocol}//${location.host}${location.pathname}?${sp.toString()}`
    return uri
}

// grab all elements used in one go
const queryString = window.location.search;
const newEventButtonEl = document.getElementById('create')
const eventTimeEl = document.getElementById('newEvent')
const copyUrlButtonEl = document.getElementById('copyUrl')
const linkContainerEl = document.getElementById('linkContainer')
const linkEl = document.getElementById('link')
let eventDescriptionEl = document.getElementById('newEventDesc')
let url = ''

// Generate the URL on click
newEventButtonEl.addEventListener('click', function (event) {
    if (eventTimeEl.value !== '') {
        url = constructUrl({
            'date': new Date(eventTimeEl.value).toUTCString(),
            'desc': eventDescriptionEl.value
        })
        linkEl.innerHTML = `<a href="${url}">${url}</a>`
        document.getElementById('link').dataset.link = url;
        linkContainerEl.style.display = 'block';
    } else {
        throw new Error('Must select a date/time for an event.')
    }
})

// Add the copy to clipboard listener and copy action
copyUrlButtonEl.addEventListener('click', function (event) {
    copyTextToClipboard(document.getElementById('link').dataset.link)
    // navigator.clipboard.writeText(document.getElementById('link').dataset.link)
})

function setupDisplayForEvent(date, description) {
    document.getElementById('existingEventHeader').innerHTML = 'Currently Scheduled Event'
    document.getElementById('existingEventTime').innerHTML = date
    document.getElementById('eventDesc').innerText = description
    document.getElementById("countdown").style.display = "block";
    document.getElementById('existingEventTimer').style.display = 'block';
}

// Process the query string
if (queryString) {
    let searchParams = new URLSearchParams(queryString)
    let date = ''

    if (searchParams.has('date')) {
        date = new Date(searchParams.get('date'))
        setupDisplayForEvent(date, searchParams.get('desc'))
    }

    // Timer Related code
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
    }, 10)
}