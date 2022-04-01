require("flatpickr/dist/themes/dark.css");
import flatpickr from "flatpickr";

const tzEventTimer = () => {
    flatpickr('#newEvent', {
        enableTime: true,
        dateFormat: "Y-m-d H:i"
    });
};
tzEventTimer();

